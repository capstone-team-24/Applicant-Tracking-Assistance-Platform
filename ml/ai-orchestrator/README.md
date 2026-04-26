# ATS AI Orchestrator

RAG-based candidate ranking microservice built with **FastAPI**, **Weaviate** vector search, and pluggable LLM adapters.

## Overview

The AI Orchestrator receives a ranking request (job ID + list of candidate IDs), retrieves the job description, embeds it, queries Weaviate for the most relevant resume chunks per candidate, passes those chunks through an LLM adapter for quality scoring, and produces a composite ranked list.

## RAG Flow

```
1. Ranking request arrives (REST or RabbitMQ)
2. Fetch job description text
3. Compute dense embedding of job description (sentence-transformers)
4. For each candidate:
   a. Query Weaviate ResumeChunk collection (nearVector + candidateId filter)
   b. Retrieve top-k evidence chunks
   c. Assemble RAG context (job desc + chunks)
   d. Call LLM adapter -> quality score + summary + evidence
   e. Compute semantic_score from average vector similarity
   f. Fetch assessment_score (external service / DB)
   g. Calculate composite_score
5. Sort candidates by composite_score descending
6. Persist results + audit log
7. Publish "job.rank.result" event via RabbitMQ
```

## Composite Scoring Formula

```
composite = semantic_score * W_semantic
          + assessment_score * W_assessment
          + llm_quality_score * W_llm
```

Default weights: `W_semantic = 0.40`, `W_assessment = 0.20`, `W_llm = 0.40`

- **semantic_score** (0-100): average cosine similarity between the job embedding and retrieved resume chunks, normalised to a 0-100 scale.
- **assessment_score** (0-100): fetched from an external assessment service or database. Defaults to 0 when unavailable.
- **llm_quality_score** (0-100): produced by the LLM adapter based on keyword matching (mock) or generative scoring (OpenAI / Claude).

Weights are validated to sum to 1.0 and normalised automatically if they do not.

## Endpoints

| Method | Path                       | Description                            |
|--------|----------------------------|----------------------------------------|
| POST   | `/rank`                    | Trigger a new ranking job              |
| GET    | `/rank/{ranking_job_id}`   | Poll ranking job status and results    |
| GET    | `/audit/export`            | Export LLM audit logs (compliance)     |
| GET    | `/health`                  | Liveness probe                         |

## LLM Adapter Configuration

Set the `LLM_PROVIDER` environment variable:

| Value       | Backend                     | Requires           |
|-------------|-----------------------------|---------------------|
| `mock`      | Deterministic keyword scorer | Nothing             |
| `openai`    | OpenAI Chat Completions      | `OPENAI_API_KEY`    |
| `claude`    | Anthropic Messages API       | `ANTHROPIC_API_KEY` |
| `anthropic` | (alias for claude)           | `ANTHROPIC_API_KEY` |

In **DEMO_MODE** (`DEMO_MODE=true`, the default) the service uses in-memory vector storage, random embeddings, and the mock LLM adapter so it runs without any external dependencies.

## Sample curl Commands

### Health check
```bash
curl http://localhost:8092/health
```

### Trigger ranking
```bash
curl -X POST http://localhost:8092/rank \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "550e8400-e29b-41d4-a716-446655440000",
    "candidateIds": [
      "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      "6ba7b811-9dad-11d1-80b4-00c04fd430c8"
    ]
  }'
```

### Poll results
```bash
curl http://localhost:8092/rank/<ranking_job_id>
```

### Export audit logs
```bash
curl "http://localhost:8092/audit/export?limit=50&offset=0"
```

## Running Locally

```bash
# Install dependencies
pip install -r requirements.txt

# Start in demo mode (no external services needed)
DEMO_MODE=true uvicorn app.main:app --host 0.0.0.0 --port 8092 --reload
```

## Docker

```bash
docker build -t ai-orchestrator .
docker run -p 8092:8092 -e DEMO_MODE=true ai-orchestrator
```

## Environment Variables

| Variable            | Default                                    | Description                      |
|---------------------|--------------------------------------------|----------------------------------|
| RABBITMQ_HOST       | localhost                                  | RabbitMQ hostname                |
| RABBITMQ_PORT       | 5672                                       | RabbitMQ port                    |
| RABBITMQ_USER       | guest                                      | RabbitMQ username                |
| RABBITMQ_PASSWORD   | guest                                      | RabbitMQ password                |
| WEAVIATE_HOST       | localhost                                  | Weaviate hostname                |
| WEAVIATE_PORT       | 8080                                       | Weaviate port                    |
| EMBEDDING_MODEL     | sentence-transformers/all-MiniLM-L6-v2     | HuggingFace model name           |
| POSTGRES_HOST       | localhost                                  | PostgreSQL hostname              |
| POSTGRES_PORT       | 5432                                       | PostgreSQL port                  |
| POSTGRES_USER       | postgres                                   | PostgreSQL username              |
| POSTGRES_PASSWORD   | postgres                                   | PostgreSQL password              |
| POSTGRES_DB         | ats_ai                                     | PostgreSQL database name         |
| LLM_PROVIDER        | mock                                       | LLM backend (mock/openai/claude) |
| OPENAI_API_KEY      | (none)                                     | OpenAI API key                   |
| ANTHROPIC_API_KEY   | (none)                                     | Anthropic API key                |
| DEMO_MODE           | true                                       | Enable demo fallbacks            |
| EUREKA_HOST         | localhost                                  | Eureka server hostname           |
| EUREKA_PORT         | 8761                                       | Eureka server port               |
| SERVICE_PORT        | 8092                                       | Port this service listens on     |
