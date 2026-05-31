import uuid
from datetime import datetime, timezone
from typing import Optional, List

from sqlalchemy import (
    Column, String, Text, Float, Integer, DateTime, ForeignKey, JSON
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from pydantic import BaseModel, Field

from app.database import Base


# ---------------------------------------------------------------------------
# SQLAlchemy ORM Models
# ---------------------------------------------------------------------------

class Assessment(Base):
    __tablename__ = "assessments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(UUID(as_uuid=True), nullable=False)
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    time_limit_minutes = Column(Integer, nullable=False, default=60)
    questions = Column(JSON, nullable=False, default=list)
    created_by = Column(UUID(as_uuid=True), nullable=True)
    access_token = Column(String(100), unique=True, nullable=False)
    status = Column(String(20), nullable=False, default="DRAFT")
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    submissions = relationship(
        "AssessmentSubmission", back_populates="assessment", cascade="all, delete-orphan"
    )


class AssessmentSubmission(Base):
    __tablename__ = "assessment_submissions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    assessment_id = Column(
        UUID(as_uuid=True), ForeignKey("assessments.id"), nullable=False
    )
    candidate_id = Column(UUID(as_uuid=True), nullable=False)
    answers = Column(JSON, nullable=True, default=list)
    score = Column(Float, nullable=True)
    scoring_details = Column(JSON, nullable=True)
    llm_rationale = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="IN_PROGRESS")
    started_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    warning_accepted_at = Column(DateTime(timezone=True), nullable=True)
    exam_started_at = Column(DateTime(timezone=True), nullable=True)
    strike_count = Column(Integer, nullable=False, default=0)
    disqualified_at = Column(DateTime(timezone=True), nullable=True)
    last_activity_at = Column(DateTime(timezone=True), nullable=True)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    scored_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    assessment = relationship("Assessment", back_populates="submissions")
    proctoring_events = relationship(
        "ProctoringEvent", back_populates="submission", cascade="all, delete-orphan"
    )


class ProctoringEvent(Base):
    __tablename__ = "proctoring_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    submission_id = Column(
        UUID(as_uuid=True),
        ForeignKey("assessment_submissions.id"),
        nullable=False,
    )
    event_type = Column(String(50), nullable=False)
    event_data = Column(JSON, nullable=True)
    timestamp = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    submission = relationship("AssessmentSubmission", back_populates="proctoring_events")


class LLMAuditLog(Base):
    __tablename__ = "llm_audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    submission_id = Column(UUID(as_uuid=True), nullable=False)
    model_name = Column(String(100), nullable=False)
    prompt_hash = Column(String(128), nullable=False)
    prompt_template_id = Column(String(100), nullable=True)
    input_variables = Column(JSON, nullable=True)
    raw_response = Column(Text, nullable=True)
    score = Column(Float, nullable=True)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------

class Question(BaseModel):
    id: str
    type: str = Field(..., pattern="^(MCQ|SHORT_ANSWER)$")
    text: str
    options: Optional[List[str]] = None
    correct_answer: Optional[str] = None
    max_score: float = 1.0


class CreateAssessmentRequest(BaseModel):
    jobId: str
    title: str
    description: Optional[str] = None
    timeLimitMinutes: int = 60
    questions: List[Question]


class AssessmentResponse(BaseModel):
    id: str
    jobId: str
    title: str
    description: Optional[str] = None
    timeLimitMinutes: int
    questions: List[Question]
    createdBy: Optional[str] = None
    accessToken: str
    status: str
    createdAt: str
    updatedAt: str

    class Config:
        from_attributes = True


class AnswerSubmission(BaseModel):
    questionId: str
    answer: str


class SubmitRequest(BaseModel):
    answers: List[AnswerSubmission]


class AutosaveRequest(BaseModel):
    answers: List[AnswerSubmission]
    lastActivityAt: Optional[str] = None


class AttemptStateRequest(BaseModel):
    warningAccepted: Optional[bool] = None
    examStarted: Optional[bool] = None
    strikeReason: Optional[str] = None
    strikeType: Optional[str] = None
    evidence: Optional[dict] = None
    lastActivityAt: Optional[str] = None


class ScoreDetail(BaseModel):
    questionId: str
    questionType: str
    score: float
    maxScore: float
    rationale: str


class SubmissionResponse(BaseModel):
    id: str
    assessmentId: str
    candidateId: Optional[str] = None
    score: Optional[float] = None
    status: str
    scoringDetails: Optional[List[ScoreDetail]] = None
    answers: Optional[List[AnswerSubmission]] = None
    startedAt: Optional[str] = None
    warningAcceptedAt: Optional[str] = None
    examStartedAt: Optional[str] = None
    strikeCount: int = 0
    disqualifiedAt: Optional[str] = None
    lastActivityAt: Optional[str] = None
    submittedAt: Optional[str] = None
    scoredAt: Optional[str] = None

    class Config:
        from_attributes = True


class ProctoringEventRequest(BaseModel):
    submissionId: str
    eventType: str = Field(..., pattern="^(TAB_CHANGE|MULTI_FACE|COPY_PASTE|WINDOW_BLUR|ATTEMPT_STRIKE)$")
    eventData: Optional[dict] = None
    timestamp: str


class ProctoringEventResponse(BaseModel):
    id: str
    submissionId: str
    eventType: str
    eventData: Optional[dict] = None
    reason: Optional[str] = None
    strikeType: Optional[str] = None
    strikeCount: Optional[int] = None
    evidence: Optional[dict] = None
    timestamp: str

    class Config:
        from_attributes = True

class UpdateAssessmentRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    timeLimitMinutes: Optional[int] = None
    questions: Optional[List[Question]] = None

class GenerateAssessmentRequest(BaseModel):
    jobId: str
    questionCount: int = Field(default=8, ge=1, le=30)
