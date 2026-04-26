"""FastAPI route definitions for the ATS Parsing Service."""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ParseRequest, ParseResponse, ParseResult, ParseStatusResponse
from app.parser_service import _safe_uuid, parse_resume

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# POST /parse
# ---------------------------------------------------------------------------


@router.post("/parse", response_model=ParseResponse, tags=["parsing"])
def submit_parse(request: ParseRequest, db: Session = Depends(get_db)):
    """Accept a resume parse request and execute the pipeline synchronously.

    In production this could be made asynchronous by publishing to Kafka
    and returning immediately.  For simplicity the default behaviour is
    synchronous.
    """
    logger.info(
        "POST /parse -- applicationId=%s filePath=%s",
        request.applicationId,
        request.filePath,
    )

    result = parse_resume(
        application_id=request.applicationId,
        file_path=request.filePath,
        db_session=db,
    )

    status = result.get("status", "UNKNOWN")
    confidence = result.get("parse_confidence")

    return ParseResponse(
        status=status,
        parsedJsonUrl=f"/parse/{request.applicationId}/status",
        parseConfidence=confidence,
    )


# ---------------------------------------------------------------------------
# GET /parse/{application_id}/status
# ---------------------------------------------------------------------------


@router.get(
    "/parse/{application_id}/status",
    response_model=ParseStatusResponse,
    tags=["parsing"],
)
def get_parse_status(application_id: str, db: Session = Depends(get_db)):
    """Return the current status of a parse job for the given application."""
    app_uuid = _safe_uuid(application_id)

    row: Optional[ParseResult] = (
        db.query(ParseResult)
        .filter(ParseResult.application_id == app_uuid)
        .order_by(ParseResult.created_at.desc())
        .first()
    )

    if row is None:
        raise HTTPException(status_code=404, detail="Parse result not found.")

    return ParseStatusResponse(
        applicationId=application_id,
        status=row.status,
        parseConfidence=row.parse_confidence,
        chunkCount=row.chunk_count,
    )


# ---------------------------------------------------------------------------
# GET /health
# ---------------------------------------------------------------------------


@router.get("/health", tags=["health"])
def health_check():
    """Simple liveness probe."""
    return {"status": "ok"}
