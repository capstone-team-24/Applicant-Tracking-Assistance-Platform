# Notification Service

Spring Boot microservice responsible for sending email, in-app, and webhook notifications within the ATS platform. Listens to Kafka events for automated notifications and exposes REST endpoints for manual notification management.

## Tech Stack

- Java 17, Spring Boot 3.4.1
- Spring Data JPA + PostgreSQL
- Spring Mail (MailHog in dev)
- Spring Kafka
- Flyway for database migrations
- Eureka client for service discovery
- SpringDoc OpenAPI (Swagger UI)

## Prerequisites

- Java 17+
- PostgreSQL (database: `ats_notifications`)
- Kafka
- MailHog (for local email testing, SMTP on port 1025, UI on port 8025)

## Running Locally

```bash
# Start dependencies (PostgreSQL, Kafka, MailHog)
# Then run:
./mvnw spring-boot:run
```

The service starts on port **8084**.

## API Endpoints

| Method | Endpoint                        | Description                          |
|--------|---------------------------------|--------------------------------------|
| GET    | `/api/v1/notifications`         | List notifications for current user  |
| GET    | `/api/v1/notifications/{id}`    | Get a single notification by ID      |
| POST   | `/api/v1/notifications/send`    | Send an arbitrary notification       |

### Swagger UI

Available at: [http://localhost:8084/swagger-ui.html](http://localhost:8084/swagger-ui.html)

### API Docs

Available at: [http://localhost:8084/v3/api-docs](http://localhost:8084/v3/api-docs)

## Sample curl Commands

### List notifications for a user

```bash
curl -X GET "http://localhost:8084/api/v1/notifications?page=0&size=20" \
  -H "X-User-Id: 550e8400-e29b-41d4-a716-446655440000" \
  -H "Content-Type: application/json"
```

### Get a single notification

```bash
curl -X GET "http://localhost:8084/api/v1/notifications/550e8400-e29b-41d4-a716-446655440001" \
  -H "Content-Type: application/json"
```

### Send a notification (admin)

```bash
curl -X POST "http://localhost:8084/api/v1/notifications/send" \
  -H "Content-Type: application/json" \
  -d '{
    "recipientEmail": "candidate@example.com",
    "subject": "Interview Scheduled",
    "body": "<p>Your interview has been scheduled for next Monday.</p>",
    "type": "INTERVIEW_SCHEDULED"
  }'
```

## Kafka Events

The service listens to these Kafka topics:

| Topic | Description |
|-------|-------------|
| `application.submitted` | New application submitted |
| `resume.parse.completed` | Resume parsing finished |
| `job.rank.result` | Candidate ranking completed |

### Example Kafka event payload

```json
{
  "eventType": "application.submitted",
  "payload": {
    "candidateEmail": "john.doe@example.com",
    "candidateName": "John Doe",
    "jobTitle": "Software Engineer",
    "applicationId": "APP-12345"
  }
}
```

## Docker

```bash
# Build the image
docker build -t notification-service .

# Run the container
docker run -p 8084:8084 \
  -e SPRING_DATASOURCE_URL=jdbc:postgresql://host.docker.internal:5432/ats_notifications \
  -e SPRING_DATASOURCE_USERNAME=ats_admin \
  -e SPRING_DATASOURCE_PASSWORD=ats_secret_2024 \
  -e SPRING_KAFKA_BOOTSTRAP_SERVERS=host.docker.internal:9092 \
  -e SPRING_MAIL_HOST=host.docker.internal \
  notification-service
```

## Environment Variables

| Variable                                  | Default                                          |
|-------------------------------------------|--------------------------------------------------|
| `SPRING_DATASOURCE_URL`                   | `jdbc:postgresql://localhost:5432/ats_notifications` |
| `SPRING_DATASOURCE_USERNAME`              | `ats_admin`                                      |
| `SPRING_DATASOURCE_PASSWORD`              | `ats_secret_2024`                                |
| `SPRING_MAIL_HOST`                        | `localhost`                                      |
| `SPRING_MAIL_PORT`                        | `1025`                                           |
| `SPRING_KAFKA_BOOTSTRAP_SERVERS`          | `localhost:9092`                                 |
| `EUREKA_CLIENT_SERVICEURL_DEFAULTZONE`    | `http://localhost:8761/eureka`                   |
