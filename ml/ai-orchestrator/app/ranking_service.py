"""
Core ranking pipeline: fetches job description, queries Weaviate for
resume chunks, calls the LLM adapter, computes composite scores, persists
results, and publishes the completion event.
"""

import hashlib
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.config import settings
from app.embeddings import embedding_service
from app.llm_adapter import get_llm_adapter
from app.models import LLMAuditLog, RankingJob, RankingResult
from app.prompt_templates import RAG_RANKING_TEMPLATE_ID
from app.vector_store import weaviate_client

logger = logging.getLogger(__name__)

# ── Default scoring weights ───────────────────────────────────────────────────

DEFAULT_WEIGHTS: Dict[str, float] = {
    "semantic": 0.40,
    "assessment": 0.20,
    "llm": 0.40,
}

# ── Demo job descriptions (used when the jobs-service is unreachable) ─────────

_DEMO_JOB_DESCRIPTIONS: Dict[str, str] = {
    "default": (
        "We are looking for a Senior Software Engineer with strong experience "
        "in Python, microservices, REST APIs, Docker, and Kubernetes. "
        "The ideal candidate has 5+ years of experience, familiarity with "
        "PostgreSQL, CI/CD pipelines, Agile methodologies, and excellent "
        "communication skills. Machine learning exposure is a plus."
    ),
}


# ═══════════════════════════════════════════════════════════════════════════════
# Public entry-point
# ═══════════════════════════════════════════════════════════════════════════════


def rank_candidates(
    ranking_job_id: str,
    job_id: str,
    application_ids: List[str],
    db: Session,
) -> None:
    """Execute the full ranking pipeline for a single RankingJob."""

    try:
        # 1. Mark job as PROCESSING
        _update_job_status(ranking_job_id, "PROCESSING", db)

        # 2. Fetch job description
        job_desc = _fetch_job_description(job_id)

        # 3. Compute job-description embedding
        job_embedding = embedding_service.compute_embedding(job_desc)

        # 4. Store/update job description in Weaviate
        weaviate_client.upsert_job_description(
            job_id=job_id, org_id="default-org", text=job_desc, embedding=job_embedding
        )

        # 5. Score each application
        llm_adapter = get_llm_adapter()
        weights = _normalise_weights(DEFAULT_WEIGHTS.copy())
        results: List[Dict[str, Any]] = []

        for app_id in application_ids:
            try:
                result = _score_single_candidate(
                    ranking_job_id=ranking_job_id,
                    job_id=job_id,
                    job_desc=job_desc,
                    job_embedding=job_embedding,
                    application_id=app_id,
                    weights=weights,
                    llm_adapter=llm_adapter,
                    db=db,
                )
                results.append(result)
            except Exception:
                logger.exception("Failed to score application %s", app_id)
                results.append(
                    {
                        "candidateId": app_id,
                        "applicationId": app_id,
                        "semanticScore": 0.0,
                        "assessmentScore": 0.0,
                        "llmQualityScore": 0.0,
                        "compositeScore": 0.0,
                        "summary": "Scoring failed for this candidate.",
                        "evidenceChunks": [],
                    }
                )

        # 6. Sort by composite score desc and assign ranking position
        results.sort(key=lambda r: r["compositeScore"], reverse=True)
        for idx, r in enumerate(results, start=1):
            r["rankingPosition"] = idx

        # 7. Persist aggregated results and mark COMPLETED
        _complete_job(ranking_job_id, results, db)

        # 8. Publish event
        _publish_result_event(ranking_job_id, job_id, results)

        logger.info(
            "Ranking job %s completed: %d candidates scored.",
            ranking_job_id,
            len(results),
        )

    except Exception:
        logger.exception("Ranking job %s failed.", ranking_job_id)
        try:
            _update_job_status(ranking_job_id, "FAILED", db)
        except Exception:
            logger.exception("Could not mark job %s as FAILED.", ranking_job_id)


# ═══════════════════════════════════════════════════════════════════════════════
# Internal helpers
# ═══════════════════════════════════════════════════════════════════════════════


def _score_single_candidate(
    ranking_job_id: str,
    job_id: str,
    job_desc: str,
    job_embedding: List[float],
    application_id: str,
    weights: Dict[str, float],
    llm_adapter: Any,
    db: Session,
) -> Dict[str, Any]:
    """Score one application/candidate and persist the row."""

    # a. Vector search: top-k resume chunks for this application
    chunks = weaviate_client.search_resume_chunks(
        query_embedding=job_embedding,
        application_ids=[application_id],
        limit=10,
    )

    # b. Compute semantic_score (average certainty, normalised 0-100)
    if chunks:
        avg_certainty = sum(c.get("certainty", 0.5) for c in chunks) / len(chunks)
    else:
        avg_certainty = 0.0
    semantic_score = round(avg_certainty * 100, 2)

    # c. Assessment score (would come from DB/external service; demo=0)
    assessment_score = _fetch_assessment_score(application_id)

    # d. LLM quality score
    llm_result = llm_adapter.score_candidate(
        job_desc=job_desc,
        candidate_chunks=chunks,
        scoring_weights=weights,
        candidate_meta={"applicationId": application_id},
    )
    llm_quality_score = float(llm_result.get("score", 0))

    # e. Composite score
    composite = (
        semantic_score * weights["semantic"]
        + assessment_score * weights["assessment"]
        + llm_quality_score * weights["llm"]
    )
    composite = round(composite, 2)

    summary = llm_result.get("summary", "")
    evidence = llm_result.get("evidence", [])

    # f. Persist RankingResult
    rr = RankingResult(
        id=uuid.uuid4(),
        ranking_job_id=uuid.UUID(ranking_job_id),
        candidate_id=uuid.UUID(application_id),
        application_id=uuid.UUID(application_id),
        semantic_score=semantic_score,
        assessment_score=assessment_score,
        llm_quality_score=llm_quality_score,
        composite_score=composite,
        summary=summary,
        evidence_chunks=evidence,
    )
    db.add(rr)

    # g. Persist LLMAuditLog
    prompt_input = json.dumps(
        {"job_desc_len": len(job_desc), "chunks_count": len(chunks)}, sort_keys=True
    )
    prompt_hash = hashlib.sha256(
        (job_desc + json.dumps([c.get("text", "") for c in chunks])).encode()
    ).hexdigest()[:16]

    audit = LLMAuditLog(
        id=uuid.uuid4(),
        ranking_job_id=uuid.UUID(ranking_job_id),
        candidate_id=uuid.UUID(application_id),
        model_name=llm_adapter.model_name,
        prompt_hash=prompt_hash,
        prompt_template_id=RAG_RANKING_TEMPLATE_ID,
        input_variables=json.loads(prompt_input),
        raw_response=llm_result.get("raw_response", ""),
    )
    db.add(audit)
    db.commit()

    return {
        "candidateId": application_id,
        "applicationId": application_id,
        "semanticScore": semantic_score,
        "assessmentScore": assessment_score,
        "llmQualityScore": llm_quality_score,
        "compositeScore": composite,
        "summary": summary,
        "evidenceChunks": evidence,
    }


# ── Job description fetch ────────────────────────────────────────────────────


def _fetch_job_description(job_id: str) -> str:
    """Try to fetch from jobs-service; fall back to demo description."""
    if not settings.is_demo:
        try:
            import httpx

            url = f"http://jobs-service:8083/api/v1/jobs/{job_id}"
            resp = httpx.get(url, timeout=5.0)
            if resp.status_code == 200:
                data = resp.json()
                return data.get("description", data.get("text", ""))
        except Exception:
            logger.warning(
                "Could not reach jobs-service for job %s; using demo description.",
                job_id,
            )

    return _DEMO_JOB_DESCRIPTIONS.get(job_id, _DEMO_JOB_DESCRIPTIONS["default"])


# ── Assessment score fetch ────────────────────────────────────────────────────


def _fetch_assessment_score(candidate_id: str) -> float:
    """Placeholder: in production this would query the assessment service."""
    if settings.is_demo:
        # Deterministic demo score based on candidate ID
        seed = int(hashlib.md5(candidate_id.encode()).hexdigest(), 16) % 100
        return float(seed)
    return 0.0


# ── Weight normalisation ─────────────────────────────────────────────────────


def _normalise_weights(weights: Dict[str, float]) -> Dict[str, float]:
    """Ensure weights sum to 1.0; normalise proportionally if needed."""
    total = sum(weights.values())
    if total <= 0:
        n = len(weights)
        return {k: 1.0 / n for k in weights}
    if abs(total - 1.0) > 1e-6:
        logger.info("Weights sum=%.4f; normalising to 1.0.", total)
        return {k: v / total for k, v in weights.items()}
    return weights


# ── Job status helpers ────────────────────────────────────────────────────────


def _update_job_status(ranking_job_id: str, status: str, db: Session) -> None:
    job = (
        db.query(RankingJob).filter(RankingJob.id == uuid.UUID(ranking_job_id)).first()
    )
    if job:
        job.status = status
        if status in ("COMPLETED", "FAILED"):
            job.completed_at = datetime.now(timezone.utc)
        db.commit()


def _complete_job(
    ranking_job_id: str,
    results: List[Dict[str, Any]],
    db: Session,
) -> None:
    job = (
        db.query(RankingJob).filter(RankingJob.id == uuid.UUID(ranking_job_id)).first()
    )
    if job:
        job.status = "COMPLETED"
        job.results = results
        job.completed_at = datetime.now(timezone.utc)
        db.commit()


# ── Event publishing ──────────────────────────────────────────────────────────


def _publish_result_event(
    ranking_job_id: str,
    job_id: str,
    results: List[Dict[str, Any]],
) -> None:
    """Best-effort publish via Kafka."""
    try:
        from app.kafka_consumer import publish_event

        rankings = [
            {
                "applicationId": r["applicationId"],
                "compositeScore": r["compositeScore"],
                "rankingPosition": r.get("rankingPosition", idx + 1),
            }
            for idx, r in enumerate(results)
        ]

        payload = {
            "rankingJobId": ranking_job_id,
            "jobId": job_id,
            "status": "COMPLETED",
            "rankings": rankings,
            "metadata": {
                "candidateCount": len(results),
                "topApplicationId": results[0]["applicationId"] if results else None,
            },
        }
        publish_event(
            "job.rank.result",
            payload,
            type_id="com.ats.jobs.dto.RankResultEvent",
        )
    except Exception:
        logger.exception("Failed to publish ranking result event.")
