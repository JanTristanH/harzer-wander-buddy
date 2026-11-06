# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS backend-deps
WORKDIR /usr/src/app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    --mount=type=secret,id=proxy_ca \
    NODE_EXTRA_CA_CERTS=${NODE_EXTRA_CA_CERTS:-/run/secrets/proxy_ca} npm ci --omit=dev --no-audit --no-fund

FROM node:22-bookworm-slim AS ui5-builder
WORKDIR /ui5
COPY app/frontendhwb/package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    --mount=type=secret,id=proxy_ca \
    NODE_EXTRA_CA_CERTS=${NODE_EXTRA_CA_CERTS:-/run/secrets/proxy_ca} npm ci --no-audit --no-fund
COPY app/frontendhwb ./
RUN npm run build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /usr/src/app
COPY --from=backend-deps /usr/src/app/node_modules ./node_modules
COPY package.json ./
COPY db ./db
COPY srv ./srv
COPY app ./app
COPY util/deployProduction.js ./util/deployProduction.js
COPY --from=ui5-builder /ui5/dist ./app/frontendhwb/dist
COPY --chmod=755 start.sh ./start.sh
EXPOSE 4004
CMD ["./start.sh"]
