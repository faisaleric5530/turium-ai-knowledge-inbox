"""Application settings, read from environment variables / backend/.env."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # LLM (OpenRouter, OpenAI-compatible API)
    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    llm_model: str = ""
    # Comma-separated models tried in order if the primary is rate-limited or failing
    # (free OpenRouter models are throttled often). Use models from DIFFERENT providers:
    # the two Gemma models share one Google limit. Set to empty to disable fallback.
    llm_fallback_models: str = "baidu/ernie-5.5-flash-preview:free,nvidia/nemotron-3-ultra-550b-a55b:free"
    llm_timeout_s: float = 60.0
    llm_temperature: float = 0.1

    # Embeddings (local, fastembed)
    embedding_model: str = "nomic-ai/nomic-embed-text-v1.5"
    embedding_cache_dir: str = ".cache/fastembed"

    # Storage
    database_path: str = "data/inbox.db"

    # Chunking (token counts are estimated as chars / 4)
    chunk_target_tokens: int = 500
    chunk_overlap_tokens: int = 50

    # Retrieval
    similarity_threshold: float = 0.55
    top_k_default: int = 5
    top_k_max: int = 10

    # Input limits
    note_max_chars: int = 20_000
    question_max_chars: int = 1_000

    # URL fetching
    url_timeout_s: float = 10.0
    url_max_bytes: int = 2_000_000
    url_max_redirects: int = 3
    extracted_text_max_chars: int = 100_000
    url_min_text_chars: int = 50

    # HTTP
    cors_origins: str = "http://localhost:3000"
    log_level: str = "INFO"
    # true: log every write request (POST/PUT/PATCH/DELETE) and its processing steps
    # (ingest stages, retrieval, LLM timing) to the terminal; reads (GET) are not logged.
    # false: only warnings and errors are printed.
    api_logging: bool = False

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def llm_fallback_list(self) -> list[str]:
        return [m.strip() for m in self.llm_fallback_models.split(",") if m.strip()]

    @property
    def chunk_max_chars(self) -> int:
        return self.chunk_target_tokens * 4

    @property
    def chunk_overlap_chars(self) -> int:
        return self.chunk_overlap_tokens * 4

    @property
    def llm_configured(self) -> bool:
        return bool(self.openrouter_api_key and self.llm_model)


@lru_cache
def get_settings() -> Settings:
    return Settings()
