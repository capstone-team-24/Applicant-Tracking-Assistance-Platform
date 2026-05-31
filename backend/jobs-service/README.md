# Jobs Service

ATS Jobs Service - manages job postings, applications, and candidate ranking.

## Tech Stack

- Spring Boot 3.4.1
- Java 17
- PostgreSQL (with Flyway migrations)
- Kafka (event-driven messaging)
- Spring Cloud (Eureka discovery, OpenFeign)
- SpringDoc OpenAPI (Swagger UI)

## Running Locally

### Prerequisites

- Java 17+
- PostgreSQL running on `localhost:5432` with database `ats_jobs`
- Kafka running on `localhost:9092`
- Eureka server running on `localhost:8761`

### Start the service

```bash
cd backend/jobs-service
mvn spring-boot:run
```

The service starts on port **8083**.

### Swagger UI

Open [http://localhost:8083/swagger-ui.html](http://localhost:8083/swagger-ui.html) to view the API documentation.

### Docker

```bash
docker build -t jobs-service .
docker run -p 8083:8083 \
  -e SPRING_DATASOURCE_URL=jdbc:postgresql://host.docker.internal:5432/ats_jobs \
  -e SPRING_KAFKA_BOOTSTRAP_SERVERS=host.docker.internal:9092 \
  -e EUREKA_CLIENT_SERVICEURL_DEFAULTZONE=http://host.docker.internal:8761/eureka \
  jobs-service
```

## API Endpoints

### Jobs

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/v1/jobs` | Create a new job | RECRUITER |
| GET | `/api/v1/jobs` | List jobs (with optional filters) | Public |
| GET | `/api/v1/jobs/{id}` | Get job details | Public |
| PUT | `/api/v1/jobs/{id}` | Update a job | RECRUITER + org match |
| DELETE | `/api/v1/jobs/{id}` | Delete a draft job | RECRUITER + org match |
| POST | `/api/v1/jobs/{id}/publish` | Publish a job | RECRUITER |
| POST | `/api/v1/jobs/{id}/close` | Close a job | RECRUITER |
| POST | `/api/v1/jobs/{id}/archive` | Archive a job | RECRUITER |

### Applications

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/v1/jobs/{jobId}/apply` | Submit an application (multipart) | Public |
| GET | `/api/v1/jobs/{jobId}/applications` | List applications for a job | RECRUITER |
| GET | `/api/v1/applications/{id}` | Get application details | Public |
| GET | `/api/v1/applications/{id}/file` | Download application file | Public |
| GET | `/api/v1/applications/{id}/status` | Get application status | Public |

### Ranking

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/v1/jobs/{id}/rank` | Trigger ranking for a job | RECRUITER |
| GET | `/api/v1/jobs/ranking/{rankingJobId}` | Get ranking status/results | Public |

## Headers

All authenticated endpoints require these headers:

- `X-User-Id`: UUID of the authenticated user
- `X-User-Role`: Role of the user (e.g., `RECRUITER`, `CANDIDATE`)
- `X-Org-Id`: UUID of the user's organization

## Sample curl Commands

### Create a Job

```bash
curl -X POST http://localhost:8083/api/v1/jobs \
  -H "Content-Type: application/json" \
  -H "X-User-Id: 550e8400-e29b-41d4-a716-446655440000" \
  -H "X-User-Role: RECRUITER" \
  -H "X-Org-Id: 660e8400-e29b-41d4-a716-446655440000" \
  -d '{
    "title": "Senior Java Developer",
    "description": "We are looking for an experienced Java developer to join our team.",
    "requirements": "5+ years of Java experience, Spring Boot, PostgreSQL",
    "location": "Remote",
    "employmentType": "FULL_TIME",
    "experienceLevel": "SENIOR",
    "skills": ["Java", "Spring Boot", "PostgreSQL", "Docker"]
  }'
```

### List Jobs

```bash
curl http://localhost:8083/api/v1/jobs?status=PUBLISHED&page=0&size=10
```

### Get a Job

```bash
curl http://localhost:8083/api/v1/jobs/JOB_ID_HERE
```

### Publish a Job

```bash
curl -X POST http://localhost:8083/api/v1/jobs/JOB_ID_HERE/publish \
  -H "X-User-Id: 550e8400-e29b-41d4-a716-446655440000" \
  -H "X-User-Role: RECRUITER" \
  -H "X-Org-Id: 660e8400-e29b-41d4-a716-446655440000"
```

### Apply to a Job (Multipart)

```bash
curl -X POST http://localhost:8083/api/v1/jobs/JOB_ID_HERE/apply \
  -H "X-Org-Id: 660e8400-e29b-41d4-a716-446655440000" \
  -F 'request={"candidateAuthUserId":"770e8400-e29b-41d4-a716-446655440000","coverLetter":"I am very interested in this role.","contactPhone":"+1234567890","useProfileData":true,"portfolioLinks":["https://github.com/johndoe"]};type=application/json' \
  -F 'file=@/path/to/resume.pdf'
```

### Get Application Details

```bash
curl http://localhost:8083/api/v1/applications/APPLICATION_ID_HERE
```

### Download Application File

```bash
curl -O http://localhost:8083/api/v1/applications/APPLICATION_ID_HERE/file
```

### Trigger Ranking

```bash
curl -X POST http://localhost:8083/api/v1/jobs/JOB_ID_HERE/rank \
  -H "X-User-Id: 550e8400-e29b-41d4-a716-446655440000" \
  -H "X-User-Role: RECRUITER" \
  -H "X-Org-Id: 660e8400-e29b-41d4-a716-446655440000"
```

### Check Ranking Status

```bash
curl http://localhost:8083/api/v1/jobs/ranking/RANKING_JOB_ID_HERE
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://localhost:5432/ats_jobs` | Database URL |
| `SPRING_DATASOURCE_USERNAME` | `ats_admin` | Database username |
| `SPRING_DATASOURCE_PASSWORD` | `ats_secret_2024` | Database password |
| `SPRING_KAFKA_BOOTSTRAP_SERVERS` | `localhost:9092` | Kafka bootstrap servers |
| `EUREKA_CLIENT_SERVICEURL_DEFAULTZONE` | `http://localhost:8761/eureka` | Eureka server URL |
| `APP_STORAGE_PATH` | `./data/storage` | File storage base path |

## Running Tests

```bash
mvn test
```
