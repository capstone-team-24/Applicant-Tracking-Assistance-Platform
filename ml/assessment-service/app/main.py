"""
ATS Assessment Service -- FastAPI application entry point.

Manages assessments (MCQ, short answer, code), proctoring events,
and scoring with a pluggable LLM adapter for essay/code grading.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.database import init_db
from app.eureka_registration import register_with_eureka
from app.routes import router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(application: FastAPI):
    """Application startup and shutdown lifecycle."""
    # --- Startup ---
    logger.info("Starting ATS Assessment Service...")
    try:
        init_db()
        logger.info("Database initialised.")
    except Exception as e:
        logger.error(f"Database initialisation failed: {e}")

    try:
        register_with_eureka()
    except Exception as e:
        logger.warning(f"Eureka registration failed: {e}")

    logger.info("ATS Assessment Service is ready.")
    yield
    # --- Shutdown ---
    logger.info("Shutting down ATS Assessment Service.")


app = FastAPI(
    title="ATS Assessment Service",
    description=(
        "Manages assessments (MCQ, short answer, code), "
        "proctoring events, and AI-powered scoring."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(router)
