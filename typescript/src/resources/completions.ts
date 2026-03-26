import type { Azex } from "../client.js";

export interface NativeCompletionParams {
  model: string;
  messages: Array<{ role: string; content: string }>;
  max_tokens?: number;
  temperature?: number;
  extensions?: Record<string, unknown>;
  routing_hints?: Record<string, unknown>;
  [key: string]: unknown;
}

export class CompletionsResource {
  constructor(private _client: Azex) {}

  create(params: NativeCompletionParams): Promise<unknown> {
    return this._client.fetch({
      method: "POST",
      path: "/api/v1/llm/completions",
      body: params,
    });
  }
}
