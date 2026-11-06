# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS backend-deps
WORKDIR /usr/src/app
COPY backend/hwb/package*.json ./
# postgres declares cds-dk as an optional build-time peer; npm retains it via the lockfile.
# Runtime deployment uses the CAP API and does not need that SDK or its HANA tooling.
RUN --mount=type=cache,target=/root/.npm \
    --mount=type=secret,id=proxy_ca \
    NODE_EXTRA_CA_CERTS=${NODE_EXTRA_CA_CERTS:-/run/secrets/proxy_ca} npm ci --omit=dev --omit=peer --no-audit --no-fund \
    && rm -rf node_modules/@sap/cds-dk \
    && test ! -d node_modules/@sap/cds-dk \
    && test ! -d node_modules/sqlite3

FROM backend-deps AS model-builder
ENV NODE_ENV=production
RUN --mount=type=bind,source=backend/hwb/db,target=/usr/src/app/db \
    --mount=type=bind,source=backend/hwb/srv,target=/usr/src/app/srv \
    --mount=type=bind,source=backend/hwb/app,target=/usr/src/app/app \
    --mount=type=bind,source=backend/hwb/util/compileRuntimeModel.js,target=/usr/src/app/util/compileRuntimeModel.js \
    node util/compileRuntimeModel.js /runtime/csn.json

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

FROM debian:bookworm-slim AS static-assets
RUN --mount=type=bind,source=backend/hwb/app,target=/source-app \
    --mount=from=ui5-builder,source=/ui5/dist,target=/ui5-dist \
    mkdir -p /assets/frontendhwb \
    && cp -a /source-app/index.html /source-app/dependencies /source-app/pbc /assets/ \
    && cp -a /source-app/frontendhwb/webapp /assets/frontendhwb/ \
    && cp -a /ui5-dist /assets/frontendhwb/dist \
    && rm -rf /assets/frontendhwb/webapp/test /assets/frontendhwb/webapp/localService \
        /assets/frontendhwb/dist/test /assets/frontendhwb/dist/localService

FROM gcr.io/distroless/nodejs22-debian12:nonroot AS runtime
# Keep `node util/deployProduction.js` and `docker exec ... node` usable.
ENV PATH=/nodejs/bin:/usr/bin:/bin
ENTRYPOINT []
ENV NODE_ENV=production
WORKDIR /usr/src/app
COPY --chown=65532:65532 --from=backend-deps /usr/src/app/node_modules ./node_modules
COPY --chown=65532:65532 backend/hwb/package.json ./
COPY --chown=65532:65532 backend/hwb/srv/*.js ./srv/
COPY --chown=65532:65532 --from=model-builder /runtime/csn.json ./srv/csn.json
COPY --chown=65532:65532 --from=static-assets /assets ./app
COPY --chown=65532:65532 backend/hwb/util/deployProduction.js backend/hwb/util/startProduction.js ./util/
COPY --chown=65532:65532 --from=expo-web-exporter /usr/src/expo-app/dist ./app/rnweb
EXPOSE 4004
CMD ["node", "util/startProduction.js"]
