"""Chat completions resource (OpenAI-compatible)."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, Dict, List, Optional, Union, overload

from .._streaming import Stream
from ..types.chat import ChatCompletion, ChatCompletionChunk

if TYPE_CHECKING:
    from .._client import Azex, AsyncAzex


class ChatCompletions:
    def __init__(self, client: "Azex") -> None:
        self._client = client

    def create(
        self,
        *,
        model: str,
        messages: List[Dict[str, Any]],
        stream: bool = False,
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
        top_p: Optional[float] = None,
        n: Optional[int] = None,
        stop: Optional[Union[str, List[str]]] = None,
        presence_penalty: Optional[float] = None,
        frequency_penalty: Optional[float] = None,
        user: Optional[str] = None,
        tools: Optional[List[Any]] = None,
        tool_choice: Optional[Any] = None,
        response_format: Optional[Any] = None,
        seed: Optional[int] = None,
        **kwargs: Any,
    ) -> Union[ChatCompletion, Stream[Dict[str, Any]]]:
        body: Dict[str, Any] = {"model": model, "messages": messages, "stream": stream}
        if max_tokens is not None:
            body["max_tokens"] = max_tokens
        if temperature is not None:
            body["temperature"] = temperature
        if top_p is not None:
            body["top_p"] = top_p
        if n is not None:
            body["n"] = n
        if stop is not None:
            body["stop"] = stop
        if presence_penalty is not None:
            body["presence_penalty"] = presence_penalty
        if frequency_penalty is not None:
            body["frequency_penalty"] = frequency_penalty
        if user is not None:
            body["user"] = user
        if tools is not None:
            body["tools"] = tools
        if tool_choice is not None:
            body["tool_choice"] = tool_choice
        if response_format is not None:
            body["response_format"] = response_format
        if seed is not None:
            body["seed"] = seed
        body.update(kwargs)

        if stream:
            return self._client._request_stream(
                method="POST", path="/v1/chat/completions", body=body
            )
        raw = self._client._request(method="POST", path="/v1/chat/completions", body=body)
        return ChatCompletion.model_validate(raw)

    def stream(
        self,
        *,
        model: str,
        messages: List[Dict[str, Any]],
        **kwargs: Any,
    ) -> Stream[Dict[str, Any]]:
        return self.create(model=model, messages=messages, stream=True, **kwargs)  # type: ignore[return-value]


class AsyncChatCompletions:
    def __init__(self, client: "AsyncAzex") -> None:
        self._client = client

    async def create(
        self,
        *,
        model: str,
        messages: List[Dict[str, Any]],
        stream: bool = False,
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
        top_p: Optional[float] = None,
        n: Optional[int] = None,
        stop: Optional[Union[str, List[str]]] = None,
        presence_penalty: Optional[float] = None,
        frequency_penalty: Optional[float] = None,
        user: Optional[str] = None,
        tools: Optional[List[Any]] = None,
        tool_choice: Optional[Any] = None,
        response_format: Optional[Any] = None,
        seed: Optional[int] = None,
        **kwargs: Any,
    ) -> Union[ChatCompletion, "AsyncStream[Dict[str, Any]]"]:
        from .._streaming import AsyncStream

        body: Dict[str, Any] = {"model": model, "messages": messages, "stream": stream}
        if max_tokens is not None:
            body["max_tokens"] = max_tokens
        if temperature is not None:
            body["temperature"] = temperature
        if top_p is not None:
            body["top_p"] = top_p
        if n is not None:
            body["n"] = n
        if stop is not None:
            body["stop"] = stop
        if presence_penalty is not None:
            body["presence_penalty"] = presence_penalty
        if frequency_penalty is not None:
            body["frequency_penalty"] = frequency_penalty
        if user is not None:
            body["user"] = user
        if tools is not None:
            body["tools"] = tools
        if tool_choice is not None:
            body["tool_choice"] = tool_choice
        if response_format is not None:
            body["response_format"] = response_format
        if seed is not None:
            body["seed"] = seed
        body.update(kwargs)

        if stream:
            return await self._client._request_stream(
                method="POST", path="/v1/chat/completions", body=body
            )
        raw = await self._client._request(method="POST", path="/v1/chat/completions", body=body)
        return ChatCompletion.model_validate(raw)

    async def stream(
        self,
        *,
        model: str,
        messages: List[Dict[str, Any]],
        **kwargs: Any,
    ) -> "AsyncStream[Dict[str, Any]]":
        from .._streaming import AsyncStream
        return await self.create(model=model, messages=messages, stream=True, **kwargs)  # type: ignore[return-value]


class ChatResource:
    def __init__(self, client: "Azex") -> None:
        self.completions = ChatCompletions(client)


class AsyncChatResource:
    def __init__(self, client: "AsyncAzex") -> None:
        self.completions = AsyncChatCompletions(client)
