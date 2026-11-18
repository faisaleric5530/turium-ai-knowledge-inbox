import re
import zlib

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.adapters.embedder import l2_normalize
from app.adapters.llm import LlmResult
from app.adapters.url_fetcher import FetchedPage, UrlFetchError
from app.config import Settings
from app.main import create_app

_WORD = re.compile(r"[a-z0-9]+")
_STOP = {"the", "a", "an", "is", "of", "to", "in", "and", "do", "i", "what", "how", "my"}


class FakeEmbedder:
    """Deterministic bag-of-words hashing embedder: similar words => similar vectors."""

    model_name = "fake-embedder"
    dim = 128
    error = None

    def __init__(self, status: str = "ready") -> None:
        self.status = status

    def load(self) -> None:
        self.status = "ready"

    def _vec(self, text: str) -> np.ndarray:
        v = np.zeros(self.dim, dtype=np.float32)
        for word in _WORD.findall(text.lower()):
            if word not in _STOP:
                v[zlib.crc32(word.encode()) % self.dim] += 1.0
        return v

    def embed_documents(self, texts: list[str]) -> np.ndarray:
        return l2_normalize(np.vstack([self._vec(t) for t in texts]))

    def embed_query(self, text: str) -> np.ndarray:
        return l2_normalize(self._vec(text)[None, :])[0]


class FakeLlm:
    model = "fake/model"

    def __init__(self) -> None:
        self.calls: list[tuple[str, str]] = []
        self.error: Exception | None = None

    def complete(self, system: str, user: str) -> LlmResult:
        self.calls.append((system, user))
        if self.error:
            raise self.error
        return LlmResult(text="Based on your notes [1].", model=self.model)


class FakeFetcher:
    def __init__(self) -> None:
        self.pages: dict[str, FetchedPage] = {}
        self.error: UrlFetchError | None = None

    def fetch(self, url: str) -> FetchedPage:
        if self.error:
            raise self.error
        return self.pages.get(
            url,
            FetchedPage(url=url, title="Example page", text="Kubernetes schedules pods onto nodes."),
        )


@pytest.fixture
def settings(tmp_path) -> Settings:
    return Settings(
        _env_file=None,
        database_path=str(tmp_path / "test.db"),
        similarity_threshold=0.3,
        note_max_chars=300,
        question_max_chars=200,
    )


@pytest.fixture
def embedder() -> FakeEmbedder:
    return FakeEmbedder()


@pytest.fixture
def llm() -> FakeLlm:
    return FakeLlm()


@pytest.fixture
def fetcher() -> FakeFetcher:
    return FakeFetcher()


@pytest.fixture
def client(settings, embedder, llm, fetcher):
    app = create_app(settings, embedder=embedder, llm=llm, fetcher=fetcher)
    with TestClient(app) as test_client:
        yield test_client
