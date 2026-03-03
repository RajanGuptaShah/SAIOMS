# ─────────────────────────────────────────────────────────
# SAIOMS Backend — Optimized Dockerfile for Render.com
# Multi-stage: build → production (smaller final image)
# ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# ── Production stage ──────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

# Create non-root user
RUN addgroup -S saioms && adduser -S saioms -G saioms

COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Persistent avatar storage dir
RUN mkdir -p static/avatars && chown -R saioms:saioms /app

USER saioms

ENV NODE_ENV=production
EXPOSE 5000

CMD ["node", "src/app.js"]
