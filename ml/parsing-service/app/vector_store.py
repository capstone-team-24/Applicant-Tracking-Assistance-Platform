"""Adapters for storing and querying resume-chunk vectors.

The primary implementation targets **Weaviate**.  A stub ``ChromaAdapter``
with the same interface is provided for future use.

In DEMO_MODE, Weaviate operations degrade gracefully -- vectors are kept in
an in-memory dict so the rest of the pipeline can run without a live Weaviate
instance.
"""

import logging
import uuid as _uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import numpy as np

from app.config import settings

logger = logging.getLogger(__name__)


# =========================================================================
# Weaviate adapter
# =========================================================================

class WeaviateAdapter:
    """Thin wrapper around the Weaviate v4 client."""

    CLASS_NAME = "ResumeChunk"

    def __init__(
        self,
        host: str = settings.WEAVIATE_HOST,
        port: int = settings.WEAVIATE_PORT,
    ) -> None:
        self._host = host
        self._port = port
        self._client = None
        self._demo_store: Dict[str, dict] = {}  # in-memory fallback

        if not settings.DEMO_MODE:
            self._connect()
        else:
            logger.info(
                "DEMO_MODE active -- WeaviateAdapter will use in-memory store."
            )

    # ------------------------------------------------------------------
    # Connection
    # ------------------------------------------------------------------

    def _connect(self) -> None:
        try:
            import weaviate

            self._client = weaviate.connect_to_local(
                host=self._host,
                port=self._port,
            )
            logger.info("Connected to Weaviate at %s:%s", self._host, self._port)
        except Exception as exc:
            logger.warning(
                "Could not connect to Weaviate (%s:%s): %s. "
                "Falling back to in-memory store.",
                self._host, self._port, exc,
            )
            self._client = None

    # ------------------------------------------------------------------
    # Schema management
    # ------------------------------------------------------------------

    def ensure_schema(self) -> None:
        """Create the ``ResumeChunk`` collection if it does not exist.

        Properties
        ----------
        chunkId : string
        applicationId : string
        candidateId : string
        section : string
        text : text
        parseConfidence : number
        createdAt : date
        sourceFilePath : string

        The collection is configured with *no* vectorizer -- vectors are
        supplied at insert time.
        """
        if self._client is None:
            logger.info("Weaviate not available; skipping schema creation.")
            return

        try:
            import weaviate.classes.config as wc

            collections = self._client.collections.list_all()
            existing_names = [c for c in collections]

            if self.CLASS_NAME in existing_names:
                logger.info("Weaviate collection '%s' already exists.", self.CLASS_NAME)
                return

            self._client.collections.create(
                name=self.CLASS_NAME,
                vectorizer_config=wc.Configure.Vectorizer.none(),
                properties=[
                    wc.Property(name="chunkId", data_type=wc.DataType.TEXT),
                    wc.Property(name="applicationId", data_type=wc.DataType.TEXT),
                    wc.Property(name="candidateId", data_type=wc.DataType.TEXT),
                    wc.Property(name="section", data_type=wc.DataType.TEXT),
                    wc.Property(name="text", data_type=wc.DataType.TEXT),
                    wc.Property(name="parseConfidence", data_type=wc.DataType.NUMBER),
                    wc.Property(name="createdAt", data_type=wc.DataType.DATE),
                    wc.Property(name="sourceFilePath", data_type=wc.DataType.TEXT),
                ],
            )
            logger.info("Created Weaviate collection '%s'.", self.CLASS_NAME)
        except Exception as exc:
            logger.error("Failed to ensure Weaviate schema: %s", exc)

    # ------------------------------------------------------------------
    # Upsert
    # ------------------------------------------------------------------

    def upsert_chunks(
        self,
        chunks: List[dict],
        embeddings: List[List[float]],
        metadata: dict,
    ) -> int:
        """Batch-upsert chunks with their embedding vectors.

        Parameters
        ----------
        chunks : list of dict
            Each dict must contain ``chunk_id``, ``text``, ``section``.
        embeddings : list of list[float]
            Corresponding embedding vectors.
        metadata : dict
            Shared metadata: ``application_id``, ``candidate_id`` (optional),
            ``parse_confidence``, ``source_file_path``.

        Returns
        -------
        int
            Number of objects successfully upserted.
        """
        application_id = metadata.get("application_id", "")
        candidate_id = metadata.get("candidate_id", "")
        parse_confidence = metadata.get("parse_confidence", 0.0)
        source_file_path = metadata.get("source_file_path", "")
        now_iso = datetime.now(timezone.utc).isoformat()

        if self._client is not None:
            return self._upsert_weaviate(
                chunks, embeddings, application_id, candidate_id,
                parse_confidence, source_file_path, now_iso,
            )

        # In-memory fallback (DEMO_MODE)
        return self._upsert_memory(
            chunks, embeddings, application_id, candidate_id,
            parse_confidence, source_file_path, now_iso,
        )

    def _upsert_weaviate(
        self,
        chunks: List[dict],
        embeddings: List[List[float]],
        application_id: str,
        candidate_id: str,
        parse_confidence: float,
        source_file_path: str,
        now_iso: str,
    ) -> int:
        try:
            collection = self._client.collections.get(self.CLASS_NAME)

            with collection.batch.dynamic() as batch:
                for chunk, vector in zip(chunks, embeddings):
                    properties = {
                        "chunkId": chunk["chunk_id"],
                        "applicationId": application_id,
                        "candidateId": candidate_id,
                        "section": chunk.get("section", "general"),
                        "text": chunk["text"],
                        "parseConfidence": parse_confidence,
                        "createdAt": now_iso,
                        "sourceFilePath": source_file_path,
                    }
                    batch.add_object(
                        properties=properties,
                        vector=vector,
                    )

            logger.info(
                "Upserted %d chunks to Weaviate for application %s.",
                len(chunks), application_id,
            )
            return len(chunks)
        except Exception as exc:
            logger.error("Weaviate upsert failed: %s", exc)
            # Fall through to in-memory
            return self._upsert_memory(
                chunks, embeddings, application_id, candidate_id,
                parse_confidence, source_file_path, now_iso,
            )

    def _upsert_memory(
        self,
        chunks: List[dict],
        embeddings: List[List[float]],
        application_id: str,
        candidate_id: str,
        parse_confidence: float,
        source_file_path: str,
        now_iso: str,
    ) -> int:
        for chunk, vector in zip(chunks, embeddings):
            key = chunk["chunk_id"]
            self._demo_store[key] = {
                "chunkId": key,
                "applicationId": application_id,
                "candidateId": candidate_id,
                "section": chunk.get("section", "general"),
                "text": chunk["text"],
                "parseConfidence": parse_confidence,
                "createdAt": now_iso,
                "sourceFilePath": source_file_path,
                "vector": vector,
            }
        logger.info(
            "Stored %d chunks in memory for application %s (demo mode).",
            len(chunks), application_id,
        )
        return len(chunks)

    # ------------------------------------------------------------------
    # Search
    # ------------------------------------------------------------------

    def search_similar(
        self,
        query_embedding: List[float],
        filters: Optional[dict] = None,
        limit: int = 10,
    ) -> List[dict]:
        """Return the *limit* most similar chunks to *query_embedding*.

        Parameters
        ----------
        query_embedding : list[float]
        filters : dict, optional
            Key/value pairs applied as equality filters (e.g.
            ``{"applicationId": "..."}``)
        limit : int
        """
        if self._client is not None:
            return self._search_weaviate(query_embedding, filters, limit)

        return self._search_memory(query_embedding, filters, limit)

    def _search_weaviate(
        self,
        query_embedding: List[float],
        filters: Optional[dict],
        limit: int,
    ) -> List[dict]:
        try:
            import weaviate.classes.query as wq

            collection = self._client.collections.get(self.CLASS_NAME)

            weaviate_filters = None
            if filters:
                import weaviate.classes.query as wq_filter
                filter_conditions = []
                for key, value in filters.items():
                    filter_conditions.append(
                        collection.filter.by_property(key).equal(value)
                    )
                if len(filter_conditions) == 1:
                    weaviate_filters = filter_conditions[0]

            response = collection.query.near_vector(
                near_vector=query_embedding,
                limit=limit,
                filters=weaviate_filters,
                return_metadata=wq.MetadataQuery(distance=True),
            )

            results = []
            for obj in response.objects:
                item = dict(obj.properties)
                if obj.metadata and obj.metadata.distance is not None:
                    item["distance"] = obj.metadata.distance
                results.append(item)

            return results
        except Exception as exc:
            logger.error("Weaviate search failed: %s", exc)
            return self._search_memory(query_embedding, filters, limit)

    def _search_memory(
        self,
        query_embedding: List[float],
        filters: Optional[dict],
        limit: int,
    ) -> List[dict]:
        """Brute-force cosine-similarity search over the in-memory store."""
        query_vec = np.array(query_embedding, dtype=np.float32)
        scored: list[tuple[float, dict]] = []

        for record in self._demo_store.values():
            # Apply filters
            if filters:
                skip = False
                for k, v in filters.items():
                    if record.get(k) != v:
                        skip = True
                        break
                if skip:
                    continue

            rec_vec = np.array(record["vector"], dtype=np.float32)
            cos_sim = float(np.dot(query_vec, rec_vec) / (
                np.linalg.norm(query_vec) * np.linalg.norm(rec_vec) + 1e-10
            ))
            scored.append((cos_sim, record))

        scored.sort(key=lambda x: x[0], reverse=True)

        results = []
        for sim, record in scored[:limit]:
            item = {k: v for k, v in record.items() if k != "vector"}
            item["similarity"] = sim
            results.append(item)

        return results

    # ------------------------------------------------------------------
    # Delete
    # ------------------------------------------------------------------

    def delete_by_application(self, application_id: str) -> int:
        """Delete all chunks belonging to *application_id*.

        Returns the number of deleted objects.
        """
        if self._client is not None:
            return self._delete_weaviate(application_id)

        return self._delete_memory(application_id)

    def _delete_weaviate(self, application_id: str) -> int:
        try:
            import weaviate.classes.query as wq

            collection = self._client.collections.get(self.CLASS_NAME)
            result = collection.data.delete_many(
                where=collection.filter.by_property("applicationId").equal(application_id),
            )
            count = result.successful if hasattr(result, "successful") else 0
            logger.info(
                "Deleted %s chunks from Weaviate for application %s.",
                count, application_id,
            )
            return count
        except Exception as exc:
            logger.error("Weaviate delete failed: %s", exc)
            return self._delete_memory(application_id)

    def _delete_memory(self, application_id: str) -> int:
        keys_to_delete = [
            k for k, v in self._demo_store.items()
            if v.get("applicationId") == application_id
        ]
        for k in keys_to_delete:
            del self._demo_store[k]
        logger.info(
            "Deleted %d chunks from memory for application %s.",
            len(keys_to_delete), application_id,
        )
        return len(keys_to_delete)


# =========================================================================
# Chroma adapter (stubbed)
# =========================================================================

class ChromaAdapter:
    """Alternative vector-store adapter targeting ChromaDB.

    This adapter exposes the same interface as ``WeaviateAdapter`` but is
    **not yet implemented**.  It is provided as a placeholder so that the
    service can be reconfigured to use Chroma in the future by swapping the
    adapter class.

    To implement, install ``chromadb`` and fill in each method body.
    """

    def __init__(self, host: str = "localhost", port: int = 8000) -> None:
        # TODO: Initialize chromadb.HttpClient(host=host, port=port)
        raise NotImplementedError(
            "ChromaAdapter is not yet implemented. Use WeaviateAdapter."
        )

    def ensure_schema(self) -> None:
        # TODO: Create or get the 'resume_chunks' collection in Chroma
        raise NotImplementedError(
            "ChromaAdapter.ensure_schema is not yet implemented."
        )

    def upsert_chunks(
        self,
        chunks: List[dict],
        embeddings: List[List[float]],
        metadata: dict,
    ) -> int:
        # TODO: collection.upsert(ids, embeddings, metadatas, documents)
        raise NotImplementedError(
            "ChromaAdapter.upsert_chunks is not yet implemented."
        )

    def search_similar(
        self,
        query_embedding: List[float],
        filters: Optional[dict] = None,
        limit: int = 10,
    ) -> List[dict]:
        # TODO: collection.query(query_embeddings, n_results, where)
        raise NotImplementedError(
            "ChromaAdapter.search_similar is not yet implemented."
        )

    def delete_by_application(self, application_id: str) -> int:
        # TODO: collection.delete(where={"applicationId": application_id})
        raise NotImplementedError(
            "ChromaAdapter.delete_by_application is not yet implemented."
        )
