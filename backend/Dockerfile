# ── Build stage — compiles TypeScript, needs devDependencies ──
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ── Runtime stage — production deps only, no build tools ──
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY scripts ./scripts
COPY migrations ./migrations

# multer is configured with memoryStorage() (see src/routes/reports.ts) and
# migrations run as a separate one-off command (see DEPLOY.md) — this
# container never writes to its own filesystem, so no volume is needed and
# it's safe to run fully read-only / stateless.
# Documents the default port for local/docker-compose use — the app itself
# binds to $PORT at runtime (src/config.ts), so hosts that assign their own
# port (Render, etc.) still work with zero code change.
EXPOSE 3001
USER node

# Shell form (not exec/JSON form) so $PORT expands at container runtime,
# matching whatever port the host actually assigned — not just the default.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://localhost:${PORT:-3001}/api/health" || exit 1

CMD ["node", "dist/index.js"]
