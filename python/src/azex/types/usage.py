"""Types for the usage resource."""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel


class ModelUsageStat(BaseModel):
    model: str
    request_count: int
    total_tokens: int
    prompt_tokens: int
    completion_tokens: int
    total_cost: str


class UsageStats(BaseModel):
    request_count: int
    total_tokens: int
    prompt_tokens: int
    completion_tokens: int
    total_cost: str
    by_model: List[ModelUsageStat]
    from_date: Optional[str] = None
    to_date: Optional[str] = None


class UsageLog(BaseModel):
    uid: str
    model: str
    provider: Optional[str] = None
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    cost: str
    latency_ms: Optional[int] = None
    status: str
    error: Optional[str] = None
    created_at: str
    is_stream: bool
    is_estimated: bool
