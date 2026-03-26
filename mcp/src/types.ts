import type { ZodTypeAny } from "zod";

// Shared types for Azex MCP Server

export interface AzexConfig {
  apiKey: string;
  baseUrl: string;
  toolsets: string[];
}

export interface ToolResult {
  content: Array<{
    type: "text";
    text: string;
  }>;
  isError?: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  toolset: string;
  inputSchema: ZodTypeAny;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (params: any) => Promise<ToolResult>;
}

// API response types

export interface AccountResponse {
  balance: {
    available: string;
    locked: string;
  };
  rate_limits: {
    rpm: number;
    tpm: number;
  };
}

export interface BalanceResponse {
  available: string;
  locked: string;
  pending: string;
  total: string;
  currency: string;
}

export interface Model {
  id: string;
  name: string;
  description?: string;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
  };
  capabilities?: string[];
}

export interface ModelsResponse {
  object: string;
  data: Model[];
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface AnthropicMessage {
  role: "user" | "assistant";
  content: string;
}

export interface MessageRequest {
  model: string;
  messages: AnthropicMessage[];
  max_tokens?: number;
  system?: string;
}

export interface MessageResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{
    type: string;
    text: string;
  }>;
  model: string;
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface EmbeddingResponse {
  object: string;
  data: Array<{
    object: string;
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export interface Transaction {
  uid: string;
  type: string;
  amount: string;
  currency: string;
  description: string;
  created_at: string;
}

export interface TransactionsResponse {
  data: Transaction[];
  pagination: {
    page: number;
    size: number;
    total: number;
  };
}

export interface UsageStats {
  request_count: number;
  total_tokens: number;
  total_cost: string;
  by_model: Record<string, {
    request_count: number;
    tokens: number;
    cost: string;
  }>;
}

export interface UsageLogsResponse {
  data: Array<{
    uid: string;
    model: string;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    cost: string;
    created_at: string;
    status: string;
  }>;
  pagination: {
    page: number;
    size: number;
    total: number;
  };
}

export interface ApiKey {
  uid: string;
  name: string;
  key_prefix: string;
  rpm_limit?: number;
  tpm_limit?: number;
  model_whitelist?: string[];
  created_at: string;
  last_used_at?: string;
  status: string;
}

export interface CreateApiKeyResponse {
  uid: string;
  name: string;
  api_key: string;
  key_prefix: string;
  created_at: string;
}

export interface DepositInfo {
  deposit_address: string;
  chains: Array<{
    name: string;
    chain_id: number;
    confirmations_required: number;
  }>;
  tokens: Array<{
    symbol: string;
    name: string;
    decimals: number;
  }>;
  recent_deposits: Array<{
    uid: string;
    amount: string;
    token: string;
    chain: string;
    tx_hash: string;
    status: string;
    created_at: string;
  }>;
}
