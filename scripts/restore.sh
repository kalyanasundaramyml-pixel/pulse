#!/bin/sh
# Restore a backup produced by backup.sh. Usage:
#   ./scripts/restore.sh backups/feedback_20260101_020000.dump
set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <path-to-dump-file>"
  exit 1
fi

docker compose exec -T db pg_restore -U "${POSTGRES_USER:-feedback}" -d "${POSTGRES_DB:-feedback}" --clean --if-exists < "$1"

echo "Restore complete from $1"
