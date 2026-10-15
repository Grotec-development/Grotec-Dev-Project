# ==============================================================
# GROTEC FarmerOS — Production Multi-Stage Container
# Compatible with Render Docker runtime and AWS ECS / App Runner
# ==============================================================

# Stage 1: Build dependencies & compile TypeScript / Prisma
FROM node:20-alpine AS builder

WORKDIR /app

# Install OpenSSL for Prisma engine binary compilation
RUN apk add --no-cache openssl

# Copy root workspace and package manifests
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY backend/package.json ./backend/

# Install dependencies including devDependencies for build
RUN npm ci

# Copy shared library source and compile it
COPY packages/shared ./packages/shared
RUN npm run build:shared

# Copy backend source code and Prisma schema
COPY backend ./backend

# Generate Prisma Client and compile backend NestJS application
RUN npx prisma generate --schema=backend/prisma/schema.prisma && \
    npm run build --workspace @grotec/backend

# Stage 2: Minimal Production Runtime
FROM node:20-alpine AS runner

WORKDIR /app

# OpenSSL for Prisma engine & curl for container health check
RUN apk add --no-cache openssl curl

ENV NODE_ENV=production
ENV PORT=10000

# Copy root package manifests
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY backend/package.json ./backend/

# Copy dependencies, compiled shared module, and compiled backend
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/prisma ./backend/prisma

EXPOSE 10000

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:10000/api/v1/health || exit 1

# Start NestJS backend API from root workspace
CMD ["node", "backend/dist/main.js"]
