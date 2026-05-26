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


# ── Schema migrations ─────────────────────────────────────────────────────────

# Add idempotent ALTER TABLE statements here whenever a new column is added to
# an ORM model.  Each statement uses "IF NOT EXISTS" so it is safe to run on
# every startup against both fresh and pre-existing databases — no manual
# `docker exec` required on any device.

_MIGRATIONS = [
    """
    ALTER TABLE ai_ranking_results
        ADD COLUMN IF NOT EXISTS interview_score DOUBLE PRECISION NOT NULL DEFAULT 0.0
    """,
]


def apply_migrations() -> None:
    """Run idempotent DDL migrations against the live database."""
    try:
        with engine.connect() as conn:
            for sql in _MIGRATIONS:
                conn.execute(__import__("sqlalchemy").text(sql))
            conn.commit()
        logger.info("Schema migrations applied successfully.")
    except Exception:
        logger.exception("Failed to apply schema migrations.")
        if settings.is_demo:
            logger.warning("DEMO_MODE: continuing despite migration error.")
        else:
            raise
