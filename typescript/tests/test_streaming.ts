import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Azex } from "../src/client.js";
import { Stream } from "../src/streaming.js";

function makeSseBody(lines: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const text = lines.join("\n") + "\n";
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}

function makeOpenAiSseChunks(contents: string[]): string[] {
  const lines: string[] = [];
  for (const content of contents) {
    const chunk = {
      id: "chatcmpl-123",
      object: "chat.completion.chunk",
      created: 1711234567,
      model: "openai/gpt-4o",
      choices: [{ index: 0, delta: { content }, finish_reason: null }],
    };
    lines.push(`data: ${JSON.stringify(chunk)}`);
    lines.push("");
  }
  lines.push("data: [DONE]");
  lines.push("");
  return lines;
}

function makeAnthropicSseEvents(): string[] {
  const events = [
    {
      type: "message_start",
      message: {
        id: "msg_123",
        type: "message",
        role: "assistant",
        content: [],
        model: "anthropic/claude-sonnet-4-6",
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 0 },
      },
    },
    {
      type: "content_block_start",
      index: 0,
      content_block: { type: "text", text: "" },
    },
    {
      type: "content_block_delta",
      index: 0,
      delta: { type: "text_delta", text: "Hello" },
    },
    {
      type: "content_block_delta",
      index: 0,
      delta: { type: "text_delta", text: " world" },
    },
    { type: "content_block_stop", index: 0 },
    {
      type: "message_delta",
      delta: { stop_reason: "end_turn" },
      usage: { output_tokens: 2 },
    },
    { type: "message_stop" },
  ];

  const lines: string[] = [];
  for (const event of events) {
    lines.push(`data: ${JSON.stringify(event)}`);
    lines.push("");
  }
  return lines;
}

describe("Stream (OpenAI SSE format)", () => {
  let client: Azex;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    client = new Azex({ apiKey: "sk_test_1234", maxRetries: 0 });
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("yields chunks from OpenAI SSE stream", async () => {
    const sseLines = makeOpenAiSseChunks(["Hello", " world", "!"]);
    fetchSpy.mockResolvedValueOnce(
      new Response(makeSseBody(sseLines), {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }),
    );

    const stream = await client.chat.completions.stream({
      model: "openai/gpt-4o",
      messages: [{ role: "user", content: "Hi" }],
    });

    const collected: string[] = [];
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) collected.push(content);
    }

    expect(collected).toEqual(["Hello", " world", "!"]);
  });

  it("emits text events via .on('text', ...)", async () => {
    const sseLines = makeOpenAiSseChunks(["Hi", " there"]);
    fetchSpy.mockResolvedValueOnce(
      new Response(makeSseBody(sseLines), {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }),
    );

    const stream = await client.chat.completions.stream({
      model: "openai/gpt-4o",
      messages: [{ role: "user", content: "Hello" }],
    });

    const texts: string[] = [];
    stream.on("text", (t) => texts.push(t));

    // consume the stream
    for await (const _ of stream) { /* drain */ }

    expect(texts).toEqual(["Hi", " there"]);
  });

  it("getFinalCompletion returns last chunk", async () => {
    const sseLines = makeOpenAiSseChunks(["A", "B"]);
    fetchSpy.mockResolvedValueOnce(
      new Response(makeSseBody(sseLines), {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }),
    );

    const stream = await client.chat.completions.stream({
      model: "openai/gpt-4o",
      messages: [{ role: "user", content: "Hi" }],
    });

    for await (const _ of stream) { /* drain */ }

    const final = stream.getFinalCompletion();
    expect(final).toBeDefined();
    expect(final?.choices[0]?.delta?.content).toBe("B");
  });
});

describe("Stream (Anthropic SSE format)", () => {
  let client: Azex;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    client = new Azex({ apiKey: "sk_test_1234", maxRetries: 0 });
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("yields Anthropic SSE events", async () => {
    const sseLines = makeAnthropicSseEvents();
    fetchSpy.mockResolvedValueOnce(
      new Response(makeSseBody(sseLines), {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }),
    );

    const stream = await client.messages.stream({
      model: "anthropic/claude-sonnet-4-6",
      messages: [{ role: "user", content: "Hi" }],
      max_tokens: 100,
    });

    const events: string[] = [];
    for await (const event of stream) {
      events.push(event.type);
    }

    expect(events).toContain("message_start");
    expect(events).toContain("content_block_delta");
    expect(events).toContain("message_stop");
  });

  it("emits text from Anthropic content_block_delta events", async () => {
    const sseLines = makeAnthropicSseEvents();
    fetchSpy.mockResolvedValueOnce(
      new Response(makeSseBody(sseLines), {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }),
    );

    const stream = await client.messages.stream({
      model: "anthropic/claude-sonnet-4-6",
      messages: [{ role: "user", content: "Hi" }],
      max_tokens: 100,
    });

    const texts: string[] = [];
    stream.on("text", (t) => texts.push(t));
    for await (const _ of stream) { /* drain */ }

    expect(texts).toEqual(["Hello", " world"]);
  });

  it("Stream implements AsyncIterable", () => {
    const response = new Response(makeSseBody([]), {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    });
    const stream = new Stream(response, (data) => {
      try {
        return JSON.parse(data);
      } catch {
        return null;
      }
    });
    expect(stream[Symbol.asyncIterator]).toBeDefined();
    expect(typeof stream[Symbol.asyncIterator]).toBe("function");
  });
});
