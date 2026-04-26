"""Compute vector embeddings for text chunks.

In DEMO_MODE (or when the model cannot be loaded), deterministic random
384-dimensional vectors are returned so the rest of the pipeline can be
exercised without downloading heavy model weights.
"""

import hashlib
import logging
from typing import List

import numpy as np

from app.config import settings

logger = logging.getLogger(__name__)


class EmbeddingService:
    """Wraps a sentence-transformers model (or a DEMO_MODE stub)."""

    EMBEDDING_DIM = 384  # all-MiniLM-L6-v2 output dimension

    def __init__(self) -> None:
        self._model = None

        if settings.DEMO_MODE:
            logger.info(
                "DEMO_MODE active -- EmbeddingService will return deterministic "
                "random %d-dim vectors.",
                self.EMBEDDING_DIM,
            )
        else:
            self._load_model()

    # ------------------------------------------------------------------
    # Model loading
    # ------------------------------------------------------------------

    def _load_model(self) -> None:
        """Attempt to load the sentence-transformers model."""
        try:
            from sentence_transformers import SentenceTransformer

            logger.info("Loading embedding model: %s ...", settings.EMBEDDING_MODEL)
            self._model = SentenceTransformer(settings.EMBEDDING_MODEL)
            logger.info("Embedding model loaded successfully.")
        except Exception as exc:
            logger.warning(
                "Could not load embedding model (%s). Falling back to demo vectors. "
                "Error: %s",
                settings.EMBEDDING_MODEL,
                exc,
            )
            self._model = None

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def compute_embedding(self, text: str) -> List[float]:
        """Return a single embedding vector for *text*."""
        if self._model is not None:
            vector = self._model.encode(text, normalize_embeddings=True)
            return vector.tolist()

        return self._demo_vector(text)

    def compute_embeddings_batch(self, texts: List[str]) -> List[List[float]]:
        """Return a list of embedding vectors, one per input text."""
        if not texts:
            return []

        if self._model is not None:
            vectors = self._model.encode(texts, normalize_embeddings=True, batch_size=32)
            return [v.tolist() for v in vectors]

        return [self._demo_vector(t) for t in texts]

    # ------------------------------------------------------------------
    # Demo / fallback
    # ------------------------------------------------------------------

    def _demo_vector(self, text: str) -> List[float]:
        """Generate a deterministic, normalized random vector derived from the
        text content.  Using a hash-based seed ensures the same text always
        produces the same vector, which is useful for testing.
        """
        seed = int(hashlib.sha256(text.encode("utf-8")).hexdigest(), 16) % (2**32)
        rng = np.random.RandomState(seed)
        vec = rng.randn(self.EMBEDDING_DIM).astype(np.float32)
        # L2 normalize
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm
        return vec.tolist()
