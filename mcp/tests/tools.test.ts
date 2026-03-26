import { describe, it, expect, vi, beforeEach } from "vitest";
import { AzexClient } from "../src/client.js";
import { createAccountTools } from "../src/tools/account.js";
import { createBillingTools } from "../src/tools/billing.js";
import { createModelTools } from "../src/tools/models.js";
import { createChatTools } from "../src/tools/chat.js";
import { createKeyTools } from "../src/tools/keys.js";
import { createDepositTools } from "../src/tools/deposit.js";
import { createUsageTools } from "../src/tools/usage.js";
import { createEmbeddingTools } from "../src/tools/embeddings.js";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

function mockOk(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: () => Promise.resolve(JSON.stringify(data)),
  } as unknown as Response;
}

function mockError(status: number, body: unknown): Response {
  return {
    ok: false,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

function makeClient(): AzexClient {
  return new AzexClient("sk_test_key", "https://api.azex.ai");
}

describe("account tools", () => {
  beforeEach(() => vi.clearAllMocks());

  it("get_account returns balance and rate limits", async () => {
    const client = makeClient();
    const accountData = {
      balance: { available: "10.5000", locked: "0.0100" },
      rate_limits: { rpm: 60, tpm: 100000 },
    };
    mockFetch.mockResolvedValueOnce(mockOk(accountData));

    const tools = createAccountTools(client);
    const tool = tools.find((t) => t.name === "get_account")!;
    const result = await tool.handler({});

    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("10.5000");
    expect(result.content[0].text).toContain("rate_limits");
  });
});

describe("billing tools", () => {
  beforeEach(() => vi.clearAllMocks());

  it("get_balance returns balance breakdown", async () => {
    const client = makeClient();
    const balanceData = {
      available: "10.5000",
      locked: "0.0100",
      pending: "5.0000",
      total: "15.5100",
      currency: "USD",
    };
    mockFetch.mockResolvedValueOnce(mockOk(balanceData));

    const tools = createBillingTools(client);
    const tool = tools.find((t) => t.name === "get_balance")!;
    const result = await tool.handler({});

    expect(result.content[0].text).toContain("15.5100");
    expect(result.content[0].text).toContain("USD");
  });

  it("list_transactions passes page and size as query params", async () => {
    const client = makeClient();
    const txData = {
      data: [],
      pagination: { page: 2, size: 10, total: 0 },
    };
    mockFetch.mockResolvedValueOnce(mockOk(txData));

    const tools = createBillingTools(client);
    const tool = tools.find((t) => t.name === "list_transactions")!;
    await tool.handler({ page: 2, size: 10 });

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("page=2");
    expect(calledUrl).toContain("size=10");
  });
});

describe("model tools", () => {
  beforeEach(() => vi.clearAllMocks());

  it("list_models returns model list", async () => {
    const client = makeClient();
    const modelsData = {
      object: "list",
      data: [
        {
          id: "openai/gpt-4o",
          name: "GPT-4o",
          context_length: 128000,
          pricing: { prompt: "2.50", completion: "10.00" },
        },
      ],
    };
    mockFetch.mockResolvedValueOnce(mockOk(modelsData));

    const tools = createModelTools(client);
    const tool = tools.find((t) => t.name === "list_models")!;
    const result = await tool.handler({});

    expect(result.content[0].text).toContain("gpt-4o");
    expect(result.content[0].text).toContain("128000");
  });

  it("list_models passes capability filter", async () => {
    const client = makeClient();
    mockFetch.mockResolvedValueOnce(mockOk({ object: "list", data: [] }));

    const tools = createModelTools(client);
    const tool = tools.find((t) => t.name === "list_models")!;
    await tool.handler({ capability: "embedding" });

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("capability=embedding");
  });
});

describe("chat tools", () => {
  beforeEach(() => vi.clearAllMocks());

  it("create_chat_completion returns formatted response", async () => {
    const client = makeClient();
    const completionData = {
      id: "chatcmpl-123",
      object: "chat.completion",
      created: 1234567890,
      model: "openai/gpt-4o",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "Hello, world!" },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    };
    mockFetch.mockResolvedValueOnce(mockOk(completionData));

    const tools = createChatTools(client);
    const tool = tools.find((t) => t.name === "create_chat_completion")!;
    const result = await tool.handler({
      model: "openai/gpt-4o",
      messages: [{ role: "user", content: "Hello" }],
    });

    expect(result.content[0].text).toContain("Hello, world!");
    expect(result.content[0].text).toContain("15 total");
    expect(result.content[0].text).toContain("stop");
  });

  it("create_chat_completion handles 402 balance error", async () => {
    const client = makeClient();
    mockFetch.mockResolvedValueOnce(
      mockError(402, { message: "Insufficient balance: need $0.05, have $0.01" })
    );

    const tools = createChatTools(client);
    const tool = tools.find((t) => t.name === "create_chat_completion")!;

    // The error should be caught by the server's error handler
    await expect(
      tool.handler({ model: "openai/gpt-4o", messages: [{ role: "user", content: "Hello" }] })
    ).rejects.toThrow();
  });
});

describe("key tools", () => {
  beforeEach(() => vi.clearAllMocks());

  it("create_api_key returns key with prefix", async () => {
    const client = makeClient();
    const keyData = {
      uid: "key_abc123",
      name: "Test Key",
      api_key: "sk_live_abc123...",
      key_prefix: "sk_live_abc",
      created_at: "2024-01-01T00:00:00Z",
    };
    mockFetch.mockResolvedValueOnce(mockOk(keyData));

    const tools = createKeyTools(client);
    const tool = tools.find((t) => t.name === "create_api_key")!;
    const result = await tool.handler({ name: "Test Key" });

    expect(result.content[0].text).toContain("sk_live_abc123...");
    expect(result.content[0].text).toContain("won't be shown again");
  });

  it("list_api_keys returns key list", async () => {
    const client = makeClient();
    const keysData = [
      {
        uid: "key_abc",
        name: "My Key",
        key_prefix: "sk_live_abc",
        status: "active",
        created_at: "2024-01-01T00:00:00Z",
      },
    ];
    mockFetch.mockResolvedValueOnce(mockOk(keysData));

    const tools = createKeyTools(client);
    const tool = tools.find((t) => t.name === "list_api_keys")!;
    const result = await tool.handler({});

    expect(result.content[0].text).toContain("My Key");
    expect(result.content[0].text).toContain("active");
  });

  it("revoke_api_key calls DELETE endpoint", async () => {
    const client = makeClient();
    mockFetch.mockResolvedValueOnce(mockOk({}));

    const tools = createKeyTools(client);
    const tool = tools.find((t) => t.name === "revoke_api_key")!;
    const result = await tool.handler({ uid: "key_abc" });

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("/api/v1/keys/key_abc");
    expect(mockFetch.mock.calls[0][1].method).toBe("DELETE");
    expect(result.content[0].text).toContain("revoked");
  });
});

describe("deposit tools", () => {
  beforeEach(() => vi.clearAllMocks());

  it("get_deposit_info returns address and chains", async () => {
    const client = makeClient();
    const depositData = {
      deposit_address: "0x1234...abcd",
      chains: [{ name: "Ethereum", chain_id: 1, confirmations_required: 12 }],
      tokens: [{ symbol: "USDC", name: "USD Coin", decimals: 6 }],
      recent_deposits: [],
    };
    mockFetch.mockResolvedValueOnce(mockOk(depositData));

    const tools = createDepositTools(client);
    const tool = tools.find((t) => t.name === "get_deposit_info")!;
    const result = await tool.handler({});

    expect(result.content[0].text).toContain("0x1234...abcd");
    expect(result.content[0].text).toContain("Ethereum");
  });

  it("refresh_deposit calls POST endpoint", async () => {
    const client = makeClient();
    mockFetch.mockResolvedValueOnce(mockOk({}));

    const tools = createDepositTools(client);
    const tool = tools.find((t) => t.name === "refresh_deposit")!;
    const result = await tool.handler({});

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("/api/v1/deposit/refresh");
    expect(mockFetch.mock.calls[0][1].method).toBe("POST");
    expect(result.content[0].text).toContain("triggered");
  });
});

describe("usage tools", () => {
  beforeEach(() => vi.clearAllMocks());

  it("get_usage_stats passes from/to params", async () => {
    const client = makeClient();
    const statsData = {
      request_count: 100,
      total_tokens: 50000,
      total_cost: "0.5000",
      by_model: {},
    };
    mockFetch.mockResolvedValueOnce(mockOk(statsData));

    const tools = createUsageTools(client);
    const tool = tools.find((t) => t.name === "get_usage_stats")!;
    await tool.handler({ from: "2024-01-01", to: "2024-01-31" });

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("from=2024-01-01");
    expect(calledUrl).toContain("to=2024-01-31");
  });
});

describe("embedding tools", () => {
  beforeEach(() => vi.clearAllMocks());

  it("create_embedding returns dimension info", async () => {
    const client = makeClient();
    const embeddingData = {
      object: "list",
      data: [{ object: "embedding", embedding: Array(1536).fill(0.1), index: 0 }],
      model: "openai/text-embedding-3-small",
      usage: { prompt_tokens: 5, total_tokens: 5 },
    };
    mockFetch.mockResolvedValueOnce(mockOk(embeddingData));

    const tools = createEmbeddingTools(client);
    const tool = tools.find((t) => t.name === "create_embedding")!;
    const result = await tool.handler({ model: "openai/text-embedding-3-small", input: "Hello" });

    expect(result.content[0].text).toContain("1536");
    expect(result.content[0].text).toContain("Dimensions");
  });
});
