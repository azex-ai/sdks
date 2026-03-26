"""Checkout resource."""

from __future__ import annotations

from typing import TYPE_CHECKING, Optional

from ..types.deposit import CheckoutSession

if TYPE_CHECKING:
    from .._client import Azex, AsyncAzex


class CheckoutResource:
    def __init__(self, client: "Azex") -> None:
        self._client = client

    def create(
        self,
        *,
        chain_id: int,
        currency_id: int,
        amount: Optional[str] = None,
    ) -> CheckoutSession:
        body = {"chain_id": chain_id, "currency_id": currency_id}
        if amount is not None:
            body["amount"] = amount  # type: ignore[assignment]
        raw = self._client._request(method="POST", path="/api/v1/checkout", body=body)
        return CheckoutSession.model_validate(raw)

    def get(self, uid: str) -> CheckoutSession:
        raw = self._client._request(method="GET", path=f"/api/v1/checkout/{uid}")
        return CheckoutSession.model_validate(raw)

    def check(self, uid: str) -> CheckoutSession:
        """Alias for get() — polls current status."""
        return self.get(uid)

    def cancel(self, uid: str) -> CheckoutSession:
        raw = self._client._request(method="POST", path=f"/api/v1/checkout/{uid}/cancel")
        return CheckoutSession.model_validate(raw)


class AsyncCheckoutResource:
    def __init__(self, client: "AsyncAzex") -> None:
        self._client = client

    async def create(
        self,
        *,
        chain_id: int,
        currency_id: int,
        amount: Optional[str] = None,
    ) -> CheckoutSession:
        body = {"chain_id": chain_id, "currency_id": currency_id}
        if amount is not None:
            body["amount"] = amount  # type: ignore[assignment]
        raw = await self._client._request(method="POST", path="/api/v1/checkout", body=body)
        return CheckoutSession.model_validate(raw)

    async def get(self, uid: str) -> CheckoutSession:
        raw = await self._client._request(method="GET", path=f"/api/v1/checkout/{uid}")
        return CheckoutSession.model_validate(raw)

    async def check(self, uid: str) -> CheckoutSession:
        """Alias for get() — polls current status."""
        return await self.get(uid)

    async def cancel(self, uid: str) -> CheckoutSession:
        raw = await self._client._request(method="POST", path=f"/api/v1/checkout/{uid}/cancel")
        return CheckoutSession.model_validate(raw)
