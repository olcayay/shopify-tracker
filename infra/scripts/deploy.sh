#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_DIR="$INFRA_DIR/compose"
SSH_KEY="$HOME/.ssh/appranks-gcp"
SSH_USER="deploy"
ZONE="europe-west1-b"

# Terraform output'larından IP'leri al
cd "$INFRA_DIR/terraform"
API_IP=$(terraform output -raw api_external_ip)

echo "=== Deploying to all VMs ==="
echo "API VM: $API_IP"

# ── VM1: API + Dashboard ──
echo ""
echo "→ [1/4] Deploying API+Dashboard..."
scp -i "$SSH_KEY" -o StrictHostKeyChecking=no \
  "$COMPOSE_DIR/docker-compose-api.yml" "$SSH_USER@$API_IP:/opt/appranks/docker-compose.yml"
scp -i "$SSH_KEY" "$COMPOSE_DIR/Caddyfile" "$SSH_USER@$API_IP:/opt/appranks/Caddyfile"
scp -i "$SSH_KEY" "$COMPOSE_DIR/alloy.river" "$SSH_USER@$API_IP:/opt/appranks/alloy.river"
scp -i "$SSH_KEY" "$COMPOSE_DIR/env/.env.api" "$SSH_USER@$API_IP:/opt/appranks/.env"
ssh -i "$SSH_KEY" "$SSH_USER@$API_IP" "cd /opt/appranks && docker compose pull && docker compose up -d"
echo "  ✓ API deployed"

# ── VM2: Scraper ──
echo ""
echo "→ [2/4] Deploying Scraper..."
gcloud compute scp "$COMPOSE_DIR/docker-compose-scraper.yml" "appranks-scraper:/opt/appranks/docker-compose.yml" --zone="$ZONE" --quiet
gcloud compute scp "$COMPOSE_DIR/alloy.river" "appranks-scraper:/opt/appranks/alloy.river" --zone="$ZONE" --quiet
gcloud compute scp "$COMPOSE_DIR/env/.env.scraper" "appranks-scraper:/opt/appranks/.env" --zone="$ZONE" --quiet
gcloud compute ssh "appranks-scraper" --zone="$ZONE" --command="cd /opt/appranks && docker compose pull && docker compose up -d" --quiet
echo "  ✓ Scraper deployed"

# ── VM3: Email + Redis ──
echo ""
echo "→ [3/4] Deploying Email+Redis..."
gcloud compute scp "$COMPOSE_DIR/docker-compose-email.yml" "appranks-email:/opt/appranks/docker-compose.yml" --zone="$ZONE" --quiet
gcloud compute scp "$COMPOSE_DIR/alloy.river" "appranks-email:/opt/appranks/alloy.river" --zone="$ZONE" --quiet
gcloud compute scp "$COMPOSE_DIR/env/.env.email" "appranks-email:/opt/appranks/.env" --zone="$ZONE" --quiet
gcloud compute ssh "appranks-email" --zone="$ZONE" --command="cd /opt/appranks && docker compose pull && docker compose up -d" --quiet
echo "  ✓ Email+Redis deployed"

# ── VM4: AI Worker ──
echo ""
echo "→ [4/4] Deploying AI Worker..."
gcloud compute scp "$COMPOSE_DIR/docker-compose-ai.yml" "appranks-ai:/opt/appranks/docker-compose.yml" --zone="$ZONE" --quiet
gcloud compute scp "$COMPOSE_DIR/alloy.river" "appranks-ai:/opt/appranks/alloy.river" --zone="$ZONE" --quiet
gcloud compute scp "$COMPOSE_DIR/env/.env.ai" "appranks-ai:/opt/appranks/.env" --zone="$ZONE" --quiet
gcloud compute ssh "appranks-ai" --zone="$ZONE" --command="cd /opt/appranks && docker compose pull && docker compose up -d" --quiet
echo "  ✓ AI Worker deployed"

# ── Health Check ──
echo ""
echo "→ Health check (waiting 10s for startup)..."
sleep 10
if curl -sf "https://api.appranks.io/health/live" > /dev/null 2>&1; then
  echo "  ✓ API health check passed"
else
  echo "  ✗ API health check FAILED — check logs: ssh deploy@$API_IP 'docker logs appranks-api-1'"
  exit 1
fi

echo ""
echo "=== Deploy complete ==="
