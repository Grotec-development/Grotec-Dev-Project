# ==========================================
# GROTEC FarmerOS — Frontend Web Dockerfile
# ==========================================

# Stage 1: Build static SPA assets
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package manifests
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY frontend/package.json ./frontend/

# Install workspace dependencies
RUN npm ci

# Copy shared code and build it
COPY packages/shared ./packages/shared
RUN npm run build:shared

# Copy frontend source
COPY frontend ./frontend

# Build Vite SPA bundle
RUN npm run build --workspace @grotec/frontend

# Stage 2: Serve static files with Nginx
FROM nginx:alpine AS runner

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy custom nginx configuration
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built static files from builder
COPY --from=builder /app/frontend/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
