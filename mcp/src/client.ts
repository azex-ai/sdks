// Lightweight HTTP client for Azex API — standalone fetch, no SDK dependency

export class AzexClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "@azex/mcp-server/0.1.0",
    };
  }

  async get<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T> {
    const url = new URL(this.baseUrl + path);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined) {
          url.searchParams.set(k, String(v));
        }
      }
    }

    const response = await this.fetchWithRetry(url.toString(), {
      method: "GET",
      headers: this.headers(),
    });

    return this.parseResponse<T>(response);
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    const url = this.baseUrl + path;

    const response = await this.fetchWithRetry(url, {
      method: "POST",
      headers: this.headers(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    return this.parseResponse<T>(response);
  }

  async delete<T>(path: string): Promise<T> {
    const url = this.baseUrl + path;

    const response = await this.fetchWithRetry(url, {
      method: "DELETE",
      headers: this.headers(),
    });

    return this.parseResponse<T>(response);
  }

  // Streaming POST — returns an async generator of SSE chunks
  async *postStream(path: string, body: unknown): AsyncGenerator<string> {
    const url = this.baseUrl + path;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        ...this.headers(),
        Accept: "text/event-stream",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new AzexApiError(response.status, text);
    }

    if (!response.body) {
      throw new Error("Response body is null");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6).trim();
          if (data && data !== "[DONE]") {
            yield data;
          }
        }
      }
    }
  }

  private async fetchWithRetry(url: string, init: RequestInit, retries = 2): Promise<Response> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, init);

        // Don't retry on client errors (4xx) — only on server errors (5xx) or network issues
        if (response.status >= 500 && attempt < retries) {
          const delay = Math.pow(2, attempt) * 500;
          await sleep(delay);
          continue;
        }

        return response;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < retries) {
          const delay = Math.pow(2, attempt) * 500;
          await sleep(delay);
        }
      }
    }

    throw lastError ?? new Error("Request failed after retries");
  }

  private async parseResponse<T>(response: Response): Promise<T> {
    const text = await response.text();

    if (!response.ok) {
      throw new AzexApiError(response.status, text);
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`Failed to parse response: ${text}`);
    }
  }
}

export class AzexApiError extends Error {
  status: number;
  body: string;

  constructor(status: number, body: string) {
    let message: string;
    try {
      const parsed = JSON.parse(body) as { message?: string; error?: string | { message?: string } };
      if (typeof parsed.error === "object" && parsed.error?.message) {
        message = parsed.error.message;
      } else if (typeof parsed.error === "string") {
        message = parsed.error;
      } else if (parsed.message) {
        message = parsed.message;
      } else {
        message = body;
      }
    } catch {
      message = body || `HTTP ${status}`;
    }

    super(message);
    this.name = "AzexApiError";
    this.status = status;
    this.body = body;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
