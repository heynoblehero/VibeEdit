#!/usr/bin/env bash
# Deploy the cliproxy dokku app from this folder. Idempotent — safe to re-run.
set -euo pipefail

DOKKU_HOST="${DOKKU_HOST:-172.104.41.101}"
APP_NAME="${CLIPROXY_APP:-cliproxy}"

cd "$(dirname "$0")"

echo "==> Ensuring app '${APP_NAME}' exists on ${DOKKU_HOST}"
if ! ssh "dokku@${DOKKU_HOST}" apps:exists "${APP_NAME}" &>/dev/null; then
  ssh "dokku@${DOKKU_HOST}" apps:create "${APP_NAME}"
  ssh "dokku@${DOKKU_HOST}" storage:ensure-directory "${APP_NAME}-auth"
  ssh "dokku@${DOKKU_HOST}" storage:mount "${APP_NAME}" "${APP_NAME}-auth:/root/.cli-proxy-api"
fi

echo "==> Pushing docker/cliproxy to ${APP_NAME}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT
cp Dockerfile config.yaml "${TMP_DIR}/"
cd "${TMP_DIR}"
git init -q
git add .
git -c user.email=deploy@local -c user.name=deploy commit -q -m "cliproxy deploy $(date -u +%Y-%m-%dT%H:%M:%SZ)"
git remote add dokku "dokku@${DOKKU_HOST}:${APP_NAME}"
git push dokku master:master --force

echo ""
echo "==> Management panel:"
echo "    http://${APP_NAME}.${DOKKU_HOST}.sslip.io/management.html"
echo ""
echo "==> Next: run the Claude OAuth flow in the panel, then wire VibeEdit:"
echo "    ssh dokku@${DOKKU_HOST} config:set vibeedit \\"
echo "      ANTHROPIC_BASE_URL=http://${APP_NAME}.${DOKKU_HOST}.sslip.io \\"
echo "      ANTHROPIC_API_KEY=vibeedit-internal"
