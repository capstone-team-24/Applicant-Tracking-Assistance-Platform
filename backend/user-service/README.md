# User Service

ATS User Service - manages user profiles, organizations, and document uploads.

## Tech Stack

- Java 17
- Spring Boot 3.4.1
- Spring Cloud 2024.0.0 (Eureka Client)
- PostgreSQL + Flyway
- SpringDoc OpenAPI (Swagger UI)

## Prerequisites

- Java 17+
- Maven 3.8+
- PostgreSQL running on `localhost:5432` with a database named `ats_users`
- (Optional) Eureka server running on `localhost:8761`

## Running Locally

```bash
# Set up the database
createdb ats_users

# Build
mvn clean package

# Run
java -jar target/user-service-0.0.1-SNAPSHOT.jar
```

Or with environment variables:

```bash
SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/ats_users \
SPRING_DATASOURCE_USERNAME=ats_admin \
SPRING_DATASOURCE_PASSWORD=ats_secret_2024 \
java -jar target/user-service-0.0.1-SNAPSHOT.jar
```

The service starts on port **8082**.

## Running with Docker

```bash
docker build -t user-service .
docker run -p 8082:8082 \
  -e SPRING_DATASOURCE_URL=jdbc:postgresql://host.docker.internal:5432/ats_users \
  -e SPRING_DATASOURCE_USERNAME=ats_admin \
  -e SPRING_DATASOURCE_PASSWORD=ats_secret_2024 \
  user-service
```

## API Endpoints

### Public Profile Endpoints

| Method | Path                              | Description                       |
|--------|-----------------------------------|-----------------------------------|
| GET    | /profiles/{id}                    | Get profile by ID                 |
| PUT    | /profiles/{id}                    | Update profile (X-User-Id header) |
| GET    | /profiles/me                      | Get my profile (X-User-Id header) |
| POST   | /profiles/{id}/upload-cv          | Upload CV (multipart)             |
| GET    | /profiles/{id}/application-data   | Get application data              |

### Internal Endpoints (service-to-service)

| Method | Path                                          | Description                  |
|--------|-----------------------------------------------|------------------------------|
| POST   | /internal/profiles/bootstrap                  | Bootstrap new user profile   |
| GET    | /internal/profiles/{authUserId}/application-data | Get application data      |
| GET    | /internal/organizations/{orgId}/policies      | Get organization policies    |

### Organization Endpoints

| Method | Path             | Description              |
|--------|------------------|--------------------------|
| POST   | /organizations   | Create a new organization |

## Swagger UI

Available at: [http://localhost:8082/swagger-ui.html](http://localhost:8082/swagger-ui.html)

## Sample cURL Commands

### Bootstrap a profile (internal)

```bash
curl -X POST http://localhost:8082/internal/profiles/bootstrap \
  -H "Content-Type: application/json" \
  -d '{
    "authUserId": "550e8400-e29b-41d4-a716-446655440000",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "role": "CANDIDATE"
  }'
```

### Get my profile

```bash
curl http://localhost:8082/profiles/me \
  -H "X-User-Id: 550e8400-e29b-41d4-a716-446655440000"
```

### Update profile

```bash
curl -X PUT http://localhost:8082/profiles/{profile-id} \
  -H "Content-Type: application/json" \
  -H "X-User-Id: 550e8400-e29b-41d4-a716-446655440000" \
  -d '{
    "firstName": "Jane",
    "phone": "+1234567890",
    "bio": "Experienced developer",
    "yearsOfExperience": 5
  }'
```

### Upload CV

```bash
curl -X POST http://localhost:8082/profiles/{profile-id}/upload-cv \
  -H "X-Org-Id: org-uuid-here" \
  -F "file=@/path/to/resume.pdf"
```

### Create organization

```bash
curl -X POST http://localhost:8082/organizations \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corp",
    "organizationPolicies": "{\"maxApplications\": 100}"
  }'
```

## Running Tests

```bash
mvn test
```
