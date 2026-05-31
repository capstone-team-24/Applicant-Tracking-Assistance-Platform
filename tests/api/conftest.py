import os
import time

import pytest
import requests

from .helpers import ApiClient, DEFAULT_POLL_SECONDS, DEFAULT_WAIT_SECONDS


@pytest.fixture(scope="session")
def api_base_url() -> str:
    return os.getenv("ATS_API_BASE_URL", "http://localhost:8080")


@pytest.fixture(scope="session")
def mailhog_base_url() -> str:
    return os.getenv("ATS_MAILHOG_BASE_URL", "http://localhost:8025")


@pytest.fixture(scope="session")
def api(api_base_url: str) -> ApiClient:
    client = ApiClient(api_base_url)
    deadline = time.time() + DEFAULT_WAIT_SECONDS
    last_error = None

    while time.time() < deadline:
        try:
            gateway_health = client.request("GET", "/actuator/health", expected_status=None)
            jwks = client.request("GET", "/.well-known/jwks.json", expected_status=None)
            if gateway_health.status_code == 200 and jwks.status_code == 200:
                return client
            last_error = f"gateway={gateway_health.status_code}, jwks={jwks.status_code}"
        except requests.RequestException as exc:
            last_error = str(exc)
        time.sleep(DEFAULT_POLL_SECONDS)

    pytest.skip(
        f"ATS API was not ready at {api_base_url}. Start the local stack before running integration tests. "
        f"Last error: {last_error}"
    )
