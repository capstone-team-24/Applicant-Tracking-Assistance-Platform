"""
Kafka publisher for assessment-related events.

Publishes an "assessment.completed" event when a submission is scored.
"""

import json
import logging
import os
from typing import Optional

from kafka import KafkaProducer

logger = logging.getLogger(__name__)

TOPIC = "assessment.events"
ROUTING_KEY = b"assessment.completed"

_producer = None

def _get_bootstrap_servers():
    return [os.environ.get("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")]

def _get_producer() -> Optional[KafkaProducer]:
    global _producer
    if _producer is None:
        try:
            _producer = KafkaProducer(
                bootstrap_servers=_get_bootstrap_servers(),
                value_serializer=lambda v: json.dumps(v, default=str).encode("utf-8")
            )
        except Exception as e:
            logger.warning(f"Could not connect to Kafka: {e}")
            return None
    return _producer

def publish_assessment_completed(
    submission_id: str,
    assessment_id: str,
    candidate_id: str,
    job_id: str,
    score: float,
    status: str,
) -> bool:
    payload = {
        "submissionId": submission_id,
        "assessmentId": assessment_id,
        "candidateId": candidate_id,
        "jobId": job_id,
        "score": score,
        "status": status,
    }

    producer = _get_producer()
    if producer is None:
        logger.warning(
            "Kafka unavailable -- assessment.completed event not published: "
            f"{json.dumps(payload)}"
        )
        return False

    try:
        producer.send(
            topic=TOPIC,
            key=ROUTING_KEY,
            value=payload
        )
        producer.flush()
        logger.info(f"Published assessment.completed event for submission {submission_id}")
        return True

    except Exception as e:
        logger.error(f"Failed to publish assessment.completed event: {e}")
        return False
