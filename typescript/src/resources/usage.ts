import type { Azex } from "../client.js";
import type { UsageStats, UsageLogPage } from "../types/usage.js";

export class UsageResource {
  constructor(private _client: Azex) {}

  stats(params?: { from_date?: string; to_date?: string }): Promise<UsageStats> {
    return this._client.fetch<UsageStats>({
      method: "GET",
      path: "/api/v1/usage",
      params: {
        from: params?.from_date,
        to: params?.to_date,
      },
    });
  }

  logs(params?: { page?: number; size?: number }): Promise<UsageLogPage> {
    return this._client.fetch<UsageLogPage>({
      method: "GET",
      path: "/api/v1/usage/logs",
      params: { page: params?.page ?? 1, size: params?.size ?? 20 },
    });
  }
}
