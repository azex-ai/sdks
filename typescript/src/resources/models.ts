import type { Azex } from "../client.js";
import type { ModelList } from "../types/models.js";

export class ModelsResource {
  constructor(private _client: Azex) {}

  list(): Promise<ModelList> {
    return this._client.fetch<ModelList>({ method: "GET", path: "/v1/models" });
  }
}
