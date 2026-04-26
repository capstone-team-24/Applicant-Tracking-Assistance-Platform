"""
API route handlers for the ATS Assessment Service.
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.kafka_producer import publish_assessment_completed
from app.models import (
    AnswerSubmission,
    Assessment,
    AssessmentResponse,
    AssessmentSubmission,
    AutosaveRequest,
    CreateAssessmentRequest,
    GenerateAssessmentRequest,
    ProctoringEvent,
    ProctoringEventRequest,
    ProctoringEventResponse,
    ScoreDetail,
    SubmissionResponse,
    SubmitRequest,
    UpdateAssessmentRequest,
)
from app.scoring_service import score_submission

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _assessment_to_response(a: Assessment) -> AssessmentResponse:
    """Map an ORM Assessment to its Pydantic response."""
    return AssessmentResponse(
        id=str(a.id),
        jobId=str(a.job_id),
        title=a.title,
        description=a.description,
        timeLimitMinutes=a.time_limit_minutes,
        questions=a.questions or [],
        createdBy=str(a.created_by) if a.created_by else None,
        accessToken=a.access_token,
        status=a.status,
        createdAt=a.created_at.isoformat() if a.created_at else "",
        updatedAt=a.updated_at.isoformat() if a.updated_at else "",
    )


def _submission_to_response(s: AssessmentSubmission) -> SubmissionResponse:
    """Map an ORM submission to its Pydantic response."""
    scoring_details = None
    if s.scoring_details:
        scoring_details = [
            ScoreDetail(
                questionId=d["questionId"],
                questionType=d["questionType"],
                score=d["score"],
                maxScore=d["maxScore"],
                rationale=d["rationale"],
            )
            for d in s.scoring_details
        ]

    answers = None
    if s.answers:
        answers = [
            AnswerSubmission(questionId=a["questionId"], answer=a["answer"])
            for a in s.answers
        ]

    return SubmissionResponse(
        id=str(s.id),
        assessmentId=str(s.assessment_id),
        candidateId=str(s.candidate_id),
        score=s.score,
        status=s.status,
        scoringDetails=scoring_details,
        answers=answers,
        startedAt=s.started_at.isoformat() if s.started_at else None,
        submittedAt=s.submitted_at.isoformat() if s.submitted_at else None,
        scoredAt=s.scored_at.isoformat() if s.scored_at else None,
    )


# ---------------------------------------------------------------------------
# POST /assessments  -- create a new assessment
# ---------------------------------------------------------------------------


@router.post("/assessments", response_model=AssessmentResponse, status_code=201)
def create_assessment(
    req: CreateAssessmentRequest,
    db: Session = Depends(get_db),
):
    """Create a new assessment and generate a unique access token."""
    access_token = str(uuid.uuid4())
    questions_dicts = [q.model_dump() for q in req.questions]

    assessment = Assessment(
        id=uuid.uuid4(),
        job_id=uuid.UUID(req.jobId),
        title=req.title,
        description=req.description,
        time_limit_minutes=req.timeLimitMinutes,
        questions=questions_dicts,
        access_token=access_token,
        status="ACTIVE",
    )
    db.add(assessment)
    db.commit()
    db.refresh(assessment)

    logger.info(f"Created assessment {assessment.id} with token {access_token}")
    return _assessment_to_response(assessment)


# ---------------------------------------------------------------------------
# GET /assessments/{token}  -- get assessment by access token (candidate view)
# ---------------------------------------------------------------------------


@router.get("/assessments/by-job/{job_id}", response_model=list[AssessmentResponse])
def get_assessments_by_job(
    job_id: str,
    db: Session = Depends(get_db),
):
    """Get all assessments linked to a specific job (recruiter view)."""
    try:
        jid = uuid.UUID(job_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid job_id format.")

    assessments = (
        db.query(Assessment)
        .filter(Assessment.job_id == jid)
        .order_by(Assessment.created_at.desc())
        .all()
    )
    return [_assessment_to_response(a) for a in assessments]


@router.get("/assessments/{token}", response_model=AssessmentResponse)
def get_assessment_by_token(
    token: str,
    candidate_id: Optional[str] = Query(None, alias="candidateId"),
    db: Session = Depends(get_db),
):
    """
    Fetch an assessment by its access token.

    If candidateId is provided, an IN_PROGRESS submission is created
    automatically (if one doesn't already exist for that candidate).
    """
    assessment = db.query(Assessment).filter(Assessment.access_token == token).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found.")

    if assessment.status == "CLOSED":
        raise HTTPException(status_code=410, detail="Assessment is closed.")

    # Auto-create a submission for the candidate
    if candidate_id:
        cid = uuid.UUID(candidate_id)
        existing = (
            db.query(AssessmentSubmission)
            .filter(
                AssessmentSubmission.assessment_id == assessment.id,
                AssessmentSubmission.candidate_id == cid,
            )
            .first()
        )
        if not existing:
            submission = AssessmentSubmission(
                id=uuid.uuid4(),
                assessment_id=assessment.id,
                candidate_id=cid,
                status="IN_PROGRESS",
            )
            db.add(submission)
            db.commit()
            logger.info(
                f"Created IN_PROGRESS submission {submission.id} for candidate {cid}"
            )

    return _assessment_to_response(assessment)


# ---------------------------------------------------------------------------
# POST /assessments/{id}/save  -- autosave answers
# ---------------------------------------------------------------------------


@router.post("/assessments/{assessment_id}/save", response_model=SubmissionResponse)
def autosave_answers(
    assessment_id: str,
    req: AutosaveRequest,
    candidate_id: str = Query(..., alias="candidateId"),
    db: Session = Depends(get_db),
):
    """Autosave candidate answers (updates the submission JSON)."""
    aid = uuid.UUID(assessment_id)
    cid = uuid.UUID(candidate_id)

    submission = (
        db.query(AssessmentSubmission)
        .filter(
            AssessmentSubmission.assessment_id == aid,
            AssessmentSubmission.candidate_id == cid,
        )
        .first()
    )
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found.")

    if submission.status != "IN_PROGRESS":
        raise HTTPException(
            status_code=400,
            detail="Cannot save answers for a submission that is not in progress.",
        )

    submission.answers = [a.model_dump() for a in req.answers]
    db.commit()
    db.refresh(submission)

    return _submission_to_response(submission)


# ---------------------------------------------------------------------------
# POST /assessments/{id}/submit  -- submit & score
# ---------------------------------------------------------------------------


@router.post("/assessments/{assessment_id}/submit", response_model=SubmissionResponse)
def submit_assessment(
    assessment_id: str,
    req: SubmitRequest,
    candidate_id: str = Query(..., alias="candidateId"),
    db: Session = Depends(get_db),
):
    """Submit answers, trigger scoring, and return results."""
    aid = uuid.UUID(assessment_id)
    cid = uuid.UUID(candidate_id)

    assessment = db.query(Assessment).filter(Assessment.id == aid).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found.")

    submission = (
        db.query(AssessmentSubmission)
        .filter(
            AssessmentSubmission.assessment_id == aid,
            AssessmentSubmission.candidate_id == cid,
        )
        .first()
    )
    if not submission:
        # Create submission on the fly if candidate hasn't started yet
        submission = AssessmentSubmission(
            id=uuid.uuid4(),
            assessment_id=aid,
            candidate_id=cid,
            status="IN_PROGRESS",
        )
        db.add(submission)
        db.flush()

    if submission.status == "SCORED":
        raise HTTPException(
            status_code=400, detail="This submission has already been scored."
        )

    # Store final answers and mark as submitted
    submission.answers = [a.model_dump() for a in req.answers]
    submission.status = "SUBMITTED"
    submission.submitted_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(submission)

    # Score the submission
    try:
        summary = score_submission(assessment, submission, db)
    except Exception as e:
        logger.error(f"Scoring failed for submission {submission.id}: {e}")
        raise HTTPException(status_code=500, detail=f"Scoring failed: {e}")

    # Publish event to Kafka
    try:
        publish_assessment_completed(
            submission_id=str(submission.id),
            assessment_id=str(assessment.id),
            candidate_id=str(submission.candidate_id),
            job_id=str(assessment.job_id),
            score=submission.score,
            status=submission.status,
        )
    except Exception as e:
        logger.warning(f"Failed to publish Kafka event: {e}")

    db.refresh(submission)
    return _submission_to_response(submission)


# ---------------------------------------------------------------------------
# POST /proctor/events  -- ingest proctoring event
# ---------------------------------------------------------------------------


@router.post("/proctor/events", response_model=ProctoringEventResponse, status_code=201)
def create_proctoring_event(
    req: ProctoringEventRequest,
    db: Session = Depends(get_db),
):
    """Record a proctoring event for a submission."""
    sub_id = uuid.UUID(req.submissionId)

    submission = (
        db.query(AssessmentSubmission).filter(AssessmentSubmission.id == sub_id).first()
    )
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found.")

    event = ProctoringEvent(
        id=uuid.uuid4(),
        submission_id=sub_id,
        event_type=req.eventType,
        event_data=req.eventData,
        timestamp=datetime.fromisoformat(req.timestamp),
    )
    db.add(event)
    db.commit()
    db.refresh(event)

    logger.info(f"Proctoring event {event.event_type} recorded for submission {sub_id}")

    return ProctoringEventResponse(
        id=str(event.id),
        submissionId=str(event.submission_id),
        eventType=event.event_type,
        eventData=event.event_data,
        timestamp=event.timestamp.isoformat(),
    )


# ---------------------------------------------------------------------------
# GET /assessments/{id}/submissions  -- recruiter view
# ---------------------------------------------------------------------------


@router.get(
    "/assessments/{assessment_id}/submissions", response_model=list[SubmissionResponse]
)
def list_submissions(
    assessment_id: str,
    db: Session = Depends(get_db),
):
    """List all submissions for an assessment (recruiter view)."""
    aid = uuid.UUID(assessment_id)

    assessment = db.query(Assessment).filter(Assessment.id == aid).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found.")

    submissions = (
        db.query(AssessmentSubmission)
        .filter(AssessmentSubmission.assessment_id == aid)
        .all()
    )

    return [_submission_to_response(s) for s in submissions]


# ---------------------------------------------------------------------------
# GET /assessments/{id}/submissions/scored  -- scored submissions sorted by score
# ---------------------------------------------------------------------------


@router.get(
    "/assessments/{assessment_id}/submissions/scored", response_model=list[SubmissionResponse]
)
def list_scored_submissions(
    assessment_id: str,
    db: Session = Depends(get_db),
):
    """List all SCORED submissions for an assessment, sorted by score descending."""
    aid = uuid.UUID(assessment_id)

    assessment = db.query(Assessment).filter(Assessment.id == aid).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found.")

    submissions = (
        db.query(AssessmentSubmission)
        .filter(
            AssessmentSubmission.assessment_id == aid,
            AssessmentSubmission.status == "SCORED",
        )
        .order_by(AssessmentSubmission.score.desc())
        .all()
    )

    return [_submission_to_response(s) for s in submissions]


# ---------------------------------------------------------------------------
# GET /submissions/{id}  -- single submission detail
# ---------------------------------------------------------------------------


@router.get("/submissions/{submission_id}", response_model=SubmissionResponse)
def get_submission(
    submission_id: str,
    db: Session = Depends(get_db),
):
    """Get a single submission with full scoring details."""
    sid = uuid.UUID(submission_id)
    submission = (
        db.query(AssessmentSubmission).filter(AssessmentSubmission.id == sid).first()
    )
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found.")

    return _submission_to_response(submission)


# ---------------------------------------------------------------------------
# GET /health
# ---------------------------------------------------------------------------


@router.get("/health")
def health_check():
    """Service health check."""
    return {"status": "ok"}


@router.put("/assessments/{assessment_id}", response_model=AssessmentResponse)
def update_assessment(
    assessment_id: str, payload: UpdateAssessmentRequest, db: Session = Depends(get_db)
):
    """Edit an existing assessment"""
    try:
        aid = uuid.UUID(assessment_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid assessment ID")

    assessment = db.query(Assessment).filter(Assessment.id == aid).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    if payload.title is not None:
        assessment.title = payload.title
    if payload.description is not None:
        assessment.description = payload.description
    if payload.timeLimitMinutes is not None:
        assessment.time_limit_minutes = payload.timeLimitMinutes
    if payload.questions is not None:
        # Convert Pydantic models to dicts
        assessment.questions = [q.model_dump() for q in payload.questions]

    db.commit()
    db.refresh(assessment)
    return _assessment_to_response(assessment)


@router.delete("/assessments/{assessment_id}")
def delete_assessment(assessment_id: str, db: Session = Depends(get_db)):
    """Delete an assessment (and marks submissions via cascade or manual if needed)"""
    try:
        aid = uuid.UUID(assessment_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid assessment ID")

    assessment = db.query(Assessment).filter(Assessment.id == aid).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    db.delete(assessment)
    db.commit()
    return {"status": "success", "message": "Assessment deleted"}


import httpx

from app.config import settings


@router.post("/assessments/generate")
def generate_assessment(
    payload: GenerateAssessmentRequest,
):
    """Generate an assessment using Groq via httpx from the job description"""
    if not settings.GROQ_API_KEY:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY is not configured")

    # fetch job description from jobs-service
    job_resp = httpx.get(f"http://jobs-service:8083/api/v1/jobs/{payload.jobId}")
    if job_resp.status_code != 200:
        raise HTTPException(status_code=500, detail="Could not fetch job info")

    job_data = job_resp.json()
    job_description = job_data.get("description", "")
    requirements = job_data.get("requirements", "")

    text_content = f"Job Description:\n{job_description}\nRequirements:\n{requirements}"

    prompt = f"""
You are an expert technical interviewer. Based on the following job description and requirements, generate an assessment test with 5 multiple-choice questions (MCQ) and 3 short-answer questions (SHORT_ANSWER).
Return your response STRICTLY as a JSON object with a single key "questions" containing an array matching exactly this schema:
{{
  "questions": [
    {{
      "id": "q1",
      "type": "MCQ",
      "text": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": "Option C",
      "max_score": 1.0
    }},
    {{
      "id": "q6",
      "type": "SHORT_ANSWER",
      "text": "Explain this concept...",
      "correct_answer": "The desired keyword or exact string expected for deterministic matching (keep it brief like 'Microservices' or 'SOLID')",
      "max_score": 2.0
    }}
  ]
}}

No markdown formatting like ```json, just the raw JSON object.

Context:
{text_content}
    """

    groq_payload = {
        "model": settings.GROQ_MODEL or "llama-3.3-70b-versatile",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
    }

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
    }
    gen_url = "https://api.groq.com/openai/v1/chat/completions"

    gen_resp = httpx.post(gen_url, json=groq_payload, headers=headers, timeout=30.0)

    if gen_resp.status_code != 200:
        logger.error(f"Groq API error: {gen_resp.text}")
        raise HTTPException(status_code=500, detail="Failed to generate assessment")

    gen_data = gen_resp.json()
    try:
        raw_text = gen_data["choices"][0]["message"]["content"].strip()

        # Clean up markdown code blocks if present
        import re

        raw_text = re.sub(r"^```(?:json)?\s*", "", raw_text, flags=re.IGNORECASE)
        raw_text = re.sub(r"\s*```$", "", raw_text)

        import json

        data = json.loads(raw_text.strip())
        questions = data.get("questions", data) if isinstance(data, dict) else data
    except Exception as e:
        logger.error(
            f"Error parsing Groq response: {e}\nRaw response: {raw_text if 'raw_text' in locals() else gen_data}"
        )
        raise HTTPException(status_code=500, detail="Error parsing AI response")

    return {"questions": questions}
