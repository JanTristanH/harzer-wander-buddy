#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
: "${HWB_PREVIEW_PR:?Set HWB_PREVIEW_PR}"
: "${EXPO_PUBLIC_BACKEND_URL:?Set the deployed Cloud Run URL}"
: "${PREVIEW_ANDROID_KEYSTORE_BASE64:?Set the preview-only keystore}"
: "${PREVIEW_ANDROID_KEYSTORE_PASSWORD:?Set the preview keystore password}"
[[ "$HWB_PREVIEW_PR" =~ ^[1-9][0-9]*$ && "$EXPO_PUBLIC_BACKEND_URL" == https://* ]] || {
  echo 'A positive PR number and HTTPS backend URL are required.' >&2; exit 1;
}
if [ -d app/android ]; then
  echo 'Use a fresh checkout: refusing to overwrite an existing Android project or its caches.' >&2
  exit 1
fi
export EXPO_PUBLIC_AUTH_MODE=basic EXPO_NO_DOTENV=1
signing_dir=$(mktemp -d)
trap 'rm -rf "$signing_dir"' EXIT
printf '%s' "$PREVIEW_ANDROID_KEYSTORE_BASE64" | base64 --decode > "$signing_dir/preview.jks"
chmod 600 "$signing_dir/preview.jks"
keytool -list -keystore "$signing_dir/preview.jks" -alias preview \
  -storepass:env PREVIEW_ANDROID_KEYSTORE_PASSWORD >/dev/null
(
  cd app
  npx --no-install expo prebuild --platform android --no-install
  cd android
  ./gradlew assembleRelease --no-daemon --max-workers=2 \
    -PreactNativeArchitectures=arm64-v8a,x86_64 '-Dorg.gradle.jvmargs=-Xmx4g -XX:MaxMetaspaceSize=1g'
)
sdk_root=${ANDROID_HOME:-${ANDROID_SDK_ROOT:?Set ANDROID_HOME or ANDROID_SDK_ROOT}}
apksigner=$(find "$sdk_root/build-tools" -name apksigner -type f | sort -V | tail -n 1)
test -n "$apksigner"
mkdir -p preview-artifacts
"$apksigner" sign --ks "$signing_dir/preview.jks" --ks-key-alias preview \
  --ks-pass env:PREVIEW_ANDROID_KEYSTORE_PASSWORD --key-pass env:PREVIEW_ANDROID_KEYSTORE_PASSWORD \
  --out preview-artifacts/preview.apk app/android/app/build/outputs/apk/release/app-release.apk
"$apksigner" verify --verbose --print-certs preview-artifacts/preview.apk
