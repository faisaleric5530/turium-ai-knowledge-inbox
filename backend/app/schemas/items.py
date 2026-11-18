from typing import Literal

from pydantic import BaseModel

ItemStatus = Literal["pending", "processing", "ready", "failed"]


class ItemOut(BaseModel):
    id: str
    type: Literal["note", "url"]
    title: str | None
    source_url: str | None
    status: ItemStatus
    error: str | None
    preview: str
    chunk_count: int
    created_at: str


class ItemsPage(BaseModel):
    items: list[ItemOut]
    total: int


class ChunkOut(BaseModel):
    chunk_index: int
    text: str


class ItemDetail(ItemOut):
    raw_content: str | None
    chunks: list[ChunkOut]
