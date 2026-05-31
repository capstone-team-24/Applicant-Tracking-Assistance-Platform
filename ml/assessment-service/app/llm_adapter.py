"""
LLM Adapter layer for scoring short-answer questions.

Provides a pluggable interface with implementations for:
  - MockLLMAdapter   (deterministic, no external calls)
  - OpenAIAdapter    (calls OpenAI chat completions)
  - ClaudeAdapter    (calls Anthropic messages API)
"""

import hashlib
import json
import logging
import re
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Abstract base
# ---------------------------------------------------------------------------

class LLMAdapter(ABC):
    """Base class every LLM scoring adapter must implement."""

    @abstractmethod
    def score_answer(
        self,
        question: dict,
        answer: str,
        context: Optional[dict] = None,
    ) -> Dict[str, Any]:
        """
        Score a candidate answer.

        Returns
        -------
        dict with at least:
            score     : float  (0 .. max_score)
            rationale : str
        """
        ...

    @property
    def model_name(self) -> str:
        return self.__class__.__name__


# ---------------------------------------------------------------------------
# Mock adapter -- fully deterministic, no network
# ---------------------------------------------------------------------------

class MockLLMAdapter(LLMAdapter):
    """
    Deterministic scoring used in tests and when no LLM key is configured.

    - MCQ:          exact match -> full score, else 0
    - SHORT_ANSWER: keyword overlap gives partial credit
    """

    @property
    def model_name(self) -> str:
        return "mock-scorer-v1"

    def score_answer(
        self,
        question: dict,
        answer: str,
        context: Optional[dict] = None,
    ) -> Dict[str, Any]:
        q_type = question.get("type", "").upper()
        max_score = float(question.get("max_score", 1.0))

        if q_type == "MCQ":
            return self._score_mcq(question, answer, max_score)
        elif q_type == "SHORT_ANSWER":
            return self._score_short_answer(question, answer, max_score)
        return {
            "score": 0.0,
            "rationale": f"Unknown question type: {q_type}",
        }

    # -- MCQ -----------------------------------------------------------------
    @staticmethod
    def _score_mcq(question: dict, answer: str, max_score: float) -> dict:
        correct = (question.get("correct_answer") or "").strip().lower()
        given = answer.strip().lower()
        if given == correct:
            return {
                "score": max_score,
                "rationale": "Correct answer selected.",
            }
        return {
            "score": 0.0,
            "rationale": f"Incorrect. Expected '{correct}', got '{given}'.",
        }

    # -- SHORT_ANSWER --------------------------------------------------------
    @staticmethod
    def _score_short_answer(question: dict, answer: str, max_score: float) -> dict:
        correct = question.get("correct_answer", "")
        if not correct:
            # No reference answer -- give partial credit based on length
            word_count = len(answer.split())
            if word_count >= 20:
                score = max_score * 0.7
                rationale = (
                    "No reference answer available. "
                    "Awarded partial credit based on response completeness."
                )
            elif word_count >= 5:
                score = max_score * 0.4
                rationale = (
                    "No reference answer available. "
                    "Brief response received; partial credit awarded."
                )
            else:
                score = max_score * 0.1
                rationale = (
                    "No reference answer available. "
                    "Response too brief for meaningful evaluation."
                )
            return {"score": round(score, 2), "rationale": rationale}

        # Keyword overlap scoring
        ref_keywords = set(re.findall(r"\w+", correct.lower()))
        ans_keywords = set(re.findall(r"\w+", answer.lower()))

        if not ref_keywords:
            return {"score": 0.0, "rationale": "No keywords in reference answer."}

        overlap = ref_keywords & ans_keywords
        ratio = len(overlap) / len(ref_keywords)

        # Exact match
        if correct.strip().lower() == answer.strip().lower():
            return {"score": max_score, "rationale": "Exact match with reference answer."}

        score = round(max_score * min(ratio * 1.2, 1.0), 2)

        if ratio >= 0.8:
            rationale = (
                f"Strong keyword overlap ({len(overlap)}/{len(ref_keywords)} keywords matched). "
                "Answer demonstrates solid understanding of the topic."
            )
        elif ratio >= 0.5:
            rationale = (
                f"Moderate keyword overlap ({len(overlap)}/{len(ref_keywords)} keywords matched). "
                "Answer covers some key concepts but misses others."
            )
        elif ratio >= 0.2:
            rationale = (
                f"Weak keyword overlap ({len(overlap)}/{len(ref_keywords)} keywords matched). "
                "Answer only partially addresses the question."
            )
        else:
            rationale = (
                f"Minimal keyword overlap ({len(overlap)}/{len(ref_keywords)} keywords matched). "
                "Answer does not adequately address the question."
            )

        return {"score": score, "rationale": rationale}

# ---------------------------------------------------------------------------
# OpenAI adapter
# ---------------------------------------------------------------------------

class OpenAIAdapter(LLMAdapter):
    """Score answers by calling the OpenAI chat completions API."""

    API_URL = "https://api.openai.com/v1/chat/completions"
    MODEL = "gpt-4o-mini"

    def __init__(self, api_key: str):
        self.api_key = api_key

    @property
    def model_name(self) -> str:
        return self.MODEL

    def _build_prompt(self, question: dict, answer: str) -> str:
        return (
            "You are an expert assessment grader. Score the following answer.\n\n"
            f"Question type: {question.get('type')}\n"
            f"Question: {question.get('text')}\n"
            f"Maximum score: {question.get('max_score', 1.0)}\n"
            f"Reference answer (if any): {question.get('correct_answer', 'N/A')}\n\n"
            f"Candidate answer:\n{answer}\n\n"
            "Respond ONLY with valid JSON in this exact format:\n"
            '{"score": <float>, "rationale": "<string>"}\n'
            "The score must be between 0 and the maximum score."
        )

    def score_answer(
        self,
        question: dict,
        answer: str,
        context: Optional[dict] = None,
    ) -> Dict[str, Any]:
        prompt = self._build_prompt(question, answer)
        try:
            with httpx.Client(timeout=30.0) as client:
                resp = client.post(
                    self.API_URL,
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": self.MODEL,
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.1,
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                content = data["choices"][0]["message"]["content"]
                result = json.loads(content)
                return {
                    "score": float(result.get("score", 0)),
                    "rationale": result.get("rationale", ""),
                    "raw_response": content,
                    "prompt_hash": hashlib.sha256(prompt.encode()).hexdigest(),
                }
        except Exception as e:
            logger.error(f"OpenAI scoring failed: {e}")
            # Fall back to mock scoring
            fallback = MockLLMAdapter()
            result = fallback.score_answer(question, answer, context)
            result["rationale"] = f"[Fallback - OpenAI error: {e}] {result['rationale']}"
            return result


# ---------------------------------------------------------------------------
# Claude / Anthropic adapter
# ---------------------------------------------------------------------------

class ClaudeAdapter(LLMAdapter):
    """Score answers by calling the Anthropic messages API."""

    API_URL = "https://api.anthropic.com/v1/messages"
    MODEL = "claude-sonnet-4-20250514"

    def __init__(self, api_key: str):
        self.api_key = api_key

    @property
    def model_name(self) -> str:
        return self.MODEL

    def _build_prompt(self, question: dict, answer: str) -> str:
        return (
            "You are an expert assessment grader. Score the following answer.\n\n"
            f"Question type: {question.get('type')}\n"
            f"Question: {question.get('text')}\n"
            f"Maximum score: {question.get('max_score', 1.0)}\n"
            f"Reference answer (if any): {question.get('correct_answer', 'N/A')}\n\n"
            f"Candidate answer:\n{answer}\n\n"
            "Respond ONLY with valid JSON in this exact format:\n"
            '{"score": <float>, "rationale": "<string>"}\n'
            "The score must be between 0 and the maximum score."
        )

    def score_answer(
        self,
        question: dict,
        answer: str,
        context: Optional[dict] = None,
    ) -> Dict[str, Any]:
        prompt = self._build_prompt(question, answer)
        try:
            with httpx.Client(timeout=30.0) as client:
                resp = client.post(
                    self.API_URL,
                    headers={
                        "x-api-key": self.api_key,
                        "anthropic-version": "2023-06-01",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": self.MODEL,
                        "max_tokens": 1024,
                        "messages": [{"role": "user", "content": prompt}],
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                content = data["content"][0]["text"]
                result = json.loads(content)
                return {
                    "score": float(result.get("score", 0)),
                    "rationale": result.get("rationale", ""),
                    "raw_response": content,
                    "prompt_hash": hashlib.sha256(prompt.encode()).hexdigest(),
                }
        except Exception as e:
            logger.error(f"Claude scoring failed: {e}")
            fallback = MockLLMAdapter()
            result = fallback.score_answer(question, answer, context)
            result["rationale"] = f"[Fallback - Claude error: {e}] {result['rationale']}"
            return result


# ---------------------------------------------------------------------------
# Groq adapter -- fast open-model inference
# ---------------------------------------------------------------------------

class GroqAdapter(LLMAdapter):
    """Score answers by calling the Groq chat completions API."""

    MODEL = "llama-3.3-70b-versatile"

    def __init__(self, api_key: str):
        self.api_key = api_key

    @property
    def model_name(self) -> str:
        return settings.GROQ_MODEL if hasattr(settings, "GROQ_MODEL") and settings.GROQ_MODEL else self.MODEL

    def _build_prompt(self, question: dict, answer: str) -> str:
        return (
            "You are an expert assessment grader. Score the following answer.\n\n"
            f"Question type: {question.get('type')}\n"
            f"Question: {question.get('text')}\n"
            f"Maximum score: {question.get('max_score', 1.0)}\n"
            f"Reference answer (if any): {question.get('correct_answer', 'N/A')}\n\n"
            f"Candidate answer:\n{answer}\n\n"
            "Respond ONLY with valid JSON in this exact format:\n"
            '{"score": <float>, "rationale": "<string>"}\n'
            "The score must be between 0 and the maximum score."
        )

    def score_answer(
        self,
        question: dict,
        answer: str,
        context: Optional[dict] = None,
    ) -> Dict[str, Any]:
        from groq import Groq

        prompt = self._build_prompt(question, answer)
        try:
            client = Groq(api_key=self.api_key)
            response = client.chat.completions.create(
                model=self.model_name,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=512,
            )
            content = response.choices[0].message.content
            text = content.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1] if "\n" in text else text[3:]
                if text.endswith("```"):
                    text = text[:-3]
                text = text.strip()
            result = json.loads(text)
            return {
                "score": float(result.get("score", 0)),
                "rationale": result.get("rationale", ""),
                "raw_response": content,
                "prompt_hash": hashlib.sha256(prompt.encode()).hexdigest(),
            }
        except Exception as e:
            logger.error(f"Groq scoring failed: {e}")
            fallback = MockLLMAdapter()
            result = fallback.score_answer(question, answer, context)
            result["rationale"] = f"[Fallback - Groq error: {e}] {result['rationale']}"
            return result


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------

def get_llm_adapter(provider: Optional[str] = None) -> LLMAdapter:
    """
    Return the appropriate LLM adapter based on the provider string.

    Parameters
    ----------
    provider : str or None
        One of "mock", "openai", "claude", "groq". Defaults to settings.LLM_PROVIDER.
    """
    provider = (provider or settings.LLM_PROVIDER).lower().strip()

    if provider == "openai":
        if not settings.OPENAI_API_KEY:
            raise ValueError(
                "OPENAI_API_KEY must be set when LLM_PROVIDER is 'openai'"
            )
        return OpenAIAdapter(api_key=settings.OPENAI_API_KEY)

    if provider in ("claude", "anthropic"):
        if not settings.ANTHROPIC_API_KEY:
            raise ValueError(
                "ANTHROPIC_API_KEY must be set when LLM_PROVIDER is 'claude'"
            )
        return ClaudeAdapter(api_key=settings.ANTHROPIC_API_KEY)

    if provider == "groq":
        groq_key = getattr(settings, "GROQ_API_KEY", None)
        if not groq_key:
            raise ValueError(
                "GROQ_API_KEY must be set when LLM_PROVIDER is 'groq'"
            )
        return GroqAdapter(api_key=groq_key)

    # Default to mock
    return MockLLMAdapter()
