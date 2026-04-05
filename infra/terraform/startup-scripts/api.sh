#!/bin/bash
set -euo pipefail

# Docker install (idempotent)
if [ -f /opt/appranks/common.sh ]; then
  bash /opt/appranks/common.sh
fi

# Install Caddy (if not present)
if ! command -v caddy &> /dev/null; then
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | \
    gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | \
    tee /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi

# Copy Caddyfile and restart
if [ -f /opt/appranks/Caddyfile ]; then
  cp /opt/appranks/Caddyfile /etc/caddy/Caddyfile
  systemctl enable caddy
  systemctl restart caddy
fi

# Start containers
if [ -f /opt/appranks/docker-compose.yml ]; then
  cd /opt/appranks
  docker compose pull
  docker compose up -d
fi
