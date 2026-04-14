#!/bin/bash
set -euo pipefail

# =============================================================================
# Install Google Cloud Ops Agent on all 4 AppRanks VMs (PLA-1090)
#
# Ops Agent ships Docker container stdout/stderr to Cloud Logging with 30-day
# retention on the _Default bucket. Without it, `docker logs` is the only
# source — lost on container restart (deploys, preemption, OOM).
#
# This is the canonical "incident triage" log pipeline. Alloy → Grafana Loki
# is a complementary long-term index (see alloy.river + .env.*.example).
#
# Usage:  ./install-ops-agent.sh
#         ./install-ops-agent.sh --skip api  # skip specific host
#
# Prereqs: gcloud auth login + IAP access to the VMs. Idempotent — re-runs
# are safe; the install script itself detects an existing install.
#
# After install:
#   gcloud logging read 'resource.type="gce_instance" AND
#     labels."compute.googleapis.com/resource_name"="appranks-api"' --limit 5
# should return fresh lines within ~60s.
# =============================================================================

ZONE="${ZONE:-europe-west1-b}"
HOSTS=(appranks-api appranks-scraper appranks-email appranks-ai)

# Parse --skip <name>
SKIP=""
while [[ $# -gt 0 ]]; do
  case $1 in
    --skip) SKIP="$2"; shift 2 ;;
    *) echo "unknown arg: $1"; exit 2 ;;
  esac
done

echo "=== Installing Google Cloud Ops Agent on AppRanks VMs ==="
echo "Zone: $ZONE"
[[ -n "$SKIP" ]] && echo "Skipping: $SKIP"
echo ""

for host in "${HOSTS[@]}"; do
  if [[ "$host" == *"$SKIP"* && -n "$SKIP" ]]; then
    echo "→ $host: skipped"
    continue
  fi

  echo "→ $host: installing..."
  # Standard Google install flow: add repo, install package, ensure service is up.
  # The official install script is idempotent; re-running on an installed host
  # upgrades to latest and restarts the agent.
  gcloud compute ssh "deploy@$host" \
    --zone="$ZONE" \
    --tunnel-through-iap \
    --command="curl -sS -O https://dl.google.com/cloudagents/add-google-cloud-ops-agent-repo.sh && \
      sudo bash add-google-cloud-ops-agent-repo.sh --also-install && \
      sudo systemctl enable --now google-cloud-ops-agent && \
      sudo systemctl is-active google-cloud-ops-agent && \
      rm -f add-google-cloud-ops-agent-repo.sh" \
    || { echo "  ✗ failed on $host"; continue; }

  echo "  ✓ $host: ops-agent active"
done

echo ""
echo "=== Install complete ==="
echo ""
echo "Verify logs flowing (wait ~60s for first shipment):"
echo "  gcloud logging read 'resource.type=\"gce_instance\"' --limit 5 --freshness=2m"
echo ""
echo "Container stdout/stderr appears under log name 'google-cloud-ops-agent-fluent-bit'"
echo "with 'jsonPayload.container_name' set to the Docker container name."
