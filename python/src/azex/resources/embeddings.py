"""Embeddings resource (OpenAI-compatible)."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, Dict, List, Literal, Optional, Union

from pydantic import BaseModel

if TYPE_CHECKING:
    from .._client import Azex, AsyncAzex


class EmbeddingData(BaseModel):
    object: Literal["embedding"]
    index: int
    embedding: List[float]


class EmbeddingUsage(BaseModel):
    prompt_tokens: int
    total_tokens: int


class EmbeddingResponse(BaseModel):
    object: Literal["list"]
    data: List[EmbeddingData]
    model: str
    usage: Optional[EmbeddingUsage] = None


class EmbeddingsResource:
    def __init__(self, client: "Azex") -> None:
        self._client = client

    def create(
        self,
        *,
        model: str,
        input: Union[str, List[str], List[int], List[List[int]]],
        encoding_format: Optional[Literal["float", "base64"]] = None,
        dimensions: Optional[int] = None,
        user: Optional[str] = None,
    ) -> EmbeddingResponse:
        body: Dict[str, Any] = {"model": model, "input": input}
        if encoding_format is not None:
            body["encoding_format"] = encoding_format
        if dimensions is not None:
            body["dimensions"] = dimensions
        if user is not None:
            body["user"] = user
        raw = self._client._request(method="POST", path="/v1/embeddings", body=body)
        return EmbeddingResponse.model_validate(raw)


class AsyncEmbeddingsResource:
    def __init__(self, client: "AsyncAzex") -> None:
        self._client = client

    async def create(
        self,
        *,
        model: str,
        input: Union[str, List[str], List[int], List[List[int]]],
        encoding_format: Optional[Literal["float", "base64"]] = None,
        dimensions: Optional[int] = None,
        user: Optional[str] = None,
    ) -> EmbeddingResponse:
        body: Dict[str, Any] = {"model": model, "input": input}
        if encoding_format is not None:
            body["encoding_format"] = encoding_format
        if dimensions is not None:
            body["dimensions"] = dimensions
        if user is not None:
            body["user"] = user
        raw = await self._client._request(method="POST", path="/v1/embeddings", body=body)
        return EmbeddingResponse.model_validate(raw)
