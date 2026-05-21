"""
FastAPI route definitions for the AI Orchestrator.
"""

import logging
import threading
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    AuditExportResponse,
    AuditRecord,
    CandidateRankResult,
    LLMAuditLog,
    RankingJob,
    RankRequest,
    RankStatusResponse,
)
from app.ranking_service import rank_candidates

logger = logging.getLogger(__name__)

router = APIRouter()


# ─── POST /rank ───────────────────────────────────────────────────────────────


@router.post("/rank", tags=["ranking"])
def trigger_ranking(request: RankRequest, db: Session = Depends(get_db)):
    """Manually trigger a candidate ranking job.

    Creates a ``RankingJob``, kicks off the pipeline in a background thread,
    and immediately returns the job ID so the caller can poll for results.
    """
    ranking_job_id = str(uuid.uuid4())

    # Validate UUIDs
    try:
        job_uuid = uuid.UUID(request.jobId)
    except ValueError:
        raise HTTPException(status_code=400, detail="jobId is not a valid UUID.")

    for cid in request.applicationIds:
        try:
            uuid.UUID(cid)
        except ValueError:
            raise HTTPException(
                status_code=400, detail=f"applicationId '{cid}' is not a valid UUID."
            )

    # Persist the job
    rj = RankingJob(
        id=uuid.UUID(ranking_job_id),
        job_id=job_uuid,
        status="PENDING",
        candidate_ids=request.applicationIds,
    )
    db.add(rj)
    db.commit()

    # Run ranking in the background so the response returns immediately
    def _run():
        from app.database import SessionLocal

        bg_db = SessionLocal()
        try:
            rank_candidates(ranking_job_id, request.jobId, request.applicationIds, bg_db)
        finally:
            bg_db.close()

    t = threading.Thread(target=_run, daemon=True, name=f"rank-{ranking_job_id[:8]}")
    t.start()

    return {"rankingJobId": ranking_job_id, "status": "PENDING"}


# ─── GET /rank/{ranking_job_id} ──────────────────────────────────────────────


@router.get("/rank/{ranking_job_id}", response_model=RankStatusResponse, tags=["ranking"])
def get_ranking_status(ranking_job_id: str, db: Session = Depends(get_db)):
    """Return the current status (and results, if completed) of a ranking job."""
    try:
        rj_uuid = uuid.UUID(ranking_job_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ranking job ID.")

    rj: Optional[RankingJob] = (
        db.query(RankingJob).filter(RankingJob.id == rj_uuid).first()
    )
    if rj is None:
        raise HTTPException(status_code=404, detail="Ranking job not found.")

    results = None
    if rj.results:
        results = [
            CandidateRankResult(
                candidateId=r.get("candidateId", ""),
                applicationId=r.get("applicationId"),
                semanticScore=r.get("semanticScore", 0),
                    assessmentScore=r.get("assessmentScore", 0),
                    interviewScore=r.get("interviewScore", 0),
                    llmQualityScore=r.get("llmQualityScore", 0),
                compositeScore=r.get("compositeScore", 0),
                summary=r.get("summary"),
                evidenceChunks=r.get("evidenceChunks"),
            )
            for r in rj.results
        ]

    return RankStatusResponse(
        rankingJobId=str(rj.id),
        jobId=str(rj.job_id),
        status=rj.status,
        results=results,
        createdAt=rj.created_at.isoformat() if rj.created_at else "",
        completedAt=rj.completed_at.isoformat() if rj.completed_at else None,
    )


# ─── GET /audit/export ───────────────────────────────────────────────────────


@router.get("/audit/export", response_model=AuditExportResponse, tags=["audit"])
def export_audit_logs(
    limit: int = Query(100, ge=1, le=5000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """Export LLM audit logs for compliance review."""
    total = db.query(LLMAuditLog).count()
    logs = (
        db.query(LLMAuditLog)
        .order_by(LLMAuditLog.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    records = [
        AuditRecord(
            id=str(log.id),
            rankingJobId=str(log.ranking_job_id) if log.ranking_job_id else None,
            candidateId=str(log.candidate_id) if log.candidate_id else None,
            modelName=log.model_name,
            promptHash=log.prompt_hash,
            promptTemplateId=log.prompt_template_id,
            inputVariables=log.input_variables,
            rawResponse=log.raw_response,
            createdAt=log.created_at.isoformat() if log.created_at else "",
        )
        for log in logs
    ]

    return AuditExportResponse(records=records, total=total)


# ─── GET /health ──────────────────────────────────────────────────────────────


@router.get("/health", tags=["health"])
def health_check():
    """Simple liveness probe."""
    return {"status": "ok"}
