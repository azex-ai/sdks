"""Error hierarchy for the Azex SDK."""

from __future__ import annotations

from typing import Any, Dict, Optional


class AzexError(Exception):
    """Base class for all Azex SDK errors."""


class APIConnectionError(AzexError):
    """Raised when a connection to the API cannot be established."""

    def __init__(self, message: str = "Connection error", *, cause: Optional[BaseException] = None) -> None:
        super().__init__(message)
        self.__cause__ = cause


class APITimeoutError(APIConnectionError):
    """Raised when a request times out."""

    def __init__(self, *, cause: Optional[BaseException] = None) -> None:
        super().__init__("Request timed out", cause=cause)


class APIError(AzexError):
    """Raised when the API returns a non-2xx response."""

    status_code: int
    body: Any
    headers: Dict[str, str]

    def __init__(
        self,
        message: str,
        *,
        status_code: int,
        body: Any = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.body = body
        self.headers = headers or {}

    @classmethod
    def from_response(
        cls,
        status_code: int,
        body: Any,
        headers: Dict[str, str],
    ) -> "APIError":
        message = _extract_message(body, status_code)
        klass = _status_to_class(status_code)
        return klass(message, status_code=status_code, body=body, headers=headers)


class AuthenticationError(APIError):
    """Raised on HTTP 401."""


class InsufficientBalanceError(APIError):
    """Raised on HTTP 402."""


class PermissionDeniedError(APIError):
    """Raised on HTTP 403."""


class NotFoundError(APIError):
    """Raised on HTTP 404."""


class RateLimitError(APIError):
    """Raised on HTTP 429."""


class InternalServerError(APIError):
    """Raised on HTTP 5xx."""


def _status_to_class(status_code: int) -> type:
    mapping: Dict[int, type] = {
        401: AuthenticationError,
        402: InsufficientBalanceError,
        403: PermissionDeniedError,
        404: NotFoundError,
        429: RateLimitError,
    }
    if status_code in mapping:
        return mapping[status_code]
    if status_code >= 500:
        return InternalServerError
    return APIError


def _extract_message(body: Any, status_code: int) -> str:
    if isinstance(body, dict):
        for key in ("error", "message", "detail"):
            val = body.get(key)
            if isinstance(val, str):
                return val
            if isinstance(val, dict):
                nested = val.get("message") or val.get("detail")
                if isinstance(nested, str):
                    return nested
    return f"HTTP {status_code}"
