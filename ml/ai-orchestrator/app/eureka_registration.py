"""
Eureka service-discovery registration.

Registers this service instance with a Spring Cloud Eureka server so that
other microservices (e.g. the Java-based ATS backend) can discover it.
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
    """Register the AI Orchestrator with Eureka (non-blocking).

    Uses ``py_eureka_client`` if available.  Failures are logged but never
    propagate -- the service can still operate without discovery.
    """

    def _register():
        try:
            import py_eureka_client.eureka_client as eureka_client

            host_ip = _get_host_ip()
            eureka_url = (
                f"http://{settings.EUREKA_HOST}:{settings.EUREKA_PORT}/eureka/"
            )

            eureka_client.init(
                eureka_server=eureka_url,
                app_name="ai-orchestrator",
                instance_host=host_ip,
                instance_port=settings.SERVICE_PORT,
                renewal_interval_in_secs=30,
                duration_in_secs=90,
                health_check_url=f"http://{host_ip}:{settings.SERVICE_PORT}/health",
                home_page_url=f"http://{host_ip}:{settings.SERVICE_PORT}/",
                status_page_url=f"http://{host_ip}:{settings.SERVICE_PORT}/health",
            )

            logger.info(
                "Registered with Eureka at %s as ai-orchestrator (%s:%d).",
                eureka_url,
                host_ip,
                settings.SERVICE_PORT,
            )
        except ImportError:
            logger.warning("py-eureka-client not installed; skipping Eureka registration.")
        except Exception:
            logger.exception("Eureka registration failed; service will run without discovery.")

    t = threading.Thread(target=_register, daemon=True, name="eureka-register")
    t.start()
