# ─────────────────────────────────────────────────────────────
#  Tolti AI · Backend (TypeScript / Node)
#  Fastify-based API server with WebSocket multiplayer rooms.
# ─────────────────────────────────────────────────────────────

FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

# ── deps ─────────────────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

# ── build ────────────────────────────────────────────────────
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── runtime ──────────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
EXPOSE 3001
CMD ["node", "dist/server.js"]
