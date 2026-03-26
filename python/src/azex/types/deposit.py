"""Types for the deposit and checkout resources."""

from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel


class ChainInfo(BaseModel):
    chain_id: int
    name: str
    confirmations_required: int


class DepositRecord(BaseModel):
    uid: str
    chain_id: int
    token: str
    amount: str
    tx_hash: str
    status: Literal["pending", "confirmed", "credited"]
    created_at: str
    confirmed_at: Optional[str] = None


class DepositInfo(BaseModel):
    deposit_address: str
    chains: List[ChainInfo]
    tokens: List[str]
    deposits: List[DepositRecord]


class CheckoutSession(BaseModel):
    uid: str
    chain_id: int
    currency_id: int
    amount: Optional[str] = None
    status: Literal["pending", "completed", "cancelled", "expired"]
    payment_address: Optional[str] = None
    created_at: str
    expires_at: Optional[str] = None
