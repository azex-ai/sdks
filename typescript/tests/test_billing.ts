import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Azex } from "../src/client.js";
import type { Balance, TransactionPage } from "../src/types/billing.js";
import { Page } from "../src/pagination.js";

const mockBalance: Balance = {
  available: "1234.5678",
  locked: "50.0000",
  pending: "100.0000",
  currency: "USD",
};

const mockTransactionPage: TransactionPage = {
  items: [
    {
      uid: "txn_001",
      type: "deposit",
      amount: "100.0000",
      currency: "USD",
      description: "USDC deposit on Base",
      created_at: "2026-03-26T00:00:00Z",
    },
    {
      uid: "txn_002",
      type: "llm_consume",
      amount: "0.0023",
      currency: "USD",
      description: "openai/gpt-4o API call",
      created_at: "2026-03-26T01:00:00Z",
    },
  ],
  total: 2,
  page: 1,
  size: 20,
  pages: 1,
};

describe("billing resource", () => {
  let client: Azex;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    client = new Azex({ apiKey: "sk_test_1234", maxRetries: 0 });
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("balance() sends GET to /api/v1/billing/balance", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockBalance), { status: 200 }),
    );

    const result = await client.billing.balance();

    expect(result.available).toBe("1234.5678");
    expect(result.locked).toBe("50.0000");
    expect(result.pending).toBe("100.0000");
    expect(result.currency).toBe("USD");

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/v1/billing/balance");
    expect(init.method).toBe("GET");
  });

  it("balance() returns money as strings (not floats)", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockBalance), { status: 200 }),
    );

    const result = await client.billing.balance();

    // Money must be strings to preserve decimal precision
    expect(typeof result.available).toBe("string");
    expect(typeof result.locked).toBe("string");
    expect(typeof result.pending).toBe("string");
  });

  it("transactions() sends GET to /api/v1/billing/transactions with pagination params", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockTransactionPage), { status: 200 }),
    );

    const result = await client.billing.transactions({ page: 2, size: 10 });

    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(2);

    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/v1/billing/transactions");
    expect(url).toContain("page=2");
    expect(url).toContain("size=10");
  });

  it("transactions() defaults to page=1, size=20", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockTransactionPage), { status: 200 }),
    );

    await client.billing.transactions();

    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("page=1");
    expect(url).toContain("size=20");
  });

  it("transactions() returns correct item fields", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockTransactionPage), { status: 200 }),
    );

    const result = await client.billing.transactions();

    const deposit = result.items.find((t) => t.type === "deposit");
    expect(deposit).toBeDefined();
    expect(deposit!.amount).toBe("100.0000");
    expect(deposit!.uid).toBe("txn_001");

    const consume = result.items.find((t) => t.type === "llm_consume");
    expect(consume).toBeDefined();
    // micro-cent amounts preserved as strings
    expect(consume!.amount).toBe("0.0023");
  });

  it("throws AuthenticationError on 401", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    );

    await expect(client.billing.balance()).rejects.toMatchObject({
      name: "AuthenticationError",
      statusCode: 401,
    });
  });
});

describe("Page<T> pagination", () => {
  it("iterates all items on a single page", async () => {
    const pageData = { items: [1, 2, 3], total: 3, page: 1, size: 10, pages: 1 };
    const page = new Page(pageData);

    const collected: number[] = [];
    for await (const item of page) {
      collected.push(item);
    }
    expect(collected).toEqual([1, 2, 3]);
  });

  it("auto-pages through multiple pages", async () => {
    const page1Data = { items: ["a", "b"], total: 4, page: 1, size: 2, pages: 2 };
    const page2Data = { items: ["c", "d"], total: 4, page: 2, size: 2, pages: 2 };

    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Page(page2Data))
      .mockResolvedValue(new Page({ items: [], total: 4, page: 3, size: 2, pages: 2 }));

    const page = new Page(page1Data, fetchFn);

    const collected: string[] = [];
    for await (const item of page) {
      collected.push(item);
    }

    expect(collected).toEqual(["a", "b", "c", "d"]);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledWith(2, 2);
  });

  it("hasNextPage() returns true when more pages exist", () => {
    const page = new Page({ items: [], total: 10, page: 1, size: 5, pages: 2 });
    expect(page.hasNextPage()).toBe(true);
  });

  it("hasNextPage() returns false on last page", () => {
    const page = new Page({ items: [], total: 5, page: 2, size: 5, pages: 2 });
    expect(page.hasNextPage()).toBe(false);
  });

  it("getNextPage() returns null when no fetchPage provided", async () => {
    const page = new Page({ items: [1], total: 10, page: 1, size: 1, pages: 10 });
    const next = await page.getNextPage();
    expect(next).toBeNull();
  });
});
