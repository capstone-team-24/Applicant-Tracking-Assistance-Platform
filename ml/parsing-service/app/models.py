import uuid
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field
from sqlalchemy import Column, DateTime, Float, Integer, JSON, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import declarative_base

Base = declarative_base()


# ---------------------------------------------------------------------------
# SQLAlchemy ORM models
# ---------------------------------------------------------------------------

class ParseResult(Base):
    """Tracks the status and output of a resume-parse job."""

    __tablename__ = "parse_results"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    application_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    status = Column(String(32), nullable=False, default="PENDING")
    parsed_data = Column(JSON, nullable=True)
    parse_confidence = Column(Float, nullable=True)
    chunk_count = Column(Integer, nullable=True, default=0)
    source_file_path = Column(String(1024), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    completed_at = Column(DateTime(timezone=True), nullable=True)

    def __repr__(self) -> str:
        return (
            f"<ParseResult id={self.id} application_id={self.application_id} "
            f"status={self.status}>"
        )


# ---------------------------------------------------------------------------
# Pydantic request / response schemas
# ---------------------------------------------------------------------------

class ParseRequest(BaseModel):
    """Incoming request to parse a resume."""

    applicationId: str = Field(..., description="UUID of the application")
    filePath: str = Field(..., description="Path to the resume file on disk or in storage")


class ParseResponse(BaseModel):
    """Response returned immediately after a parse request is accepted."""

    status: str = Field(..., description="Current status of the parse job")
    parsedJsonUrl: str = Field(
        ...,
        description="URL to poll for parsed result / status",
    )
    parseConfidence: Optional[float] = Field(
        None,
        description="Overall confidence score (0-1) if already available",
    )


class ParseStatusResponse(BaseModel):
    """Detailed status of a parse job."""

    applicationId: str
    status: str
    parseConfidence: Optional[float] = None
    chunkCount: Optional[int] = None
