"""Tests for chat completions (sync + async)."""

from __future__ import annotations

import json

import pytest
import respx
import httpx

from azex import Azex, AsyncAzex
from azex._errors import AuthenticationError, RateLimitError, InsufficientBalanceError
from azex.types.chat import ChatCompletion


CHAT_RESPONSE = {
    "id": "chatcmpl-abc123",
    "object": "chat.completion",
    "created": 1700000000,
    "model": "openai/gpt-4o",
    "choices": [
        {
            "index": 0,
            "message": {"role": "assistant", "content": "Hello! How can I help?"},
            "finish_reason": "stop",
        }
    ],
    "usage": {"prompt_tokens": 10, "completion_tokens": 8, "total_tokens": 18},
}

STREAM_CHUNKS = [
    {"id": "chatcmpl-abc", "object": "chat.completion.chunk", "created": 1700000000, "model": "openai/gpt-4o", "choices": [{"index": 0, "delta": {"role": "assistant", "content": "Hello"}, "finish_reason": None}]},
    {"id": "chatcmpl-abc", "object": "chat.completion.chunk", "created": 1700000000, "model": "openai/gpt-4o", "choices": [{"index": 0, "delta": {"content": "!"}, "finish_reason": "stop"}]},
]


def _make_sse(chunks: list) -> str:
    lines = []
    for chunk in chunks:
        lines.append(f"data: {json.dumps(chunk)}")
        lines.append("")
    lines.append("data: [DONE]")
    lines.append("")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Sync tests
# ---------------------------------------------------------------------------


@respx.mock
def test_chat_create_sync() -> None:
    respx.post("https://api.azex.ai/v1/chat/completions").mock(
        return_value=httpx.Response(200, json=CHAT_RESPONSE)
    )
    client = Azex(api_key="test-key")
    result = client.chat.completions.create(
        model="openai/gpt-4o",
        messages=[{"role": "user", "content": "Hello"}],
    )
    assert isinstance(result, ChatCompletion)
    assert result.id == "chatcmpl-abc123"
    assert result.choices[0].message.content == "Hello! How can I help?"
    assert result.usage is not None
    assert result.usage.total_tokens == 18


@respx.mock
def test_chat_create_stream_sync() -> None:
    sse_body = _make_sse(STREAM_CHUNKS)
    respx.post("https://api.azex.ai/v1/chat/completions").mock(
        return_value=httpx.Response(
            200,
            content=sse_body.encode(),
            headers={"content-type": "text/event-stream"},
        )
    )
    client = Azex(api_key="test-key")
    stream = client.chat.completions.create(
        model="openai/gpt-4o",
        messages=[{"role": "user", "content": "Hello"}],
        stream=True,
    )
    chunks = list(stream)
    assert len(chunks) == 2
    assert chunks[0]["choices"][0]["delta"]["content"] == "Hello"
    assert chunks[1]["choices"][0]["delta"]["content"] == "!"


@respx.mock
def test_chat_401_raises_auth_error() -> None:
    respx.post("https://api.azex.ai/v1/chat/completions").mock(
        return_value=httpx.Response(401, json={"error": "invalid api key"})
    )
    client = Azex(api_key="bad-key", max_retries=0)
    with pytest.raises(AuthenticationError) as exc_info:
        client.chat.completions.create(
            model="openai/gpt-4o",
            messages=[{"role": "user", "content": "hi"}],
        )
    assert exc_info.value.status_code == 401


@respx.mock
def test_chat_402_raises_balance_error() -> None:
    respx.post("https://api.azex.ai/v1/chat/completions").mock(
        return_value=httpx.Response(402, json={"error": "insufficient balance"})
    )
    client = Azex(api_key="test-key", max_retries=0)
    with pytest.raises(InsufficientBalanceError) as exc_info:
        client.chat.completions.create(
            model="openai/gpt-4o",
            messages=[{"role": "user", "content": "hi"}],
        )
    assert exc_info.value.status_code == 402


@respx.mock
def test_chat_429_retries_then_raises() -> None:
    respx.post("https://api.azex.ai/v1/chat/completions").mock(
        return_value=httpx.Response(429, json={"error": "rate limit exceeded"})
    )
    # max_retries=1 so it tries twice total
    client = Azex(api_key="test-key", max_retries=1)
    with pytest.raises(RateLimitError):
        client.chat.completions.create(
            model="openai/gpt-4o",
            messages=[{"role": "user", "content": "hi"}],
        )
    # Should have called the endpoint 2 times (initial + 1 retry)
    assert respx.calls.call_count == 2


# ---------------------------------------------------------------------------
# Async tests
# ---------------------------------------------------------------------------


@pytest.mark.anyio
@respx.mock
async def test_chat_create_async() -> None:
    respx.post("https://api.azex.ai/v1/chat/completions").mock(
        return_value=httpx.Response(200, json=CHAT_RESPONSE)
    )
    client = AsyncAzex(api_key="test-key")
    result = await client.chat.completions.create(
        model="openai/gpt-4o",
        messages=[{"role": "user", "content": "Hello"}],
    )
    assert isinstance(result, ChatCompletion)
    assert result.id == "chatcmpl-abc123"
    await client.close()


@pytest.mark.anyio
@respx.mock
async def test_chat_401_async_raises() -> None:
    respx.post("https://api.azex.ai/v1/chat/completions").mock(
        return_value=httpx.Response(401, json={"error": "unauthorized"})
    )
    client = AsyncAzex(api_key="bad-key", max_retries=0)
    with pytest.raises(AuthenticationError):
        await client.chat.completions.create(
            model="openai/gpt-4o",
            messages=[{"role": "user", "content": "hi"}],
        )
    await client.close()
