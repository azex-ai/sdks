import type { Azex } from "../client.js";
import type { DepositInfo } from "../types/deposit.js";

export class DepositResource {
  constructor(private _client: Azex) {}

  info(): Promise<DepositInfo> {
    return this._client.fetch<DepositInfo>({ method: "GET", path: "/api/v1/deposit" });
  }

  refresh(): Promise<void> {
    return this._client.fetch<void>({ method: "POST", path: "/api/v1/deposit/refresh" });
  }
}
