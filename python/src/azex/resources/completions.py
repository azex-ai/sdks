"""Native completions resource (Azex superset)."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, Dict, List, Optional

if TYPE_CHECKING:
    from .._client import Azex, AsyncAzex


class CompletionsResource:
    def __init__(self, client: "Azex") -> None:
        self._client = client

    def create(
        self,
        *,
        model: str,
        messages: List[Dict[str, Any]],
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
        extensions: Optional[Dict[str, Any]] = None,
        routing_hints: Optional[Dict[str, Any]] = None,
        **kwargs: Any,
    ) -> Any:
        body: Dict[str, Any] = {"model": model, "messages": messages}
        if max_tokens is not None:
            body["max_tokens"] = max_tokens
        if temperature is not None:
            body["temperature"] = temperature
        if extensions is not None:
            body["extensions"] = extensions
        if routing_hints is not None:
            body["routing_hints"] = routing_hints
        body.update(kwargs)
        return self._client._request(method="POST", path="/api/v1/llm/completions", body=body)


class AsyncCompletionsResource:
    def __init__(self, client: "AsyncAzex") -> None:
        self._client = client

    async def create(
        self,
        *,
        model: str,
        messages: List[Dict[str, Any]],
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
        extensions: Optional[Dict[str, Any]] = None,
        routing_hints: Optional[Dict[str, Any]] = None,
        **kwargs: Any,
    ) -> Any:
        body: Dict[str, Any] = {"model": model, "messages": messages}
        if max_tokens is not None:
            body["max_tokens"] = max_tokens
        if temperature is not None:
            body["temperature"] = temperature
        if extensions is not None:
            body["extensions"] = extensions
        if routing_hints is not None:
            body["routing_hints"] = routing_hints
        body.update(kwargs)
        return await self._client._request(method="POST", path="/api/v1/llm/completions", body=body)
