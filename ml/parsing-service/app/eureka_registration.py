"""Register the service with a Netflix Eureka server.

Uses ``py-eureka-client`` for registration and periodic heartbeats.  In
DEMO_MODE (or when the Eureka server is unreachable) the registration is
skipped gracefully so the service can still start.
"""

import logging
import socket
from typing import Optional

from app.config import settings

logger = logging.getLogger(__name__)

_eureka_client = None

def _get_host_ip() -> str:
    """Best-effort detection of the host IP reachable from the network."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def register_with_eureka() -> None:
    """Register this service instance with Eureka.

    The registration includes a heartbeat that is renewed automatically by
    the ``py-eureka-client`` library in a background thread.
    """
    global _eureka_client

    if settings.DEMO_MODE:
        logger.info("DEMO_MODE active -- skipping Eureka registration.")
        return

    try:
        import py_eureka_client.eureka_client as eureka_client

        eureka_server_url = settings.eureka_url
        instance_port = settings.SERVICE_PORT

        eureka_client.init(
            eureka_server=eureka_server_url,
            app_name="parsing-service",
            instance_port=instance_port,
            instance_host=_get_host_ip(),
            renewal_interval_in_secs=30,
            duration_in_secs=90,
            ha_strategy=eureka_client.HA_STRATEGY_STICK,
        )

        _eureka_client = eureka_client
        logger.info(
            "Registered with Eureka at %s (port %d, heartbeat every 30s).",
            eureka_server_url, instance_port,
        )
    except Exception as exc:
        logger.warning(
            "Could not register with Eureka at %s:%s -- %s. "
            "Service will continue without Eureka.",
            settings.EUREKA_HOST, settings.EUREKA_PORT, exc,
        )


def deregister_from_eureka() -> None:
    """Gracefully deregister from Eureka (best-effort)."""
    global _eureka_client

    if _eureka_client is None:
        return

    try:
        import py_eureka_client.eureka_client as eureka_client
        eureka_client.stop()
        logger.info("Deregistered from Eureka.")
    except Exception as exc:
        logger.warning("Error deregistering from Eureka: %s", exc)
    finally:
        _eureka_client = None
