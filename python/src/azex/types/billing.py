"""Types for the billing resource."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class Balance(BaseModel):
    available: str
    locked: str
    pending: str
    currency: str


class Transaction(BaseModel):
    uid: str
    type: str
    amount: str
    currency: str
    description: Optional[str] = None
    created_at: str
    metadata: Optional[Dict[str, Any]] = None
