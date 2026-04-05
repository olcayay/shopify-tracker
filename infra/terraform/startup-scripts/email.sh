#!/bin/bash
set -euo pipefail

if [ -f /opt/appranks/common.sh ]; then
  bash /opt/appranks/common.sh
fi

if [ -f /opt/appranks/docker-compose.yml ]; then
  cd /opt/appranks && docker compose pull && docker compose up -d
fi

# Redis health check — diğer VM'ler buna bağımlı
for i in $(seq 1 30); do
  REDIS_CONTAINER=$(docker ps -qf "name=redis" 2>/dev/null || true)
  if [ -n "$REDIS_CONTAINER" ] && docker exec "$REDIS_CONTAINER" redis-cli ping 2>/dev/null | grep -q PONG; then
    echo "Redis is ready"
    exit 0
  fi
  sleep 2
done
echo "WARNING: Redis not ready after 60s"
