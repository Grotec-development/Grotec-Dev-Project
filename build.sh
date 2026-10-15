#!/usr/bin/env bash
set -e

echo "=== GROTEC FarmerOS Cloud Backend Build ==="
echo "Node version: $(node -v)"
echo "NPM version: $(npm -v)"

# Force installation of devDependencies required for compilation (TypeScript, Prisma)
export NPM_CONFIG_PRODUCTION=false
npm install --include=dev

# 1. Compile shared library
echo "--> Building @grotec/shared..."
npm run build --workspace @grotec/shared

# 2. Generate Prisma Client
echo "--> Generating Prisma Client..."
npx prisma generate --schema=backend/prisma/schema.prisma

# 3. Compile backend NestJS API
echo "--> Building @grotec/backend..."
npm run build --workspace @grotec/backend

echo "=== Build Completed Successfully ==="
