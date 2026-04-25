#!/usr/bin/env bash
# Deploy VibeEdit to dokku. Pushes master → main on the dokku-linode remote.
# Runs docker/cliproxy/deploy.sh too if you pass --with-proxy.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${REPO_ROOT}"

WITH_PROXY=0
for arg in "$@"; do
  case "$arg" in
    --with-proxy) WITH_PROXY=1 ;;
    *) echo "unknown flag: $arg" >&2; exit 2 ;;
  esac
done

if ! git remote get-url dokku-linode &>/dev/null; then
  echo "error: no 'dokku-linode' git remote — add it first:" >&2
  echo "       git remote add dokku-linode dokku@<host>:vibeedit" >&2
  exit 1
fi

REF="$(git rev-parse --short HEAD) ($(git log -1 --pretty=%s))"
echo "==> Deploying ${REF}"
echo "==> Pushing to GitHub origin…"
git push origin master

echo "==> Pushing to dokku-linode (main)…"
git push dokku-linode master:main

if [[ "$WITH_PROXY" == "1" ]]; then
  echo "==> Redeploying cliproxy…"
  "${REPO_ROOT}/docker/cliproxy/deploy.sh"
fi

echo ""
echo "==> Live at: https://vibevideoedit.com"
