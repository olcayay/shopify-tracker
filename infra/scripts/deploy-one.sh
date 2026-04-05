#!/bin/bash
set -euo pipefail

VM_NAME="${1:?Usage: ./deploy-one.sh <api|scraper|email|ai>}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_DIR="$INFRA_DIR/compose"
SSH_KEY="$HOME/.ssh/appranks-gcp"
SSH_USER="deploy"
ZONE="europe-west1-b"

case "$VM_NAME" in
  api)
    API_IP=$(cd "$INFRA_DIR/terraform" && terraform output -raw api_external_ip)
    echo "→ Deploying to API ($API_IP)..."
    scp -i "$SSH_KEY" -o StrictHostKeyChecking=no \
      "$COMPOSE_DIR/docker-compose-api.yml" "$SSH_USER@$API_IP:/opt/appranks/docker-compose.yml"
    scp -i "$SSH_KEY" "$COMPOSE_DIR/Caddyfile" "$SSH_USER@$API_IP:/opt/appranks/Caddyfile"
    scp -i "$SSH_KEY" "$COMPOSE_DIR/alloy.river" "$SSH_USER@$API_IP:/opt/appranks/alloy.river"
    scp -i "$SSH_KEY" "$COMPOSE_DIR/env/.env.api" "$SSH_USER@$API_IP:/opt/appranks/.env"
    ssh -i "$SSH_KEY" "$SSH_USER@$API_IP" "cd /opt/appranks && docker compose pull && docker compose up -d"
    ;;
  scraper|email|ai)
    echo "→ Deploying to $VM_NAME..."
    gcloud compute scp "$COMPOSE_DIR/docker-compose-${VM_NAME}.yml" "appranks-${VM_NAME}:/opt/appranks/docker-compose.yml" --zone="$ZONE" --quiet
    gcloud compute scp "$COMPOSE_DIR/alloy.river" "appranks-${VM_NAME}:/opt/appranks/alloy.river" --zone="$ZONE" --quiet
    gcloud compute scp "$COMPOSE_DIR/env/.env.${VM_NAME}" "appranks-${VM_NAME}:/opt/appranks/.env" --zone="$ZONE" --quiet
    gcloud compute ssh "appranks-${VM_NAME}" --zone="$ZONE" --command="cd /opt/appranks && docker compose pull && docker compose up -d" --quiet
    ;;
  *)
    echo "Unknown VM: $VM_NAME"
    echo "Usage: ./deploy-one.sh <api|scraper|email|ai>"
    exit 1
    ;;
esac

echo "✓ Deployed to $VM_NAME"
