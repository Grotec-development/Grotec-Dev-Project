#!/usr/bin/env bash
# ==============================================================================
# GROTEC FarmerOS — Automated PostgreSQL Database Backup Script
# Section 8: Handover, Documentation & Operational Runbook
# ==============================================================================
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/grotec_backup_${TIMESTAMP}.sql.gz"
CHECKSUM_FILE="${BACKUP_FILE}.sha256"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

mkdir -p "${BACKUP_DIR}"

echo "========================================================"
echo "🌱 GROTEC FarmerOS — Database Backup Initiated"
echo "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "Backup destination: ${BACKUP_FILE}"
echo "========================================================"

if [ -z "${DATABASE_URL:-}" ]; then
  if [ -f "backend/.env" ]; then
    echo "ℹ️  Loading DATABASE_URL from backend/.env..."
    DATABASE_URL=$(grep -E '^DATABASE_URL=' backend/.env | cut -d '=' -f2- | tr -d '"' | tr -d "'")
  fi
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ ERROR: DATABASE_URL environment variable is not defined."
  echo "Usage: DATABASE_URL='postgresql://user:pass@host:5432/dbname' ./scripts/backup-db.sh"
  exit 1
fi

echo "📦 Dumping database schemas, tables, sequences & data..."
if command -v pg_dump >/dev/null 2>&1; then
  pg_dump "${DATABASE_URL}" --no-owner --no-privileges --clean --if-exists | gzip -9 > "${BACKUP_FILE}"
elif command -v docker >/dev/null 2>&1; then
  echo "ℹ️  Host pg_dump not found. Executing dump inside postgres container..."
  docker run --rm -i postgres:16-alpine pg_dump "${DATABASE_URL}" --no-owner --no-privileges --clean --if-exists | gzip -9 > "${BACKUP_FILE}"
else
  echo "❌ ERROR: Neither pg_dump nor docker is available in system PATH."
  exit 1
fi

# Generate SHA256 checksum
echo "🔒 Computing SHA256 checksum for backup integrity..."
if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "${BACKUP_FILE}" > "${CHECKSUM_FILE}"
elif command -v shasum >/dev/null 2>&1; then
  shasum -a 256 "${BACKUP_FILE}" > "${CHECKSUM_FILE}"
fi

BACKUP_SIZE=$(ls -lh "${BACKUP_FILE}" | awk '{print $5}')
echo "✅ Backup successfully created!"
echo "   File: ${BACKUP_FILE} (${BACKUP_SIZE})"
if [ -f "${CHECKSUM_FILE}" ]; then
  echo "   Checksum: $(cat "${CHECKSUM_FILE}")"
fi

# Prune old backups past retention threshold
echo "🧹 Pruning backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "grotec_backup_*.sql.gz*" -mtime "+${RETENTION_DAYS}" -exec rm -f {} + 2>/dev/null || true

echo "🎉 Backup workflow finished cleanly."
