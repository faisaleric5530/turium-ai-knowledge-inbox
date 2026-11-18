"""Retrieval: embed the question, search vectors, apply the similarity threshold."""

import time
from dataclasses import dataclass

import structlog

from app.adapters.embedder import Embedder
from app.errors import ServiceUnavailableError
from app.repositories.vector_store import SearchHit, VectorStore

log = structlog.get_logger(__name__)


@dataclass(frozen=True)
class RetrievalResult:
    hits: list[SearchHit]  # only hits at or above the threshold, best first
    top_scores: list[float]  # best raw scores (before thresholding), for debugging
    embed_ms: float
    search_ms: float


class RetrievalService:
    def __init__(self, *, embedder: Embedder, vectors: VectorStore, threshold: float) -> None:
        self._embedder = embedder
        self._vectors = vectors
        self._threshold = threshold

    def retrieve(self, question: str, top_k: int) -> RetrievalResult:
        if self._embedder.status != "ready":
            raise ServiceUnavailableError(
                "The embedding model is still loading. Try again in a moment (see GET /health)."
            )
        t = time.perf_counter()
        query_vector = self._embedder.embed_query(question)
        embed_ms = round((time.perf_counter() - t) * 1000, 1)

        t = time.perf_counter()
        raw_hits = self._vectors.search(query_vector, top_k)
        search_ms = round((time.perf_counter() - t) * 1000, 1)

        hits = [h for h in raw_hits if h.score >= self._threshold]
        log.info(
            "retrieval_done",
            embed_ms=embed_ms,
            search_ms=search_ms,
            candidates=len(raw_hits),
            kept=len(hits),
            threshold=self._threshold,
            top_scores=[round(h.score, 3) for h in raw_hits],
        )
        return RetrievalResult(
            hits=hits,
            top_scores=[h.score for h in raw_hits],
            embed_ms=embed_ms,
            search_ms=search_ms,
        )
