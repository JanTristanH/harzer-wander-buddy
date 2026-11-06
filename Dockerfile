# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS backend-deps
WORKDIR /usr/src/app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY backend/hwb/package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    --mount=type=secret,id=proxy_ca \
    NODE_EXTRA_CA_CERTS=${NODE_EXTRA_CA_CERTS:-/run/secrets/proxy_ca} npm ci --omit=dev --no-audit --no-fund

FROM node:22-bookworm-slim AS ui5-builder
WORKDIR /ui5
COPY backend/hwb/app/frontendhwb/package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    --mount=type=secret,id=proxy_ca \
    NODE_EXTRA_CA_CERTS=${NODE_EXTRA_CA_CERTS:-/run/secrets/proxy_ca} npm ci --no-audit --no-fund
COPY backend/hwb/app/frontendhwb ./
RUN npm run build

FROM node:22-bookworm-slim AS expo-web-builder
WORKDIR /usr/src/expo-app
# Google's existing Docker trigger does not pass build arguments.
ARG EXPO_PUBLIC_BACKEND_URL=https://app.harzer-wander-buddy.de
ENV EXPO_PUBLIC_BACKEND_URL=${EXPO_PUBLIC_BACKEND_URL}
RUN test -n "${EXPO_PUBLIC_BACKEND_URL}"
COPY app/package*.json ./
COPY app/patches ./patches
RUN --mount=type=cache,target=/root/.npm \
    --mount=type=secret,id=proxy_ca \
    NODE_EXTRA_CA_CERTS=${NODE_EXTRA_CA_CERTS:-/run/secrets/proxy_ca} npm ci --no-audit --no-fund
FROM node:22-bookworm-slim AS expo-web-exporter
WORKDIR /usr/src/expo-app
ARG EXPO_PUBLIC_BACKEND_URL=https://app.harzer-wander-buddy.de
ENV EXPO_PUBLIC_BACKEND_URL=${EXPO_PUBLIC_BACKEND_URL}
COPY app ./
# Mount dependencies for export instead of duplicating them in another build layer.
RUN --mount=from=expo-web-builder,source=/usr/src/expo-app/node_modules,target=/usr/src/expo-app/node_modules,rw \
    npx --no-install expo export --platform web --max-workers 2

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /usr/src/app
COPY --from=backend-deps /usr/src/app/node_modules ./node_modules
COPY backend/hwb/package.json ./
COPY backend/hwb/db ./db
COPY backend/hwb/srv ./srv
COPY backend/hwb/app ./app
COPY backend/hwb/util/deployProduction.js ./util/deployProduction.js
COPY --from=ui5-builder /ui5/dist ./app/frontendhwb/dist
COPY --from=expo-web-exporter /usr/src/expo-app/dist ./app/rnweb
COPY --chmod=755 backend/hwb/start.sh ./start.sh
EXPOSE 4004
CMD ["./start.sh"]
