"""API keys resource."""

from __future__ import annotations

from typing import TYPE_CHECKING, Optional

from ..types.keys import APIKey, APIKeyList

if TYPE_CHECKING:
    from .._client import Azex, AsyncAzex


class KeysResource:
    def __init__(self, client: "Azex") -> None:
        self._client = client

    def create(self, *, name: str, rpm_limit: Optional[int] = None) -> APIKey:
        body = {"name": name}
        if rpm_limit is not None:
            body["rpm_limit"] = rpm_limit  # type: ignore[assignment]
        raw = self._client._request(method="POST", path="/api/v1/keys", body=body)
        return APIKey.model_validate(raw)

    def list(self) -> APIKeyList:
        raw = self._client._request(method="GET", path="/api/v1/keys")
        return APIKeyList.model_validate(raw)

    def revoke(self, uid: str) -> None:
        self._client._request(method="DELETE", path=f"/api/v1/keys/{uid}")

    def update(self, uid: str, *, name: Optional[str] = None, rpm_limit: Optional[int] = None) -> APIKey:
        body = {}
        if name is not None:
            body["name"] = name
        if rpm_limit is not None:
            body["rpm_limit"] = rpm_limit  # type: ignore[assignment]
        raw = self._client._request(method="PATCH", path=f"/api/v1/keys/{uid}", body=body)
        return APIKey.model_validate(raw)

    def suspend(self, uid: str) -> APIKey:
        raw = self._client._request(method="POST", path=f"/api/v1/keys/{uid}/suspend")
        return APIKey.model_validate(raw)

    def resume(self, uid: str) -> APIKey:
        raw = self._client._request(method="POST", path=f"/api/v1/keys/{uid}/resume")
        return APIKey.model_validate(raw)


class AsyncKeysResource:
    def __init__(self, client: "AsyncAzex") -> None:
        self._client = client

    async def create(self, *, name: str, rpm_limit: Optional[int] = None) -> APIKey:
        body = {"name": name}
        if rpm_limit is not None:
            body["rpm_limit"] = rpm_limit  # type: ignore[assignment]
        raw = await self._client._request(method="POST", path="/api/v1/keys", body=body)
        return APIKey.model_validate(raw)

    async def list(self) -> APIKeyList:
        raw = await self._client._request(method="GET", path="/api/v1/keys")
        return APIKeyList.model_validate(raw)

    async def revoke(self, uid: str) -> None:
        await self._client._request(method="DELETE", path=f"/api/v1/keys/{uid}")

    async def update(self, uid: str, *, name: Optional[str] = None, rpm_limit: Optional[int] = None) -> APIKey:
        body = {}
        if name is not None:
            body["name"] = name
        if rpm_limit is not None:
            body["rpm_limit"] = rpm_limit  # type: ignore[assignment]
        raw = await self._client._request(method="PATCH", path=f"/api/v1/keys/{uid}", body=body)
        return APIKey.model_validate(raw)

    async def suspend(self, uid: str) -> APIKey:
        raw = await self._client._request(method="POST", path=f"/api/v1/keys/{uid}/suspend")
        return APIKey.model_validate(raw)

    async def resume(self, uid: str) -> APIKey:
        raw = await self._client._request(method="POST", path=f"/api/v1/keys/{uid}/resume")
        return APIKey.model_validate(raw)
