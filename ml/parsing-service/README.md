# ATS Parsing Service

A FastAPI-based microservice that parses resumes, extracts structured text, computes vector embeddings, and stores them in Weaviate for semantic search.

## Architecture

The Parsing Service sits within a larger ATS (Applicant Tracking System) microservices architecture:

1. **Resume Ingestion** -- Resumes are uploaded and an event is published to RabbitMQ.
2. **Text Extraction** -- The service extracts raw text from PDF, DOCX, or TXT files using pdfplumber, python-docx, or pytesseract (OCR fallback for scanned documents).
3. **Normalization** -- Skills, dates, and contact information are normalized and structured.
4. **Chunking** -- Text is split into overlapping chunks with section inference (experience, education, skills, etc.).
5. **Embedding** -- Each chunk is embedded using sentence-transformers (all-MiniLM-L6-v2, 384 dimensions).
6. **Vector Storage** -- Chunks and their embeddings are upserted into Weaviate for similarity search.
7. **Completion Event** -- A `resume.parse.completed` event is published back to RabbitMQ.

### Weaviate vs Chroma

The service includes adapters for both vector databases:

- **Weaviate (primary)**: Production-ready, supports rich filtering, multi-tenancy, and hybrid search. Used by default.
- **Chroma (stubbed)**: Lightweight alternative suitable for local development or smaller deployments. The `ChromaAdapter` interface is defined but not implemented -- swap in when needed.

## Endpoints

| Method | Path                              | Description                          |
|--------|-----------------------------------|--------------------------------------|
| POST   | `/parse`                          | Submit a resume for parsing          |
| GET    | `/parse/{application_id}/status`  | Check parsing status                 |
| GET    | `/health`                         | Health check                         |

## Environment Variables

| Variable              | Default                                     | Description                        |
|-----------------------|---------------------------------------------|------------------------------------|
| `RABBITMQ_HOST`       | `localhost`                                 | RabbitMQ hostname                  |
| `RABBITMQ_PORT`       | `5672`                                      | RabbitMQ port                      |
| `RABBITMQ_USER`       | `guest`                                     | RabbitMQ username                  |
| `RABBITMQ_PASSWORD`   | `guest`                                     | RabbitMQ password                  |
| `WEAVIATE_HOST`       | `localhost`                                 | Weaviate hostname                  |
| `WEAVIATE_PORT`       | `8080`                                      | Weaviate port                      |
| `POSTGRES_HOST`       | `localhost`                                 | PostgreSQL hostname                |
| `POSTGRES_PORT`       | `5432`                                      | PostgreSQL port                    |
| `POSTGRES_USER`       | `ats_user`                                  | PostgreSQL username                |
| `POSTGRES_PASSWORD`   | `ats_password`                              | PostgreSQL password                |
| `POSTGRES_DB`         | `ats_parsing`                               | PostgreSQL database name           |
| `EMBEDDING_MODEL`     | `sentence-transformers/all-MiniLM-L6-v2`    | Sentence-transformer model name    |
| `DEMO_MODE`           | `true`                                      | Use mock/fallback behavior         |
| `SERVICE_PORT`        | `8090`                                      | Port the service listens on        |
| `EUREKA_HOST`         | `localhost`                                 | Eureka server hostname             |
| `EUREKA_PORT`         | `8761`                                      | Eureka server port                 |
| `STORAGE_BASE_PATH`   | `./data/storage`                            | Base path for file storage         |

## Running Locally

### With Docker

```bash
docker build -t ats-parsing-service .
docker run -p 8090:8090 -e DEMO_MODE=true ats-parsing-service
```

### Without Docker

```bash
pip install -r requirements.txt
DEMO_MODE=true uvicorn app.main:app --host 0.0.0.0 --port 8090
```

## Sample curl Commands

### Health Check

```bash
curl http://localhost:8090/health
```

Response:
```json
{"status": "ok"}
```

### Parse a Resume

```bash
curl -X POST http://localhost:8090/parse \
  -H "Content-Type: application/json" \
  -d '{
    "applicationId": "550e8400-e29b-41d4-a716-446655440000",
    "filePath": "/data/storage/resumes/resume.pdf"
  }'
```

Response:
```json
{
  "status": "COMPLETED",
  "parsedJsonUrl": "/parse/550e8400-e29b-41d4-a716-446655440000/status",
  "parseConfidence": 0.85
}
```

### Check Parse Status

```bash
curl http://localhost:8090/parse/550e8400-e29b-41d4-a716-446655440000/status
```

Response:
```json
{
  "applicationId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "COMPLETED",
  "parseConfidence": 0.85,
  "chunkCount": 5
}
```
