#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "==> Starting ATS platform (local development)..."
cd "$ROOT_DIR"

# Copy .env if not present
if [ ! -f .env ]; then
  cp .env.example .env
  echo "    Created .env from .env.example"
fi

# Create data directories
mkdir -p data/storage

# Start infrastructure first
echo "==> Starting infrastructure services..."
docker compose up -d postgres kafka jaeger minio mailhog kafka-ui pgadmin

echo "==> Waiting for infrastructure to be healthy..."
sleep 10

# Start eureka
echo "==> Starting Eureka..."
docker compose up -d eureka-server
sleep 15

# Start backend services
echo "==> Starting backend services..."
docker compose up -d auth-service user-service jobs-service notification-service

sleep 10

# Start gateway
echo "==> Starting API Gateway..."
docker compose up -d api-gateway

# Start ML services
echo "==> Starting ML services..."
docker compose up -d hiring-rag-service assessment-service

# Start frontend
echo "==> Starting Frontend..."
docker compose up -d frontend

echo ""
echo "=== ATS Platform is starting up ==="
echo "Eureka Dashboard : http://localhost:8761"
echo "API Gateway      : http://localhost:8080"
echo "Frontend         : http://localhost:3000"
echo "Kafka UI         : http://localhost:8089"
echo "Jaeger           : http://localhost:16686"
echo "MailHog          : http://localhost:8025"
echo "MinIO Console    : http://localhost:9001"
echo ""
echo "Use 'docker compose logs -f <service>' to view logs"
