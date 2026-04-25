#!/usr/bin/env bash
# Build a debug-signed Android APK locally.
# Requires: Android SDK (ANDROID_HOME), Java 17+, bun.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${REPO_ROOT}"

echo "==> Adding android platform if missing"
if [[ ! -d android ]]; then
  bunx cap add android
fi

echo "==> Syncing capacitor (web → native)"
bunx cap sync android

echo "==> Building debug APK"
cd android
./gradlew assembleDebug

APK="app/build/outputs/apk/debug/app-debug.apk"
if [[ ! -f "${APK}" ]]; then
  echo "✗ APK not found at ${APK}" >&2
  exit 1
fi
SIZE_MB=$(du -m "${APK}" | cut -f1)
echo ""
echo "==> ✓ Built ${APK} (${SIZE_MB}M)"
echo ""
echo "Install on a connected device:"
echo "    adb install -r ${REPO_ROOT}/android/${APK}"
echo ""
echo "Or copy to your phone and install manually (allow 'unknown sources')."
