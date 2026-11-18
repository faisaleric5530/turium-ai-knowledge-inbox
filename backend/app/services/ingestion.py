"""Ingestion: validate and save an item, then process it in the background.

Flow: create(...) saves a 'pending' item and returns its id (HTTP 202);
process(...) later fetches (URLs), chunks, embeds and stores vectors, then marks
the item 'ready' - or 'failed' with a readable error. Nothing is lost on failure.
"""

import sqlite3
import time
from urllib.parse import urldefrag

import numpy as np
import structlog
from structlog.contextvars import bound_contextvars

from app.adapters.chunker import chunk_text
from app.adapters.embedder import Embedder
from app.adapters.url_fetcher import UrlFetcher, UrlFetchError
from app.config import Settings
from app.errors import DuplicateUrlError, PayloadTooLargeError, ServiceUnavailableError
from app.repositories.items_repo import ItemsRepository
from app.repositories.vector_store import VectorStore
from app.schemas.ingest import IngestNote, IngestRequest, IngestUrl

log = structlog.get_logger(__name__)

_TITLE_FROM_NOTE_CHARS = 60
_EMBED_BATCH = 32


def _note_title(content: str) -> str:
    first_line = next((ln.strip() for ln in content.splitlines() if ln.strip()), "Untitled note")
    if len(first_line) > _TITLE_FROM_NOTE_CHARS:
        return first_line[: _TITLE_FROM_NOTE_CHARS - 1].rstrip() + "…"
    return first_line


class IngestionService:
    def __init__(
        self,
        *,
        items: ItemsRepository,
        vectors: VectorStore,
        embedder: Embedder,
        fetcher: UrlFetcher,
        settings: Settings,
    ) -> None:
        self._items = items
        self._vectors = vectors
        self._embedder = embedder
        self._fetcher = fetcher
        self._settings = settings

    def create(self, request: IngestRequest) -> str:
        """Validate, reject duplicates, and save a pending item. Returns its id."""
        if self._embedder.status != "ready":
            raise ServiceUnavailableError(
                "The embedding model is still loading. Try again in a moment (see GET /health)."
            )
        if isinstance(request, IngestNote):
            if len(request.content) > self._settings.note_max_chars:
                raise PayloadTooLargeError(
                    f"Notes are limited to {self._settings.note_max_chars:,} characters "
                    f"(got {len(request.content):,})."
                )
            return self._items.create(
                item_type="note",
                title=request.title or _note_title(request.content),
                source_url=None,
                raw_content=request.content,
            )

        assert isinstance(request, IngestUrl)
        url = urldefrag(str(request.url)).url
        existing = self._items.find_by_url(url)
        if existing is not None:
            if existing["status"] != "failed":
                raise DuplicateUrlError(
                    "That URL is already saved.",
                    details={"existing_id": existing["id"], "status": existing["status"]},
                )
            self._items.delete(existing["id"])  # a failed URL can be retried
        try:
            return self._items.create(
                item_type="url", title=request.title, source_url=url, raw_content=None
            )
        except sqlite3.IntegrityError:
            raise DuplicateUrlError("That URL is already saved.") from None

    def process(self, item_id: str, request_id: str | None = None) -> None:
        """Background task: turn a pending item into searchable chunks."""
        with bound_contextvars(request_id=request_id, item_id=item_id):
            started = time.perf_counter()
            try:
                self._process(item_id)
            except UrlFetchError as exc:
                log.warning("ingest_failed", stage="fetch", error=str(exc))
                self._fail(item_id, str(exc))
            except Exception:  # noqa: BLE001 - any failure must end as a visible 'failed' item
                log.exception("ingest_failed", stage="unexpected")
                self._fail(
                    item_id,
                    "Something went wrong while processing this item. "
                    f"Check the server logs (request id {request_id or 'n/a'}).",
                )
            else:
                log.info("ingest_done", total_ms=_ms(started))

    def _process(self, item_id: str) -> None:
        item = self._items.get(item_id)
        if item is None:
            log.warning("ingest_item_missing")
            return
        self._items.set_status(item_id, "processing")

        text = item["raw_content"]
        if item["type"] == "url":
            t = time.perf_counter()
            page = self._fetcher.fetch(item["source_url"])
            self._items.set_content(item_id, page.text, page.title)
            text = page.text
            log.info("ingest_fetched", chars=len(text), fetch_ms=_ms(t))

        t = time.perf_counter()
        chunks = chunk_text(
            text,
            max_chars=self._settings.chunk_max_chars,
            overlap_chars=self._settings.chunk_overlap_chars,
        )
        log.info("ingest_chunked", chunks=len(chunks), chunk_ms=_ms(t))
        if not chunks:
            raise UrlFetchError("There was no text to index.")

        t = time.perf_counter()
        vectors = np.vstack(
            [
                self._embedder.embed_documents(chunks[i : i + _EMBED_BATCH])
                for i in range(0, len(chunks), _EMBED_BATCH)
            ]
        )
        log.info("ingest_embedded", chunks=len(chunks), embed_ms=_ms(t))

        self._vectors.add_chunks(item_id, chunks, vectors, model=self._embedder.model_name)
        self._items.set_status(item_id, "ready")
        self._vectors.invalidate()

    def _fail(self, item_id: str, message: str) -> None:
        self._items.set_status(item_id, "failed", message)
        self._vectors.invalidate()


def _ms(started: float) -> float:
    return round((time.perf_counter() - started) * 1000, 1)
