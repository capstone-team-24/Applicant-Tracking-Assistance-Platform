# ATS Auth Service

Spring Boot authentication service providing JWT-based auth with RS256 signing, refresh token rotation, and JWKS endpoint.

## Prerequisites

- Java 17+
- PostgreSQL
- Kafka
- Eureka Server (optional, for service discovery)

## Configuration

Set environment variables or edit `src/main/resources/application.yml`:

| Variable | Default | Description |
|---|---|---|
| DB_HOST | localhost | PostgreSQL host |
| DB_PORT | 5432 | PostgreSQL port |
| DB_NAME | ats_auth | Database name |
| DB_USER | postgres | Database user |
| DB_PASS | postgres | Database password |
| SPRING_KAFKA_BOOTSTRAP_SERVERS | localhost:9092 | Kafka bootstrap servers |
| EUREKA_URI | http://localhost:8761/eureka | Eureka server URL |
| JWT_ACCESS_TTL_MINUTES | 15 | Access token TTL in minutes |
| JWT_REFRESH_TTL_DAYS | 7 | Refresh token TTL in days |
| JWT_ISSUER | ats-auth-service | JWT issuer claim |
| JWT_AUDIENCE | ats-platform | JWT audience claim |

## Build and Run

```bash
# Build
./mvnw clean package

# Run
java -jar target/auth-service-0.0.1-SNAPSHOT.jar

# Or with Docker
docker build -t auth-service .
docker run -p 8081:8081 \
  -e DB_HOST=host.docker.internal \
  -e SPRING_KAFKA_BOOTSTRAP_SERVERS=host.docker.internal:9092 \
  auth-service
```

## API Endpoints

### Signup
```bash
curl -X POST http://localhost:8081/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "password": "password123",
    "role": "CANDIDATE"
  }'
```

### Login
```bash
curl -X POST http://localhost:8081/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'
```

### Refresh Token
```bash
curl -X POST http://localhost:8081/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "<refresh_token_from_login>"
  }'
```

### Logout
```bash
curl -X POST http://localhost:8081/auth/logout \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "<refresh_token>"
  }'
```

### JWKS (Public Keys)
```bash
curl http://localhost:8081/.well-known/jwks.json
```

### Rotate Keys
```bash
curl -X POST http://localhost:8081/auth/keys/rotate
```

## Swagger UI

Access the API documentation at: http://localhost:8081/swagger-ui.html
