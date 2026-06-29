#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="${SERVICE_NAME:-campstore-pos}"
RESTART_CMD="${RESTART_CMD:-}"

git pull
npm install --omit=dev
npm run setup

if [[ -n "$RESTART_CMD" ]]; then
  # shellcheck disable=SC2086
  $RESTART_CMD
elif command -v systemctl >/dev/null 2>&1; then
  sudo systemctl restart "$SERVICE_NAME"
else
  echo "Update complete. Restart the Campstore-PoS service manually, or set RESTART_CMD." >&2
fi
