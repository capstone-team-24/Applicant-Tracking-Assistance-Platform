"""
Kafka consumer: listens for ranking requests on the ``job.rank.request``
topic and dispatches them to the ranking pipeline.

Also exposes a ``publish_event`` helper for outbound messages published to
the ``job.rank.result`` topic.
"""

import json
import logging
import os
import threading
import uuid
from typing import Any, Dict, Optional

from kafka import KafkaConsumer, KafkaProducer

logger = logging.getLogger(__name__)

TOPIC_IN = "job.rank.request"
TOPIC_OUT = "job.rank.result"
GROUP_ID = "ai-orchestrator-group"

_producer = None
_lock = threading.Lock()


def _get_bootstrap_servers():
    return [os.environ.get("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")]


def _ensure_producer():
    """Return (and cache) a KafkaProducer."""
    global _producer
    with _lock:
        if _producer is None:
            _producer = KafkaProducer(
                bootstrap_servers=_get_bootstrap_servers(),
                value_serializer=lambda v: json.dumps(v, default=str).encode("utf-8"),
            )
        return _producer


def publish_event(
    routing_key: str,
    payload: Dict[str, Any],
    type_id: Optional[str] = None,
) -> None:
    """Publish a JSON message to the rank-result Kafka topic."""
    try:
        producer = _ensure_producer()
        headers = []
        if type_id:
            headers.append(("__TypeId__", type_id.encode("utf-8")))

        producer.send(
            topic=TOPIC_OUT,
            key=routing_key.encode("utf-8"),
            value=payload,
            headers=headers if headers else None,
        )
        producer.flush()
        logger.info(
            "Published event '%s' to topic '%s': %s", routing_key, TOPIC_OUT, payload
        )
    except Exception:
        logger.exception("Failed to publish event '%s'.", routing_key)


def _on_rank_request(msg) -> None:
    """Handle an incoming rank-request message."""
    try:
        data = json.loads(msg.value.decode("utf-8"))
        job_id = data.get("jobId")
        application_ids = data.get("applicationIds", [])
        ranking_job_id = data.get("rankingJobId", str(uuid.uuid4()))

        if not job_id or not application_ids:
            logger.warning("Ignoring malformed rank request: %s", data)
            return

        logger.info(
            "Received rank request for job %s with %d applications (rankingJobId=%s).",
            job_id,
            len(application_ids),
            ranking_job_id,
        )

        from app.database import SessionLocal
        from app.models import RankingJob
        from app.ranking_service import rank_candidates

        db = SessionLocal()
        try:
            rj = RankingJob(
                id=uuid.UUID(ranking_job_id),
                job_id=uuid.UUID(job_id),
                status="PENDING",
                candidate_ids=application_ids,
            )
            db.add(rj)
            db.commit()

            rank_candidates(ranking_job_id, job_id, application_ids, db)
        finally:
            db.close()

    except Exception:
        logger.exception("Error processing rank request.")


def start_consuming() -> None:
    """Start blocking consume loop on the rank-request topic."""
    try:
        consumer = KafkaConsumer(
            TOPIC_IN,
            bootstrap_servers=_get_bootstrap_servers(),
            group_id=GROUP_ID,
            auto_offset_reset="latest",
        )
        logger.info(
            "Kafka consumer started on topic '%s'. Waiting for messages.", TOPIC_IN
        )
        for msg in consumer:
            _on_rank_request(msg)
    except Exception:
        logger.exception("Kafka consumer crashed.")


def start_consumer_thread() -> threading.Thread:
    """Spin up the consumer in a background daemon thread."""
    t = threading.Thread(target=start_consuming, daemon=True, name="kafka-consumer")
    t.start()
    logger.info("Kafka consumer thread started (topic=%s).", TOPIC_IN)
    return t
