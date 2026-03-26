import type { Azex } from "../client.js";
import { Stream } from "../streaming.js";
import type { Message, MessageCreateParams, MessageStreamEvent } from "../types/messages.js";

export class MessagesResource {
  constructor(private _client: Azex) {}

  async create(params: Omit<MessageCreateParams, "stream"> & { stream?: false }): Promise<Message>;
  async create(
    params: Omit<MessageCreateParams, "stream"> & { stream: true },
  ): Promise<Stream<MessageStreamEvent>>;
  async create(
    params: MessageCreateParams,
  ): Promise<Message | Stream<MessageStreamEvent>> {
    if (params.stream) {
      return this._client.fetch<Stream<MessageStreamEvent>>({
        method: "POST",
        path: "/v1/messages",
        body: params,
        stream: true,
      });
    }
    return this._client.fetch<Message>({
      method: "POST",
      path: "/v1/messages",
      body: params,
    });
  }

  stream(
    params: Omit<MessageCreateParams, "stream">,
  ): Promise<Stream<MessageStreamEvent>> {
    return this._client.fetch<Stream<MessageStreamEvent>>({
      method: "POST",
      path: "/v1/messages",
      body: { ...params, stream: true },
      stream: true,
    });
  }
}
