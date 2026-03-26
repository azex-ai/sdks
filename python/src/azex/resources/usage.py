"""Usage resource."""

from __future__ import annotations

from typing import TYPE_CHECKING, Optional

from .._pagination import Page
from ..types.usage import UsageLog, UsageStats

if TYPE_CHECKING:
    from .._client import Azex, AsyncAzex


class UsageResource:
    def __init__(self, client: "Azex") -> None:
        self._client = client

    def stats(
        self,
        *,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
    ) -> UsageStats:
        params = {}
        if from_date is not None:
            params["from"] = from_date
        if to_date is not None:
            params["to"] = to_date
        raw = self._client._request(method="GET", path="/api/v1/usage", params=params)
        return UsageStats.model_validate(raw)

    def logs(self, *, page: int = 1, size: int = 20) -> Page[UsageLog]:
        return self._client._request_page(
            path="/api/v1/usage/logs",
            params={"page": page, "size": size},
            item_factory=UsageLog.model_validate,
        )


class AsyncUsageResource:
    def __init__(self, client: "AsyncAzex") -> None:
        self._client = client

    async def stats(
        self,
        *,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
    ) -> UsageStats:
        params = {}
        if from_date is not None:
            params["from"] = from_date
        if to_date is not None:
            params["to"] = to_date
        raw = await self._client._request(method="GET", path="/api/v1/usage", params=params)
        return UsageStats.model_validate(raw)

    async def logs(self, *, page: int = 1, size: int = 20) -> Page[UsageLog]:
        return await self._client._request_page(
            path="/api/v1/usage/logs",
            params={"page": page, "size": size},
            item_factory=UsageLog.model_validate,
        )
