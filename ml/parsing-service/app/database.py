import logging
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import settings
from app.models import Base

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Engine & session factory
# ---------------------------------------------------------------------------

if settings.DEMO_MODE:
    # In demo mode fall back to a local SQLite database so the service can
    # start without a running PostgreSQL instance.
    DATABASE_URL = "sqlite:///./demo_parsing.db"
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
    )
    logger.info("DEMO_MODE active -- using SQLite backend: %s", DATABASE_URL)
else:
    DATABASE_URL = settings.database_url
    engine = create_engine(
        DATABASE_URL,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
    )
    logger.info("Using PostgreSQL backend: %s", settings.POSTGRES_HOST)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# ---------------------------------------------------------------------------
# Table creation helper
# ---------------------------------------------------------------------------

def create_tables() -> None:
    """Create all tables that do not already exist."""
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables ensured.")


# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------

def get_db() -> Generator[Session, None, None]:
    """Yield a SQLAlchemy session and ensure it is closed after use."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
