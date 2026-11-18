from typing import Annotated, Literal

from fastapi import APIRouter, Path, Query

from app.api.deps import ContainerDep
from app.errors import NotFoundError
from app.schemas.items import ChunkOut, ItemDetail, ItemOut, ItemsPage

router = APIRouter(tags=["items"])


def _to_item(row) -> ItemOut:
    return ItemOut(
        id=row["id"],
        type=row["type"],
        title=row["title"],
        source_url=row["source_url"],
        status=row["status"],
        error=row["error"],
        preview=row["preview"],
        chunk_count=row["chunk_count"],
        created_at=row["created_at"],
    )


@router.get("/items", response_model=ItemsPage)
def list_items(
    container: ContainerDep,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    status: Literal["pending", "processing", "ready", "failed"] | None = None,
):
    rows, total = container.items.list_items(limit=limit, offset=offset, status=status)
    return ItemsPage(items=[_to_item(r) for r in rows], total=total)


@router.get("/items/{item_id}", response_model=ItemDetail)
def get_item(container: ContainerDep, item_id: Annotated[str, Path(max_length=64)]):
    row = container.items.get(item_id)
    if row is None:
        raise NotFoundError(f"No item with id '{item_id}'.")
    chunks = [ChunkOut(chunk_index=c["chunk_index"], text=c["text"]) for c in container.items.get_chunks(item_id)]
    return ItemDetail(**_to_item(row).model_dump(), raw_content=row["raw_content"], chunks=chunks)
