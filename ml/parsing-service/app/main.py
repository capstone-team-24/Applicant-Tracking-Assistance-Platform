"""ATS Parsing Service -- FastAPI application entry point.

On startup the application:
1. Creates database tables (if they do not already exist).
2. Ensures the Weaviate vector-store schema is present.
3. Starts the Kafka consumer in a background daemon thread.
4. Registers with Eureka for service discovery.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import settings
from app.database import create_tables
from app.eureka_registration import deregister_from_eureka, register_with_eureka
from app.kafka_consumer import start_consumer_thread
from app.parser_service import handle_parse_message
from app.routes import router
from app.vector_store import WeaviateAdapter

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Lifespan (startup / shutdown)
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage startup and shutdown side-effects."""
    logger.info("Starting ATS Parsing Service (DEMO_MODE=%s) ...", settings.DEMO_MODE)

    # 1. Database
    create_tables()

    # 2. Weaviate schema
    try:
        vs = WeaviateAdapter()
        vs.ensure_schema()
    except Exception as exc:
        logger.warning("Weaviate schema initialisation skipped: %s", exc)

    # 3. Kafka consumer
    start_consumer_thread(handler=handle_parse_message)

    # 4. Eureka
    register_with_eureka()

    logger.info("ATS Parsing Service is ready.")
    yield

    # Shutdown
    logger.info("Shutting down ATS Parsing Service ...")
    deregister_from_eureka()


# ---------------------------------------------------------------------------
# FastAPI application
# ---------------------------------------------------------------------------

app = FastAPI(
    title="ATS Parsing Service",
    description=(
        "Microservice that parses resumes, extracts structured text, "
        "computes vector embeddings, and stores them in Weaviate."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(router)
