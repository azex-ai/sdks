import type { Azex } from "../client.js";

export interface EmbeddingData {
  object: "embedding";
  index: number;
  embedding: number[];
}

export interface EmbeddingResponse {
  object: "list";
  data: EmbeddingData[];
  model: string;
  usage?: { prompt_tokens: number; total_tokens: number };
}

export interface EmbeddingCreateParams {
  model: string;
  input: string | string[] | number[] | number[][];
  encoding_format?: "float" | "base64";
  dimensions?: number;
  user?: string;
}

export class EmbeddingsResource {
  constructor(private _client: Azex) {}

  create(params: EmbeddingCreateParams): Promise<EmbeddingResponse> {
    return this._client.fetch<EmbeddingResponse>({
      method: "POST",
      path: "/v1/embeddings",
      body: params,
    });
  }
}
