"""
LLM adapter layer: abstract base + Mock, OpenAI, and Claude implementations.

The mock adapter produces deterministic, keyword-based scores so that demo
runs look realistic without requiring an API key.
"""

import hashlib
import json
import logging
import re
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

from app.config import settings
from app.prompt_templates import RAG_RANKING_PROMPT, RAG_RANKING_USER_TEMPLATE

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# Abstract base
# ═══════════════════════════════════════════════════════════════════════════════


class LLMAdapter(ABC):
    """Interface every LLM backend must implement."""

    @property
    @abstractmethod
    def model_name(self) -> str:
        ...

    @abstractmethod
    def score_candidate(
        self,
        job_desc: str,
        candidate_chunks: List[Dict[str, Any]],
        scoring_weights: Dict[str, float],
        candidate_meta: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Return dict with keys: score (0-100), summary (str), evidence (list),
        raw_response (str).
        """
        ...


# ═══════════════════════════════════════════════════════════════════════════════
# Mock adapter (deterministic keyword matching)
# ═══════════════════════════════════════════════════════════════════════════════


class MockLLMAdapter(LLMAdapter):
    """Deterministic scoring based on keyword overlap between job description
    and candidate resume chunks.  Produces realistic-looking summaries."""

    _COMMON_SKILLS = [
        "python", "java", "spring boot", "react", "typescript", "javascript",
        "aws", "docker", "kubernetes", "postgresql", "mongodb", "mysql",
        "rest api", "rest apis", "graphql", "ci/cd", "agile", "scrum",
        "machine learning", "data engineering", "microservices",
        "node.js", "go", "rust", "c++", "sql", "nosql",
        "tdd", "unit testing", "integration testing",
        "system design", "leadership", "communication",
        "redis", "kafka", "rabbitmq", "terraform", "ansible",
        "deep learning", "nlp", "computer vision", "pytorch", "tensorflow",
    ]

    @property
    def model_name(self) -> str:
        return "mock-keyword-scorer-v1"

    def score_candidate(
        self,
        job_desc: str,
        candidate_chunks: List[Dict[str, Any]],
        scoring_weights: Dict[str, float],
        candidate_meta: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        job_lower = job_desc.lower()
        chunk_text = " ".join(c.get("text", "") for c in candidate_chunks).lower()

        # Extract skills mentioned in the job description
        job_skills = [s for s in self._COMMON_SKILLS if s in job_lower]
        if not job_skills:
            # Fallback: use simple word tokens
            job_skills = list(set(re.findall(r"\b[a-z]{3,}\b", job_lower)))[:15]

        # Check which skills appear in the candidate chunks
        matched = [s for s in job_skills if s in chunk_text]
        missing = [s for s in job_skills if s not in chunk_text]

        # ── Score calculation ─────────────────────────────────────────────
        if job_skills:
            match_ratio = len(matched) / len(job_skills)
        else:
            match_ratio = 0.5  # neutral when no skills are extractable

        # Map ratio to a 40-95 score range (nobody gets 0 or 100 from keyword match)
        score = int(40 + match_ratio * 55)

        # Slight deterministic jitter based on content hash
        content_hash = int(
            hashlib.md5((job_desc + chunk_text).encode()).hexdigest(), 16
        )
        jitter = (content_hash % 11) - 5  # range -5..+5
        score = max(10, min(98, score + jitter))

        # ── Summary ───────────────────────────────────────────────────────
        strong_str = ", ".join(matched[:5]) if matched else "general experience"
        weak_str = ", ".join(missing[:3]) if missing else "none identified"
        summary = f"Strong: {strong_str}; Gaps: {weak_str}"

        # ── Evidence ──────────────────────────────────────────────────────
        evidence: List[Dict[str, str]] = []
        for chunk in candidate_chunks[:2]:
            text = chunk.get("text", "")
            phrase = text[:120] + ("..." if len(text) > 120 else "")
            evidence.append(
                {"chunkId": chunk.get("chunkId", "unknown"), "phrase": phrase}
            )

        raw_response = json.dumps(
            {"score": score, "summary": summary, "evidence": evidence}, indent=2
        )

        return {
            "score": score,
            "summary": summary,
            "evidence": evidence,
            "raw_response": raw_response,
        }


# ═══════════════════════════════════════════════════════════════════════════════
# OpenAI adapter
# ═══════════════════════════════════════════════════════════════════════════════


class OpenAIAdapter(LLMAdapter):
    """Calls the OpenAI Chat Completions API with the RAG ranking prompt."""

    @property
    def model_name(self) -> str:
        return "gpt-4o"

    def score_candidate(
        self,
        job_desc: str,
        candidate_chunks: List[Dict[str, Any]],
        scoring_weights: Dict[str, float],
        candidate_meta: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        import httpx

        evidence_text = "\n".join(
            f"[Chunk {c.get('chunkId', 'N/A')}] ({c.get('section', '')}): {c.get('text', '')}"
            for c in candidate_chunks
        )
        user_content = RAG_RANKING_USER_TEMPLATE.format(
            job_description=job_desc,
            evidence_chunks=evidence_text,
            w_semantic=scoring_weights.get("semantic", 0.4),
            w_assessment=scoring_weights.get("assessment", 0.2),
            w_llm=scoring_weights.get("llm", 0.4),
        )

        payload = {
            "model": self.model_name,
            "messages": [
                {"role": "system", "content": RAG_RANKING_PROMPT},
                {"role": "user", "content": user_content},
            ],
            "temperature": 0.2,
            "max_tokens": 512,
        }

        headers = {
            "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
            "Content-Type": "application/json",
        }

        resp = httpx.post(
            "https://api.openai.com/v1/chat/completions",
            json=payload,
            headers=headers,
            timeout=30.0,
        )
        resp.raise_for_status()
        raw = resp.json()["choices"][0]["message"]["content"]

        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            parsed = {"score": 50, "summary": raw[:200], "evidence": []}

        return {
            "score": parsed.get("score", 50),
            "summary": parsed.get("summary", ""),
            "evidence": parsed.get("evidence", []),
            "raw_response": raw,
        }


# ═══════════════════════════════════════════════════════════════════════════════
# Claude (Anthropic) adapter
# ═══════════════════════════════════════════════════════════════════════════════


class ClaudeAdapter(LLMAdapter):
    """Calls the Anthropic Messages API with the RAG ranking prompt."""

    @property
    def model_name(self) -> str:
        return "claude-sonnet-4-20250514"

    def score_candidate(
        self,
        job_desc: str,
        candidate_chunks: List[Dict[str, Any]],
        scoring_weights: Dict[str, float],
        candidate_meta: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        import httpx

        evidence_text = "\n".join(
            f"[Chunk {c.get('chunkId', 'N/A')}] ({c.get('section', '')}): {c.get('text', '')}"
            for c in candidate_chunks
        )
        user_content = RAG_RANKING_USER_TEMPLATE.format(
            job_description=job_desc,
            evidence_chunks=evidence_text,
            w_semantic=scoring_weights.get("semantic", 0.4),
            w_assessment=scoring_weights.get("assessment", 0.2),
            w_llm=scoring_weights.get("llm", 0.4),
        )

        payload = {
            "model": self.model_name,
            "max_tokens": 512,
            "system": RAG_RANKING_PROMPT,
            "messages": [{"role": "user", "content": user_content}],
        }

        headers = {
            "x-api-key": settings.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        }

        resp = httpx.post(
            "https://api.anthropic.com/v1/messages",
            json=payload,
            headers=headers,
            timeout=30.0,
        )
        resp.raise_for_status()
        raw = resp.json()["content"][0]["text"]

        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            parsed = {"score": 50, "summary": raw[:200], "evidence": []}

        return {
            "score": parsed.get("score", 50),
            "summary": parsed.get("summary", ""),
            "evidence": parsed.get("evidence", []),
            "raw_response": raw,
        }


# ═══════════════════════════════════════════════════════════════════════════════
# Gemini (Google) adapter  —  free-tier compatible
# ═══════════════════════════════════════════════════════════════════════════════


class GeminiAdapter(LLMAdapter):
    """Calls the Google Gemini API (free tier) for candidate scoring."""

    @property
    def model_name(self) -> str:
        return "gemini-2.0-flash"

    def score_candidate(
        self,
        job_desc: str,
        candidate_chunks: List[Dict[str, Any]],
        scoring_weights: Dict[str, float],
        candidate_meta: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        import google.generativeai as genai

        genai.configure(api_key=settings.GEMINI_API_KEY)

        evidence_text = "\n".join(
            f"[Chunk {c.get('chunkId', 'N/A')}] ({c.get('section', '')}): {c.get('text', '')}"
            for c in candidate_chunks
        )
        user_content = RAG_RANKING_USER_TEMPLATE.format(
            job_description=job_desc,
            evidence_chunks=evidence_text,
            w_semantic=scoring_weights.get("semantic", 0.4),
            w_assessment=scoring_weights.get("assessment", 0.2),
            w_llm=scoring_weights.get("llm", 0.4),
        )

        full_prompt = f"{RAG_RANKING_PROMPT}\n\n{user_content}"

        model = genai.GenerativeModel(
            self.model_name,
            generation_config=genai.GenerationConfig(
                temperature=0.2,
                max_output_tokens=512,
            ),
        )

        response = model.generate_content(full_prompt)
        raw = response.text

        # Try to extract JSON from the response
        try:
            # Handle markdown code blocks
            text = raw.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1] if "\n" in text else text[3:]
                if text.endswith("```"):
                    text = text[:-3]
                text = text.strip()
            parsed = json.loads(text)
        except json.JSONDecodeError:
            logger.warning("Gemini response was not valid JSON, using fallback parsing.")
            parsed = {"score": 50, "summary": raw[:200], "evidence": []}

        return {
            "score": parsed.get("score", 50),
            "summary": parsed.get("summary", ""),
            "evidence": parsed.get("evidence", []),
            "raw_response": raw,
        }


# ═══════════════════════════════════════════════════════════════════════════════
# Groq adapter  —  fast open-model inference
# ═══════════════════════════════════════════════════════════════════════════════


class GroqAdapter(LLMAdapter):
    """Calls the Groq chat completions API for candidate scoring."""

    @property
    def model_name(self) -> str:
        return settings.GROQ_MODEL or "llama-3.3-70b-versatile"

    def score_candidate(
        self,
        job_desc: str,
        candidate_chunks: List[Dict[str, Any]],
        scoring_weights: Dict[str, float],
        candidate_meta: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        from groq import Groq

        evidence_text = "\n".join(
            f"[Chunk {c.get('chunkId', 'N/A')}] ({c.get('section', '')}): {c.get('text', '')}"
            for c in candidate_chunks
        )
        user_content = RAG_RANKING_USER_TEMPLATE.format(
            job_description=job_desc,
            evidence_chunks=evidence_text,
            w_semantic=scoring_weights.get("semantic", 0.4),
            w_assessment=scoring_weights.get("assessment", 0.2),
            w_llm=scoring_weights.get("llm", 0.4),
        )

        client = Groq(api_key=settings.GROQ_API_KEY)
        response = client.chat.completions.create(
            model=self.model_name,
            messages=[
                {"role": "system", "content": RAG_RANKING_PROMPT},
                {"role": "user", "content": user_content},
            ],
            temperature=0.2,
            max_tokens=512,
        )
        raw = response.choices[0].message.content

        try:
            text = raw.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1] if "\n" in text else text[3:]
                if text.endswith("```"):
                    text = text[:-3]
                text = text.strip()
            parsed = json.loads(text)
        except json.JSONDecodeError:
            logger.warning("Groq response was not valid JSON, using fallback parsing.")
            parsed = {"score": 50, "summary": raw[:200], "evidence": []}

        return {
            "score": parsed.get("score", 50),
            "summary": parsed.get("summary", ""),
            "evidence": parsed.get("evidence", []),
            "raw_response": raw,
        }


# ═══════════════════════════════════════════════════════════════════════════════
# Factory
# ═══════════════════════════════════════════════════════════════════════════════

_ADAPTERS = {
    "mock": MockLLMAdapter,
    "openai": OpenAIAdapter,
    "claude": ClaudeAdapter,
    "anthropic": ClaudeAdapter,
    "gemini": GeminiAdapter,
    "google": GeminiAdapter,
    "groq": GroqAdapter,
}


def get_llm_adapter(provider: Optional[str] = None) -> LLMAdapter:
    """Instantiate the LLM adapter for the given (or configured) provider."""
    provider = (provider or settings.LLM_PROVIDER).lower().strip()
    cls = _ADAPTERS.get(provider)
    if cls is None:
        logger.warning(
            "Unknown LLM provider '%s'; falling back to mock.", provider
        )
        cls = MockLLMAdapter
    return cls()
