"""Billing resource."""

from __future__ import annotations

from typing import TYPE_CHECKING, Optional

from .._pagination import Page
from ..types.billing import Balance, Transaction

if TYPE_CHECKING:
    from .._client import Azex, AsyncAzex


class BillingResource:
    def __init__(self, client: "Azex") -> None:
        self._client = client

    def balance(self) -> Balance:
        raw = self._client._request(method="GET", path="/api/v1/billing/balance")
        return Balance.model_validate(raw)

    def transactions(self, *, page: int = 1, size: int = 20) -> Page[Transaction]:
        return self._client._request_page(
            path="/api/v1/billing/transactions",
            params={"page": page, "size": size},
            item_factory=Transaction.model_validate,
        )


class AsyncBillingResource:
    def __init__(self, client: "AsyncAzex") -> None:
        self._client = client

    async def balance(self) -> Balance:
        raw = await self._client._request(method="GET", path="/api/v1/billing/balance")
        return Balance.model_validate(raw)

    async def transactions(self, *, page: int = 1, size: int = 20) -> Page[Transaction]:
        return await self._client._request_page(
            path="/api/v1/billing/transactions",
            params={"page": page, "size": size},
            item_factory=Transaction.model_validate,
        )
