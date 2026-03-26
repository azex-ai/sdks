"""Models resource."""

from __future__ import annotations

from typing import TYPE_CHECKING

from ..types.models import ModelList

if TYPE_CHECKING:
    from .._client import Azex, AsyncAzex


class ModelsResource:
    def __init__(self, client: "Azex") -> None:
        self._client = client

    def list(self) -> ModelList:
        raw = self._client._request(method="GET", path="/v1/models")
        return ModelList.model_validate(raw)


class AsyncModelsResource:
    def __init__(self, client: "AsyncAzex") -> None:
        self._client = client

    async def list(self) -> ModelList:
        raw = await self._client._request(method="GET", path="/v1/models")
        return ModelList.model_validate(raw)
