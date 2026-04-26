"""
Application configuration using pydantic-settings.
All values are sourced from environment variables with sensible defaults.
"""

from typing import Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Central configuration for the AI Orchestrator service."""

    # ── Kafka ─────────────────────────────────────────────────────────────
    KAFKA_BOOTSTRAP_SERVERS: str = "kafka:9092"

    # ── Weaviate ──────────────────────────────────────────────────────────
    WEAVIATE_HOST: str = "localhost"
    WEAVIATE_PORT: int = 8080

    # ── Embedding model ───────────────────────────────────────────────────
    EMBEDDING_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"

    # ── PostgreSQL ────────────────────────────────────────────────────────
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "ats_ai"

    # ── LLM provider ─────────────────────────────────────────────────────
    LLM_PROVIDER: str = "mock"
    OPENAI_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None
    GROQ_API_KEY: Optional[str] = None
    GROQ_MODEL: Optional[str] = None

    # ── Demo / fallback mode ──────────────────────────────────────────────
    DEMO_MODE: str = "true"

    # ── Eureka service-discovery ──────────────────────────────────────────
    EUREKA_HOST: str = "localhost"
    EUREKA_PORT: int = 8761
    SERVICE_PORT: int = 8092

    # ── Derived helpers ───────────────────────────────────────────────────
    @property
    def database_url(self) -> str:
        return (
            f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @property
    def is_demo(self) -> bool:
        return self.DEMO_MODE.lower() == "true"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
