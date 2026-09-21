#!/usr/bin/env bash
# ==============================================================================
# GROTEC FarmerOS — Database Restoration Script
# Section 8: Handover, Documentation & Operational Runbook
# ==============================================================================
set -euo pipefail

BACKUP_FILE="${1:-}"
FORCE="${2:-}"

if [ -z "${BACKUP_FILE}" ]; then
  echo "Usage: ./scripts/restore-db.sh <path_to_backup.sql.gz> [--force]"
  echo "Example: ./scripts/restore-db.sh ./backups/grotec_backup_20260921_120000.sql.gz"
  exit 1
fi

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "❌ ERROR: Backup file '${BACKUP_FILE}' not found."
  exit 1
fi

if [ -z "${DATABASE_URL:-}" ]; then
  if [ -f "backend/.env" ]; then
    echo "ℹ️  Loading DATABASE_URL from backend/.env..."
    DATABASE_URL=$(grep -E '^DATABASE_URL=' backend/.env | cut -d '=' -f2- | tr -d '"' | tr -d "'")
  fi
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ ERROR: DATABASE_URL is not set."
  exit 1
fi

echo "========================================================"
echo "⚠️  GROTEC FarmerOS — Database Restore Initiated"
echo "Target: ${DATABASE_URL%%@*}@***"
echo "Source File: ${BACKUP_FILE}"
echo "========================================================"

# Verify checksum if present
CHECKSUM_FILE="${BACKUP_FILE}.sha256"
if [ -f "${CHECKSUM_FILE}" ]; then
  echo "🔍 Verifying SHA256 checksum..."
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum -c "${CHECKSUM_FILE}"
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 -c "${CHECKSUM_FILE}"
  fi
  echo "✅ Checksum verified!"
fi

if [ "${FORCE}" != "--force" ] && [ "${FORCE}" != "-y" ]; then
  echo ""
  echo "⚠️  WARNING: Restoring will overwrite existing tables and records in the target database!"
  read -r -p "Type 'RESTORE' to confirm: " CONFIRMATION
  if [ "${CONFIRMATION}" != "RESTORE" ]; then
    echo "Restoration aborted."
    exit 0
  fi
fi

echo "🚀 Executing database restoration..."
if command -v psql >/dev/null 2>&1; then
  gzip -dc "${BACKUP_FILE}" | psql "${DATABASE_URL}"
elif command -v docker >/dev/null 2>&1; then
  echo "ℹ️  Host psql not found. Executing restore inside postgres container..."
  gzip -dc "${BACKUP_FILE}" | docker run --rm -i postgres:16-alpine psql "${DATABASE_URL}"
else
  echo "❌ ERROR: Neither psql nor docker is available in PATH."
  exit 1
fi

echo "✅ Restoration completed successfully."
