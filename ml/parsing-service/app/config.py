from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Kafka
    KAFKA_BOOTSTRAP_SERVERS: str = "kafka:9092"

    # Weaviate
    WEAVIATE_HOST: str = "localhost"
    WEAVIATE_PORT: int = 8080

    # PostgreSQL
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "ats_user"
    POSTGRES_PASSWORD: str = "ats_password"
    POSTGRES_DB: str = "ats_parsing"

    # Embedding model
    EMBEDDING_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"

    # Demo mode
    DEMO_MODE: bool = True

    # Service
    SERVICE_PORT: int = 8090

    # Eureka
    EUREKA_HOST: str = "localhost"
    EUREKA_PORT: int = 8761

    # Storage
    STORAGE_BASE_PATH: str = "./data/storage"

    class Config:
        env_file = ".env"
        case_sensitive = True

    @property
    def database_url(self) -> str:
        return (
            f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @property
    def weaviate_url(self) -> str:
        return f"http://{self.WEAVIATE_HOST}:{self.WEAVIATE_PORT}"

    @property
    def eureka_url(self) -> str:
        return f"http://{self.EUREKA_HOST}:{self.EUREKA_PORT}/eureka"


settings = Settings()
