"""Application configuration via environment variables (12-factor)."""
from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "AI Data Pipeline Doctor"
    environment: str = "development"

    # SQLite by default so the app runs anywhere; point at Postgres in prod.
    database_url: str = "sqlite:///./pipeline_doctor.db"

    # Anthropic API. When unset, the diagnosis engine falls back to the
    # rule-based classifier so the product still works end to end.
    anthropic_api_key: str = ""
    diagnosis_model: str = "claude-sonnet-5"
    triage_model: str = "claude-haiku-4-5-20251001"
    max_diagnosis_tokens: int = 4096

    # How many characters of log context we send to the LLM after smart
    # truncation (head + error window + tail).
    log_context_budget: int = 24000

    # Simple shared-secret auth for ingest webhooks; empty disables auth
    # (local/dev mode).
    ingest_api_key: str = ""

    cors_origins: str = "http://localhost:3000,http://localhost:5173"

    class Config:
        env_prefix = "PD_"
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()
