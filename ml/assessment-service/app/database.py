from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import settings
import logging

logger = logging.getLogger(__name__)

engine = create_engine(
    settings.database_url,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def init_db():
    """Create all tables in the database."""
    try:
        Base.metadata.create_all(bind=engine)
        with engine.begin() as conn:
            conn.execute(
                text(
                    """
                    ALTER TABLE assessment_submissions
                    ADD COLUMN IF NOT EXISTS warning_accepted_at TIMESTAMPTZ,
                    ADD COLUMN IF NOT EXISTS exam_started_at TIMESTAMPTZ,
                    ADD COLUMN IF NOT EXISTS strike_count INTEGER NOT NULL DEFAULT 0,
                    ADD COLUMN IF NOT EXISTS disqualified_at TIMESTAMPTZ,
                    ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ
                    """
                )
            )
        logger.info("Database tables created successfully.")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        raise


def get_db():
    """FastAPI dependency that provides a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
