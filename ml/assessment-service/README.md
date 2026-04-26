# ATS Assessment Service

A FastAPI microservice that manages assessments (MCQ, short answer, code), proctoring events, and AI-powered scoring with a pluggable LLM adapter.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/assessments` | Create a new assessment |
| `GET` | `/assessments/{token}` | Get assessment by access token (candidate view) |
| `POST` | `/assessments/{id}/save` | Autosave candidate answers |
| `POST` | `/assessments/{id}/submit` | Submit answers and trigger scoring |
| `POST` | `/proctor/events` | Record a proctoring event |
| `GET` | `/assessments/{id}/submissions` | List all submissions (recruiter view) |
| `GET` | `/submissions/{id}` | Get submission detail with scores |
| `GET` | `/health` | Health check |

## Assessment Flow

1. **Recruiter creates assessment** via `POST /assessments` with questions (MCQ, SHORT_ANSWER, CODE).
2. The service returns an `accessToken` (UUID) that is shared with the candidate.
3. **Candidate opens assessment** via `GET /assessments/{token}?candidateId=<uuid>` -- this auto-creates an IN_PROGRESS submission.
4. **Candidate autosaves** progress via `POST /assessments/{id}/save?candidateId=<uuid>`.
5. **Candidate submits** via `POST /assessments/{id}/submit?candidateId=<uuid>` -- the service scores all answers and returns results.
6. **Proctoring events** (tab changes, multi-face detection, copy/paste, window blur) are sent to `POST /proctor/events` during the assessment.
7. **Recruiter reviews** submissions via `GET /assessments/{id}/submissions`.

## LLM Adapter Configuration

The service uses a pluggable LLM adapter for scoring SHORT_ANSWER and CODE questions. MCQ questions are always scored deterministically.

Set the `LLM_PROVIDER` environment variable:

| Provider | Env Var | Required Keys |
|----------|---------|---------------|
| `mock` (default) | `LLM_PROVIDER=mock` | None |
| `openai` | `LLM_PROVIDER=openai` | `OPENAI_API_KEY` |
| `claude` | `LLM_PROVIDER=claude` | `ANTHROPIC_API_KEY` |

The **mock adapter** provides deterministic scoring:
- **MCQ**: Exact match gives full score, otherwise 0.
- **SHORT_ANSWER**: Keyword overlap with reference answer for partial credit.
- **CODE**: Length heuristic + structural keyword detection + reference token overlap.

## Environment Variables

```bash
# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=ats_assessments

# RabbitMQ
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USER=guest
RABBITMQ_PASSWORD=guest

# LLM
LLM_PROVIDER=mock
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Eureka
EUREKA_HOST=localhost
EUREKA_PORT=8761

# Service
SERVICE_PORT=8091
```

## Running Locally

```bash
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8091 --reload
```

## Docker

```bash
docker build -t assessment-service .
docker run -p 8091:8091 \
  -e POSTGRES_HOST=host.docker.internal \
  -e RABBITMQ_HOST=host.docker.internal \
  assessment-service
```

## Sample curl Commands

### Create an assessment

```bash
curl -X POST http://localhost:8091/assessments \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Python Developer Assessment",
    "description": "Technical assessment for Python developer role",
    "timeLimitMinutes": 45,
    "questions": [
      {
        "id": "q1",
        "type": "MCQ",
        "text": "What is the output of print(type([]))?",
        "options": ["<class '\''dict'\''>", "<class '\''list'\''>", "<class '\''tuple'\''>", "<class '\''set'\''>"],
        "correct_answer": "<class '\''list'\''>",
        "max_score": 1.0
      },
      {
        "id": "q2",
        "type": "SHORT_ANSWER",
        "text": "Explain the difference between a list and a tuple in Python.",
        "correct_answer": "Lists are mutable ordered sequences while tuples are immutable ordered sequences. Lists use square brackets and tuples use parentheses.",
        "max_score": 5.0
      },
      {
        "id": "q3",
        "type": "CODE",
        "text": "Write a Python function that reverses a string without using slicing.",
        "correct_answer": "def reverse_string(s): result = str(); for char in s: result = char + result; return result",
        "max_score": 10.0
      }
    ]
  }'
```

### Get assessment by token (candidate starts test)

```bash
curl "http://localhost:8091/assessments/<access_token>?candidateId=660e8400-e29b-41d4-a716-446655440001"
```

### Autosave answers

```bash
curl -X POST "http://localhost:8091/assessments/<assessment_id>/save?candidateId=660e8400-e29b-41d4-a716-446655440001" \
  -H "Content-Type: application/json" \
  -d '{
    "answers": [
      {"questionId": "q1", "answer": "<class '\''list'\''>"}
    ]
  }'
```

### Submit answers

```bash
curl -X POST "http://localhost:8091/assessments/<assessment_id>/submit?candidateId=660e8400-e29b-41d4-a716-446655440001" \
  -H "Content-Type: application/json" \
  -d '{
    "answers": [
      {"questionId": "q1", "answer": "<class '\''list'\''>"},
      {"questionId": "q2", "answer": "Lists are mutable and can be changed after creation. Tuples are immutable and cannot be modified. Lists use square brackets [] while tuples use parentheses ()."},
      {"questionId": "q3", "answer": "def reverse_string(s):\n    result = \"\"\n    for char in s:\n        result = char + result\n    return result"}
    ]
  }'
```

### Record a proctoring event

```bash
curl -X POST http://localhost:8091/proctor/events \
  -H "Content-Type: application/json" \
  -d '{
    "submissionId": "<submission_id>",
    "eventType": "TAB_CHANGE",
    "eventData": {"fromTab": "assessment", "toTab": "external"},
    "timestamp": "2026-01-15T10:30:00Z"
  }'
```

### List submissions for an assessment

```bash
curl "http://localhost:8091/assessments/<assessment_id>/submissions"
```

### Get submission detail

```bash
curl "http://localhost:8091/submissions/<submission_id>"
```

### Health check

```bash
curl http://localhost:8091/health
```
