"""
Embedding service: wraps sentence-transformers or falls back to random
vectors in DEMO_MODE.
"""

import hashlib
import logging
from typing import List

import numpy as np

from app.config import settings

logger = logging.getLogger(__name__)


class EmbeddingService:
    """Compute dense embeddings for text passages."""

    _DEMO_DIM = 384  # all-MiniLM-L6-v2 output dimensionality

    def __init__(self) -> None:
        self._model = None

        if settings.is_demo:
            logger.info(
                "DEMO_MODE enabled: using deterministic random embeddings (%d-dim).",
                self._DEMO_DIM,
            )
        else:
            self._load_model()

    # ── Model loading ─────────────────────────────────────────────────────

    def _load_model(self) -> None:
        try:
            from sentence_transformers import SentenceTransformer

            logger.info("Loading embedding model: %s", settings.EMBEDDING_MODEL)
            self._model = SentenceTransformer(settings.EMBEDDING_MODEL)
            logger.info("Embedding model loaded successfully.")
        except Exception:
            logger.exception(
                "Failed to load embedding model '%s'. "
                "Falling back to demo (random) embeddings.",
                settings.EMBEDDING_MODEL,
            )

    # ── Public API ────────────────────────────────────────────────────────

    def compute_embedding(self, text: str) -> List[float]:
        """Return a dense vector for *text*.

        In DEMO_MODE (or when the real model failed to load) a deterministic
        pseudo-random vector is returned, seeded from the text hash so
        identical inputs always produce identical vectors.
        """
        if self._model is not None:
            embedding = self._model.encode(text, normalize_embeddings=True)
            return embedding.tolist()

        return self._demo_embedding(text)

    # ── Demo fallback ─────────────────────────────────────────────────────

    def _demo_embedding(self, text: str) -> List[float]:
        """Deterministic random vector derived from text hash."""
        seed = int(hashlib.sha256(text.encode("utf-8")).hexdigest(), 16) % (2**32)
        rng = np.random.RandomState(seed)
        vec = rng.randn(self._DEMO_DIM).astype(np.float32)
        # L2 normalize
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm
        return vec.tolist()


# Module-level singleton
embedding_service = EmbeddingService()
