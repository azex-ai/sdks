"""Configuration for the Azex SDK."""

from __future__ import annotations

import os
from dataclasses import dataclass, field


DEFAULT_BASE_URL = "https://api.azex.ai"
DEFAULT_TIMEOUT = 60.0  # seconds
DEFAULT_MAX_RETRIES = 2


@dataclass
class AzexConfig:
    api_key: str
    base_url: str = DEFAULT_BASE_URL
    timeout: float = DEFAULT_TIMEOUT
    max_retries: int = DEFAULT_MAX_RETRIES


def resolve_config(
    *,
    api_key: str | None = None,
    base_url: str | None = None,
    timeout: float | None = None,
    max_retries: int | None = None,
) -> AzexConfig:
    resolved_key = api_key or os.environ.get("AZEX_API_KEY")
    if not resolved_key:
        raise ValueError(
            "api_key is required. Pass it explicitly or set the AZEX_API_KEY environment variable."
        )

    resolved_base = (
        base_url or os.environ.get("AZEX_BASE_URL") or DEFAULT_BASE_URL
    ).rstrip("/")

    return AzexConfig(
        api_key=resolved_key,
        base_url=resolved_base,
        timeout=timeout if timeout is not None else DEFAULT_TIMEOUT,
        max_retries=max_retries if max_retries is not None else DEFAULT_MAX_RETRIES,
    )
