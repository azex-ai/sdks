"""Types for the API keys resource."""

from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel


class APIKey(BaseModel):
    uid: str
    name: str
    prefix: str
    status: Literal["active", "suspended", "revoked"]
    rpm_limit: Optional[int] = None
    created_at: str
    last_used_at: Optional[str] = None
    # Only present on creation
    key: Optional[str] = None


class APIKeyList(BaseModel):
    items: List[APIKey]
    total: int
