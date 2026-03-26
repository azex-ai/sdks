type TextEventHandler = (text: string) => void;
type EventHandler<T> = (chunk: T) => void;

export class Stream<T> implements AsyncIterable<T> {
  private _chunks: T[] = [];
  private _textHandlers: TextEventHandler[] = [];
  private _chunkHandlers: EventHandler<T>[] = [];
  private _response: Response;
  private _parseChunk: (data: string) => T | null;

  constructor(response: Response, parseChunk: (data: string) => T | null) {
    this._response = response;
    this._parseChunk = parseChunk;
  }

  on(event: "text", handler: TextEventHandler): this;
  on(event: "chunk", handler: EventHandler<T>): this;
  on(event: string, handler: unknown): this {
    if (event === "text") {
      this._textHandlers.push(handler as TextEventHandler);
    } else if (event === "chunk") {
      this._chunkHandlers.push(handler as EventHandler<T>);
    }
    return this;
  }

  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    if (!this._response.body) return;

    const reader = this._response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        let eventData = "";
        for (const line of lines) {
          if (line === "") {
            // end of SSE block
            if (eventData) {
              const chunk = this._parseChunk(eventData);
              if (chunk !== null) {
                this._chunks.push(chunk);
                this._chunkHandlers.forEach((h) => h(chunk));
                // emit text for OpenAI chunks
                const text = extractText(chunk);
                if (text) {
                  this._textHandlers.forEach((h) => h(text));
                }
                yield chunk;
              }
              eventData = "";
            }
          } else if (line.startsWith("data: ")) {
            eventData = line.slice(6);
          }
          // ignore event:, id:, retry: lines for now (handled in parseChunk)
        }
      }
      // flush remaining buffer
      if (buffer.trim()) {
        if (buffer.startsWith("data: ")) {
          const data = buffer.slice(6).trim();
          if (data && data !== "[DONE]") {
            const chunk = this._parseChunk(data);
            if (chunk !== null) {
              this._chunks.push(chunk);
              this._chunkHandlers.forEach((h) => h(chunk));
              yield chunk;
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  getFinalCompletion(): T | undefined {
    return this._chunks[this._chunks.length - 1];
  }

  getFinalMessage(): T | undefined {
    return this._chunks[this._chunks.length - 1];
  }
}

function extractText(chunk: unknown): string | null {
  if (typeof chunk !== "object" || chunk === null) return null;
  const c = chunk as Record<string, unknown>;

  // OpenAI format
  const choices = c["choices"];
  if (Array.isArray(choices) && choices.length > 0) {
    const delta = (choices[0] as Record<string, unknown>)["delta"];
    if (typeof delta === "object" && delta !== null) {
      const content = (delta as Record<string, unknown>)["content"];
      if (typeof content === "string") return content;
    }
  }

  // Anthropic format
  if (c["type"] === "content_block_delta") {
    const delta = c["delta"];
    if (typeof delta === "object" && delta !== null) {
      const text = (delta as Record<string, unknown>)["text"];
      if (typeof text === "string") return text;
    }
  }

  return null;
}

export function makeChunkParser<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _schema?: unknown,
): (data: string) => T | null {
  return (data: string): T | null => {
    if (data === "[DONE]") return null;
    try {
      return JSON.parse(data) as T;
    } catch {
      return null;
    }
  };
}
