"""Types for Anthropic-compatible messages API."""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional, Union

from pydantic import BaseModel


class TextBlock(BaseModel):
    type: Literal["text"]
    text: str


class ThinkingBlock(BaseModel):
    type: Literal["thinking"]
    thinking: str
    signature: Optional[str] = None


class ToolUseBlock(BaseModel):
    type: Literal["tool_use"]
    id: str
    name: str
    input: Dict[str, Any]


ContentBlock = Union[TextBlock, ThinkingBlock, ToolUseBlock]


class MessageUsage(BaseModel):
    input_tokens: int
    output_tokens: int


class Message(BaseModel):
    id: str
    type: Literal["message"]
    role: Literal["assistant"]
    content: List[ContentBlock]
    model: str
    stop_reason: Optional[str] = None
    stop_sequence: Optional[str] = None
    usage: MessageUsage


# --- Stream events ---

class TextDelta(BaseModel):
    type: Literal["text_delta"]
    text: str


class ThinkingDelta(BaseModel):
    type: Literal["thinking_delta"]
    thinking: str


class InputJSONDelta(BaseModel):
    type: Literal["input_json_delta"]
    partial_json: str


Delta = Union[TextDelta, ThinkingDelta, InputJSONDelta]


class MessageStartEvent(BaseModel):
    type: Literal["message_start"]
    message: Message


class ContentBlockStartEvent(BaseModel):
    type: Literal["content_block_start"]
    index: int
    content_block: ContentBlock


class ContentBlockDeltaEvent(BaseModel):
    type: Literal["content_block_delta"]
    index: int
    delta: Delta


class ContentBlockStopEvent(BaseModel):
    type: Literal["content_block_stop"]
    index: int


class MessageDeltaEvent(BaseModel):
    type: Literal["message_delta"]
    delta: Dict[str, Any]
    usage: Optional[MessageUsage] = None


class MessageStopEvent(BaseModel):
    type: Literal["message_stop"]


MessageStreamEvent = Union[
    MessageStartEvent,
    ContentBlockStartEvent,
    ContentBlockDeltaEvent,
    ContentBlockStopEvent,
    MessageDeltaEvent,
    MessageStopEvent,
]
