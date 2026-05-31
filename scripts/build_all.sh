#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

DCMD="docker"
CCMD="compose"
BCMD="build"

for svc in eureka-server auth-service user-service jobs-service notification-service api-gateway hiring-rag-service assessment-service frontend; do
  echo "==> Building $svc at $(date)"
  $DCMD $CCMD $BCMD "$svc" 2>&1 | tail -10
  RC=$?
  if [ $RC -eq 0 ]; then
    echo "    OK: $svc"
  else
    echo "    FAILED: $svc (exit $RC)"
  fi
done

echo ""
echo "=== Build Summary ==="
$DCMD images | grep trial1
