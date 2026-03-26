import type { Azex } from "../client.js";
import type { CheckoutSession, CheckoutCreateParams } from "../types/deposit.js";

export class CheckoutResource {
  constructor(private _client: Azex) {}

  create(params: CheckoutCreateParams): Promise<CheckoutSession> {
    return this._client.fetch<CheckoutSession>({
      method: "POST",
      path: "/api/v1/checkout",
      body: params,
    });
  }

  get(uid: string): Promise<CheckoutSession> {
    return this._client.fetch<CheckoutSession>({
      method: "GET",
      path: `/api/v1/checkout/${uid}`,
    });
  }

  /** Alias for get() — polls current status. */
  check(uid: string): Promise<CheckoutSession> {
    return this.get(uid);
  }

  cancel(uid: string): Promise<CheckoutSession> {
    return this._client.fetch<CheckoutSession>({
      method: "POST",
      path: `/api/v1/checkout/${uid}/cancel`,
    });
  }
}
