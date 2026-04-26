"""Kafka consumer for resume-parse events and completion publisher."""

import json
import logging
import os
import threading
from typing import Callable, Optional

from kafka import KafkaConsumer, KafkaProducer

logger = logging.getLogger(__name__)

TOPIC_IN = "application.submitted"
TOPIC_OUT = "resume.parse.completed"
GROUP_ID = "parsing-service-group"

_producer: Optional[KafkaProducer] = None
_producer_lock = threading.Lock()


def _get_bootstrap_servers():
    return [os.environ.get("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")]


def _ensure_producer() -> Optional[KafkaProducer]:
    global _producer
    with _producer_lock:
        if _producer is None:
            try:
                _producer = KafkaProducer(
                    bootstrap_servers=_get_bootstrap_servers(),
                    value_serializer=lambda v: json.dumps(v, default=str).encode(
                        "utf-8"
                    ),
                )
            except Exception as exc:
                logger.error("Failed to create KafkaProducer: %s", exc)
                return None
        return _producer


def publish_completion_event(event: dict) -> None:
    """Publish a resume.parse.completed event to the dedicated Kafka topic.

    This is a module-level helper so that ``parser_service`` (and any route
    handler) can call it without holding a reference to the consumer wrapper.
    """
    producer = _ensure_producer()
    if producer is None:
        logger.warning(
            "Kafka producer unavailable – completion event not published: %s", event
        )
        return

    try:
        producer.send(
            topic=TOPIC_OUT,
            key=b"resume.parse.completed",
            value=event,
        )
        producer.flush()
        logger.info(
            "Published resume.parse.completed event for application %s",
            event.get("applicationId"),
        )
    except Exception as exc:
        logger.error("Failed to publish completion event: %s", exc)


class KafkaConsumerWrapper:
    def __init__(self, handler: Callable[[dict], None]) -> None:
        self._handler = handler
        self._consumer: Optional[KafkaConsumer] = None
        self._running = False

    def start_consuming(self) -> None:
        if os.environ.get("DEMO_MODE", "false").lower() == "true":
            logger.info("DEMO_MODE active – Kafka consumer will not start.")
            return

        try:
            self._consumer = KafkaConsumer(
                TOPIC_IN,
                bootstrap_servers=_get_bootstrap_servers(),
                group_id=GROUP_ID,
                auto_offset_reset="latest",
            )
        except Exception as exc:
            logger.warning("Kafka consumer could not start: %s", exc)
            return

        logger.info(
            "Kafka consumer started on topic '%s'. Waiting for messages …", TOPIC_IN
        )
        self._running = True
        try:
            for msg in self._consumer:
                if not self._running:
                    break
                try:
                    payload = json.loads(msg.value.decode("utf-8"))
                    logger.info(
                        "Received message on topic '%s' (key=%s)",
                        TOPIC_IN,
                        msg.key.decode("utf-8") if msg.key else None,
                    )
                    self._handler(payload)
                except json.JSONDecodeError as exc:
                    logger.error("Invalid JSON in message body: %s", exc)
                except Exception as exc:
                    logger.error("Error processing message: %s", exc, exc_info=True)
        except Exception as exc:
            logger.error("Kafka consumer error: %s", exc, exc_info=True)
        finally:
            if self._consumer:
                self._consumer.close()


def start_consumer_thread(handler: Callable[[dict], None]) -> threading.Thread:
    consumer = KafkaConsumerWrapper(handler)
    thread = threading.Thread(
        target=consumer.start_consuming, daemon=True, name="kafka-consumer"
    )
    thread.start()
    logger.info("Kafka consumer thread started.")
    return thread
