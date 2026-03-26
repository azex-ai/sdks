export interface ModelPricing {
  input_per_million: string;
  output_per_million: string;
  currency: string;
}

export interface ModelCapability {
  supports_streaming: boolean;
  supports_tools: boolean;
  supports_vision: boolean;
  supports_thinking: boolean;
  context_window?: number;
  max_output_tokens?: number;
}

export interface Model {
  id: string;
  object: "model";
  created?: number;
  owned_by?: string;
  display_name?: string;
  description?: string;
  pricing?: ModelPricing;
  capabilities?: ModelCapability;
}

export interface ModelList {
  object: "list";
  data: Model[];
}
