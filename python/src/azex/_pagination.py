"""Pagination helpers."""

from __future__ import annotations

from typing import (
    Any,
    AsyncIterator,
    Callable,
    Awaitable,
    Generic,
    Iterator,
    List,
    Optional,
    TypeVar,
)

T = TypeVar("T")


class Page(Generic[T]):
    """A single page of results with auto-paging support."""

    items: List[T]
    total: int
    page: int
    size: int
    pages: int

    def __init__(
        self,
        items: List[T],
        total: int,
        page: int,
        size: int,
        pages: int,
        fetch_page: Optional[Callable[[int, int], "Page[T]"]] = None,
        async_fetch_page: Optional[Callable[[int, int], Awaitable["Page[T]"]]] = None,
    ) -> None:
        self.items = items
        self.total = total
        self.page = page
        self.size = size
        self.pages = pages
        self._fetch_page = fetch_page
        self._async_fetch_page = async_fetch_page

    @classmethod
    def from_dict(
        cls,
        data: Any,
        item_factory: Optional[Callable[[Any], T]] = None,
        fetch_page: Optional[Callable[[int, int], "Page[T]"]] = None,
        async_fetch_page: Optional[Callable[[int, int], Awaitable["Page[T]"]]] = None,
    ) -> "Page[T]":
        raw_items = data.get("items", [])
        items: List[T] = (
            [item_factory(i) for i in raw_items] if item_factory else raw_items
        )
        return cls(
            items=items,
            total=data.get("total", len(items)),
            page=data.get("page", 1),
            size=data.get("size", len(items)),
            pages=data.get("pages", 1),
            fetch_page=fetch_page,
            async_fetch_page=async_fetch_page,
        )

    def has_next_page(self) -> bool:
        return self.page < self.pages

    def get_next_page(self) -> Optional["Page[T]"]:
        if not self.has_next_page() or self._fetch_page is None:
            return None
        return self._fetch_page(self.page + 1, self.size)

    async def aget_next_page(self) -> Optional["Page[T]"]:
        if not self.has_next_page() or self._async_fetch_page is None:
            return None
        return await self._async_fetch_page(self.page + 1, self.size)

    def auto_paging_iter(self) -> Iterator[T]:
        """Iterate through all items across all pages (sync)."""
        current: Optional[Page[T]] = self
        while current is not None:
            yield from current.items
            current = current.get_next_page()

    async def async_auto_paging_iter(self) -> AsyncIterator[T]:
        """Iterate through all items across all pages (async)."""
        current: Optional[Page[T]] = self
        while current is not None:
            for item in current.items:
                yield item
            current = await current.aget_next_page()

    def __iter__(self) -> Iterator[T]:
        return iter(self.items)

    def __len__(self) -> int:
        return len(self.items)

    def __repr__(self) -> str:
        return (
            f"Page(page={self.page}, pages={self.pages}, "
            f"total={self.total}, items={len(self.items)})"
        )
