# API Gateway

Spring Cloud Gateway service for the ATS (Applicant Tracking System) microservices platform. This reactive gateway handles routing, JWT authentication, rate limiting, and CORS for all downstream services.

## Architecture

The API Gateway sits in front of all microservices and provides:

- **Routing**: Routes requests to auth-service, user-service, and jobs-service via Eureka service discovery with client-side load balancing.
- **JWT Authentication**: Validates RS256-signed JWTs using JWKS fetched from the auth-service. Extracts user claims (sub, role, org) and forwards them as headers (X-User-Id, X-User-Role, X-Org-Id) to downstream services.
- **Rate Limiting**: Token-bucket rate limiter per client IP address (default 50 requests/second).
- **CORS**: Configured for localhost:3000 (frontend development).

### Request Flow

```
Client -> API Gateway (port 8080)
           |-> Rate Limiter Filter (order -2)
           |-> JWT Auth Filter (order -1)
           |-> Route to downstream service via Eureka
```

### Route Table

| Route ID       | Path Pattern                                                              | Target Service |
|----------------|---------------------------------------------------------------------------|----------------|
| auth-service   | /auth/**                                                                  | auth-service   |
| auth-jwks      | /.well-known/**                                                           | auth-service   |
| user-profiles  | /profiles/**, /internal/profiles/**, /organizations/**, /internal/organizations/** | user-service   |
| jobs-service   | /api/v1/jobs/**, /api/v1/applications/**                                  | jobs-service   |

### Public Paths (no authentication required)

- `/auth/**`
- `/.well-known/**`
- `/actuator/**`
- `/**/swagger/**`, `/**/swagger-ui/**`
- `/**/v3/api-docs/**`
- `/webjars/**`

## Prerequisites

- Java 17
- Maven 3.8+
- Running Eureka server on port 8761
- Auth service on port 8081 (provides JWKS endpoint)

## Build and Run

### Local

```bash
./mvnw clean package -DskipTests
java -jar target/api-gateway-0.0.1-SNAPSHOT.jar
```

### Docker

```bash
docker build -t api-gateway .
docker run -p 8080:8080 \
  -e EUREKA_CLIENT_SERVICEURL_DEFAULTZONE=http://eureka:8761/eureka \
  -e GATEWAY_JWKS_URI=http://auth-service:8081/.well-known/jwks.json \
  api-gateway
```

## Configuration

| Environment Variable                        | Default                                     | Description                |
|---------------------------------------------|---------------------------------------------|----------------------------|
| EUREKA_CLIENT_SERVICEURL_DEFAULTZONE        | http://localhost:8761/eureka                | Eureka server URL          |
| GATEWAY_JWKS_URI                            | http://localhost:8081/.well-known/jwks.json | Auth service JWKS endpoint |

## Sample curl Commands

### Health check

```bash
curl http://localhost:8080/actuator/health
```

### Login (public, no token required)

```bash
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"secret"}'
```

### Access a protected endpoint

```bash
curl http://localhost:8080/profiles/me \
  -H "Authorization: Bearer <your-jwt-token>"
```

### Fetch JWKS (public)

```bash
curl http://localhost:8080/.well-known/jwks.json
```

### List jobs (protected)

```bash
curl http://localhost:8080/api/v1/jobs \
  -H "Authorization: Bearer <your-jwt-token>"
```

### Create a job application (protected)

```bash
curl -X POST http://localhost:8080/api/v1/applications \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{"jobId":"123","coverLetter":"I am interested in this position."}'
```
