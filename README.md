# ATS Platform — Local-First Microservices

A complete Applicant Tracking System built with microservices architecture, runnable entirely locally via `docker-compose`.

## Architecture Overview

```
┌─────────────┐     ┌──────────────────────────────────────────────────┐
│   Frontend   │────▸│              API Gateway (:8080)                 │
│  Next.js     │     │  JWT validation · Rate limiting · Header inject │
│  (:3000)     │     └──────┬──────┬──────┬──────┬──────┬──────────────┘
└─────────────┘            │      │      │      │      │
                    ┌──────▼┐ ┌───▼───┐ ┌▼─────┐ ┌▼────┐ ┌▼──────────┐
                    │ Auth  │ │ User  │ │ Jobs │ │Notif│ │  ML Svcs   │
                    │:8081  │ │:8082  │ │:8083 │ │:8084│ │:8090-8092  │
                    └───┬───┘ └───┬───┘ └──┬───┘ └──┬──┘ └─────┬──────┘
                        │         │        │        │           │
                    ┌───▼─────────▼────────▼────────▼───────────▼──┐
                    │              PostgreSQL (:5432)              │
                    │  ats_auth │ ats_users │ ats_jobs │ ats_notif │
                    └──────────────────────────────────────────────┘
                    ┌────────────┐  ┌────────────┐  ┌──────────────┐
                    │  RabbitMQ  │  │  Weaviate   │  │    MinIO     │
                    │  (:5672)   │  │  (:8079)    │  │  (:9000)     │
                    └────────────┘  └────────────┘  └──────────────┘
```

## Services

| Service | Tech | Port | Description |
|---------|------|------|-------------|
| **eureka-server** | Spring Boot | 8761 | Service discovery |
| **api-gateway** | Spring Cloud Gateway | 8080 | JWT validation, routing, rate limiting |
| **auth-service** | Spring Boot | 8081 | Authentication, RS256 JWT, JWKS |
| **user-service** | Spring Boot | 8082 | User profiles, CV upload, organizations |
| **jobs-service** | Spring Boot | 8083 | Job CRUD, applications, ranking triggers |
| **notification-service** | Spring Boot | 8084 | Email notifications via MailHog |
| **parsing-service** | FastAPI | 8090 | Resume parsing, embeddings, Weaviate |
| **assessment-service** | FastAPI | 8091 | Assessments, scoring, proctoring |
| **ai-orchestrator** | FastAPI | 8092 | RAG ranking, LLM scoring |
| **frontend** | Next.js | 3000 | Recruiter & candidate UI |

## Infrastructure

| Service | Port | Description |
|---------|------|-------------|
| PostgreSQL | 5432 | Primary database (4 databases) |
| RabbitMQ | 5672 (AMQP), 15672 (UI) | Message bus |
| Weaviate | 8079 | Vector database for RAG |
| MinIO | 9000 (API), 9001 (Console) | Object storage |
| MailHog | 1025 (SMTP), 8025 (UI) | Dev email server |

## Auth Model

The platform uses a **gateway-only auth trust model**:

1. Clients send JWT in `Authorization: Bearer <token>` header
2. API Gateway validates RS256 JWT using JWKS from auth-service
3. Gateway injects trusted headers: `X-User-Id`, `X-User-Role`, `X-Org-Id`
4. Downstream services trust these headers — they do NOT validate tokens
5. Public routes bypass JWT validation (job listing, signup, login, docs)

## Quick Start

### Prerequisites
- Docker & Docker Compose (v2+)
- 8GB+ RAM recommended (for all services + Weaviate)

### Start Everything

```bash
# 1. Clone and enter the project
cd /path/to/project

# 2. Copy environment config
cp .env.example .env

# 3. Start all services
./scripts/dev_up.sh

# Or manually:
docker compose up --build -d
```

### Seed Sample Data

```bash
# After services are healthy (~60s):
./scripts/seed_data.sh
```

### Stop Everything

```bash
./scripts/dev_down.sh

# To also remove volumes (full reset):
docker compose down -v
```

## Sample API Calls

### Sign Up
```bash
curl -X POST http://localhost:8080/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Alice",
    "lastName": "Recruiter",
    "email": "alice@example.com",
    "password": "Password123!",
    "role": "RECRUITER"
  }'
```

### Login
```bash
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "alice@example.com", "password": "Password123!"}'

# Response: {"accessToken":"eyJ...","refreshToken":"...","expiresIn":900,...}
```

### Create a Job (Recruiter)
```bash
curl -X POST http://localhost:8080/api/v1/jobs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "title": "Senior Backend Engineer",
    "description": "Join our platform team...",
    "skills": ["Java", "Spring Boot", "PostgreSQL"]
  }'
```

### List Jobs (Public)
```bash
curl http://localhost:8080/api/v1/jobs
```

### Apply to a Job
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

## Event Flow (RabbitMQ)

```
Application Submit ──▸ application.submitted ──▸ notification-service (email)
                   ──▸ resume.parse.request  ──▸ parsing-service
                                                    │
                                                    ▼
                       resume.parse.completed ◀── (parse + embed + Weaviate)
                                                    │
                                                    ▼
Rank Trigger ─────────▸ job.rank.request ────▸ ai-orchestrator
                                                    │
                                                    ▼
                       job.rank.result ◀──── (RAG + LLM + composite score)
                            │
                            ▼
                       notification-service (ranking complete email)
```

## RAG / Vector Search

- **Embeddings**: `sentence-transformers/all-MiniLM-L6-v2` (384 dims)
- **Vector DB**: Weaviate with classes `ResumeChunk` and `JobDesc`
- **Chunking**: ~1000 chars with 200 char overlap
- **Ranking**: Composite score = `semantic * W_s + assessment * W_a + llm_quality * W_l`
- **LLM**: Mock adapter by default; swap to OpenAI/Anthropic via `LLM_PROVIDER` env var

## Development

### Run Individual Services

```bash
# Backend (requires JDK 17 + Maven):
cd backend/auth-service && mvn spring-boot:run

# Python ML service:
cd ml/parsing-service && pip install -r requirements.txt && uvicorn app.main:app --port 8090

# Frontend:
cd frontend/client && npm install && npm run dev
```

### Environment Variables

See `.env.example` for all configurable values. Key settings:

| Variable | Default | Description |
|----------|---------|-------------|
| `DEMO_MODE` | `true` | Use mock embeddings/LLM |
| `LLM_PROVIDER` | `mock` | LLM adapter: mock, openai, claude |
| `OPENAI_API_KEY` | (empty) | Required if LLM_PROVIDER=openai |
| `JWT_ACCESS_TTL_MINUTES` | `15` | JWT access token lifetime |

### Access UIs

| UI | URL |
|----|-----|
| Frontend | http://localhost:3000 |
| Eureka Dashboard | http://localhost:8761 |
| RabbitMQ Management | http://localhost:15672 (ats/ats_rabbit_2024) |
| MailHog (emails) | http://localhost:8025 |
| MinIO Console | http://localhost:9001 (minio_admin/minio_secret_2024) |
| Weaviate | http://localhost:8079/v1 |

## Vector DB Choice

| DB | Pros | Cons | When to use |
|----|------|------|-------------|
| **Weaviate** (default) | Full-featured, semantic modules, production-ready | Heavier resource use | Default recommendation |
| **Chroma** | Lightweight, pure Python, easy setup | Less production-ready | Resource-constrained dev |
| **Milvus** | Great at scale, distributed | Heavy, complex setup | Large-scale production |

## Project Structure

```
├── backend/
│   ├── eureka-server/      # Service discovery
│   ├── api-gateway/        # JWT validation + routing
│   ├── auth-service/       # Authentication + JWKS
│   ├── user-service/       # Profiles + file upload
│   ├── jobs-service/       # Jobs + applications
│   └── notification-service/ # Email notifications
├── ml/
│   ├── parsing-service/    # Resume parsing + embeddings
│   ├── assessment-service/ # Assessments + scoring
│   └── ai-orchestrator/    # RAG ranking + LLM
├── frontend/
│   └── client/             # Next.js + TypeScript
├── scripts/
│   ├── dev_up.sh          # Start platform
│   ├── dev_down.sh        # Stop platform
│   ├── seed_data.sh       # Seed sample data
│   └── init-databases.sql # DB initialization
├── data/
│   ├── storage/           # File uploads (mounted)
│   └── samples/           # Sample CVs and job descriptions
├── .github/workflows/
│   └── ci.yml             # CI pipeline
├── docker-compose.yml
├── .env.example
└── README.md
```

## Testing

```bash
# Java services:
cd backend/auth-service && mvn test

# Python services:
cd ml/parsing-service && pytest tests/ -v

# Frontend:
cd frontend/client && npm run lint
```

## License

Internal use only.
