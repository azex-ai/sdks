export interface TextBlock {
  type: "text";
  text: string;
}

export interface ThinkingBlock {
  type: "thinking";
  thinking: string;
  signature?: string;
}

export interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export type ContentBlock = TextBlock | ThinkingBlock | ToolUseBlock;

export interface MessageUsage {
  input_tokens: number;
  output_tokens: number;
}

export interface Message {
  id: string;
  type: "message";
  role: "assistant";
  content: ContentBlock[];
  model: string;
  stop_reason: string | null;
  stop_sequence: string | null;
  usage: MessageUsage;
}

export interface TextDelta {
  type: "text_delta";
  text: string;
}

export interface ThinkingDelta {
  type: "thinking_delta";
  thinking: string;
}

export interface InputJSONDelta {
  type: "input_json_delta";
  partial_json: string;
}

export type Delta = TextDelta | ThinkingDelta | InputJSONDelta;

export interface MessageStartEvent {
  type: "message_start";
  message: Message;
}

export interface ContentBlockStartEvent {
  type: "content_block_start";
  index: number;
  content_block: ContentBlock;
}

export interface ContentBlockDeltaEvent {
  type: "content_block_delta";
  index: number;
  delta: Delta;
}

export interface ContentBlockStopEvent {
  type: "content_block_stop";
  index: number;
}

export interface MessageDeltaEvent {
  type: "message_delta";
  delta: Record<string, unknown>;
  usage?: MessageUsage;
}

export interface MessageStopEvent {
  type: "message_stop";
}

export type MessageStreamEvent =
  | MessageStartEvent
  | ContentBlockStartEvent
  | ContentBlockDeltaEvent
  | ContentBlockStopEvent
  | MessageDeltaEvent
  | MessageStopEvent;

export interface MessageCreateParams {
  model: string;
  messages: Array<{ role: "user" | "assistant"; content: string | ContentBlock[] }>;
  max_tokens: number;
  system?: string | Array<{ type: string; text: string }>;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  stop_sequences?: string[];
  tools?: unknown[];
  tool_choice?: unknown;
  stream?: boolean;
}
