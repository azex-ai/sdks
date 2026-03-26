"""Types for the models resource."""

from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel


class ModelPricing(BaseModel):
    input_per_million: str
    output_per_million: str
    currency: str


class ModelCapability(BaseModel):
    supports_streaming: bool
    supports_tools: bool
    supports_vision: bool
    supports_thinking: bool
    context_window: Optional[int] = None
    max_output_tokens: Optional[int] = None


class Model(BaseModel):
    id: str
    object: Literal["model"]
    created: Optional[int] = None
    owned_by: Optional[str] = None
    display_name: Optional[str] = None
    description: Optional[str] = None
    pricing: Optional[ModelPricing] = None
    capabilities: Optional[ModelCapability] = None


class ModelList(BaseModel):
    object: Literal["list"]
    data: List[Model]
