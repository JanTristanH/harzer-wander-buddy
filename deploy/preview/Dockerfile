# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS web
WORKDIR /build
COPY app/package*.json ./
COPY app/patches ./patches
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; npm ci
COPY app ./
ARG PREVIEW_PR
ENV HWB_PREVIEW_PR=$PREVIEW_PR EXPO_PUBLIC_AUTH_MODE=basic EXPO_PUBLIC_BACKEND_URL=same-origin
RUN npx expo export --platform web

FROM node:22-bookworm-slim
WORKDIR /srv/hwb
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY --chown=node:node backend/hwb/package*.json ./
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; npm ci
# Use the existing CAP demo CSVs, never a local database or private bindings.
COPY --chown=node:node backend/hwb/srv ./srv
COPY --chown=node:node backend/hwb/util/seedPreviewBadges.js ./util/seedPreviewBadges.js
COPY --chown=node:node backend/hwb/db/schema.cds ./db/schema.cds
COPY --chown=node:node backend/hwb/db/doNotDeploy-data ./db/data
# CSV import needs more heap than the inexpensive 1-GiB runtime allows.
# Seed once during the image build; cold starts only copy the resulting database.
RUN NODE_ENV=development CDS_ENV=dev-basic \
    CDS_REQUIRES_DB_CREDENTIALS_URL=/srv/hwb/preview-seed.sqlite \
    NODE_OPTIONS=--max-old-space-size=2048 \
    ./node_modules/.bin/cds deploy --profile dev-basic && \
    NODE_ENV=development CDS_ENV=dev-basic CDS_REQUIRES_DB_CREDENTIALS_URL=/srv/hwb/preview-seed.sqlite \
    node util/seedPreviewBadges.js
COPY --from=web --chown=node:node /build/dist ./app/rnweb
COPY --chown=node:node deploy/preview/start.sh ./start.sh
ARG PREVIEW_SHA
ARG PREVIEW_PR
LABEL org.opencontainers.image.revision=$PREVIEW_SHA
RUN node -e 'require("fs").writeFileSync("app/rnweb/preview.json", JSON.stringify({sha:process.argv[1],pr:process.argv[2]}))' "$PREVIEW_SHA" "$PREVIEW_PR"
# CAP's production profile intentionally rejects Basic auth. This dedicated
# disposable image uses dev-basic and never receives production credentials.
ENV NODE_ENV=development PORT=8080 CDS_ENV=dev-basic CDS_REQUIRES_AUTH_IMPL=srv/basic-auth.js
USER node
CMD ["sh", "./start.sh"]
