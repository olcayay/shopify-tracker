#!/bin/bash
# =============================================================================
# Daily PostgreSQL Backup Script
# Dumps the database, compresses it, and optionally uploads to S3/B2.
# Usage: ./scripts/backup-db.sh [--upload]
#
# Cron (on production VPS):
#   0 2 * * * /opt/appranks/scripts/backup-db.sh --upload >> /var/log/appranks-backup.log 2>&1
# =============================================================================

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/tmp/appranks-backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y-%m-%d_%H%M%S)
BACKUP_FILE="appranks_backup_${TIMESTAMP}.sql.gz"
PG_CONTAINER="${PG_CONTAINER:-}"  # Auto-detect if empty
PG_USER="${POSTGRES_USER:-postgres}"
PG_DB="${POSTGRES_DB:-postgres}"
S3_BUCKET="${S3_BUCKET:-}"
UPLOAD="${1:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"; }
warn() { echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"; }
error() { echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" >&2; }

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

log "Starting backup of database '$PG_DB' from container '$PG_CONTAINER'"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Dump and compress
log "Dumping database..."
docker exec "$PG_CONTAINER" pg_dump -U "$PG_USER" "$PG_DB" --no-owner --no-acl | gzip > "${BACKUP_DIR}/${BACKUP_FILE}"

# Verify backup
BACKUP_SIZE=$(du -sh "${BACKUP_DIR}/${BACKUP_FILE}" | cut -f1)
if [ ! -s "${BACKUP_DIR}/${BACKUP_FILE}" ]; then
  error "Backup file is empty! Aborting."
  rm -f "${BACKUP_DIR}/${BACKUP_FILE}"
  exit 1
fi
log "Backup created: ${BACKUP_FILE} (${BACKUP_SIZE})"

# Verify backup integrity by checking if it can be decompressed
if ! gzip -t "${BACKUP_DIR}/${BACKUP_FILE}" 2>/dev/null; then
  error "Backup file is corrupted!"
  exit 1
fi
log "Backup integrity verified"

# Count tables in dump (sanity check)
TABLE_COUNT=$(zcat "${BACKUP_DIR}/${BACKUP_FILE}" | grep -c "^CREATE TABLE" || echo "0")
log "Tables in backup: ${TABLE_COUNT}"
if [ "$TABLE_COUNT" -lt 10 ]; then
  warn "Expected 10+ tables, found ${TABLE_COUNT}. Backup may be incomplete."
fi

# Upload to S3 if requested
if [ "$UPLOAD" = "--upload" ] && [ -n "$S3_BUCKET" ]; then
  log "Uploading to S3: s3://${S3_BUCKET}/db/${BACKUP_FILE}"
  aws s3 cp "${BACKUP_DIR}/${BACKUP_FILE}" "s3://${S3_BUCKET}/db/${BACKUP_FILE}" --storage-class STANDARD_IA
  log "Upload complete"

  # Clean up old S3 backups
  log "Cleaning up S3 backups older than ${RETENTION_DAYS} days..."
  CUTOFF_DATE=$(date -d "-${RETENTION_DAYS} days" +%Y-%m-%d 2>/dev/null || date -v-${RETENTION_DAYS}d +%Y-%m-%d)
  aws s3 ls "s3://${S3_BUCKET}/db/" | while read -r line; do
    FILE_DATE=$(echo "$line" | awk '{print $1}')
    FILE_NAME=$(echo "$line" | awk '{print $4}')
    if [[ "$FILE_DATE" < "$CUTOFF_DATE" ]] && [ -n "$FILE_NAME" ]; then
      aws s3 rm "s3://${S3_BUCKET}/db/${FILE_NAME}"
      log "Deleted old backup: $FILE_NAME"
    fi
  done
elif [ "$UPLOAD" = "--upload" ] && [ -z "$S3_BUCKET" ]; then
  warn "S3_BUCKET not set, skipping upload"
fi

# Clean up old local backups
log "Cleaning up local backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name "appranks_backup_*.sql.gz" -mtime +${RETENTION_DAYS} -delete 2>/dev/null || true

# Summary
TOTAL_LOCAL=$(ls -1 "${BACKUP_DIR}"/appranks_backup_*.sql.gz 2>/dev/null | wc -l | tr -d ' ')
log "Backup complete. Local backups: ${TOTAL_LOCAL}, Retention: ${RETENTION_DAYS} days"
log "Backup path: ${BACKUP_DIR}/${BACKUP_FILE}"
