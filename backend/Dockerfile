# ─────────────────────────────────────────────────────────────
#  Tolti AI · Backend (TypeScript / Node)
#  Build context = repo ROOT (needs ../contracts for shared types)
# ─────────────────────────────────────────────────────────────

FROM node:20-alpine AS base
WORKDIR /app/backend
RUN apk add --no-cache libc6-compat

# ── contracts (shared types) ─────────────────────────────────
FROM node:20-alpine AS contracts-build
WORKDIR /contracts
COPY contracts/package.json contracts/tsconfig.json ./
RUN npm install --no-audit --no-fund
COPY contracts/src ./src
RUN npm run build

# ── deps ─────────────────────────────────────────────────────
FROM base AS deps
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --no-audit --no-fund

# ── build ────────────────────────────────────────────────────
FROM base AS build
COPY --from=contracts-build /contracts/dist /app/contracts/dist
COPY backend/package.json ./
COPY --from=deps /app/backend/node_modules ./node_modules
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

# ── runtime ──────────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /app/backend/node_modules ./node_modules
COPY --from=build /app/backend/dist ./dist
COPY backend/package.json ./
EXPOSE 3001
CMD ["node", "dist/server.js"]
