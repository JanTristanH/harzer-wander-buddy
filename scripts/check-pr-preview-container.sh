#!/usr/bin/env bash
# Catch cold-start failures before spending time on the native APK build.
set -euo pipefail
cd "$(dirname "$0")/.."
: "${IMAGE:?Set IMAGE}"
: "${PREVIEW_PR:?Set PREVIEW_PR}"
: "${PREVIEW_SHA:?Set PREVIEW_SHA}"
preview_port=${PREVIEW_CONTAINER_PORT:-14066}
container=$(docker run --detach --memory 1g --memory-swap 1g --cpus 1 \
  --publish "127.0.0.1:$preview_port:8080" "$IMAGE")
cleanup() {
  result=$?
  if [ "$result" -ne 0 ]; then docker logs "$container" >&2 || true; fi
  docker rm --force "$container" >/dev/null || true
  exit "$result"
}
trap cleanup EXIT
export PREVIEW_URL="http://127.0.0.1:$preview_port"
for attempt in {1..24}; do
  if curl --fail --silent --max-time 2 "$PREVIEW_URL/app/rnweb/preview.json" >/dev/null; then
    node scripts/smoke-pr-preview.cjs
    exit 0
  fi
  if [ "$(docker inspect --format '{{.State.Running}}' "$container")" != true ]; then
    echo 'Preview container exited before becoming ready.' >&2
    exit 1
  fi
  sleep 2
done
echo 'Preview container did not become ready under the 1-GiB/1-CPU limits.' >&2
exit 1
