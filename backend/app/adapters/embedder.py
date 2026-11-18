"""Local embedding model (fastembed / ONNX) behind a small interface.

fastembed returns unnormalised vectors for some models (nomic), so vectors are
L2-normalised here: cosine similarity then equals a plain dot product.
"""

import os
import threading
from typing import Protocol

import numpy as np
import structlog

os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")

log = structlog.get_logger(__name__)

# model-name prefix -> (query_prefix, document_prefix)
_PREFIXES: dict[str, tuple[str, str]] = {
    "nomic-ai/nomic-embed-text": ("search_query: ", "search_document: "),
    "BAAI/bge-": ("Represent this sentence for searching relevant passages: ", ""),
}


def prefixes_for(model_name: str) -> tuple[str, str]:
    for model_prefix, prefixes in _PREFIXES.items():
        if model_name.startswith(model_prefix):
            return prefixes
    return ("", "")


def l2_normalize(vectors: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    return (vectors / np.maximum(norms, 1e-12)).astype(np.float32)


class Embedder(Protocol):
    model_name: str
    dim: int | None
    status: str  # "loading" | "ready" | "error"
    error: str | None

    def load(self) -> None: ...
    def embed_documents(self, texts: list[str]) -> np.ndarray: ...
    def embed_query(self, text: str) -> np.ndarray: ...


class FastEmbedEmbedder:
    def __init__(self, model_name: str, cache_dir: str) -> None:
        self.model_name = model_name
        self.cache_dir = cache_dir
        self.dim: int | None = None
        self.status = "loading"
        self.error: str | None = None
        self._model = None
        self._query_prefix, self._doc_prefix = prefixes_for(model_name)
        self._lock = threading.Lock()

    def load(self) -> None:
        """Download (first run) and load the model. Blocking; run in a thread."""
        try:
            from fastembed import TextEmbedding

            log.info("embedder_loading", model=self.model_name)
            model = TextEmbedding(self.model_name, cache_dir=self.cache_dir)
            probe = np.array(list(model.embed(["probe"])), dtype=np.float32)
            self._model = model
            self.dim = int(probe.shape[1])
            self.status = "ready"
            log.info("embedder_ready", model=self.model_name, dim=self.dim)
        except Exception as exc:  # noqa: BLE001 - surfaced via /health
            self.status = "error"
            self.error = f"{type(exc).__name__}: {exc}"
            log.exception("embedder_load_failed", model=self.model_name)

    def _embed(self, texts: list[str]) -> np.ndarray:
        if self._model is None:
            raise RuntimeError("embedder is not loaded")
        with self._lock:  # ONNX session reuse is cheap; serialise to bound CPU use
            vectors = np.array(list(self._model.embed(texts)), dtype=np.float32)
        return l2_normalize(vectors)

    def embed_documents(self, texts: list[str]) -> np.ndarray:
        return self._embed([self._doc_prefix + t for t in texts])

    def embed_query(self, text: str) -> np.ndarray:
        return self._embed([self._query_prefix + text])[0]
