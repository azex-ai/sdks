import type { Azex } from "../client.js";
import { Stream, makeChunkParser } from "../streaming.js";
import type {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionCreateParams,
} from "../types/chat.js";

class ChatCompletions {
  constructor(private _client: Azex) {}

  async create(
    params: Omit<ChatCompletionCreateParams, "stream"> & { stream?: false },
  ): Promise<ChatCompletion>;
  async create(
    params: Omit<ChatCompletionCreateParams, "stream"> & { stream: true },
  ): Promise<Stream<ChatCompletionChunk>>;
  async create(
    params: ChatCompletionCreateParams,
  ): Promise<ChatCompletion | Stream<ChatCompletionChunk>> {
    if (params.stream) {
      return this._client.fetch<Stream<ChatCompletionChunk>>({
        method: "POST",
        path: "/v1/chat/completions",
        body: params,
        stream: true,
      });
    }
    return this._client.fetch<ChatCompletion>({
      method: "POST",
      path: "/v1/chat/completions",
      body: params,
    });
  }

  stream(
    params: Omit<ChatCompletionCreateParams, "stream">,
  ): Promise<Stream<ChatCompletionChunk>> {
    return this._client.fetch<Stream<ChatCompletionChunk>>({
      method: "POST",
      path: "/v1/chat/completions",
      body: { ...params, stream: true },
      stream: true,
    });
  }
}

export class ChatResource {
  readonly completions: ChatCompletions;

  constructor(client: Azex) {
    this.completions = new ChatCompletions(client);
  }
}
