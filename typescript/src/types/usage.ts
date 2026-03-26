export interface ModelUsageStat {
  model: string;
  request_count: number;
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_cost: string;
}

export interface UsageStats {
  request_count: number;
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_cost: string;
  by_model: ModelUsageStat[];
  from_date?: string;
  to_date?: string;
}

export interface UsageLog {
  uid: string;
  model: string;
  provider?: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost: string;
  latency_ms?: number;
  status: string;
  error?: string;
  created_at: string;
  is_stream: boolean;
  is_estimated: boolean;
}

export interface UsageLogPage {
  items: UsageLog[];
  total: number;
  page: number;
  size: number;
  pages: number;
}
