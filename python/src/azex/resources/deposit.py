"""Deposit resource."""

from __future__ import annotations

from typing import TYPE_CHECKING

from ..types.deposit import DepositInfo

if TYPE_CHECKING:
    from .._client import Azex, AsyncAzex


class DepositResource:
    def __init__(self, client: "Azex") -> None:
        self._client = client

    def info(self) -> DepositInfo:
        raw = self._client._request(method="GET", path="/api/v1/deposit")
        return DepositInfo.model_validate(raw)

    def refresh(self) -> None:
        self._client._request(method="POST", path="/api/v1/deposit/refresh")


class AsyncDepositResource:
    def __init__(self, client: "AsyncAzex") -> None:
        self._client = client

    async def info(self) -> DepositInfo:
        raw = await self._client._request(method="GET", path="/api/v1/deposit")
        return DepositInfo.model_validate(raw)

    async def refresh(self) -> None:
        await self._client._request(method="POST", path="/api/v1/deposit/refresh")
