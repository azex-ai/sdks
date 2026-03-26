export { Azex } from "./client.js";
export type { AzexConfig } from "./config.js";
export {
  AzexError,
  APIError,
  APIConnectionError,
  APITimeoutError,
  AuthenticationError,
  PermissionDeniedError,
  NotFoundError,
  InsufficientBalanceError,
  RateLimitError,
  InternalServerError,
} from "./errors.js";
export { Stream } from "./streaming.js";
export { Page } from "./pagination.js";
export type { PageData } from "./pagination.js";
export type { RequestOptions, RawResponse } from "./client.js";

// Resources
export { ChatResource } from "./resources/chat.js";
export { MessagesResource } from "./resources/messages.js";
export { CompletionsResource, type NativeCompletionParams } from "./resources/completions.js";
export { EmbeddingsResource, type EmbeddingData, type EmbeddingResponse, type EmbeddingCreateParams } from "./resources/embeddings.js";
export { ModelsResource } from "./resources/models.js";
export { KeysResource } from "./resources/keys.js";
export { BillingResource } from "./resources/billing.js";
export { UsageResource } from "./resources/usage.js";
export { DepositResource } from "./resources/deposit.js";
export { CheckoutResource } from "./resources/checkout.js";

// Types
export type { Usage } from "./types/shared.js";
export type {
  ChatMessage,
  ChatMessageContentPart,
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionChunkChoice,
  ChatCompletionChoice,
  ChatCompletionDelta,
  ChatCompletionCreateParams,
  ToolCall,
} from "./types/chat.js";
export type {
  Message,
  MessageUsage,
  ContentBlock,
  TextBlock,
  ThinkingBlock,
  ToolUseBlock,
  MessageStreamEvent,
  MessageStartEvent,
  ContentBlockStartEvent,
  ContentBlockDeltaEvent,
  ContentBlockStopEvent,
  MessageDeltaEvent,
  MessageStopEvent,
  TextDelta,
  ThinkingDelta,
  InputJSONDelta,
  Delta,
  MessageCreateParams,
} from "./types/messages.js";
export type { Model, ModelList, ModelPricing, ModelCapability } from "./types/models.js";
export type { Balance, Transaction, TransactionPage } from "./types/billing.js";
export type { UsageStats, UsageLog, UsageLogPage, ModelUsageStat } from "./types/usage.js";
export type { APIKey, APIKeyList, APIKeyCreateParams, APIKeyUpdateParams } from "./types/keys.js";
export type {
  DepositInfo,
  DepositRecord,
  ChainInfo,
  CheckoutSession,
  CheckoutCreateParams,
} from "./types/deposit.js";

export { Azex as default } from "./client.js";
