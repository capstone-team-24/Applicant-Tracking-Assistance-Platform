"""
API route handlers for the ATS Assessment Service.
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional
import json
import re

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import settings
from app.kafka_producer import publish_assessment_completed
from app.models import (
    AnswerSubmission,
    Assessment,
    AssessmentResponse,
    AssessmentSubmission,
    AttemptStateRequest,
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


def _parse_client_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _get_or_create_submission(db: Session, assessment_id: uuid.UUID, candidate_id: uuid.UUID) -> AssessmentSubmission:
    submission = (
        db.query(AssessmentSubmission)
        .filter(
            AssessmentSubmission.assessment_id == assessment_id,
            AssessmentSubmission.candidate_id == candidate_id,
        )
        .first()
    )
    if submission:
        return submission

    submission = AssessmentSubmission(
        id=uuid.uuid4(),
        assessment_id=assessment_id,
        candidate_id=candidate_id,
        status="IN_PROGRESS",
    )
    db.add(submission)
    db.flush()
    return submission


def _reset_disqualified_submission(db: Session, submission: AssessmentSubmission) -> AssessmentSubmission:
    submission.answers = []
    submission.score = None
    submission.scoring_details = None
    submission.llm_rationale = None
    submission.status = "IN_PROGRESS"
    submission.started_at = datetime.now(timezone.utc)
    submission.warning_accepted_at = None
    submission.exam_started_at = None
    submission.strike_count = 0
    submission.disqualified_at = None
    submission.last_activity_at = None
    submission.submitted_at = None
    submission.scored_at = None

    db.query(ProctoringEvent).filter(
        ProctoringEvent.submission_id == submission.id
    ).delete(synchronize_session=False)
    return submission


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
        startedAt=(s.exam_started_at or s.started_at).isoformat() if (s.exam_started_at or s.started_at) else None,
        warningAcceptedAt=s.warning_accepted_at.isoformat() if s.warning_accepted_at else None,
        examStartedAt=s.exam_started_at.isoformat() if s.exam_started_at else None,
        strikeCount=s.strike_count or 0,
        disqualifiedAt=s.disqualified_at.isoformat() if s.disqualified_at else None,
        lastActivityAt=s.last_activity_at.isoformat() if s.last_activity_at else None,
        submittedAt=s.submitted_at.isoformat() if s.submitted_at else None,
        scoredAt=s.scored_at.isoformat() if s.scored_at else None,
    )


def _proctoring_event_to_response(event: ProctoringEvent) -> ProctoringEventResponse:
    event_data = event.event_data or {}
    return ProctoringEventResponse(
        id=str(event.id),
        submissionId=str(event.submission_id),
        eventType=event.event_type,
        eventData=event_data,
        reason=event_data.get("reason"),
        strikeType=event_data.get("strikeType"),
        strikeCount=event_data.get("strikeCount"),
        evidence=event_data.get("evidence"),
        timestamp=event.timestamp.isoformat(),
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
        existing = _get_or_create_submission(db, assessment.id, cid)
        if existing.id:
            db.commit()
            logger.info(f"Ensured submission {existing.id} exists for candidate {cid}")

    return _assessment_to_response(assessment)


@router.get("/assessments/{assessment_id}/submission", response_model=SubmissionResponse)
def get_submission_for_candidate(
    assessment_id: str,
    candidate_id: str = Query(..., alias="candidateId"),
    db: Session = Depends(get_db),
):
    aid = uuid.UUID(assessment_id)
    cid = uuid.UUID(candidate_id)

    submission = _get_or_create_submission(db, aid, cid)
    db.commit()
    db.refresh(submission)
    return _submission_to_response(submission)


@router.patch("/assessments/{assessment_id}/attempt-state", response_model=SubmissionResponse)
def update_attempt_state(
    assessment_id: str,
    req: AttemptStateRequest,
    candidate_id: str = Query(..., alias="candidateId"),
    db: Session = Depends(get_db),
):
    aid = uuid.UUID(assessment_id)
    cid = uuid.UUID(candidate_id)

    submission = _get_or_create_submission(db, aid, cid)

    if req.warningAccepted and submission.warning_accepted_at is None:
        submission.warning_accepted_at = datetime.now(timezone.utc)

    if req.examStarted and submission.exam_started_at is None:
        now = datetime.now(timezone.utc)
        submission.exam_started_at = now
        if submission.warning_accepted_at is None:
            submission.warning_accepted_at = now

    if req.lastActivityAt:
        submission.last_activity_at = _parse_client_datetime(req.lastActivityAt)

    if req.strikeReason and submission.status == "IN_PROGRESS":
        submission.strike_count = (submission.strike_count or 0) + 1
        submission.last_activity_at = datetime.now(timezone.utc)
        event_data = {
            "reason": req.strikeReason,
            "strikeType": req.strikeType or "unknown",
            "strikeCount": submission.strike_count,
            "evidence": req.evidence,
        }
        event = ProctoringEvent(
            id=uuid.uuid4(),
            submission_id=submission.id,
            event_type="ATTEMPT_STRIKE",
            event_data=event_data,
            timestamp=datetime.now(timezone.utc),
        )
        db.add(event)
        if submission.strike_count >= 3 and submission.disqualified_at is None:
            submission.disqualified_at = datetime.now(timezone.utc)
            submission.status = "DISQUALIFIED"

    db.commit()
    db.refresh(submission)
    return _submission_to_response(submission)


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

    if submission.status == "DISQUALIFIED":
        raise HTTPException(status_code=403, detail="This assessment attempt has been disqualified.")

    if submission.status != "IN_PROGRESS":
        raise HTTPException(
            status_code=400,
            detail="Cannot save answers for a submission that is not in progress.",
        )

    submission.answers = [a.model_dump() for a in req.answers]
    submission.last_activity_at = _parse_client_datetime(req.lastActivityAt) or datetime.now(timezone.utc)
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

    submission = _get_or_create_submission(db, aid, cid)

    if submission.status == "SCORED":
        raise HTTPException(
            status_code=400, detail="This submission has already been scored."
        )

    if submission.status == "DISQUALIFIED":
        raise HTTPException(
            status_code=403, detail="This assessment attempt has been disqualified."
        )

    # Store final answers and mark as submitted
    submission.answers = [a.model_dump() for a in req.answers]
    submission.status = "SUBMITTED"
    submission.last_activity_at = datetime.now(timezone.utc)
    if submission.exam_started_at is None:
        submission.exam_started_at = datetime.now(timezone.utc)
    if submission.warning_accepted_at is None:
        submission.warning_accepted_at = submission.exam_started_at
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

    return _proctoring_event_to_response(event)


@router.get(
    "/assessments/submissions/{submission_id}/proctoring-events",
    response_model=list[ProctoringEventResponse],
)
def list_submission_proctoring_events(
    submission_id: str,
    db: Session = Depends(get_db),
):
    """Return the exact proctoring offense log for a submission."""
    sub_id = uuid.UUID(submission_id)
    submission = (
        db.query(AssessmentSubmission).filter(AssessmentSubmission.id == sub_id).first()
    )
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found.")

    events = (
        db.query(ProctoringEvent)
        .filter(ProctoringEvent.submission_id == sub_id)
        .order_by(ProctoringEvent.timestamp.asc())
        .all()
    )
    return [_proctoring_event_to_response(event) for event in events]


@router.post(
    "/assessments/{token}/candidates/{candidate_id}/reset-disqualification",
    response_model=SubmissionResponse,
)
def reset_candidate_disqualification(
    token: str,
    candidate_id: str,
    x_internal_service_token: Optional[str] = Header(
        None, alias="X-Internal-Service-Token"
    ),
    db: Session = Depends(get_db),
):
    """Clear a disqualified OA attempt so a recruiter can let the candidate retake it."""
    if x_internal_service_token != settings.INTERNAL_SERVICE_TOKEN:
        raise HTTPException(status_code=403, detail="Forbidden.")

    assessment = db.query(Assessment).filter(Assessment.access_token == token).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found.")

    cid = uuid.UUID(candidate_id)
    submission = (
        db.query(AssessmentSubmission)
        .filter(
            AssessmentSubmission.assessment_id == assessment.id,
            AssessmentSubmission.candidate_id == cid,
        )
        .first()
    )
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found.")

    if submission.status != "DISQUALIFIED" and submission.disqualified_at is None:
        return _submission_to_response(submission)

    _reset_disqualified_submission(db, submission)
    db.commit()
    db.refresh(submission)
    logger.info(
        "Reset disqualified assessment submission %s for candidate %s",
        submission.id,
        cid,
    )
    return _submission_to_response(submission)


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
    skills = job_data.get("skills") or []
    question_count = max(1, min(payload.questionCount, 30))
    mcq_count = max(1, round(question_count * 0.65))
    short_count = question_count - mcq_count
    if question_count > 1 and short_count == 0:
        mcq_count -= 1
        short_count = 1

    text_content = f"Job Description:\n{job_description}\nRequirements:\n{requirements}\nSkills:\n{', '.join(skills)}"

    prompt = f"""
You are an expert technical interviewer. Based on the following job description and requirements, generate exactly {question_count} assessment questions.

Question mix:
- {mcq_count} multiple-choice questions with type "MCQ".
- {short_count} short-answer questions with type "SHORT_ANSWER".
- Do NOT generate coding questions, code-writing tasks, or any question with type "CODE".

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
      "correct_answer": "A concise reference answer with expected keywords and concepts for AI grading.",
      "max_score": 2.0
    }}
  ]
}}

Rules:
- Only use "MCQ" or "SHORT_ANSWER" as the type.
- MCQ questions must have exactly 4 options and correct_answer must exactly match one option.
- SHORT_ANSWER questions should have a reference answer that describes the expected concepts, not just a single exact-match string.
- Keep each question directly relevant to the role.
- Return exactly {question_count} questions.

No markdown formatting like ```json, just the raw JSON object.

Context:
{text_content}
    """

    groq_payload = {
        "model": settings.GROQ_MODEL or "llama-3.3-70b-versatile",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.2,
        "max_tokens": min(6000, max(2000, question_count * 220)),
        "response_format": {"type": "json_object"},
    }

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
    }
    gen_url = "https://api.groq.com/openai/v1/chat/completions"

    gen_resp = httpx.post(gen_url, json=groq_payload, headers=headers, timeout=60.0)

    if gen_resp.status_code != 200:
        logger.error(f"Groq API error: {gen_resp.text}")
        raise HTTPException(status_code=500, detail="Failed to generate assessment")

    gen_data = gen_resp.json()
    try:
        raw_text = gen_data["choices"][0]["message"]["content"].strip()

        # Clean up markdown code blocks if present
        raw_text = re.sub(r"^```(?:json)?\s*", "", raw_text, flags=re.IGNORECASE)
        raw_text = re.sub(r"\s*```$", "", raw_text)

        data = json.loads(raw_text.strip())
        questions = data.get("questions", data) if isinstance(data, dict) else data
    except Exception as e:
        logger.error(
            f"Error parsing Groq response: {e}\nRaw response: {raw_text if 'raw_text' in locals() else gen_data}"
        )
        raise HTTPException(status_code=500, detail="Error parsing AI response")

    normalized_questions = []
    for raw_question in questions if isinstance(questions, list) else []:
        if not isinstance(raw_question, dict):
            continue

        q_type = str(raw_question.get("type", "")).upper()
        if q_type not in {"MCQ", "SHORT_ANSWER"}:
            continue

        text = str(raw_question.get("text", "")).strip()
        if not text:
            continue

        question = {
            "id": f"q{len(normalized_questions) + 1}",
            "type": q_type,
            "text": text,
            "correct_answer": str(raw_question.get("correct_answer", "")).strip(),
            "max_score": 1.0 if q_type == "MCQ" else 2.0,
        }

        if q_type == "MCQ":
            options = raw_question.get("options") or []
            options = [str(option).strip() for option in options if str(option).strip()]
            if len(options) < 4:
                continue
            question["options"] = options[:4]
            if question["correct_answer"] not in question["options"]:
                question["correct_answer"] = question["options"][0]

        normalized_questions.append(question)
        if len(normalized_questions) >= question_count:
            break

    if not normalized_questions:
        raise HTTPException(status_code=500, detail="AI did not generate usable questions")

    return {"questions": normalized_questions}
