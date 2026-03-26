"""Messages resource (Anthropic-compatible)."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, Dict, List, Optional, Union

from .._streaming import Stream, AsyncStream
from ..types.messages import Message

if TYPE_CHECKING:
    from .._client import Azex, AsyncAzex


class MessagesResource:
    def __init__(self, client: "Azex") -> None:
        self._client = client

    def create(
        self,
        *,
        model: str,
        messages: List[Dict[str, Any]],
        max_tokens: int,
        system: Optional[Any] = None,
        stream: bool = False,
        temperature: Optional[float] = None,
        top_p: Optional[float] = None,
        top_k: Optional[int] = None,
        stop_sequences: Optional[List[str]] = None,
        tools: Optional[List[Any]] = None,
        tool_choice: Optional[Any] = None,
        **kwargs: Any,
    ) -> Union[Message, Stream[Dict[str, Any]]]:
        body: Dict[str, Any] = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
            "stream": stream,
        }
        if system is not None:
            body["system"] = system
        if temperature is not None:
            body["temperature"] = temperature
        if top_p is not None:
            body["top_p"] = top_p
        if top_k is not None:
            body["top_k"] = top_k
        if stop_sequences is not None:
            body["stop_sequences"] = stop_sequences
        if tools is not None:
            body["tools"] = tools
        if tool_choice is not None:
            body["tool_choice"] = tool_choice
        body.update(kwargs)

        if stream:
            return self._client._request_stream(
                method="POST", path="/v1/messages", body=body
            )
        raw = self._client._request(method="POST", path="/v1/messages", body=body)
        return Message.model_validate(raw)

    def stream(
        self,
        *,
        model: str,
        messages: List[Dict[str, Any]],
        max_tokens: int,
        **kwargs: Any,
    ) -> Stream[Dict[str, Any]]:
        return self.create(model=model, messages=messages, max_tokens=max_tokens, stream=True, **kwargs)  # type: ignore[return-value]


class AsyncMessagesResource:
    def __init__(self, client: "AsyncAzex") -> None:
        self._client = client

    async def create(
        self,
        *,
        model: str,
        messages: List[Dict[str, Any]],
        max_tokens: int,
        system: Optional[Any] = None,
        stream: bool = False,
        temperature: Optional[float] = None,
        top_p: Optional[float] = None,
        top_k: Optional[int] = None,
        stop_sequences: Optional[List[str]] = None,
        tools: Optional[List[Any]] = None,
        tool_choice: Optional[Any] = None,
        **kwargs: Any,
    ) -> Union[Message, AsyncStream[Dict[str, Any]]]:
        body: Dict[str, Any] = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
            "stream": stream,
        }
        if system is not None:
            body["system"] = system
        if temperature is not None:
            body["temperature"] = temperature
        if top_p is not None:
            body["top_p"] = top_p
        if top_k is not None:
            body["top_k"] = top_k
        if stop_sequences is not None:
            body["stop_sequences"] = stop_sequences
        if tools is not None:
            body["tools"] = tools
        if tool_choice is not None:
            body["tool_choice"] = tool_choice
        body.update(kwargs)

        if stream:
            return await self._client._request_stream(
                method="POST", path="/v1/messages", body=body
            )
        raw = await self._client._request(method="POST", path="/v1/messages", body=body)
        return Message.model_validate(raw)

    async def stream(
        self,
        *,
        model: str,
        messages: List[Dict[str, Any]],
        max_tokens: int,
        **kwargs: Any,
    ) -> AsyncStream[Dict[str, Any]]:
        return await self.create(model=model, messages=messages, max_tokens=max_tokens, stream=True, **kwargs)  # type: ignore[return-value]
