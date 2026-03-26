"""Tests for messages resource (Anthropic format)."""

from __future__ import annotations

import json

import pytest
import respx
import httpx

from azex import Azex, AsyncAzex
from azex.types.messages import Message


MESSAGE_RESPONSE = {
    "id": "msg_01XFDUDYJgAACzvnptvVoYEL",
    "type": "message",
    "role": "assistant",
    "content": [{"type": "text", "text": "Hi! How can I help?"}],
    "model": "anthropic/claude-sonnet-4-6",
    "stop_reason": "end_turn",
    "stop_sequence": None,
    "usage": {"input_tokens": 25, "output_tokens": 12},
}

STREAM_EVENTS = [
    {"type": "message_start", "message": MESSAGE_RESPONSE},
    {"type": "content_block_start", "index": 0, "content_block": {"type": "text", "text": ""}},
    {"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": "Hi!"}},
    {"type": "content_block_stop", "index": 0},
    {"type": "message_delta", "delta": {"stop_reason": "end_turn"}, "usage": {"input_tokens": 25, "output_tokens": 12}},
    {"type": "message_stop"},
]


def _make_anthropic_sse(events: list) -> str:
    lines = []
    event_type_map = {
        "message_start": "message_start",
        "content_block_start": "content_block_start",
        "content_block_delta": "content_block_delta",
        "content_block_stop": "content_block_stop",
        "message_delta": "message_delta",
        "message_stop": "message_stop",
    }
    for event in events:
        evt_type = event_type_map.get(event["type"], event["type"])
        lines.append(f"event: {evt_type}")
        lines.append(f"data: {json.dumps(event)}")
        lines.append("")
    return "\n".join(lines)


@respx.mock
def test_messages_create_sync() -> None:
    respx.post("https://api.azex.ai/v1/messages").mock(
        return_value=httpx.Response(200, json=MESSAGE_RESPONSE)
    )
    client = Azex(api_key="test-key")
    result = client.messages.create(
        model="anthropic/claude-sonnet-4-6",
        messages=[{"role": "user", "content": "Hello"}],
        max_tokens=1024,
    )
    assert isinstance(result, Message)
    assert result.role == "assistant"
    assert result.content[0].type == "text"
    assert result.usage.input_tokens == 25


@respx.mock
def test_messages_create_stream_sync() -> None:
    sse_body = _make_anthropic_sse(STREAM_EVENTS)
    respx.post("https://api.azex.ai/v1/messages").mock(
        return_value=httpx.Response(
            200,
            content=sse_body.encode(),
            headers={"content-type": "text/event-stream"},
        )
    )
    client = Azex(api_key="test-key")
    stream = client.messages.create(
        model="anthropic/claude-sonnet-4-6",
        messages=[{"role": "user", "content": "Hello"}],
        max_tokens=1024,
        stream=True,
    )
    events = list(stream)
    # Should have parsed all non-empty events
    assert len(events) > 0
    # Find content_block_delta
    deltas = [e for e in events if isinstance(e, dict) and e.get("type") == "content_block_delta"]
    assert len(deltas) == 1
    assert deltas[0]["delta"]["text"] == "Hi!"


@pytest.mark.anyio
@respx.mock
async def test_messages_create_async() -> None:
    respx.post("https://api.azex.ai/v1/messages").mock(
        return_value=httpx.Response(200, json=MESSAGE_RESPONSE)
    )
    client = AsyncAzex(api_key="test-key")
    result = await client.messages.create(
        model="anthropic/claude-sonnet-4-6",
        messages=[{"role": "user", "content": "Hello"}],
        max_tokens=1024,
    )
    assert isinstance(result, Message)
    assert result.id == "msg_01XFDUDYJgAACzvnptvVoYEL"
    await client.close()


@respx.mock
def test_messages_with_system_prompt() -> None:
    respx.post("https://api.azex.ai/v1/messages").mock(
        return_value=httpx.Response(200, json=MESSAGE_RESPONSE)
    )
    client = Azex(api_key="test-key")
    result = client.messages.create(
        model="anthropic/claude-sonnet-4-6",
        messages=[{"role": "user", "content": "Hello"}],
        max_tokens=1024,
        system="You are a helpful assistant.",
    )
    assert isinstance(result, Message)
    # Verify system was sent in the request
    sent_body = json.loads(respx.calls.last.request.content)
    assert sent_body["system"] == "You are a helpful assistant."
