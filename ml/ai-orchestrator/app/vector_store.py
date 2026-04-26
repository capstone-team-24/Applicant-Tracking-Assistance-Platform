"""
Weaviate vector store client: schema management, upsert, and search.
"""

import hashlib
import logging
import uuid as _uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import numpy as np

from app.config import settings

logger = logging.getLogger(__name__)


class WeaviateClient:
    """Thin wrapper around the Weaviate v4 Python client."""

    def __init__(self) -> None:
        self._client = None
        self._demo_store: Dict[str, Dict[str, Any]] = {}  # in-memory fallback
        self._demo_chunks: List[Dict[str, Any]] = []

        if settings.is_demo:
            logger.info("DEMO_MODE: using in-memory vector store fallback.")
            self._seed_demo_chunks()
        else:
            self._connect()

    # ── Connection ────────────────────────────────────────────────────────

    def _connect(self) -> None:
        try:
            import weaviate

            self._client = weaviate.connect_to_local(
                host=settings.WEAVIATE_HOST,
                port=settings.WEAVIATE_PORT,
            )
            logger.info(
                "Connected to Weaviate at %s:%s",
                settings.WEAVIATE_HOST,
                settings.WEAVIATE_PORT,
            )
        except Exception:
            logger.exception("Failed to connect to Weaviate; falling back to demo store.")

    # ── Schema management ─────────────────────────────────────────────────

    def ensure_job_desc_schema(self) -> None:
        """Create the *JobDesc* class in Weaviate if it does not exist."""
        if self._client is None:
            logger.info("DEMO_MODE: skipping Weaviate schema creation for JobDesc.")
            return

        try:
            import weaviate.classes.config as wc

            if not self._client.collections.exists("JobDesc"):
                self._client.collections.create(
                    name="JobDesc",
                    properties=[
                        wc.Property(name="jobId", data_type=wc.DataType.TEXT),
                        wc.Property(name="orgId", data_type=wc.DataType.TEXT),
                        wc.Property(name="text", data_type=wc.DataType.TEXT),
                        wc.Property(name="createdAt", data_type=wc.DataType.DATE),
                    ],
                )
                logger.info("Created Weaviate class 'JobDesc'.")
            else:
                logger.info("Weaviate class 'JobDesc' already exists.")
        except Exception:
            logger.exception("Error ensuring JobDesc schema.")

    # ── Upsert ────────────────────────────────────────────────────────────

    def upsert_job_description(
        self,
        job_id: str,
        org_id: str,
        text: str,
        embedding: List[float],
    ) -> None:
        """Store (or update) a job description with its vector."""
        if self._client is None:
            self._demo_store[job_id] = {
                "jobId": job_id,
                "orgId": org_id,
                "text": text,
                "embedding": embedding,
                "createdAt": datetime.now(timezone.utc).isoformat(),
            }
            logger.info("DEMO_MODE: stored job description %s in memory.", job_id)
            return

        try:
            collection = self._client.collections.get("JobDesc")
            deterministic_uuid = _uuid.uuid5(_uuid.NAMESPACE_URL, f"jobdesc:{job_id}")

            collection.data.insert(
                uuid=deterministic_uuid,
                properties={
                    "jobId": job_id,
                    "orgId": org_id,
                    "text": text,
                    "createdAt": datetime.now(timezone.utc).isoformat(),
                },
                vector=embedding,
            )
            logger.info("Upserted job description %s into Weaviate.", job_id)
        except Exception:
            logger.exception("Failed to upsert job description %s.", job_id)

    # ── Search: resume chunks ─────────────────────────────────────────────

    def search_resume_chunks(
        self,
        query_embedding: List[float],
        application_ids: List[str],
        limit: int = 10,
    ) -> List[Dict[str, Any]]:
        """Return the most relevant resume chunks for given applications.

        Each result dict contains: text, section, candidateId, chunkId,
        distance, certainty.
        """
        if self._client is None:
            return self._demo_search_chunks(query_embedding, application_ids, limit)

        try:
            import weaviate.classes.query as wq

            collection = self._client.collections.get("ResumeChunk")

            app_filter = wq.Filter.by_property("applicationId").contains_any(
                application_ids
            )

            response = collection.query.near_vector(
                near_vector=query_embedding,
                filters=app_filter,
                limit=limit,
                return_metadata=wq.MetadataQuery(distance=True, certainty=True),
            )

            results = []
            for obj in response.objects:
                results.append(
                    {
                        "text": obj.properties.get("text", ""),
                        "section": obj.properties.get("section", ""),
                        "candidateId": obj.properties.get("candidateId", ""),
                        "chunkId": str(obj.uuid),
                        "distance": obj.metadata.distance,
                        "certainty": obj.metadata.certainty,
                    }
                )
            return results

        except Exception:
            logger.exception("Weaviate search_resume_chunks failed; using demo fallback.")
            return self._demo_search_chunks(query_embedding, application_ids, limit)

    # ── Search: similar candidates (broader) ──────────────────────────────

    def search_similar_candidates(
        self,
        job_embedding: List[float],
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        """Broader search across all resume chunks (no candidate filter)."""
        if self._client is None:
            return self._demo_search_chunks(job_embedding, [], limit)

        try:
            import weaviate.classes.query as wq

            collection = self._client.collections.get("ResumeChunk")
            response = collection.query.near_vector(
                near_vector=job_embedding,
                limit=limit,
                return_metadata=wq.MetadataQuery(distance=True, certainty=True),
            )

            results = []
            for obj in response.objects:
                results.append(
                    {
                        "text": obj.properties.get("text", ""),
                        "section": obj.properties.get("section", ""),
                        "candidateId": obj.properties.get("candidateId", ""),
                        "chunkId": str(obj.uuid),
                        "distance": obj.metadata.distance,
                        "certainty": obj.metadata.certainty,
                    }
                )
            return results

        except Exception:
            logger.exception("Weaviate search_similar_candidates failed; using demo fallback.")
            return self._demo_search_chunks(job_embedding, [], limit)

    # ── Demo helpers ──────────────────────────────────────────────────────

    _DEMO_SECTIONS = [
        "experience",
        "skills",
        "education",
        "certifications",
        "summary",
        "projects",
    ]

    _DEMO_SKILL_POOL = [
        "Python", "Java", "Spring Boot", "React", "TypeScript",
        "AWS", "Docker", "Kubernetes", "PostgreSQL", "MongoDB",
        "REST APIs", "GraphQL", "CI/CD", "Agile", "Scrum",
        "Machine Learning", "Data Engineering", "Microservices",
        "Node.js", "Go", "Rust", "C++", "SQL", "NoSQL",
        "TDD", "Unit Testing", "Integration Testing",
        "System Design", "Leadership", "Communication",
    ]

    _DEMO_TEXTS = [
        "Developed scalable microservices using {skill1} and {skill2} at a Fortune 500 company, handling 10M+ requests daily.",
        "Led a team of 5 engineers to migrate legacy systems to {skill1} with {skill2} integration, reducing latency by 40%.",
        "Built end-to-end data pipelines using {skill1}, {skill2}, and {skill3} processing 2TB of data daily.",
        "Designed and implemented {skill1} solutions with {skill2} for a high-availability e-commerce platform.",
        "Certified in {skill1}. Experienced with {skill2} and {skill3} in production environments.",
        "Published research on optimizing {skill1} performance with {skill2} techniques.",
        "Contributed to open-source {skill1} projects and mentored junior developers on {skill2} best practices.",
        "Architected event-driven systems using {skill1} and {skill2}, achieving 99.99% uptime SLA.",
        "Implemented {skill1} testing strategies including {skill2} for {skill3} applications.",
        "5+ years of experience in {skill1} development with strong background in {skill2} and {skill3}.",
    ]

    def _seed_demo_chunks(self) -> None:
        """Pre-populate the in-memory chunk store for realistic demo results."""
        rng = np.random.RandomState(42)
        demo_candidate_count = 20

        for i in range(demo_candidate_count):
            candidate_id = str(_uuid.uuid5(_uuid.NAMESPACE_URL, f"demo-candidate-{i}"))
            num_chunks = rng.randint(3, 8)

            for j in range(num_chunks):
                skills = list(rng.choice(self._DEMO_SKILL_POOL, size=3, replace=False))
                template = self._DEMO_TEXTS[rng.randint(0, len(self._DEMO_TEXTS))]
                text = template.format(
                    skill1=skills[0],
                    skill2=skills[1],
                    skill3=skills[2] if "{skill3}" in template else skills[1],
                )
                section = self._DEMO_SECTIONS[rng.randint(0, len(self._DEMO_SECTIONS))]

                vec = rng.randn(384).astype(np.float32)
                vec = vec / (np.linalg.norm(vec) + 1e-9)

                self._demo_chunks.append(
                    {
                        "text": text,
                        "section": section,
                        "candidateId": candidate_id,
                        "chunkId": str(_uuid.uuid4()),
                        "embedding": vec.tolist(),
                    }
                )

        logger.info(
            "DEMO_MODE: seeded %d resume chunks for %d candidates.",
            len(self._demo_chunks),
            demo_candidate_count,
        )

    def _demo_search_chunks(
        self,
        query_embedding: List[float],
        application_ids: List[str],
        limit: int,
    ) -> List[Dict[str, Any]]:
        """Cosine-similarity search over in-memory demo chunks.

        In demo mode, chunks are keyed by candidateId only.  If the
        supplied *application_ids* don't match any chunk's candidateId
        we fall back to an unfiltered search so the pipeline still
        produces meaningful results.
        """
        q = np.array(query_embedding, dtype=np.float32)
        q_norm = np.linalg.norm(q)
        if q_norm > 0:
            q = q / q_norm

        scored = []
        for chunk in self._demo_chunks:
            # In demo mode, application_ids won't match demo candidateIds,
            # so we skip the filter to return the best global matches.
            c = np.array(chunk["embedding"], dtype=np.float32)
            similarity = float(np.dot(q, c))
            distance = 1.0 - similarity
            scored.append(
                {
                    "text": chunk["text"],
                    "section": chunk["section"],
                    "candidateId": chunk["candidateId"],
                    "chunkId": chunk["chunkId"],
                    "distance": round(distance, 4),
                    "certainty": round(similarity, 4),
                }
            )

        scored.sort(key=lambda x: x["distance"])
        return scored[:limit]


# Module-level singleton
weaviate_client = WeaviateClient()
