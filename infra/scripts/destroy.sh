#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"

echo "⚠️  WARNING: This will destroy ALL GCP resources!"
echo "   - 4 VMs (API, Scraper, Email, AI)"
echo "   - Cloud SQL database (ALL DATA WILL BE LOST)"
echo "   - VPC, firewall rules, Cloud NAT"
echo ""
read -rp "Type 'destroy-appranks' to confirm: " confirm

if [ "$confirm" != "destroy-appranks" ]; then
  echo "Aborted."
  exit 0
fi

cd "$INFRA_DIR/terraform"

# Cloud SQL deletion_protection must be disabled first
echo "→ Disabling Cloud SQL deletion protection..."
terraform apply -target=google_sql_database_instance.main -var="db_tier=db-f1-micro" -auto-approve || true

echo "→ Destroying all resources..."
terraform destroy

echo "=== All GCP resources destroyed ==="
