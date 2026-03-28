#!/bin/bash
# =============================================================================
# PostgreSQL Restore Script
# Restores a backup created by backup-db.sh
# Usage: ./scripts/restore-db.sh <backup-file.sql.gz>
#
# WARNING: This will DROP and recreate the target database!
# =============================================================================

set -euo pipefail

BACKUP_FILE="${1:-}"
PG_CONTAINER="${PG_CONTAINER:-}"
PG_USER="${POSTGRES_USER:-postgres}"
PG_DB="${POSTGRES_DB:-postgres}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"; }
error() { echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" >&2; }

if [ -z "$BACKUP_FILE" ]; then
  error "Usage: $0 <backup-file.sql.gz>"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  error "Backup file not found: $BACKUP_FILE"
  exit 1
fi

# Auto-detect PostgreSQL container
if [ -z "$PG_CONTAINER" ]; then
  PG_CONTAINER=$(docker ps --filter "ancestor=postgres:16-alpine" --format '{{.Names}}' | head -1)
  if [ -z "$PG_CONTAINER" ]; then
    PG_CONTAINER=$(docker ps --filter "name=postgres" --format '{{.Names}}' | head -1)
  fi
  if [ -z "$PG_CONTAINER" ]; then
    error "Could not find PostgreSQL container. Set PG_CONTAINER env var."
    exit 1
  fi
fi

echo -e "${YELLOW}WARNING: This will DROP and recreate database '$PG_DB' in container '$PG_CONTAINER'${NC}"
echo -n "Are you sure? (type 'yes' to confirm): "
read -r CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted."
  exit 0
fi

log "Restoring from: $BACKUP_FILE"
log "Target: container=$PG_CONTAINER, database=$PG_DB"

# Drop and recreate database
log "Dropping and recreating database..."
docker exec "$PG_CONTAINER" psql -U "$PG_USER" -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$PG_DB' AND pid <> pg_backend_pid();" postgres 2>/dev/null || true
docker exec "$PG_CONTAINER" psql -U "$PG_USER" -c "DROP DATABASE IF EXISTS $PG_DB;" postgres
docker exec "$PG_CONTAINER" psql -U "$PG_USER" -c "CREATE DATABASE $PG_DB;" postgres

# Restore
log "Restoring data..."
zcat "$BACKUP_FILE" | docker exec -i "$PG_CONTAINER" psql -U "$PG_USER" "$PG_DB" > /dev/null 2>&1

# Verify
TABLE_COUNT=$(docker exec "$PG_CONTAINER" psql -U "$PG_USER" -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" "$PG_DB" | tr -d ' ')
log "Restore complete. Tables in database: $TABLE_COUNT"

# Show table sizes
log "Table sizes:"
docker exec "$PG_CONTAINER" psql -U "$PG_USER" -c "
  SELECT schemaname || '.' || tablename AS table,
         pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS size
  FROM pg_tables
  WHERE schemaname = 'public'
  ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC
  LIMIT 10;
" "$PG_DB"
