#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "==> Stopping ATS platform..."
cd "$ROOT_DIR"
docker compose down

echo "==> ATS platform stopped."
echo "    To also remove volumes: docker compose down -v"
