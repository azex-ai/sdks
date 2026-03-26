"""Tests for billing resource (balance + transactions)."""

from __future__ import annotations

import pytest
import respx
import httpx

from azex import Azex, AsyncAzex
from azex._errors import AuthenticationError
from azex._pagination import Page
from azex.types.billing import Balance, Transaction


BALANCE_FIXTURE = {
    "available": "1234.5678",
    "locked": "50.0000",
    "pending": "100.0000",
    "currency": "USD",
}

TRANSACTIONS_PAGE_1 = {
    "items": [
        {
            "uid": "txn_01",
            "type": "deposit",
            "amount": "100.0000",
            "currency": "USD",
            "description": "USDC deposit",
            "created_at": "2026-03-26T00:00:00Z",
        },
        {
            "uid": "txn_02",
            "type": "llm_cost",
            "amount": "0.0042",
            "currency": "USD",
            "description": "gpt-4o request",
            "created_at": "2026-03-26T01:00:00Z",
        },
    ],
    "total": 3,
    "page": 1,
    "size": 2,
    "pages": 2,
}

TRANSACTIONS_PAGE_2 = {
    "items": [
        {
            "uid": "txn_03",
            "type": "llm_cost",
            "amount": "0.0010",
            "currency": "USD",
            "description": "claude request",
            "created_at": "2026-03-26T02:00:00Z",
        },
    ],
    "total": 3,
    "page": 2,
    "size": 2,
    "pages": 2,
}


@respx.mock
def test_billing_balance() -> None:
    respx.get("https://api.azex.ai/api/v1/billing/balance").mock(
        return_value=httpx.Response(200, json=BALANCE_FIXTURE)
    )
    client = Azex(api_key="test-key")
    balance = client.billing.balance()
    assert isinstance(balance, Balance)
    assert balance.available == "1234.5678"
    assert balance.locked == "50.0000"
    assert balance.pending == "100.0000"
    assert balance.currency == "USD"


@respx.mock
def test_billing_balance_401() -> None:
    respx.get("https://api.azex.ai/api/v1/billing/balance").mock(
        return_value=httpx.Response(401, json={"error": "unauthorized"})
    )
    client = Azex(api_key="invalid-key", max_retries=0)
    with pytest.raises(AuthenticationError) as exc_info:
        client.billing.balance()
    assert exc_info.value.status_code == 401
    assert "unauthorized" in str(exc_info.value)


@respx.mock
def test_billing_transactions_page() -> None:
    respx.get("https://api.azex.ai/api/v1/billing/transactions").mock(
        return_value=httpx.Response(200, json=TRANSACTIONS_PAGE_1)
    )
    client = Azex(api_key="test-key")
    page = client.billing.transactions(page=1, size=2)
    assert isinstance(page, Page)
    assert page.total == 3
    assert page.page == 1
    assert page.pages == 2
    assert len(page.items) == 2
    assert isinstance(page.items[0], Transaction)
    assert page.items[0].uid == "txn_01"
    assert page.items[0].type == "deposit"
    assert page.has_next_page() is True


@respx.mock
def test_billing_transactions_auto_paging() -> None:
    respx.get("https://api.azex.ai/api/v1/billing/transactions").mock(
        side_effect=[
            httpx.Response(200, json=TRANSACTIONS_PAGE_1),
            httpx.Response(200, json=TRANSACTIONS_PAGE_2),
        ]
    )
    client = Azex(api_key="test-key")
    page = client.billing.transactions(page=1, size=2)
    all_items = list(page.auto_paging_iter())
    assert len(all_items) == 3
    assert all_items[0].uid == "txn_01"
    assert all_items[2].uid == "txn_03"


@pytest.mark.anyio
@respx.mock
async def test_billing_balance_async() -> None:
    respx.get("https://api.azex.ai/api/v1/billing/balance").mock(
        return_value=httpx.Response(200, json=BALANCE_FIXTURE)
    )
    client = AsyncAzex(api_key="test-key")
    balance = await client.billing.balance()
    assert isinstance(balance, Balance)
    assert balance.available == "1234.5678"
    await client.close()


@pytest.mark.anyio
@respx.mock
async def test_billing_transactions_async() -> None:
    respx.get("https://api.azex.ai/api/v1/billing/transactions").mock(
        return_value=httpx.Response(200, json=TRANSACTIONS_PAGE_1)
    )
    client = AsyncAzex(api_key="test-key")
    page = await client.billing.transactions(page=1, size=2)
    assert isinstance(page, Page)
    assert len(page.items) == 2
    await client.close()
