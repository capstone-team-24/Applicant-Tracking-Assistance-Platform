from typing import Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Kafka
    KAFKA_BOOTSTRAP_SERVERS: str = "kafka:9092"

    # PostgreSQL
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "ats_assessments"

    # LLM Configuration
    LLM_PROVIDER: str = "mock"
    OPENAI_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None
    GROQ_API_KEY: Optional[str] = None
    GROQ_MODEL: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None

    # Eureka
    EUREKA_HOST: str = "localhost"
    EUREKA_PORT: int = 8761

    # Service
    SERVICE_PORT: int = 8091
    INTERNAL_SERVICE_TOKEN: str = "dev-internal-token"
    JOBS_SERVICE_URL: str = "http://localhost:8083"

    @property
    def database_url(self) -> str:
        return (
            f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
