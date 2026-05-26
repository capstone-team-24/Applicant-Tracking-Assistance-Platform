"""
SQLAlchemy ORM models and Pydantic schemas for the AI Orchestrator.
"""

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field
from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import relationship

from app.database import Base


# ═══════════════════════════════════════════════════════════════════════════════
# SQLAlchemy ORM models
# ═══════════════════════════════════════════════════════════════════════════════


class RankingJob(Base):
    """Tracks a single ranking request for a job posting."""

    __tablename__ = "ai_ranking_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    status = Column(
        String(20),
        nullable=False,
        default="PENDING",
        comment="PENDING | PROCESSING | COMPLETED | FAILED",
    )
    candidate_ids = Column(JSON, nullable=False, default=list)
    results = Column(JSON, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # one-to-many
    ranking_results = relationship(
        "RankingResult", back_populates="ranking_job", cascade="all, delete-orphan"
    )
    audit_logs = relationship(
        "LLMAuditLog", back_populates="ranking_job", cascade="all, delete-orphan"
    )


class RankingResult(Base):
    """Individual candidate ranking outcome within a RankingJob."""

    __tablename__ = "ai_ranking_results"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ranking_job_id = Column(
        UUID(as_uuid=True),
        ForeignKey("ai_ranking_jobs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    candidate_id = Column(UUID(as_uuid=True), nullable=False)
    application_id = Column(UUID(as_uuid=True), nullable=True)
    semantic_score = Column(Float, nullable=False, default=0.0)
    assessment_score = Column(Float, nullable=False, default=0.0)
    interview_score = Column(Float, nullable=False, default=0.0)
    llm_quality_score = Column(Float, nullable=False, default=0.0)
    composite_score = Column(Float, nullable=False, default=0.0)
    summary = Column(Text, nullable=True)
    evidence_chunks = Column(JSON, nullable=True, default=list)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    ranking_job = relationship("RankingJob", back_populates="ranking_results")


class LLMAuditLog(Base):
    """Immutable audit trail for every LLM invocation (compliance)."""

    __tablename__ = "ai_llm_audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ranking_job_id = Column(
        UUID(as_uuid=True),
        ForeignKey("ai_ranking_jobs.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    candidate_id = Column(UUID(as_uuid=True), nullable=True)
    model_name = Column(String(128), nullable=False)
    prompt_hash = Column(String(64), nullable=False)
    prompt_template_id = Column(String(64), nullable=False)
    input_variables = Column(JSON, nullable=True, default=dict)
    raw_response = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    ranking_job = relationship("RankingJob", back_populates="audit_logs")


# ═══════════════════════════════════════════════════════════════════════════════
# Pydantic request / response schemas
# ═══════════════════════════════════════════════════════════════════════════════


class RankRequest(BaseModel):
    """Payload to trigger a new ranking job."""

    jobId: str
    applicationIds: List[str]


class CandidateRankResult(BaseModel):
    """Single candidate outcome within a ranking job."""

    candidateId: str
    applicationId: Optional[str] = None
    semanticScore: float = 0.0
    assessmentScore: float = 0.0
    interviewScore: float = 0.0
    llmQualityScore: float = 0.0
    compositeScore: float = 0.0
    summary: Optional[str] = None
    evidenceChunks: Optional[List[Dict[str, Any]]] = None


class RankStatusResponse(BaseModel):
    """Full status / result of a ranking job."""

    rankingJobId: str
    jobId: str
    status: str
    results: Optional[List[CandidateRankResult]] = None
    createdAt: str
    completedAt: Optional[str] = None


class AuditRecord(BaseModel):
    """Single LLM audit record."""

    id: str
    rankingJobId: Optional[str] = None
    candidateId: Optional[str] = None
    modelName: str
    promptHash: str
    promptTemplateId: str
    inputVariables: Optional[Dict[str, Any]] = None
    rawResponse: Optional[str] = None
    createdAt: str


class AuditExportResponse(BaseModel):
    """Export wrapper for compliance audit."""

    records: List[AuditRecord]
    total: int
