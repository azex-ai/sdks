"""Sync and async Azex clients."""

from __future__ import annotations

import random
import time
from typing import Any, Callable, Dict, Optional, TypeVar

import httpx

from ._config import AzexConfig, resolve_config
from ._errors import APIConnectionError, APIError, APITimeoutError
from ._pagination import Page
from ._streaming import AsyncStream, Stream, make_chunk_parser
from .resources.billing import AsyncBillingResource, BillingResource
from .resources.chat import AsyncChatResource, ChatResource
from .resources.checkout import AsyncCheckoutResource, CheckoutResource
from .resources.completions import AsyncCompletionsResource, CompletionsResource
from .resources.deposit import AsyncDepositResource, DepositResource
from .resources.embeddings import AsyncEmbeddingsResource, EmbeddingsResource
from .resources.keys import AsyncKeysResource, KeysResource
from .resources.messages import AsyncMessagesResource, MessagesResource
from .resources.models import AsyncModelsResource, ModelsResource
from .resources.usage import AsyncUsageResource, UsageResource

T = TypeVar("T")

_RETRY_STATUS_CODES = frozenset([429, 500, 502, 503, 504])
_SDK_VERSION = "0.1.0"


def _jitter_sleep(attempt: int) -> None:
    base = (2**attempt) * 1.0  # seconds
    jitter = random.random() * base * 0.25
    time.sleep(base + jitter)


async def _async_jitter_sleep(attempt: int) -> None:
    import asyncio

    base = (2**attempt) * 1.0
    jitter = random.random() * base * 0.25
    await asyncio.sleep(base + jitter)


# ---------------------------------------------------------------------------
# RawResponse wrapper
# ---------------------------------------------------------------------------


class RawResponse(Dict[str, Any]):
    """Dict subclass that also carries response headers."""

    def __init__(self, data: Any, headers: httpx.Headers) -> None:
        super().__init__(data if isinstance(data, dict) else {})
        self._raw_data = data
        self.headers = headers
        self.request_cost: Optional[str] = headers.get("x-request-cost")
        self.tokens_used: Optional[str] = headers.get("x-tokens-used")
        self.model_used: Optional[str] = headers.get("x-model-used")


# ---------------------------------------------------------------------------
# Sync client
# ---------------------------------------------------------------------------


class Azex:
    """Synchronous Azex API client."""

    chat: ChatResource
    messages: MessagesResource
    completions: CompletionsResource
    embeddings: EmbeddingsResource
    models: ModelsResource
    keys: KeysResource
    billing: BillingResource
    usage: UsageResource
    deposit: DepositResource
    checkout: CheckoutResource

    def __init__(
        self,
        *,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        timeout: Optional[float] = None,
        max_retries: Optional[int] = None,
    ) -> None:
        self._config = resolve_config(
            api_key=api_key,
            base_url=base_url,
            timeout=timeout,
            max_retries=max_retries,
        )
        self._http = httpx.Client(
            base_url=self._config.base_url,
            timeout=self._config.timeout,
            headers=self._default_headers(),
        )

        self.chat = ChatResource(self)
        self.messages = MessagesResource(self)
        self.completions = CompletionsResource(self)
        self.embeddings = EmbeddingsResource(self)
        self.models = ModelsResource(self)
        self.keys = KeysResource(self)
        self.billing = BillingResource(self)
        self.usage = UsageResource(self)
        self.deposit = DepositResource(self)
        self.checkout = CheckoutResource(self)

    def _default_headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self._config.api_key}",
            "Content-Type": "application/json",
            "User-Agent": f"azex-python/{_SDK_VERSION}",
        }

    def _build_url(self, path: str, params: Optional[Dict[str, Any]] = None) -> str:
        # httpx handles base_url merging; path is relative
        return path

    def _request(
        self,
        *,
        method: str,
        path: str,
        body: Optional[Any] = None,
        params: Optional[Dict[str, Any]] = None,
    ) -> Any:
        clean_params = (
            {k: v for k, v in params.items() if v is not None} if params else None
        )

        attempts = 0
        last_error: Optional[Exception] = None

        while attempts <= self._config.max_retries:
            try:
                response = self._http.request(
                    method=method,
                    url=path,
                    json=body,
                    params=clean_params,
                )
            except httpx.TimeoutException as e:
                last_error = APITimeoutError(cause=e)
                if attempts < self._config.max_retries:
                    attempts += 1
                    _jitter_sleep(attempts - 1)
                    continue
                raise last_error from e
            except httpx.RequestError as e:
                raise APIConnectionError(str(e), cause=e) from e

            if response.status_code in _RETRY_STATUS_CODES and attempts < self._config.max_retries:
                body_json = _safe_json(response)
                last_error = APIError.from_response(
                    response.status_code,
                    body_json,
                    dict(response.headers),
                )
                attempts += 1
                _jitter_sleep(attempts - 1)
                continue

            if not response.is_success:
                body_json = _safe_json(response)
                raise APIError.from_response(
                    response.status_code,
                    body_json,
                    dict(response.headers),
                )

            # 204 No Content
            if response.status_code == 204 or not response.content:
                return None

            return response.json()

        if last_error:
            raise last_error
        raise APIConnectionError("Max retries exceeded")

    def _request_stream(
        self,
        *,
        method: str,
        path: str,
        body: Optional[Any] = None,
        params: Optional[Dict[str, Any]] = None,
    ) -> Stream[Any]:
        clean_params = (
            {k: v for k, v in params.items() if v is not None} if params else None
        )
        headers = {**self._default_headers(), "Accept": "text/event-stream"}
        # Use a regular request — content is buffered; iter_lines() works on buffered content too.
        # For real production use, the response content will be streamed by httpx's transport.
        response = self._http.request(
            method=method,
            url=path,
            json=body,
            params=clean_params,
            headers=headers,
        )
        if not response.is_success:
            body_json = _safe_json(response)
            raise APIError.from_response(response.status_code, body_json, dict(response.headers))
        return Stream(response, make_chunk_parser())

    def _request_page(
        self,
        *,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        item_factory: Optional[Callable[[Any], Any]] = None,
    ) -> Page[Any]:
        raw = self._request(method="GET", path=path, params=params)

        def fetch_page(page: int, size: int) -> Page[Any]:
            new_params = {**(params or {}), "page": page, "size": size}
            return self._request_page(path=path, params=new_params, item_factory=item_factory)

        return Page.from_dict(raw, item_factory=item_factory, fetch_page=fetch_page)

    def with_raw_response(self) -> "_RawResponseMixin":
        return _RawResponseMixin(self)

    def close(self) -> None:
        self._http.close()

    def __enter__(self) -> "Azex":
        return self

    def __exit__(self, *args: Any) -> None:
        self.close()


# ---------------------------------------------------------------------------
# Async client
# ---------------------------------------------------------------------------


class AsyncAzex:
    """Asynchronous Azex API client."""

    chat: AsyncChatResource
    messages: AsyncMessagesResource
    completions: AsyncCompletionsResource
    embeddings: AsyncEmbeddingsResource
    models: AsyncModelsResource
    keys: AsyncKeysResource
    billing: AsyncBillingResource
    usage: AsyncUsageResource
    deposit: AsyncDepositResource
    checkout: AsyncCheckoutResource

    def __init__(
        self,
        *,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        timeout: Optional[float] = None,
        max_retries: Optional[int] = None,
    ) -> None:
        self._config = resolve_config(
            api_key=api_key,
            base_url=base_url,
            timeout=timeout,
            max_retries=max_retries,
        )
        self._http = httpx.AsyncClient(
            base_url=self._config.base_url,
            timeout=self._config.timeout,
            headers=self._default_headers(),
        )

        self.chat = AsyncChatResource(self)
        self.messages = AsyncMessagesResource(self)
        self.completions = AsyncCompletionsResource(self)
        self.embeddings = AsyncEmbeddingsResource(self)
        self.models = AsyncModelsResource(self)
        self.keys = AsyncKeysResource(self)
        self.billing = AsyncBillingResource(self)
        self.usage = AsyncUsageResource(self)
        self.deposit = AsyncDepositResource(self)
        self.checkout = AsyncCheckoutResource(self)

    def _default_headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self._config.api_key}",
            "Content-Type": "application/json",
            "User-Agent": f"azex-python/{_SDK_VERSION}",
        }

    async def _request(
        self,
        *,
        method: str,
        path: str,
        body: Optional[Any] = None,
        params: Optional[Dict[str, Any]] = None,
    ) -> Any:
        clean_params = (
            {k: v for k, v in params.items() if v is not None} if params else None
        )

        attempts = 0
        last_error: Optional[Exception] = None

        while attempts <= self._config.max_retries:
            try:
                response = await self._http.request(
                    method=method,
                    url=path,
                    json=body,
                    params=clean_params,
                )
            except httpx.TimeoutException as e:
                last_error = APITimeoutError(cause=e)
                if attempts < self._config.max_retries:
                    attempts += 1
                    await _async_jitter_sleep(attempts - 1)
                    continue
                raise last_error from e
            except httpx.RequestError as e:
                raise APIConnectionError(str(e), cause=e) from e

            if response.status_code in _RETRY_STATUS_CODES and attempts < self._config.max_retries:
                body_json = _safe_json(response)
                last_error = APIError.from_response(
                    response.status_code,
                    body_json,
                    dict(response.headers),
                )
                attempts += 1
                await _async_jitter_sleep(attempts - 1)
                continue

            if not response.is_success:
                body_json = _safe_json(response)
                raise APIError.from_response(
                    response.status_code,
                    body_json,
                    dict(response.headers),
                )

            if response.status_code == 204 or not response.content:
                return None

            return response.json()

        if last_error:
            raise last_error
        raise APIConnectionError("Max retries exceeded")

    async def _request_stream(
        self,
        *,
        method: str,
        path: str,
        body: Optional[Any] = None,
        params: Optional[Dict[str, Any]] = None,
    ) -> AsyncStream[Any]:
        clean_params = (
            {k: v for k, v in params.items() if v is not None} if params else None
        )
        headers = {**self._default_headers(), "Accept": "text/event-stream"}
        response = await self._http.request(
            method=method,
            url=path,
            json=body,
            params=clean_params,
            headers=headers,
        )
        if not response.is_success:
            body_json = _safe_json(response)
            raise APIError.from_response(response.status_code, body_json, dict(response.headers))
        return AsyncStream(response, make_chunk_parser())

    async def _request_page(
        self,
        *,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        item_factory: Optional[Callable[[Any], Any]] = None,
    ) -> Page[Any]:
        raw = await self._request(method="GET", path=path, params=params)

        async def async_fetch_page(page: int, size: int) -> Page[Any]:
            new_params = {**(params or {}), "page": page, "size": size}
            return await self._request_page(path=path, params=new_params, item_factory=item_factory)

        return Page.from_dict(raw, item_factory=item_factory, async_fetch_page=async_fetch_page)

    async def close(self) -> None:
        await self._http.aclose()

    async def __aenter__(self) -> "AsyncAzex":
        return self

    async def __aexit__(self, *args: Any) -> None:
        await self.close()


# ---------------------------------------------------------------------------
# Raw response mixin
# ---------------------------------------------------------------------------


class _RawResponseMixin:
    """Wraps a sync client to return RawResponse objects with headers exposed."""

    def __init__(self, client: Azex) -> None:
        self._client = client

    def request(
        self,
        *,
        method: str,
        path: str,
        body: Optional[Any] = None,
        params: Optional[Dict[str, Any]] = None,
    ) -> RawResponse:
        clean_params = (
            {k: v for k, v in params.items() if v is not None} if params else None
        )
        response = self._client._http.request(
            method=method,
            url=path,
            json=body,
            params=clean_params,
        )
        if not response.is_success:
            body_json = _safe_json(response)
            raise APIError.from_response(
                response.status_code,
                body_json,
                dict(response.headers),
            )
        data = response.json() if response.content else None
        return RawResponse(data, response.headers)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _safe_json(response: httpx.Response) -> Any:
    try:
        return response.json()
    except Exception:
        return response.text
