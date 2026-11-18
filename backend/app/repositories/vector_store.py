"""Vector storage behind a small interface.

SqliteVectorStore keeps vectors as float32 BLOBs in the chunks table and does an
exact cosine search (dot product of L2-normalised vectors) with NumPy over an
in-memory matrix. The matrix is rebuilt lazily after the data changes.

Scale note: O(n) scan and all vectors in RAM - fine to roughly 50-100k chunks.
Beyond that, implement this interface on pgvector (HNSW) or a vector database.
"""

import threading
from dataclasses import dataclass
from typing import Protocol

import numpy as np
import structlog

from app.db import Database

log = structlog.get_logger(__name__)


@dataclass(frozen=True)
class SearchHit:
    item_id: str
    title: str | None
    source_url: str | None
    chunk_index: int
    text: str
    score: float


class VectorStore(Protocol):
    def add_chunks(
        self, item_id: str, texts: list[str], vectors: np.ndarray, *, model: str
    ) -> None: ...

    def search(self, query_vector: np.ndarray, top_k: int) -> list[SearchHit]: ...

    def invalidate(self) -> None: ...


class SqliteVectorStore:
    def __init__(self, db: Database, model: str) -> None:
        self._db = db
        self._model = model
        self._lock = threading.Lock()
        self._matrix: np.ndarray | None = None
        self._meta: list[tuple[str, str | None, str | None, int, str]] = []

    def add_chunks(
        self, item_id: str, texts: list[str], vectors: np.ndarray, *, model: str
    ) -> None:
        if len(texts) != len(vectors):
            raise ValueError("texts and vectors must have the same length")
        dim = int(vectors.shape[1]) if len(vectors) else 0
        rows = [
            (item_id, index, text, vectors[index].astype(np.float32).tobytes(), model, dim)
            for index, text in enumerate(texts)
        ]
        with self._db.transaction() as conn:
            conn.execute("DELETE FROM chunks WHERE item_id = ?", (item_id,))
            conn.executemany(
                "INSERT INTO chunks (item_id, chunk_index, text, embedding, embedding_model, embedding_dim)"
                " VALUES (?, ?, ?, ?, ?, ?)",
                rows,
            )

    def invalidate(self) -> None:
        """Call after items become ready/failed or are deleted; next search reloads."""
        with self._lock:
            self._matrix = None

    def search(self, query_vector: np.ndarray, top_k: int) -> list[SearchHit]:
        matrix, meta = self._snapshot()
        if matrix is None or len(meta) == 0:
            return []
        scores = matrix @ query_vector.astype(np.float32)
        k = min(top_k, len(scores))
        top = np.argpartition(-scores, k - 1)[:k]
        top = top[np.argsort(-scores[top])]
        return [
            SearchHit(
                item_id=meta[i][0],
                title=meta[i][1],
                source_url=meta[i][2],
                chunk_index=meta[i][3],
                text=meta[i][4],
                score=float(scores[i]),
            )
            for i in top
        ]

    def _snapshot(self):
        with self._lock:
            if self._matrix is None:
                self._reload()
            return self._matrix, self._meta

    def _reload(self) -> None:
        with self._db.connection() as conn:
            rows = conn.execute(
                "SELECT c.item_id, i.title, i.source_url, c.chunk_index, c.text, c.embedding"
                " FROM chunks c JOIN items i ON i.id = c.item_id"
                " WHERE i.status = 'ready' AND c.embedding_model = ?",
                (self._model,),
            ).fetchall()
            stale = conn.execute(
                "SELECT COUNT(*) FROM chunks c JOIN items i ON i.id = c.item_id"
                " WHERE i.status = 'ready' AND c.embedding_model != ?",
                (self._model,),
            ).fetchone()[0]
        if stale:
            log.warning(
                "chunks_ignored_model_mismatch", count=stale, current_model=self._model,
                hint="re-ingest these items to embed them with the current model",
            )
        self._meta = [(r[0], r[1], r[2], r[3], r[4]) for r in rows]
        self._matrix = (
            np.vstack([np.frombuffer(r[5], dtype=np.float32) for r in rows])
            if rows
            else np.empty((0, 0), dtype=np.float32)
        )
        log.info("vector_cache_loaded", chunks=len(rows))
