"""Core orchestration logic for parsing a resume end-to-end.

The ``parse_resume`` function ties together text extraction, normalisation,
chunking, embedding, and vector storage into a single pipeline and persists
progress to the database.
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.chunker import chunk_text
from app.config import settings
from app.embeddings import EmbeddingService
from app.models import ParseResult
from app.normalizer import extract_structured_data, normalize_dates
from app.text_extractor import extract_text
from app.vector_store import WeaviateAdapter

logger = logging.getLogger(__name__)

# Module-level singletons (initialised lazily so import alone is cheap)
_embedding_service: Optional[EmbeddingService] = None
_vector_store: Optional[WeaviateAdapter] = None


def _get_embedding_service() -> EmbeddingService:
    global _embedding_service
    if _embedding_service is None:
        _embedding_service = EmbeddingService()
    return _embedding_service


def _get_vector_store() -> WeaviateAdapter:
    global _vector_store
    if _vector_store is None:
        _vector_store = WeaviateAdapter()
    return _vector_store


# ---------------------------------------------------------------------------
# Confidence scoring
# ---------------------------------------------------------------------------


def _compute_confidence(
    text: str,
    structured: dict,
    chunk_count: int,
) -> float:
    """Heuristic confidence score in [0, 1].

    Factors considered:
    - Length of extracted text (longer = more content to evaluate)
    - Presence of key structured fields (name, email, skills, employment)
    - Number of chunks produced
    """
    score = 0.0

    # Text length contribution (up to 0.25)
    text_len = len(text)
    if text_len > 2000:
        score += 0.25
    elif text_len > 500:
        score += 0.15
    elif text_len > 100:
        score += 0.08

    # Name present (0.10)
    if structured.get("name"):
        score += 0.10

    # Email present (0.10)
    if structured.get("email"):
        score += 0.10

    # Phone present (0.05)
    if structured.get("phone"):
        score += 0.05

    # Skills count (up to 0.20)
    skills = structured.get("skills", [])
    if len(skills) >= 5:
        score += 0.20
    elif len(skills) >= 2:
        score += 0.12
    elif len(skills) >= 1:
        score += 0.05

    # Employment history (up to 0.20)
    employment = structured.get("employment", [])
    if len(employment) >= 2:
        score += 0.20
    elif len(employment) >= 1:
        score += 0.10

    # Education (0.10)
    education = structured.get("education", [])
    if education:
        score += 0.10

    # Clamp
    return round(min(score, 1.0), 4)


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------


def parse_resume(
    application_id: str,
    file_path: str,
    db_session: Session,
) -> dict:
    """Execute the full resume-parse pipeline.

    Steps
    -----
    1. Create a ``ParseResult`` row with status ``PROCESSING``.
    2. Extract text from the resume file.
    3. Extract structured data (name, email, skills, ...).
    4. Chunk the text.
    5. Compute embeddings for each chunk.
    6. Upsert chunks + embeddings to the vector store.
    7. Calculate overall parse confidence.
    8. Update the ``ParseResult`` row to ``COMPLETED``.
    9. Return a summary dict.
    """
    app_uuid = _safe_uuid(application_id)

    # 1. Create tracking row
    parse_result = ParseResult(
        id=uuid.uuid4(),
        application_id=app_uuid,
        status="PROCESSING",
        source_file_path=file_path,
    )
    db_session.add(parse_result)
    db_session.commit()
    db_session.refresh(parse_result)
    logger.info(
        "Created ParseResult %s for application %s", parse_result.id, application_id
    )

    try:
        # 2. Extract text
        raw_text = extract_text(file_path)
        logger.info(
            "Extracted %d characters from %s",
            len(raw_text),
            file_path,
        )

        # 3. Structured data
        structured = extract_structured_data(raw_text)
        # Also normalise any dates in the raw text (for storage)
        normalised_text = normalize_dates(raw_text)
        logger.info(
            "Structured extraction complete -- name=%s, skills=%d",
            structured.get("name"),
            len(structured.get("skills", [])),
        )

        # 4. Chunk
        chunks = chunk_text(normalised_text)
        logger.info("Produced %d chunks.", len(chunks))

        # 5. Embeddings
        emb_service = _get_embedding_service()
        chunk_texts = [c["text"] for c in chunks]
        embeddings = emb_service.compute_embeddings_batch(chunk_texts)
        logger.info("Computed %d embeddings.", len(embeddings))

        # 6. Vector store upsert
        vs = _get_vector_store()
        confidence = _compute_confidence(raw_text, structured, len(chunks))
        metadata = {
            "application_id": application_id,
            "candidate_id": structured.get("name", ""),
            "parse_confidence": confidence,
            "source_file_path": file_path,
        }
        upserted = vs.upsert_chunks(chunks, embeddings, metadata)
        logger.info("Upserted %d chunks to vector store.", upserted)

        # 7. Confidence
        logger.info("Parse confidence: %.4f", confidence)

        # 8. Update DB row
        parse_result.status = "COMPLETED"
        parse_result.parsed_data = structured
        parse_result.parse_confidence = confidence
        parse_result.chunk_count = len(chunks)
        parse_result.completed_at = datetime.now(timezone.utc)
        db_session.commit()
        db_session.refresh(parse_result)
        logger.info(
            "ParseResult %s updated to COMPLETED (confidence=%.4f, chunks=%d).",
            parse_result.id,
            confidence,
            len(chunks),
        )

        # 9. Return summary
        return {
            "parse_result_id": str(parse_result.id),
            "application_id": application_id,
            "status": "COMPLETED",
            "parse_confidence": confidence,
            "chunk_count": len(chunks),
            "structured_data": structured,
        }

    except Exception as exc:
        logger.error(
            "Parse failed for application %s: %s",
            application_id,
            exc,
            exc_info=True,
        )
        parse_result.status = "FAILED"
        parse_result.parsed_data = {"error": str(exc)}
        parse_result.completed_at = datetime.now(timezone.utc)
        db_session.commit()

        return {
            "parse_result_id": str(parse_result.id),
            "application_id": application_id,
            "status": "FAILED",
            "error": str(exc),
        }


# ---------------------------------------------------------------------------
# Kafka message handler (adapter)
# ---------------------------------------------------------------------------


def handle_parse_message(payload: dict) -> None:
    """Handle an incoming Kafka message by triggering the parse pipeline.

    Expected payload keys: ``applicationId``, ``filePath``.
    """
    from app.database import SessionLocal
    from app.kafka_consumer import publish_completion_event

    application_id = payload.get("applicationId", "")
    file_path = payload.get("filePath", "")

    if not application_id:
        logger.error("Message missing 'applicationId': %s", payload)
        return

    if not file_path:
        file_path = f"{settings.STORAGE_BASE_PATH}/resumes/{application_id}.pdf"
        logger.info("No filePath in message; defaulting to %s", file_path)

    db = SessionLocal()
    try:
        result = parse_resume(application_id, file_path, db)
        logger.info(
            "Parse completed for application %s: %s",
            application_id,
            result.get("status"),
        )

        # Publish completion event to resume.parse.completed topic
        try:
            publish_completion_event(
                {
                    "applicationId": application_id,
                    "parseResultId": result.get("parse_result_id"),
                    "status": result.get("status"),
                    "parseConfidence": result.get("parse_confidence"),
                    "chunkCount": result.get("chunk_count"),
                }
            )
        except Exception as exc:
            logger.warning("Failed to publish parse completion event: %s", exc)
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _safe_uuid(value: str) -> uuid.UUID:
    """Convert a string to a UUID, generating one if the string is invalid."""
    try:
        return uuid.UUID(value)
    except (ValueError, AttributeError):
        return uuid.uuid5(uuid.NAMESPACE_DNS, str(value))
