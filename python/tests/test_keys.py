"""Tests for API key management resource."""

from __future__ import annotations

import json

import pytest
import respx
import httpx

from azex import Azex
from azex._errors import NotFoundError
from azex.types.keys import APIKey, APIKeyList


KEY_FIXTURE = {
    "uid": "key_01J8XRTN3BEH4JBC8TZJX71XGG",
    "name": "prod-key",
    "prefix": "sk_live_abc",
    "status": "active",
    "rpm_limit": 100,
    "created_at": "2026-03-26T00:00:00Z",
    "last_used_at": None,
    "key": "sk_live_abc...secretpart",
}

KEY_FIXTURE_NO_KEY = {k: v for k, v in KEY_FIXTURE.items() if k != "key"}

LIST_FIXTURE = {
    "items": [KEY_FIXTURE_NO_KEY],
    "total": 1,
}


@respx.mock
def test_keys_create() -> None:
    respx.post("https://api.azex.ai/api/v1/keys").mock(
        return_value=httpx.Response(200, json=KEY_FIXTURE)
    )
    client = Azex(api_key="test-key")
    key = client.keys.create(name="prod-key", rpm_limit=100)
    assert isinstance(key, APIKey)
    assert key.uid == "key_01J8XRTN3BEH4JBC8TZJX71XGG"
    assert key.key == "sk_live_abc...secretpart"
    assert key.status == "active"
    assert key.rpm_limit == 100

    sent = json.loads(respx.calls.last.request.content)
    assert sent["name"] == "prod-key"
    assert sent["rpm_limit"] == 100


@respx.mock
def test_keys_list() -> None:
    respx.get("https://api.azex.ai/api/v1/keys").mock(
        return_value=httpx.Response(200, json=LIST_FIXTURE)
    )
    client = Azex(api_key="test-key")
    result = client.keys.list()
    assert isinstance(result, APIKeyList)
    assert result.total == 1
    assert len(result.items) == 1
    assert result.items[0].name == "prod-key"


@respx.mock
def test_keys_revoke() -> None:
    uid = "key_01J8XRTN3BEH4JBC8TZJX71XGG"
    respx.delete(f"https://api.azex.ai/api/v1/keys/{uid}").mock(
        return_value=httpx.Response(204)
    )
    client = Azex(api_key="test-key")
    result = client.keys.revoke(uid)
    assert result is None


@respx.mock
def test_keys_update() -> None:
    uid = "key_01J8XRTN3BEH4JBC8TZJX71XGG"
    updated = {**KEY_FIXTURE_NO_KEY, "name": "renamed-key"}
    respx.patch(f"https://api.azex.ai/api/v1/keys/{uid}").mock(
        return_value=httpx.Response(200, json=updated)
    )
    client = Azex(api_key="test-key")
    key = client.keys.update(uid, name="renamed-key")
    assert key.name == "renamed-key"

    sent = json.loads(respx.calls.last.request.content)
    assert sent["name"] == "renamed-key"


@respx.mock
def test_keys_suspend() -> None:
    uid = "key_01J8XRTN3BEH4JBC8TZJX71XGG"
    suspended = {**KEY_FIXTURE_NO_KEY, "status": "suspended"}
    respx.post(f"https://api.azex.ai/api/v1/keys/{uid}/suspend").mock(
        return_value=httpx.Response(200, json=suspended)
    )
    client = Azex(api_key="test-key")
    key = client.keys.suspend(uid)
    assert key.status == "suspended"


@respx.mock
def test_keys_resume() -> None:
    uid = "key_01J8XRTN3BEH4JBC8TZJX71XGG"
    active = {**KEY_FIXTURE_NO_KEY, "status": "active"}
    respx.post(f"https://api.azex.ai/api/v1/keys/{uid}/resume").mock(
        return_value=httpx.Response(200, json=active)
    )
    client = Azex(api_key="test-key")
    key = client.keys.resume(uid)
    assert key.status == "active"


@respx.mock
def test_keys_revoke_not_found() -> None:
    uid = "nonexistent"
    respx.delete(f"https://api.azex.ai/api/v1/keys/{uid}").mock(
        return_value=httpx.Response(404, json={"error": "key not found"})
    )
    client = Azex(api_key="test-key", max_retries=0)
    with pytest.raises(NotFoundError) as exc_info:
        client.keys.revoke(uid)
    assert exc_info.value.status_code == 404


@respx.mock
def test_keys_create_without_rpm_limit() -> None:
    no_rpm = {**KEY_FIXTURE, "rpm_limit": None}
    respx.post("https://api.azex.ai/api/v1/keys").mock(
        return_value=httpx.Response(200, json=no_rpm)
    )
    client = Azex(api_key="test-key")
    key = client.keys.create(name="dev-key")
    assert key.rpm_limit is None
    # rpm_limit should NOT be in sent body
    sent = json.loads(respx.calls.last.request.content)
    assert "rpm_limit" not in sent
