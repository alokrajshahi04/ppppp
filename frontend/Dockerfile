# ─────────────────────────────────────────────────────────────
#  Tolti AI · Frontend (React + Vite + TypeScript)
#  Built artefact is served by nginx.
# ─────────────────────────────────────────────────────────────

FROM node:20-alpine AS build
WORKDIR /app

ARG VITE_API_URL=http://localhost:3001
ARG VITE_WS_URL=ws://localhost:3001
ENV VITE_API_URL=${VITE_API_URL} \
    VITE_WS_URL=${VITE_WS_URL}

COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

# ── runtime ──────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=5s --retries=5 CMD wget -qO- http://localhost/ >/dev/null || exit 1
CMD ["nginx", "-g", "daemon off;"]
