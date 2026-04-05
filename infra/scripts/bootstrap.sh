#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== AppRanks GCP Tier 7 Light — Bootstrap ==="
echo ""

# Check prerequisites
command -v terraform >/dev/null 2>&1 || { echo "Error: terraform not found. Run: brew install terraform"; exit 1; }
command -v gcloud >/dev/null 2>&1 || { echo "Error: gcloud not found. Run: brew install google-cloud-sdk"; exit 1; }

if [ ! -f "$HOME/.ssh/appranks-gcp.pub" ]; then
  echo "Error: SSH key not found. Run: ssh-keygen -t ed25519 -f ~/.ssh/appranks-gcp"
  exit 1
fi

# Check tfvars
if [ ! -f "$INFRA_DIR/terraform/terraform.tfvars" ]; then
  echo "Error: terraform.tfvars not found."
  echo "Copy and edit: cp terraform.tfvars.example terraform.tfvars"
  exit 1
fi

# Terraform
echo "→ [1/3] Terraform init + apply..."
cd "$INFRA_DIR/terraform"
terraform init
terraform plan -out=tfplan
echo ""
read -rp "Apply this plan? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
  echo "Aborted."
  exit 0
fi
terraform apply tfplan

# Save outputs
echo ""
echo "→ [2/3] Saving outputs..."
terraform output -json > "$INFRA_DIR/terraform-outputs.json"
echo "  API IP: $(terraform output -raw api_external_ip)"
echo "  DB IP:  $(terraform output -raw db_private_ip)"
echo "  Redis:  $(terraform output -raw redis_url)"

# Deploy
echo ""
echo "→ [3/3] First deploy..."
echo "Before running deploy, create .env files:"
echo "  cp $INFRA_DIR/compose/env/.env.api.example $INFRA_DIR/compose/env/.env.api"
echo "  cp $INFRA_DIR/compose/env/.env.scraper.example $INFRA_DIR/compose/env/.env.scraper"
echo "  cp $INFRA_DIR/compose/env/.env.email.example $INFRA_DIR/compose/env/.env.email"
echo "  cp $INFRA_DIR/compose/env/.env.ai.example $INFRA_DIR/compose/env/.env.ai"
echo ""
echo "Fill in the values from terraform output, then run:"
echo "  $SCRIPT_DIR/deploy.sh"
echo ""
echo "=== Bootstrap complete (infra provisioned) ==="
