import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Azex } from "../src/client.js";
import type { APIKey, APIKeyList } from "../src/types/keys.js";

const mockKey: APIKey = {
  uid: "key_abc123",
  name: "prod-key",
  prefix: "sk_live_",
  status: "active",
  rpm_limit: 100,
  created_at: "2026-03-26T00:00:00Z",
  last_used_at: null,
  key: "sk_live_abc123_secret",
};

const mockKeyList: APIKeyList = {
  items: [
    { uid: "key_abc123", name: "prod-key", prefix: "sk_live_", status: "active", created_at: "2026-03-26T00:00:00Z" },
    { uid: "key_def456", name: "test-key", prefix: "sk_live_", status: "suspended", created_at: "2026-03-25T00:00:00Z" },
  ],
  total: 2,
};

describe("keys resource", () => {
  let client: Azex;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    client = new Azex({ apiKey: "sk_test_1234", maxRetries: 0 });
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("create sends POST to /api/v1/keys with params", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockKey), { status: 200 }),
    );

    const result = await client.keys.create({ name: "prod-key", rpm_limit: 100 });

    expect(result.uid).toBe("key_abc123");
    expect(result.key).toBe("sk_live_abc123_secret");

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/v1/keys");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body.name).toBe("prod-key");
    expect(body.rpm_limit).toBe(100);
  });

  it("list sends GET to /api/v1/keys", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(mockKeyList), { status: 200 }),
    );

    const result = await client.keys.list();

    expect(result.total).toBe(2);
    expect(result.items).toHaveLength(2);
    expect(result.items[0].name).toBe("prod-key");
    expect(result.items[1].status).toBe("suspended");

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/v1/keys");
    expect(init.method).toBe("GET");
  });

  it("revoke sends DELETE to /api/v1/keys/:uid", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(null, { status: 204, headers: { "Content-Length": "0" } }),
    );

    await client.keys.revoke("key_abc123");

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/v1/keys/key_abc123");
    expect(init.method).toBe("DELETE");
  });

  it("update sends PATCH to /api/v1/keys/:uid", async () => {
    const updated = { ...mockKey, name: "renamed-key", key: undefined };
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(updated), { status: 200 }),
    );

    const result = await client.keys.update("key_abc123", { name: "renamed-key" });

    expect(result.name).toBe("renamed-key");

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/v1/keys/key_abc123");
    expect(init.method).toBe("PATCH");
    const body = JSON.parse(init.body as string);
    expect(body.name).toBe("renamed-key");
  });

  it("suspend sends POST to /api/v1/keys/:uid/suspend", async () => {
    const suspended = { ...mockKey, status: "suspended" as const, key: undefined };
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(suspended), { status: 200 }),
    );

    const result = await client.keys.suspend("key_abc123");

    expect(result.status).toBe("suspended");

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/v1/keys/key_abc123/suspend");
    expect(init.method).toBe("POST");
  });

  it("resume sends POST to /api/v1/keys/:uid/resume", async () => {
    const resumed = { ...mockKey, status: "active" as const, key: undefined };
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(resumed), { status: 200 }),
    );

    const result = await client.keys.resume("key_abc123");

    expect(result.status).toBe("active");

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/v1/keys/key_abc123/resume");
    expect(init.method).toBe("POST");
  });

  it("throws NotFoundError on 404", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Key not found" }), { status: 404 }),
    );

    await expect(client.keys.revoke("nonexistent")).rejects.toMatchObject({
      name: "NotFoundError",
      statusCode: 404,
    });
  });
});
