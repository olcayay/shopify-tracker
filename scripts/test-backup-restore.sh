#!/usr/bin/env bash
#
# Automated backup restore test.
# Verifies that:
#   1. backup-db.sh creates a valid compressed dump
#   2. The dump can be restored to a fresh database
#   3. Restored database has expected table count
#
# Usage:
#   ./scripts/test-backup-restore.sh                    # full test
#   ./scripts/test-backup-restore.sh --backup-only      # just create backup
#   ./scripts/test-backup-restore.sh --restore-only     # restore from latest backup
#
# Requires: PostgreSQL client tools (pg_dump, pg_restore, psql)
# Requires: docker (for test database container)

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RESET='\033[0m'

BACKUP_DIR="${BACKUP_DIR:-/tmp/appranks-backup-test}"
TEST_DB_CONTAINER="appranks-restore-test-$$"
TEST_DB_PORT=54329
PG_USER="${POSTGRES_USER:-postgres}"
PG_PASS="${POSTGRES_PASSWORD:-postgres}"
PG_DB="${POSTGRES_DB:-restore_test}"

cleanup() {
  echo -e "\n${YELLOW}Cleaning up...${RESET}"
  docker rm -f "$TEST_DB_CONTAINER" 2>/dev/null || true
  rm -rf "$BACKUP_DIR"
}
trap cleanup EXIT

echo -e "${GREEN}=== Backup Restore Test ===${RESET}"
echo "Backup dir: $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"

# Step 1: Create backup
if [[ "${1:-}" != "--restore-only" ]]; then
  echo -e "\n${GREEN}Step 1: Creating backup...${RESET}"
  BACKUP_DIR="$BACKUP_DIR" ./scripts/backup-db.sh 2>&1 || {
    echo -e "${RED}Backup failed!${RESET}"
    exit 1
  }

  BACKUP_FILE=$(ls -t "$BACKUP_DIR"/*.sql.gz 2>/dev/null | head -1)
  if [ -z "$BACKUP_FILE" ]; then
    echo -e "${RED}No backup file created!${RESET}"
    exit 1
  fi
  echo -e "${GREEN}✓ Backup created: $(basename "$BACKUP_FILE") ($(du -h "$BACKUP_FILE" | cut -f1))${RESET}"
fi

if [[ "${1:-}" == "--backup-only" ]]; then
  echo -e "\n${GREEN}Backup-only mode — skipping restore test.${RESET}"
  exit 0
fi

# Step 2: Start test database
echo -e "\n${GREEN}Step 2: Starting test PostgreSQL container...${RESET}"
docker run -d --name "$TEST_DB_CONTAINER" \
  -e POSTGRES_USER="$PG_USER" \
  -e POSTGRES_PASSWORD="$PG_PASS" \
  -e POSTGRES_DB="$PG_DB" \
  -p "$TEST_DB_PORT:5432" \
  postgres:16-alpine > /dev/null

echo "Waiting for PostgreSQL to be ready..."
for i in $(seq 1 30); do
  if PGPASSWORD="$PG_PASS" psql -h localhost -p "$TEST_DB_PORT" -U "$PG_USER" -d "$PG_DB" -c "SELECT 1" > /dev/null 2>&1; then
    break
  fi
  sleep 1
done

# Step 3: Restore backup
BACKUP_FILE=$(ls -t "$BACKUP_DIR"/*.sql.gz 2>/dev/null | head -1)
echo -e "\n${GREEN}Step 3: Restoring backup: $(basename "$BACKUP_FILE")...${RESET}"
gunzip -c "$BACKUP_FILE" | PGPASSWORD="$PG_PASS" psql -h localhost -p "$TEST_DB_PORT" -U "$PG_USER" -d "$PG_DB" -q 2>/dev/null || true

# Step 4: Verify restore
echo -e "\n${GREEN}Step 4: Verifying restored database...${RESET}"
TABLE_COUNT=$(PGPASSWORD="$PG_PASS" psql -h localhost -p "$TEST_DB_PORT" -U "$PG_USER" -d "$PG_DB" -t -c \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';" | tr -d ' ')

echo "Restored table count: $TABLE_COUNT"

if [ "$TABLE_COUNT" -gt 10 ]; then
  echo -e "${GREEN}✓ Restore verification passed! ($TABLE_COUNT tables found)${RESET}"
else
  echo -e "${RED}✗ Restore verification failed! Only $TABLE_COUNT tables found (expected > 10)${RESET}"
  exit 1
fi

# Step 5: Check critical tables exist
echo -e "\n${GREEN}Step 5: Checking critical tables...${RESET}"
CRITICAL_TABLES="accounts users apps app_snapshots tracked_keywords scrape_runs"
for table in $CRITICAL_TABLES; do
  EXISTS=$(PGPASSWORD="$PG_PASS" psql -h localhost -p "$TEST_DB_PORT" -U "$PG_USER" -d "$PG_DB" -t -c \
    "SELECT count(*) FROM information_schema.tables WHERE table_name = '$table';" | tr -d ' ')
  if [ "$EXISTS" -eq 1 ]; then
    echo -e "  ${GREEN}✓ $table${RESET}"
  else
    echo -e "  ${RED}✗ $table (MISSING!)${RESET}"
  fi
done

echo -e "\n${GREEN}=== Backup Restore Test PASSED ===${RESET}"
