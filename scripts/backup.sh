#!/bin/sh
# Nightly Postgres backup. Run via host cron, e.g.:
#   0 2 * * * /path/to/scripts/backup.sh >> /var/log/feedback-backup.log 2>&1
set -e

BACKUP_DIR="$(dirname "$0")/../backups"
RETENTION_DAYS=14
STAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

docker compose exec -T db pg_dump -U "${POSTGRES_USER:-feedback}" -Fc "${POSTGRES_DB:-feedback}" \
  > "$BACKUP_DIR/feedback_${STAMP}.dump"

find "$BACKUP_DIR" -name 'feedback_*.dump' -mtime +$RETENTION_DAYS -delete

echo "Backup written to $BACKUP_DIR/feedback_${STAMP}.dump"
