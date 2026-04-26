"""
Scoring service -- orchestrates grading of an entire submission.

For each question/answer pair the service:
  1. MCQ -> deterministic exact-match (no LLM call)
  2. SHORT_ANSWER -> LLM adapter scoring with audit logging
  3. CODE -> LLM adapter or heuristic scoring with audit logging
"""

import hashlib
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List

from sqlalchemy.orm import Session

from app.config import settings
from app.llm_adapter import get_llm_adapter, MockLLMAdapter
from app.models import (
    Assessment,
    AssessmentSubmission,
    LLMAuditLog,
    ScoreDetail,
)

logger = logging.getLogger(__name__)


def _build_question_map(questions_json: list) -> Dict[str, dict]:
    """Map question id -> question dict for fast lookup."""
    return {q["id"]: q for q in questions_json}


def _create_audit_log(
    db: Session,
    submission_id: uuid.UUID,
    adapter,
    question: dict,
    answer: str,
    result: dict,
) -> None:
    """Persist an LLM audit trail entry."""
    prompt_text = json.dumps(
        {"question": question, "answer": answer}, sort_keys=True
    )
    prompt_hash = hashlib.sha256(prompt_text.encode()).hexdigest()

    log_entry = LLMAuditLog(
        id=uuid.uuid4(),
        submission_id=submission_id,
        model_name=adapter.model_name,
        prompt_hash=result.get("prompt_hash", prompt_hash),
        prompt_template_id=f"score_{question.get('type', 'unknown').lower()}_v1",
        input_variables={
            "question_id": question.get("id"),
            "question_type": question.get("type"),
            "question_text": question.get("text", "")[:500],
            "answer_preview": answer[:500],
        },
        raw_response=result.get("raw_response", json.dumps(result)),
        score=result.get("score", 0.0),
    )
    db.add(log_entry)


def score_submission(
    assessment: Assessment,
    submission: AssessmentSubmission,
    db: Session,
) -> Dict[str, Any]:
    """
    Score every answer in a submission and persist results.

    Returns a summary dict with total_score, max_score, percentage,
    and per-question details.
    """
    adapter = get_llm_adapter(settings.LLM_PROVIDER)
    question_map = _build_question_map(assessment.questions or [])

    answers: list = submission.answers or []
    answer_map: Dict[str, str] = {a["questionId"]: a["answer"] for a in answers}

    details: List[Dict[str, Any]] = []
    total_score = 0.0
    total_max = 0.0
    rationale_parts: List[str] = []

    for q_id, question in question_map.items():
        q_type = question.get("type", "").upper()
        max_score = float(question.get("max_score", 1.0))
        total_max += max_score
        candidate_answer = answer_map.get(q_id, "")

        if not candidate_answer:
            details.append({
                "questionId": q_id,
                "questionType": q_type,
                "score": 0.0,
                "maxScore": max_score,
                "rationale": "No answer provided.",
            })
            rationale_parts.append(f"Q {q_id}: No answer provided (0/{max_score}).")
            continue

        # --- MCQ / SHORT_ANSWER: always deterministic, no LLM call -------------------------
        if q_type in ("MCQ", "SHORT_ANSWER"):
            correct = (question.get("correct_answer") or "").strip().lower()
            given = candidate_answer.strip().lower()
            if given == correct:
                q_score = max_score
                q_rationale = "Correct answer selected."
            else:
                q_score = 0.0
                q_rationale = f"Incorrect. Expected '{correct}', got '{given}'."

            details.append({
                "questionId": q_id,
                "questionType": q_type,
                "score": q_score,
                "maxScore": max_score,
                "rationale": q_rationale,
            })
            total_score += q_score
            rationale_parts.append(f"Q {q_id} ({q_type}): {q_rationale} ({q_score}/{max_score})")
            continue

        # --- CODE: use LLM adapter ---------------------------
        try:
            result = adapter.score_answer(
                question=question,
                answer=candidate_answer,
                context={"submission_id": str(submission.id)},
            )
        except Exception as e:
            logger.error(f"LLM adapter error for question {q_id}: {e}")
            result = {"score": 0.0, "rationale": f"Scoring error: {e}"}

        q_score = min(float(result.get("score", 0.0)), max_score)
        q_rationale = result.get("rationale", "")

        # Audit log for LLM-scored questions
        try:
            _create_audit_log(
                db=db,
                submission_id=submission.id,
                adapter=adapter,
                question=question,
                answer=candidate_answer,
                result=result,
            )
        except Exception as e:
            logger.error(f"Failed to create audit log for question {q_id}: {e}")

        details.append({
            "questionId": q_id,
            "questionType": q_type,
            "score": q_score,
            "maxScore": max_score,
            "rationale": q_rationale,
        })
        total_score += q_score
        rationale_parts.append(
            f"Q {q_id} ({q_type}): {q_rationale} ({q_score}/{max_score})"
        )

    # Round final score
    total_score = round(total_score, 2)
    percentage = round((total_score / total_max * 100) if total_max > 0 else 0.0, 1)

    # Persist results on the submission
    # Store as percentage (0-100) so the frontend can display it directly
    now = datetime.now(timezone.utc)
    submission.score = percentage
    submission.scoring_details = details
    submission.llm_rationale = "\n".join(rationale_parts)
    submission.status = "SCORED"
    submission.scored_at = now

    db.add(submission)
    db.commit()
    db.refresh(submission)

    summary = {
        "submissionId": str(submission.id),
        "assessmentId": str(submission.assessment_id),
        "candidateId": str(submission.candidate_id),
        "totalScore": total_score,
        "maxScore": total_max,
        "percentage": percentage,
        "status": "SCORED",
        "details": details,
    }

    logger.info(
        f"Scored submission {submission.id}: {total_score}/{total_max} ({percentage}%)"
    )
    return summary
