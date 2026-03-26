import type { Azex } from "../client.js";
import type { Balance, TransactionPage } from "../types/billing.js";

export class BillingResource {
  constructor(private _client: Azex) {}

  balance(): Promise<Balance> {
    return this._client.fetch<Balance>({
      method: "GET",
      path: "/api/v1/billing/balance",
    });
  }

  transactions(params?: { page?: number; size?: number }): Promise<TransactionPage> {
    return this._client.fetch<TransactionPage>({
      method: "GET",
      path: "/api/v1/billing/transactions",
      params: { page: params?.page ?? 1, size: params?.size ?? 20 },
    });
  }
}
