import type { Azex } from "../client.js";
import type { APIKey, APIKeyList, APIKeyCreateParams, APIKeyUpdateParams } from "../types/keys.js";

export class KeysResource {
  constructor(private _client: Azex) {}

  create(params: APIKeyCreateParams): Promise<APIKey> {
    return this._client.fetch<APIKey>({
      method: "POST",
      path: "/api/v1/keys",
      body: params,
    });
  }

  list(): Promise<APIKeyList> {
    return this._client.fetch<APIKeyList>({ method: "GET", path: "/api/v1/keys" });
  }

  revoke(uid: string): Promise<void> {
    return this._client.fetch<void>({
      method: "DELETE",
      path: `/api/v1/keys/${uid}`,
    });
  }

  update(uid: string, params: APIKeyUpdateParams): Promise<APIKey> {
    return this._client.fetch<APIKey>({
      method: "PATCH",
      path: `/api/v1/keys/${uid}`,
      body: params,
    });
  }

  suspend(uid: string): Promise<APIKey> {
    return this._client.fetch<APIKey>({
      method: "POST",
      path: `/api/v1/keys/${uid}/suspend`,
    });
  }

  resume(uid: string): Promise<APIKey> {
    return this._client.fetch<APIKey>({
      method: "POST",
      path: `/api/v1/keys/${uid}/resume`,
    });
  }
}
