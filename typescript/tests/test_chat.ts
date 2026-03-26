import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Azex } from "../src/client.js";
import type { ChatCompletion } from "../src/types/chat.js";

const mockCompletion: ChatCompletion = {
  id: "chatcmpl-abc123",
  object: "chat.completion",
  created: 1711234567,
  model: "openai/gpt-4o",
  choices: [
    {
      index: 0,
      message: { role: "assistant", content: "Hello! How can I help you?" },
      finish_reason: "stop",
    },
  ],
  usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 },
};

describe("chat.completions.create", () => {
  let client: Azex;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    client = new Azex({ apiKey: "sk_test_1234", maxRetries: 0 });
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends a POST to /v1/chat/completions and returns completion", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockCompletion), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await client.chat.completions.create({
      model: "openai/gpt-4o",
      messages: [{ role: "user", content: "Hello" }],
    });

    expect(result.id).toBe("chatcmpl-abc123");
    expect(result.choices[0].message.content).toBe("Hello! How can I help you?");

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/v1/chat/completions");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("openai/gpt-4o");
    expect(body.messages[0].content).toBe("Hello");
  });

  it("sends Authorization header with Bearer token", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockCompletion), { status: 200 }),
    );

    await client.chat.completions.create({
      model: "openai/gpt-4o",
      messages: [{ role: "user", content: "Hi" }],
    });

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer sk_test_1234");
  });

  it("throws AuthenticationError on 401", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Invalid API key" }), { status: 401 }),
    );

    await expect(
      client.chat.completions.create({
        model: "openai/gpt-4o",
        messages: [{ role: "user", content: "Hi" }],
      }),
    ).rejects.toMatchObject({ name: "AuthenticationError", statusCode: 401 });
  });

  it("throws InsufficientBalanceError on 402", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Insufficient balance" }), { status: 402 }),
    );

    await expect(
      client.chat.completions.create({
        model: "openai/gpt-4o",
        messages: [{ role: "user", content: "Hi" }],
      }),
    ).rejects.toMatchObject({ name: "InsufficientBalanceError", statusCode: 402 });
  });

  it("throws RateLimitError on 429 (no retry when maxRetries=0)", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429 }),
    );

    await expect(
      client.chat.completions.create({
        model: "openai/gpt-4o",
        messages: [{ role: "user", content: "Hi" }],
      }),
    ).rejects.toMatchObject({ name: "RateLimitError", statusCode: 429 });
  });

  it("retries 429 up to maxRetries and then throws", async () => {
    const retryClient = new Azex({ apiKey: "sk_test_1234", maxRetries: 2 });

    fetchSpy
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Rate limited" }), { status: 429 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Rate limited" }), { status: 429 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify(mockCompletion), { status: 200 }));

    // Mock jitter sleep to avoid waiting
    vi.stubGlobal("setTimeout", (fn: () => void) => {
      fn();
      return 0;
    });

    const result = await retryClient.chat.completions.create({
      model: "openai/gpt-4o",
      messages: [{ role: "user", content: "Hi" }],
    });

    expect(result.id).toBe("chatcmpl-abc123");
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("throws InternalServerError on 500", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 }),
    );

    await expect(
      client.chat.completions.create({
        model: "openai/gpt-4o",
        messages: [{ role: "user", content: "Hi" }],
      }),
    ).rejects.toMatchObject({ name: "InternalServerError", statusCode: 500 });
  });
});
