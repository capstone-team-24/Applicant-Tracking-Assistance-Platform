"""
SQLAlchemy database engine, session factory, and helpers.
"""

import logging
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from app.config import settings

logger = logging.getLogger(__name__)

# ── Engine & session ──────────────────────────────────────────────────────────

engine = create_engine(
    settings.database_url,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


# ── Dependency for FastAPI ────────────────────────────────────────────────────

def get_db() -> Generator[Session, None, None]:
    """Yield a transactional DB session that is closed after use."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Table creation helper ────────────────────────────────────────────────────

def create_tables() -> None:
    """Create all tables defined on *Base* if they do not yet exist."""
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created / verified successfully.")
    except Exception:
        logger.exception("Failed to create database tables.")
        if settings.is_demo:
            logger.warning("DEMO_MODE: continuing despite database error.")
        else:
            raise
