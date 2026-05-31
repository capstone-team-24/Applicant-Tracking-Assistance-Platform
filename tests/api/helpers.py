import json
import os
import quopri
import re
import time
import uuid
from typing import Any

import pytest
import requests


DEFAULT_TIMEOUT = float(os.getenv("ATS_TEST_REQUEST_TIMEOUT", "10"))
DEFAULT_WAIT_SECONDS = float(os.getenv("ATS_TEST_WAIT_SECONDS", "45"))
DEFAULT_POLL_SECONDS = float(os.getenv("ATS_TEST_POLL_SECONDS", "1"))

INVITE_TOKEN_RE = re.compile(
    r"token(?:=|%3D|=3D|&#x3D;|&#61;)([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})"
)


class ApiClient:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()

    def request(self, method: str, path: str, expected_status: int | set[int] | None = None, **kwargs: Any) -> requests.Response:
        url = f"{self.base_url}{path}"
        kwargs.setdefault("timeout", DEFAULT_TIMEOUT)
        response = self.session.request(method, url, **kwargs)

        if expected_status is not None:
            expected = {expected_status} if isinstance(expected_status, int) else set(expected_status)
            if response.status_code not in expected:
                pytest.fail(
                    f"{method} {path} returned {response.status_code}; expected {sorted(expected)}\n"
                    f"Response body:\n{response.text[:2000]}"
                )

        return response

    def request_json(self, method: str, path: str, expected_status: int | set[int] = 200, **kwargs: Any) -> dict[str, Any] | list[Any]:
        response = self.request(method, path, expected_status=expected_status, **kwargs)
        try:
            return response.json()
        except ValueError:
            pytest.fail(
                f"{method} {path} returned non-JSON response with status {response.status_code}:\n"
                f"{response.text[:2000]}"
            )


def assert_uuid(value: Any) -> str:
    try:
        return str(uuid.UUID(str(value)))
    except (TypeError, ValueError):
        pytest.fail(f"Expected a UUID value, got: {value!r}")


def auth_headers(access_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {access_token}"}


def unique_suffix() -> str:
    return f"{int(time.time() * 1000)}-{uuid.uuid4().hex[:8]}"


def unique_email(prefix: str, suffix: str) -> str:
    return f"{prefix}.{suffix}@example.com"


def signup_user(
    api: ApiClient,
    *,
    email: str,
    password: str,
    role: str,
    first_name: str,
    last_name: str,
    org_id: str | None = None,
) -> str:
    payload: dict[str, Any] = {
        "firstName": first_name,
        "lastName": last_name,
        "email": email,
        "password": password,
        "role": role,
    }
    if org_id:
        payload["orgId"] = org_id

    data = api.request_json("POST", "/auth/signup", expected_status=201, json=payload)
    user_id = assert_uuid(data.get("userId"))
    assert "registered" in data.get("message", "").lower()
    return user_id


def login_user(api: ApiClient, *, email: str, password: str, expected_role: str) -> dict[str, Any]:
    data = api.request_json(
        "POST",
        "/auth/login",
        expected_status=200,
        json={"email": email, "password": password},
    )
    assert data.get("accessToken"), "Login response must include accessToken"
    assert data.get("refreshToken"), "Login response must include refreshToken"
    assert data.get("role") == expected_role
    assert data.get("email") == email
    assert_uuid(data.get("userId"))
    return data


def wait_for_profile(api: ApiClient, *, access_token: str, auth_user_id: str, email: str) -> dict[str, Any]:
    deadline = time.time() + DEFAULT_WAIT_SECONDS
    last_response = ""

    while time.time() < deadline:
        response = api.request(
            "GET",
            "/api/v1/profiles/me",
            headers=auth_headers(access_token),
            expected_status=None,
        )
        last_response = f"status={response.status_code} body={response.text[:1000]}"

        if response.status_code == 200:
            data = response.json()
            if data.get("authUserId") == auth_user_id and data.get("email") == email:
                return data

        time.sleep(DEFAULT_POLL_SECONDS)

    pytest.fail(f"Profile was not available for auth user {auth_user_id}. Last response: {last_response}")


def wait_for_mailhog_message(
    mailhog_base_url: str,
    *,
    recipient_email: str,
    subject_contains: str | None = None,
    timeout_seconds: float = DEFAULT_WAIT_SECONDS,
) -> dict[str, Any]:
    base_url = mailhog_base_url.rstrip("/")
    recipient = recipient_email.lower()
    subject_filter = subject_contains.lower() if subject_contains else None
    deadline = time.time() + timeout_seconds
    last_error: str | None = None

    while time.time() < deadline:
        try:
            response = requests.get(f"{base_url}/api/v2/messages?limit=200", timeout=DEFAULT_TIMEOUT)
            response.raise_for_status()
            messages = response.json().get("items", [])
        except (requests.RequestException, ValueError) as exc:
            last_error = str(exc)
            messages = []

        for message in messages:
            searchable = mailhog_message_text(message).lower()
            if recipient not in searchable:
                continue
            if subject_filter and subject_filter not in searchable:
                continue
            return message

        time.sleep(DEFAULT_POLL_SECONDS)

    detail = f" Last error: {last_error}" if last_error else ""
    pytest.fail(f"MailHog message to {recipient_email!r} was not found within {timeout_seconds}s.{detail}")


def extract_invite_token(message: dict[str, Any]) -> str:
    searchable = mailhog_message_text(message)
    match = INVITE_TOKEN_RE.search(searchable)
    if not match:
        pytest.fail(f"Invite token was not found in MailHog message:\n{searchable[:2000]}")
    return assert_uuid(match.group(1))


def mailhog_message_text(message: dict[str, Any]) -> str:
    raw_text_parts = list(_walk_strings(message))
    raw_text_parts.append(json.dumps(message, default=str))

    expanded_parts: list[str] = []
    for part in raw_text_parts:
        expanded_parts.append(part)
        try:
            decoded = quopri.decodestring(part).decode("utf-8", errors="ignore")
            expanded_parts.append(decoded)
        except (AttributeError, UnicodeDecodeError):
            pass

    return "\n".join(expanded_parts)


def _walk_strings(value: Any):
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for item in value.values():
            yield from _walk_strings(item)
    elif isinstance(value, list):
        for item in value:
            yield from _walk_strings(item)


def assert_page_contains_id(page: dict[str, Any], expected_id: str) -> None:
    content = page.get("content")
    assert isinstance(content, list), f"Expected paged response with content list, got: {page}"
    ids = {str(item.get("id")) for item in content if isinstance(item, dict)}
    assert expected_id in ids, f"Expected {expected_id} in page content ids {sorted(ids)}"
