#!/bin/bash
VM_NAME="${1:?Usage: ./ssh.sh <api|scraper|email|ai>}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"
ZONE="europe-west1-b"

case "$VM_NAME" in
  api)
    API_IP=$(cd "$INFRA_DIR/terraform" && terraform output -raw api_external_ip)
    ssh -i ~/.ssh/appranks-gcp "deploy@$API_IP"
    ;;
  scraper|email|ai)
    gcloud compute ssh "deploy@appranks-${VM_NAME}" --zone="$ZONE" --tunnel-through-iap
    ;;
  *)
    echo "Unknown VM: $VM_NAME"
    echo "Usage: ./ssh.sh <api|scraper|email|ai>"
    exit 1
    ;;
esac
