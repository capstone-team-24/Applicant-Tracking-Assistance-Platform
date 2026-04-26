"""
Prompt templates for LLM calls.

Each template has a unique ID and version so that audit logs can reference
exactly which prompt produced a given score.
"""

# ─── CV Quality Check ─────────────────────────────────────────────────────────

CV_CHECK_TEMPLATE_ID = "cv_check_v1"
CV_CHECK_VERSION = "1.0.0"

CV_CHECK_PROMPT = (
    "You are an expert HR screener. Given the resume text and job seniority, "
    "compute a JSON with fields: cv_score (0-100), format_ok (true/false), "
    "recommendations (up to 3 short strings), explanation (1-2 sentences)."
)

CV_CHECK_USER_TEMPLATE = (
    "Resume text:\n"
    "---\n"
    "{resume_text}\n"
    "---\n"
    "\n"
    "Job seniority level: {seniority}\n"
    "\n"
    "Produce the JSON output only."
)


# ─── RAG-based Candidate Ranking ──────────────────────────────────────────────

RAG_RANKING_TEMPLATE_ID = "rag_ranking_v1"
RAG_RANKING_VERSION = "1.0.0"

RAG_RANKING_PROMPT = (
    "You are a recruitment assistant. Using the following job description and "
    "candidate retrieved evidence chunks, produce a composite relevance score "
    "(0-100) and a one-line explainable summary, plus a bullet list of 2 "
    "supporting evidence phrases referencing chunk ids."
)

RAG_RANKING_USER_TEMPLATE = (
    "Job description:\n"
    "---\n"
    "{job_description}\n"
    "---\n"
    "\n"
    "Candidate evidence chunks:\n"
    "{evidence_chunks}\n"
    "\n"
    "Scoring weights: semantic={w_semantic}, assessment={w_assessment}, llm={w_llm}\n"
    "\n"
    "Return JSON with fields: score (int 0-100), summary (string), "
    "evidence (list of objects with chunkId and phrase)."
)


# ─── Registry ─────────────────────────────────────────────────────────────────

TEMPLATE_REGISTRY = {
    CV_CHECK_TEMPLATE_ID: {
        "version": CV_CHECK_VERSION,
        "system": CV_CHECK_PROMPT,
        "user": CV_CHECK_USER_TEMPLATE,
    },
    RAG_RANKING_TEMPLATE_ID: {
        "version": RAG_RANKING_VERSION,
        "system": RAG_RANKING_PROMPT,
        "user": RAG_RANKING_USER_TEMPLATE,
    },
}
