"""Wires adapters, repositories and services together (the composition root)."""

from dataclasses import dataclass

from app.adapters.embedder import Embedder, FastEmbedEmbedder
from app.adapters.llm import LlmClient, OpenRouterLlm
from app.adapters.url_fetcher import HttpUrlFetcher, UrlFetcher
from app.config import Settings
from app.db import Database
from app.repositories.items_repo import ItemsRepository
from app.repositories.vector_store import SqliteVectorStore, VectorStore
from app.services.answering import AnsweringService
from app.services.ingestion import IngestionService
from app.services.retrieval import RetrievalService


@dataclass
class Container:
    settings: Settings
    db: Database
    embedder: Embedder
    items: ItemsRepository
    vectors: VectorStore
    ingestion: IngestionService
    answering: AnsweringService


def build_container(
    settings: Settings,
    *,
    embedder: Embedder | None = None,
    llm: LlmClient | None = None,
    fetcher: UrlFetcher | None = None,
) -> Container:
    """Build the object graph. Pass fakes for embedder/llm/fetcher in tests."""
    db = Database(settings.database_path)
    embedder = embedder or FastEmbedEmbedder(settings.embedding_model, settings.embedding_cache_dir)
    llm = llm or OpenRouterLlm(
        api_key=settings.openrouter_api_key,
        base_url=settings.openrouter_base_url,
        model=settings.llm_model,
        fallback_models=settings.llm_fallback_list,
        timeout_s=settings.llm_timeout_s,
        temperature=settings.llm_temperature,
    )
    fetcher = fetcher or HttpUrlFetcher(
        timeout_s=settings.url_timeout_s,
        max_bytes=settings.url_max_bytes,
        max_redirects=settings.url_max_redirects,
        max_text_chars=settings.extracted_text_max_chars,
        min_text_chars=settings.url_min_text_chars,
    )
    items = ItemsRepository(db)
    vectors = SqliteVectorStore(db, model=embedder.model_name)
    retrieval = RetrievalService(
        embedder=embedder, vectors=vectors, threshold=settings.similarity_threshold
    )
    return Container(
        settings=settings,
        db=db,
        embedder=embedder,
        items=items,
        vectors=vectors,
        ingestion=IngestionService(
            items=items, vectors=vectors, embedder=embedder, fetcher=fetcher, settings=settings
        ),
        answering=AnsweringService(
            retrieval=retrieval, llm=llm, top_k_default=settings.top_k_default
        ),
    )
