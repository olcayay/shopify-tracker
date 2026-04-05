#!/bin/bash
set -euo pipefail

# =============================================================================
# GCP Monitoring & Billing Budget Setup
# Usage: ./setup-monitoring.sh
#
# Prerequisites:
#   - gcloud auth login completed
#   - GCP billing account linked
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"

cd "$INFRA_DIR/terraform"
PROJECT_ID=$(terraform output -raw 2>/dev/null | head -1 || cat terraform.tfvars | grep project_id | cut -d'"' -f2)

echo "=== AppRanks Monitoring & Budget Setup ==="
echo "Project: $PROJECT_ID"
echo ""

# ── 1. GCP Billing Budget ──
echo "→ [1/3] Setting up billing budget..."
BILLING_ACCOUNT=$(gcloud billing accounts list --format='value(ACCOUNT_ID)' | head -1)

if [ -n "$BILLING_ACCOUNT" ]; then
  gcloud billing budgets create \
    --billing-account="$BILLING_ACCOUNT" \
    --display-name="AppRanks Monthly ($60 cap)" \
    --budget-amount=60USD \
    --threshold-rules=percent=0.5 \
    --threshold-rules=percent=0.8 \
    --threshold-rules=percent=1.0 \
    --all-updates-rule-monitoring-notification-channels=[] \
    2>/dev/null && echo "  ✓ Budget created: $60/mo with alerts at 50%, 80%, 100%" \
    || echo "  ⚠ Budget may already exist or requires permissions"
else
  echo "  ⚠ No billing account found. Set up manually in GCP Console."
fi

# ── 2. Uptime Checks (GCP native) ──
echo ""
echo "→ [2/3] Setting up uptime checks..."

API_IP=$(terraform output -raw api_external_ip 2>/dev/null || echo "")
if [ -n "$API_IP" ]; then
  # API health check
  gcloud monitoring uptime create \
    --display-name="AppRanks API Health" \
    --resource-type=uptime-url \
    --hostname="api.appranks.io" \
    --path="/health/live" \
    --protocol=https \
    --period=300 \
    --timeout=10 \
    2>/dev/null && echo "  ✓ API uptime check created (5min interval)" \
    || echo "  ⚠ Uptime check may already exist"

  # Dashboard health check
  gcloud monitoring uptime create \
    --display-name="AppRanks Dashboard" \
    --resource-type=uptime-url \
    --hostname="appranks.io" \
    --path="/" \
    --protocol=https \
    --period=300 \
    --timeout=10 \
    2>/dev/null && echo "  ✓ Dashboard uptime check created (5min interval)" \
    || echo "  ⚠ Uptime check may already exist"
else
  echo "  ⚠ API IP not found. Run terraform apply first."
fi

# ── 3. Spot VM restart cron ──
echo ""
echo "→ [3/3] Spot VM auto-restart..."
echo ""
echo "  To auto-restart preempted Spot VMs, add a Cloud Scheduler job:"
echo ""
echo "  # Check and restart scraper VM every 5 minutes"
echo "  gcloud scheduler jobs create http appranks-restart-scraper \\"
echo "    --schedule='*/5 * * * *' \\"
echo "    --uri='https://compute.googleapis.com/compute/v1/projects/$PROJECT_ID/zones/europe-west1-b/instances/appranks-scraper/start' \\"
echo "    --http-method=POST \\"
echo "    --oauth-service-account-email=\$(gcloud iam service-accounts list --format='value(EMAIL)' | head -1)"
echo ""
echo "  # Check and restart AI VM every 5 minutes"
echo "  gcloud scheduler jobs create http appranks-restart-ai \\"
echo "    --schedule='*/5 * * * *' \\"
echo "    --uri='https://compute.googleapis.com/compute/v1/projects/$PROJECT_ID/zones/europe-west1-b/instances/appranks-ai/start' \\"
echo "    --http-method=POST \\"
echo "    --oauth-service-account-email=\$(gcloud iam service-accounts list --format='value(EMAIL)' | head -1)"
echo ""
echo "  Note: 'start' on an already running VM is a no-op (safe to call repeatedly)."

echo ""
echo "=== Monitoring setup complete ==="
echo ""
echo "Grafana Cloud alerts should be configured in the Grafana UI:"
echo "  - API down > 2min → Critical"
echo "  - Email VM down > 3min → Critical"
echo "  - Scraper/AI VM no logs > 5min → Warning"
echo "  - Queue backlog > 50 → Warning"
echo "  - DB connection errors > 5/min → Critical"
