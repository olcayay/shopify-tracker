#!/bin/bash
set -euo pipefail

# =============================================================================
# Database Migration: Hetzner PostgreSQL → GCP Cloud SQL
# Usage: ./migrate-db.sh
#
# Prerequisites:
#   - cloud-sql-proxy installed (brew install cloud-sql-proxy)
#   - gcloud auth login completed
#   - Hetzner SSH access (root@5.78.101.102)
#   - Terraform outputs available
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"
DUMP_FILE="/tmp/appranks-migration-$(date +%Y%m%d-%H%M%S).sql"
HETZNER_HOST="root@5.78.101.102"

echo "=== AppRanks Database Migration ==="
echo "Source: Hetzner PostgreSQL (Docker container)"
echo "Target: GCP Cloud SQL"
echo ""

# Get Cloud SQL connection info
cd "$INFRA_DIR/terraform"
DB_IP=$(terraform output -raw db_private_ip 2>/dev/null || echo "")
DB_URL=$(terraform output -raw database_url 2>/dev/null || echo "")

if [ -z "$DB_IP" ]; then
  echo "Error: Could not get Cloud SQL IP from Terraform. Run 'terraform apply' first."
  exit 1
fi

echo "Cloud SQL IP: $DB_IP"
echo ""

# Step 1: Dump from Hetzner
echo "→ [1/5] Dumping database from Hetzner..."
POSTGRES_CONTAINER=$(ssh "$HETZNER_HOST" "docker ps --format '{{.Names}}' | grep postgres" | head -1)
if [ -z "$POSTGRES_CONTAINER" ]; then
  echo "Error: PostgreSQL container not found on Hetzner"
  exit 1
fi
echo "  Found container: $POSTGRES_CONTAINER"

ssh "$HETZNER_HOST" "docker exec $POSTGRES_CONTAINER pg_dump -U postgres -d postgres --no-owner --no-acl --clean --if-exists" > "$DUMP_FILE"
DUMP_SIZE=$(du -h "$DUMP_FILE" | cut -f1)
echo "  ✓ Dump saved: $DUMP_FILE ($DUMP_SIZE)"

# Step 2: Count source tables/rows
echo ""
echo "→ [2/5] Counting source tables..."
SOURCE_TABLES=$(ssh "$HETZNER_HOST" "docker exec $POSTGRES_CONTAINER psql -U postgres -d postgres -t -c \"SELECT count(*) FROM information_schema.tables WHERE table_schema='public'\"" | tr -d ' ')
echo "  Source tables: $SOURCE_TABLES"

# Step 3: Start Cloud SQL proxy
echo ""
echo "→ [3/5] Starting Cloud SQL proxy..."
GCP_PROJECT=$(cd "$INFRA_DIR/terraform" && terraform output -raw 2>/dev/null | head -1 || cat terraform.tfvars | grep project_id | cut -d'"' -f2)
cloud-sql-proxy "${GCP_PROJECT}:europe-west1:appranks-db" --port=15432 &
PROXY_PID=$!
sleep 3

if ! kill -0 "$PROXY_PID" 2>/dev/null; then
  echo "Error: Cloud SQL proxy failed to start"
  exit 1
fi
echo "  ✓ Proxy running (PID: $PROXY_PID, port: 15432)"

# Step 4: Import to Cloud SQL
echo ""
echo "→ [4/5] Importing to Cloud SQL..."
DB_PASSWORD=$(cd "$INFRA_DIR/terraform" && terraform output -raw database_url 2>/dev/null | sed 's|.*://postgres:\(.*\)@.*|\1|')
PGPASSWORD="$DB_PASSWORD" psql "postgresql://postgres@127.0.0.1:15432/appranks" < "$DUMP_FILE"
echo "  ✓ Import complete"

# Step 5: Verify
echo ""
echo "→ [5/5] Verifying migration..."
TARGET_TABLES=$(PGPASSWORD="$DB_PASSWORD" psql "postgresql://postgres@127.0.0.1:15432/appranks" -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'" | tr -d ' ')
echo "  Source tables: $SOURCE_TABLES"
echo "  Target tables: $TARGET_TABLES"

if [ "$SOURCE_TABLES" = "$TARGET_TABLES" ]; then
  echo "  ✓ Table count matches!"
else
  echo "  ⚠ Table count mismatch! Source=$SOURCE_TABLES, Target=$TARGET_TABLES"
fi

# Row counts for key tables
echo ""
echo "  Row counts (key tables):"
for table in apps categories keywords accounts users; do
  COUNT=$(PGPASSWORD="$DB_PASSWORD" psql "postgresql://postgres@127.0.0.1:15432/appranks" -t -c "SELECT count(*) FROM $table" 2>/dev/null | tr -d ' ' || echo "N/A")
  echo "    $table: $COUNT"
done

# Cleanup
kill "$PROXY_PID" 2>/dev/null || true
echo ""
echo "=== Migration complete ==="
echo "Dump file kept at: $DUMP_FILE"
echo ""
echo "Next steps:"
echo "  1. Deploy API container to verify migrations run: ./deploy-one.sh api"
echo "  2. Check dashboard loads with data"
echo "  3. Keep Hetzner running as fallback for 1 week"
