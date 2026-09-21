#!/usr/bin/env bash
# ==============================================================================
# GROTEC FarmerOS — Production Health & Pre-Flight Validation Script
# Section 8: Handover, Documentation & Operational Runbook
# ==============================================================================
set -euo pipefail

API_URL="${API_URL:-http://localhost:3000/api/v1}"
FAILED=0

echo "========================================================"
echo "🌾 GROTEC FarmerOS — Production Health Audit"
echo "Target Base: ${API_URL}"
echo "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "========================================================"

check_health() {
  echo -n "1. Checking /health endpoint... "
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}/health" || echo "000")
  if [ "$STATUS" = "200" ]; then
    echo "✅ PASS (HTTP 200)"
  else
    echo "❌ FAIL (HTTP $STATUS)"
    FAILED=$((FAILED + 1))
  fi
}

check_cors() {
  echo -n "2. Checking CORS Security Allow-List... "
  # Test with disallowed evil origin
  CORS_HEADER=$(curl -s -I -H "Origin: https://malicious-phishing-site.com" "${API_URL}/health" | grep -i "access-control-allow-origin" || true)
  if [ -z "$CORS_HEADER" ]; then
    echo "✅ PASS (Disallowed origin properly rejected with no CORS headers)"
  else
    echo "❌ FAIL (Origin allowed unexpectedly: $CORS_HEADER)"
    FAILED=$((FAILED + 1))
  fi
}

check_database() {
  echo -n "3. Checking Database connectivity & Prisma Client... "
  if [ -f "backend/package.json" ]; then
    DB_STATUS=$(cd backend && node -e '
      const { PrismaClient } = require("@prisma/client");
      const prisma = new PrismaClient();
      prisma.$queryRaw`SELECT 1 as connected`
        .then(() => { console.log("OK"); process.exit(0); })
        .catch(err => { console.error(err.message); process.exit(1); });
    ' 2>&1 || true)
    if [ "$DB_STATUS" = "OK" ]; then
      echo "✅ PASS (Database query succeeded)"
    else
      echo "❌ FAIL ($DB_STATUS)"
      FAILED=$((FAILED + 1))
    fi
  else
    echo "⚠️  SKIPPED (backend directory not in current path)"
  fi
}

check_health
check_cors
check_database

echo "========================================================"
if [ $FAILED -eq 0 ]; then
  echo "🎉 ALL PRODUCTION HEALTH CHECKS PASSED!"
  exit 0
else
  echo "⚠️  $FAILED CHECK(S) FAILED. Review errors above."
  exit 1
fi
