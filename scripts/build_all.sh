#!/bin/bash
cd /home/kaleb/final/trial1

DCMD="docker"
CCMD="compose"
BCMD="build"

for svc in auth-service jobs-service notification-service api-gateway parsing-service assessment-service ai-orchestrator frontend; do
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
