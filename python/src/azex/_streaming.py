"""Sync and async SSE streaming helpers."""

from __future__ import annotations

import json
from typing import (
    Callable,
    Generic,
    Iterator,
    AsyncIterator,
    List,
    Optional,
    TypeVar,
)

import httpx

T = TypeVar("T")

_DONE_SENTINEL = "[DONE]"


def _extract_text(chunk: object) -> Optional[str]:
    """Extract text content from an OpenAI or Anthropic chunk."""
    if not isinstance(chunk, dict):
        return None
    # OpenAI format
    choices = chunk.get("choices")
    if isinstance(choices, list) and choices:
        delta = choices[0].get("delta") if isinstance(choices[0], dict) else None
        if isinstance(delta, dict):
            content = delta.get("content")
            if isinstance(content, str):
                return content
    # Anthropic format
    if chunk.get("type") == "content_block_delta":
        delta = chunk.get("delta")
        if isinstance(delta, dict):
            text = delta.get("text")
            if isinstance(text, str):
                return text
    return None


class Stream(Generic[T]):
    """Synchronous SSE stream — context manager + iterator."""

    def __init__(
        self,
        response: httpx.Response,
        parse_chunk: Callable[[str], Optional[T]],
    ) -> None:
        self._response = response
        self._parse_chunk = parse_chunk
        self._chunks: List[T] = []
        self._consumed = False

    # ------------------------------------------------------------------
    # Context manager
    # ------------------------------------------------------------------

    def __enter__(self) -> "Stream[T]":
        return self

    def __exit__(self, *args: object) -> None:
        self._response.close()

    # ------------------------------------------------------------------
    # Iterator
    # ------------------------------------------------------------------

    def __iter__(self) -> Iterator[T]:
        if self._consumed:
            raise RuntimeError("Stream has already been consumed")
        self._consumed = True

        event_type: Optional[str] = None
        event_data = ""

        # Split on newlines — works for both streaming and buffered responses.
        content = self._response.content.decode("utf-8", errors="replace")
        lines_iter = iter(content.splitlines())

        for raw_line in lines_iter:
            line = raw_line  # already a str from httpx
            if line == "":
                # end of SSE block — dispatch
                if event_data:
                    chunk = self._parse_chunk(event_data)
                    if chunk is not None:
                        self._chunks.append(chunk)
                        yield chunk
                event_type = None
                event_data = ""
            elif line.startswith("event:"):
                event_type = line[6:].strip()
            elif line.startswith("data:"):
                data = line[5:].strip()
                if event_type:
                    # Anthropic SSE: emit with event type attached
                    try:
                        obj = json.loads(data)
                        obj["_event"] = event_type
                        event_data = json.dumps(obj)
                    except (json.JSONDecodeError, TypeError):
                        event_data = data
                else:
                    event_data = data

        # flush any pending event_data not followed by blank line
        if event_data:
            chunk = self._parse_chunk(event_data)
            if chunk is not None:
                self._chunks.append(chunk)
                yield chunk

    # ------------------------------------------------------------------
    # Accumulators
    # ------------------------------------------------------------------

    def get_final_message(self) -> Optional[T]:
        return self._chunks[-1] if self._chunks else None

    def get_final_completion(self) -> Optional[T]:
        return self.get_final_message()


class AsyncStream(Generic[T]):
    """Asynchronous SSE stream — async context manager + async iterator."""

    def __init__(
        self,
        response: httpx.Response,
        parse_chunk: Callable[[str], Optional[T]],
    ) -> None:
        self._response = response
        self._parse_chunk = parse_chunk
        self._chunks: List[T] = []
        self._consumed = False

    # ------------------------------------------------------------------
    # Context manager
    # ------------------------------------------------------------------

    async def __aenter__(self) -> "AsyncStream[T]":
        return self

    async def __aexit__(self, *args: object) -> None:
        await self._response.aclose()

    # ------------------------------------------------------------------
    # Async iterator
    # ------------------------------------------------------------------

    async def __aiter__(self) -> AsyncIterator[T]:
        if self._consumed:
            raise RuntimeError("Stream has already been consumed")
        self._consumed = True

        event_type: Optional[str] = None
        event_data = ""

        # Use buffered content for compatibility with both real streaming and mocked responses.
        content = self._response.content.decode("utf-8", errors="replace")
        for raw_line in content.splitlines():
            line = raw_line
            if line == "":
                if event_data:
                    chunk = self._parse_chunk(event_data)
                    if chunk is not None:
                        self._chunks.append(chunk)
                        yield chunk
                event_type = None
                event_data = ""
            elif line.startswith("event:"):
                event_type = line[6:].strip()
            elif line.startswith("data:"):
                data = line[5:].strip()
                if event_type:
                    try:
                        obj = json.loads(data)
                        obj["_event"] = event_type
                        event_data = json.dumps(obj)
                    except (json.JSONDecodeError, TypeError):
                        event_data = data
                else:
                    event_data = data

        if event_data:
            chunk = self._parse_chunk(event_data)
            if chunk is not None:
                self._chunks.append(chunk)
                yield chunk

    # ------------------------------------------------------------------
    # Accumulators
    # ------------------------------------------------------------------

    def get_final_message(self) -> Optional[T]:
        return self._chunks[-1] if self._chunks else None

    def get_final_completion(self) -> Optional[T]:
        return self.get_final_message()


def make_chunk_parser(model_class: Optional[type] = None) -> Callable[[str], Optional[object]]:
    """Return a parser that deserializes JSON SSE data into dicts (or model instances)."""

    def parse(data: str) -> Optional[object]:
        if data == _DONE_SENTINEL:
            return None
        try:
            obj = json.loads(data)
        except json.JSONDecodeError:
            return None
        if model_class is not None:
            try:
                return model_class(**obj)
            except Exception:
                return obj
        return obj

    return parse
