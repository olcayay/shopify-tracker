#!/bin/bash
set -euo pipefail

if [ -f /opt/appranks/common.sh ]; then
  bash /opt/appranks/common.sh
fi

if [ -f /opt/appranks/docker-compose.yml ]; then
  cd /opt/appranks && docker compose pull && docker compose up -d
fi
