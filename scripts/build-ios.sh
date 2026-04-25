#!/usr/bin/env bash
# Build the iOS app archive locally. Requires macOS + Xcode + a paid
# Apple Developer account if you want to install on a real device or
# upload to TestFlight.
#
# Without a developer cert, you can still build + run in the simulator
# using `bun run cap:run:ios` after this script syncs the native project.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${REPO_ROOT}"

if [[ "$(uname)" != "Darwin" ]]; then
  echo "✗ iOS builds require macOS. Use the simulator or TestFlight from a Mac." >&2
  exit 1
fi

echo "==> Adding ios platform if missing"
if [[ ! -d ios ]]; then
  bunx cap add ios
fi

echo "==> Pod install"
(cd ios/App && pod install)

echo "==> Sync"
bunx cap sync ios

echo ""
echo "==> Open in Xcode for archive + signing:"
echo "    open ios/App/App.xcworkspace"
echo ""
echo "Then Product → Archive → Distribute App. TestFlight upload requires"
echo "an Apple Developer account ($99/yr) and signed bundle id."
