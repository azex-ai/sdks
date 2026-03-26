"""Tests for SSE streaming (OpenAI and Anthropic formats)."""

from __future__ import annotations

import json
from typing import List

import pytest
import respx
import httpx

from azex import Azex
from azex._streaming import Stream, make_chunk_parser


def _make_openai_sse(chunks: list) -> bytes:
    lines = []
    for chunk in chunks:
        lines.append(f"data: {json.dumps(chunk)}")
        lines.append("")
    lines.append("data: [DONE]")
    lines.append("")
    return "\n".join(lines).encode()


def _make_anthropic_sse(events: list) -> bytes:
    lines = []
    for event in events:
        lines.append(f"event: {event['type']}")
        lines.append(f"data: {json.dumps(event)}")
        lines.append("")
    return "\n".join(lines).encode()


OPENAI_CHUNKS = [
    {
        "id": "chatcmpl-1",
        "object": "chat.completion.chunk",
        "created": 1700000000,
        "model": "openai/gpt-4o",
        "choices": [{"index": 0, "delta": {"role": "assistant", "content": "The"}, "finish_reason": None}],
    },
    {
        "id": "chatcmpl-1",
        "object": "chat.completion.chunk",
        "created": 1700000000,
        "model": "openai/gpt-4o",
        "choices": [{"index": 0, "delta": {"content": " answer"}, "finish_reason": None}],
    },
    {
        "id": "chatcmpl-1",
        "object": "chat.completion.chunk",
        "created": 1700000000,
        "model": "openai/gpt-4o",
        "choices": [{"index": 0, "delta": {"content": " is 42."}, "finish_reason": "stop"}],
    },
]

ANTHROPIC_EVENTS = [
    {"type": "message_start", "message": {
        "id": "msg_abc",
        "type": "message",
        "role": "assistant",
        "content": [],
        "model": "anthropic/claude-sonnet-4-6",
        "stop_reason": None,
        "stop_sequence": None,
        "usage": {"input_tokens": 10, "output_tokens": 0},
    }},
    {"type": "content_block_start", "index": 0, "content_block": {"type": "text", "text": ""}},
    {"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": "Hello "}},
    {"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": "world!"}},
    {"type": "content_block_stop", "index": 0},
    {"type": "message_delta", "delta": {"stop_reason": "end_turn"}, "usage": {"input_tokens": 10, "output_tokens": 5}},
    {"type": "message_stop"},
]


@respx.mock
def test_openai_stream_yields_all_chunks() -> None:
    respx.post("https://api.azex.ai/v1/chat/completions").mock(
        return_value=httpx.Response(
            200,
            content=_make_openai_sse(OPENAI_CHUNKS),
            headers={"content-type": "text/event-stream"},
        )
    )
    client = Azex(api_key="test-key")
    stream = client.chat.completions.create(
        model="openai/gpt-4o",
        messages=[{"role": "user", "content": "What is the answer?"}],
        stream=True,
    )
    chunks = list(stream)
    assert len(chunks) == 3
    texts = [c["choices"][0]["delta"].get("content", "") for c in chunks]
    assert "".join(t for t in texts if t) == "The answer is 42."


@respx.mock
def test_stream_get_final_completion() -> None:
    respx.post("https://api.azex.ai/v1/chat/completions").mock(
        return_value=httpx.Response(
            200,
            content=_make_openai_sse(OPENAI_CHUNKS),
            headers={"content-type": "text/event-stream"},
        )
    )
    client = Azex(api_key="test-key")
    stream = client.chat.completions.create(
        model="openai/gpt-4o",
        messages=[{"role": "user", "content": "hi"}],
        stream=True,
    )
    # consume
    list(stream)
    final = stream.get_final_completion()
    assert final is not None
    assert final["choices"][0]["delta"]["content"] == " is 42."


@respx.mock
def test_anthropic_stream_parses_event_types() -> None:
    respx.post("https://api.azex.ai/v1/messages").mock(
        return_value=httpx.Response(
            200,
            content=_make_anthropic_sse(ANTHROPIC_EVENTS),
            headers={"content-type": "text/event-stream"},
        )
    )
    client = Azex(api_key="test-key")
    stream = client.messages.create(
        model="anthropic/claude-sonnet-4-6",
        messages=[{"role": "user", "content": "hi"}],
        max_tokens=100,
        stream=True,
    )
    events = list(stream)
    types = [e.get("type") for e in events if isinstance(e, dict)]
    assert "content_block_delta" in types
    # Verify text was captured
    text_deltas = [
        e["delta"]["text"]
        for e in events
        if isinstance(e, dict) and e.get("type") == "content_block_delta"
    ]
    assert "".join(text_deltas) == "Hello world!"


def test_stream_cannot_be_iterated_twice() -> None:
    """Consuming a stream twice should raise RuntimeError."""
    parse = make_chunk_parser()
    # Build a minimal response
    body = b"data: {\"test\": 1}\n\ndata: [DONE]\n\n"
    response = httpx.Response(200, content=body, headers={"content-type": "text/event-stream"})
    stream: Stream = Stream(response, parse)
    list(stream)  # first consumption
    with pytest.raises(RuntimeError, match="already been consumed"):
        list(stream)


@respx.mock
def test_stream_context_manager() -> None:
    respx.post("https://api.azex.ai/v1/chat/completions").mock(
        return_value=httpx.Response(
            200,
            content=_make_openai_sse(OPENAI_CHUNKS),
            headers={"content-type": "text/event-stream"},
        )
    )
    client = Azex(api_key="test-key")
    raw_stream = client.chat.completions.create(
        model="openai/gpt-4o",
        messages=[{"role": "user", "content": "hi"}],
        stream=True,
    )
    with raw_stream as stream:
        chunks = list(stream)
    assert len(chunks) == 3
