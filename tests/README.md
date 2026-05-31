# Integration/API Tests

This folder contains live API integration tests for the ATS backend. They are separate from the older `backend_testcases.json` Postman collection and do not use it.

The tests exercise the running local stack through the API Gateway and assert real behavior across services:

- Auth signup, login, refresh, logout, JWT/JWKS
- User profile bootstrap and update through `user-service`
- Public contact message submission
- Organization creation
- Org-admin and recruiter invite flow
- Recruiter invite delivery through `notification-service` and MailHog
- Job create/publish/list through `jobs-service`
- Candidate application submission with multipart resume upload
- Application listing for candidate and recruiter
- Kafka-backed application notification delivery to MailHog

## Run Manually

Start the local stack first:

```bash
cp .env.example .env
docker compose up --build -d
```

Install test dependencies:

```bash
python3 -m venv .venv-tests
. .venv-tests/bin/activate
pip install -r tests/requirements.txt
```

Run the tests:

```bash
pytest tests/api -v
```

Optional environment overrides:

```bash
ATS_API_BASE_URL=http://localhost:8080 \
ATS_MAILHOG_BASE_URL=http://localhost:8025 \
ATS_TEST_WAIT_SECONDS=60 \
pytest tests/api -v
```

These tests create unique users, organizations, jobs, applications, and emails in the local test database. Use `docker compose down -v` when you want a clean database.
