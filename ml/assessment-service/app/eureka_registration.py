"""
Eureka service registration for the ATS Assessment Service.

Registers the service with a Eureka server on startup.
Gracefully degrades if the Eureka server is unavailable.
"""

import logging
import socket
import threading

from app.config import settings

logger = logging.getLogger(__name__)

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
    """
    Register this service instance with Eureka in a background thread.

    Uses py_eureka_client to maintain a heartbeat with the Eureka server.
    If Eureka is unavailable the service continues to operate normally.
    """

    def _register():
        try:
            import py_eureka_client.eureka_client as eureka_client

            eureka_url = (
                f"http://{settings.EUREKA_HOST}:{settings.EUREKA_PORT}/eureka/"
            )

            eureka_client.init(
                eureka_server=eureka_url,
                app_name="assessment-service",
                instance_port=settings.SERVICE_PORT,
                instance_host=_get_host_ip(),
                ha_strategy=eureka_client.HA_STRATEGY_STICK,
            )

            logger.info(
                f"Registered with Eureka at {eureka_url} "
                f"(port {settings.SERVICE_PORT})"
            )

        except ImportError:
            logger.warning(
                "py-eureka-client not installed -- skipping Eureka registration."
            )
        except Exception as e:
            logger.warning(f"Could not register with Eureka: {e}")

    thread = threading.Thread(target=_register, daemon=True)
    thread.start()
