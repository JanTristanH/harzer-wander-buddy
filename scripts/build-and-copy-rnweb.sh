#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="${ROOT_DIR}/app"
TARGET_DIR="${ROOT_DIR}/backend/hwb/app/rnweb"

echo "[1/3] Build Expo web app..."
cd "${APP_DIR}"
npx expo export --platform web

echo "[2/3] Replace CAP static target..."
rm -rf "${TARGET_DIR}"
mkdir -p "${TARGET_DIR}"
cp -R "${APP_DIR}/dist/." "${TARGET_DIR}/"

echo "[3/3] Done. Output copied to ${TARGET_DIR}"
ls -la "${TARGET_DIR}" | sed -n '1,40p'
