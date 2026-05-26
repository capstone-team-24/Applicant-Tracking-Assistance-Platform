"""
FastAPI application entry-point for the ATS AI Orchestrator.

On startup the service:
1. Creates / verifies PostgreSQL tables.
2. Ensures the Weaviate ``JobDesc`` schema exists.
3. Starts the Kafka consumer in a background daemon thread.
4. Registers itself with Eureka for service discovery.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import settings
from app.database import apply_migrations, create_tables
from app.eureka_registration import register_with_eureka
from app.kafka_consumer import start_consumer_thread
from app.routes import router
from app.vector_store import weaviate_client

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


# ── Lifespan (startup / shutdown) ─────────────────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Perform startup tasks, then yield control to the application."""
    logger.info("Starting ATS AI Orchestrator (DEMO_MODE=%s)...", settings.DEMO_MODE)

    # 1. Database — create tables, then apply any schema migrations
    try:
        create_tables()
        apply_migrations()
    except Exception:
        logger.exception("Database initialisation failed.")
        if not settings.is_demo:
            raise

    # 2. Weaviate schema
    try:
        weaviate_client.ensure_job_desc_schema()
    except Exception:
        logger.exception("Weaviate schema setup failed.")

    # 3. Kafka consumer
    try:
        start_consumer_thread()
    except Exception:
        logger.exception("Kafka consumer thread failed to start.")

    # 4. Eureka registration
    try:
        register_with_eureka()
    except Exception:
        logger.exception("Eureka registration failed.")

    logger.info("AI Orchestrator ready on port %d.", settings.SERVICE_PORT)

    yield  # ← application runs here

    logger.info("AI Orchestrator shutting down.")


# ── App factory ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="ATS AI Orchestrator",
    description=(
        "RAG-based candidate ranking service. "
        "Uses Weaviate vector search and configurable LLM adapters to "
        "produce composite scores and explainable summaries for each candidate."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(router)
