# ==========================================
# GROTEC FarmerOS — Backend API Dockerfile
# ==========================================

# Stage 1: Build & compile
FROM node:20-alpine AS builder

WORKDIR /app

# Install OpenSSL for Prisma engine compatibility on Alpine
RUN apk add --no-cache openssl

# Copy root package manifests
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY backend/package.json ./backend/

# Install all workspace dependencies
RUN npm ci

# Copy shared code and compile it
COPY packages/shared ./packages/shared
RUN npm run build:shared

# Copy backend source code and Prisma schema
COPY backend ./backend

# Generate Prisma client for linux-musl and compile NestJS API
RUN cd backend && npx prisma generate && npm run build

# Stage 2: Production runtime
FROM node:20-alpine AS runner

WORKDIR /app

# Install OpenSSL and curl/wget for health checks
RUN apk add --no-cache openssl wget

ENV NODE_ENV=production
ENV PORT=3000

# Copy root package manifests
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY backend/package.json ./backend/

# Copy compiled output, Prisma schema, and node_modules from builder.
# backend/src is ESM-syntax .js without "type":"module"; Node 20 can't run it
# directly. `npm run build` (tsc) in the builder emits plain CommonJS to
# backend/dist, which runs on bare `node` with no runtime loader.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/prisma ./backend/prisma

WORKDIR /app/backend

EXPOSE 3000

# Apply committed migrations using runtime DATABASE_URL/DIRECT_URL before listening.
# A migration failure exits the container; exec gives Node normal shutdown signals.
CMD ["sh", "-c", "npm run prisma:migrate-deploy && exec node dist/main.js"]
