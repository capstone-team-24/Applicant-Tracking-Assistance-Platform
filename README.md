# ATS Platform - Local Microservices

A local-first Applicant Tracking System built with Spring Boot, FastAPI, Next.js, Kafka, PostgreSQL, and Docker Compose.

## Architecture

```text
Frontend (:3000)
    |
    v
API Gateway (:8080) -- JWT validation, rate limiting, trusted headers
    |
    +--> auth-service (:8081)
    +--> user-service (:8082)
    +--> jobs-service (:8083)
    +--> notification-service (:8084)
    +--> assessment-service (:8091)

Kafka (:9092)
    | application.submitted
    | resume.parse.completed
    | job.rank.request
    | job.rank.result
    v
hiring-rag-service (:8097 host -> :8090 container)
    - resume parsing and OCR
    - Chroma resume indexing
    - candidate ranking
    - match explanations

PostgreSQL, MinIO, MailHog, Kafka UI, Jaeger
```

## Services

| Service | Tech | Port | Description |
|---------|------|------|-------------|
| `eureka-server` | Spring Boot | 8761 | Service discovery |
| `api-gateway` | Spring Cloud Gateway | 8080 | JWT validation, routing, rate limiting |
| `auth-service` | Spring Boot | 8081 | Authentication, RS256 JWT, JWKS |
| `user-service` | Spring Boot | 8082 | User profiles, CV upload, organizations |
| `jobs-service` | Spring Boot | 8083 | Job CRUD, applications, ranking triggers |
| `notification-service` | Spring Boot | 8084 | Email and in-app notifications |
| `hiring-rag-service` | FastAPI | 8097 | Resume parsing, Chroma indexing, ranking, explanations |
| `assessment-service` | FastAPI | 8091 | Assessments, scoring, proctoring |
| `frontend` | Next.js | 3000 | Recruiter and candidate UI |

## Infrastructure

| Service | Port | Description |
|---------|------|-------------|
| PostgreSQL | 5433 host -> 5432 container | Primary database |
| Kafka | 9092 | Event bus |
| Kafka UI | 8089 | Local Kafka inspection UI |
| Chroma | internal volume | Embedded vector store used by `hiring-rag-service` |
| MinIO | 9000, 9001 | Object storage |
| MailHog | 1025, 8025 | Local email capture |
| Jaeger | 16686 | Trace UI |
| pgAdmin | 5050 | PostgreSQL admin UI |

## Auth Model

The platform uses a gateway-only auth trust model.

1. Clients send JWTs to the API Gateway.
2. API Gateway validates RS256 JWTs using JWKS from `auth-service`.
3. API Gateway injects `X-User-Id`, `X-User-Role`, and `X-Org-Id`.
4. Downstream services trust those headers.
5. Public routes bypass JWT validation where configured.

## Quick Start

### Prerequisites

- Git
- Docker and Docker Compose v2+
- 16GB+ RAM recommended

### Clone The Repository

```bash
git clone https://github.com/capstone-team-24/Applicant-Tracking-Assistance-Platform.git
cd Applicant-Tracking-Assistance-Platform
```

### Start Everything

```bash
cp .env.example .env
./scripts/dev_up.sh
```

Or manually:

```bash
docker compose up --build -d
```

### Stop Everything

```bash
./scripts/dev_down.sh
```

Full reset, including volumes:

```bash
docker compose down -v
```

## Event Flow

```text
Application submitted
    -> jobs-service publishes application.submitted
    -> notification-service sends application notification
    -> hiring-rag-service parses, OCRs, anonymizes, chunks, embeds, and indexes resume
    -> hiring-rag-service publishes resume.parse.completed

Recruiter triggers ranking
    -> jobs-service publishes job.rank.request with rank-eligible application IDs and resume file paths
    -> hiring-rag-service backfills any missing Chroma index entries
    -> hiring-rag-service ranks candidates and publishes job.rank.result
    -> jobs-service stores scores/rank positions and advances APPLIED candidates to SCREENED
    -> notification-service handles ranking completion notification
```

## RAG And Ranking

| Component | Current Implementation |
|-----------|------------------------|
| Resume extraction | PyMuPDF, OCR fallback, image OCR, DOCX/text parsing |
| Vector store | Chroma persisted in `hiring_rag_chroma` volume |
| Embeddings | `BAAI/bge-small-en-v1.5` by default |
| Ranking | lexical or cross-encoder scoring depending on config |
| LLM analysis | Groq, Ollama, or disabled/mock mode |

Relevant environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `RAG_LLM_PROVIDER` | `groq` | `groq`, `ollama`, `mock`, `none`, or `disabled` |
| `GROQ_API_KEY` | empty | Required for Groq-backed analysis |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | Groq chat model |
| `RAG_EMBEDDING_MODEL` | `BAAI/bge-small-en-v1.5` | HuggingFace embedding model |
| `RAG_CROSS_ENCODER_MODEL` | `cross-encoder/ms-marco-MiniLM-L-6-v2` | Optional cross-encoder model |
| `CHROMA_COLLECTION_NAME` | `hiring_resumes` | Chroma collection name |

## API Examples

### Login

```bash
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"Password123!"}'
```

### Apply To A Job

```bash
curl -X POST http://localhost:8080/api/v1/jobs/{jobId}/apply \
  -H "Authorization: Bearer <candidate_token>" \
  -F 'request={"coverLetter":"Excited to apply!","useProfileData":true};type=application/json' \
  -F 'file=@resume.pdf'
```

### Trigger Ranking

```bash
curl -X POST http://localhost:8080/api/v1/jobs/{jobId}/rank \
  -H "Authorization: Bearer <recruiter_token>"
```

## Local UIs

| UI | URL |
|----|-----|
| Frontend | http://localhost:3000 |
| Eureka | http://localhost:8761 |
| Kafka UI | http://localhost:8089 |
| MailHog | http://localhost:8025 |
| MinIO Console | http://localhost:9001 |
| Jaeger | http://localhost:16686 |
| pgAdmin | http://localhost:5050 |

## Development

Docker is the default local workflow. Rebuild or restart individual services with Docker Compose:

```bash
# Rebuild one service image
docker compose build jobs-service

# Restart one service after changes
docker compose up -d jobs-service

# Follow logs for one service
docker compose logs -f jobs-service
```

Optional Dockerized Maven checks, without requiring Maven installed locally:

```bash
docker run --rm -v "$PWD/backend/jobs-service:/workspace" -w /workspace maven:3.9.6-eclipse-temurin-17 mvn test
```

## Project Structure

```text
backend/
  api-gateway/
  auth-service/
  eureka-server/
  jobs-service/
  notification-service/
  user-service/
ml/
  assessment-service/
  hiring-rag-service/
frontend/
  client/
scripts/
  dev_up.sh
  dev_down.sh
  build_all.sh
  init-databases.sql
data/
  storage/
  samples/
```

## Verification

```bash
# Java service Docker builds
docker compose build eureka-server auth-service user-service jobs-service notification-service api-gateway

# Python syntax check
python3 -m py_compile ml/hiring-rag-service/app/main.py

# Frontend type check
cd frontend/client && npx tsc --noEmit
```

## Notes

- Legacy standalone parsing and orchestration services were retired. Their responsibilities now live in `hiring-rag-service`.
- The legacy vector database was retired. Chroma is embedded in `hiring-rag-service` and persisted via Docker volume.

## License

Internal use only.
