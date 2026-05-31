# Eureka Server

Spring Boot Eureka Service Discovery Server for the ATS platform.

## Prerequisites

- Java 17
- Maven 3.8+

## Run Locally

```bash
mvn clean package -DskipTests
java -jar target/eureka-server-0.0.1-SNAPSHOT.jar
```

The Eureka dashboard will be available at: http://localhost:8761

## Run with Docker

```bash
docker build -t eureka-server .
docker run -p 8761:8761 eureka-server
```

## Configuration

| Property                            | Value          |
|-------------------------------------|----------------|
| Server Port                         | 8761           |
| Register with Eureka                | false          |
| Fetch Registry                      | false          |
| Application Name                    | eureka-server  |

## Actuator Endpoints

Health check is available at: http://localhost:8761/actuator/health
