#!/usr/bin/env bash
# One-time workspace setup: install the three pnpm projects and make sure the
# shared root .env is present. Safe to re-run. Used by Conductor's setup script
# and by `pnpm setup:workspace`.
set -euo pipefail

cd "$(dirname "$0")/../.."

# Conductor runs this in a non-interactive shell; make sure node/pnpm from nvm are on PATH.
if ! command -v pnpm >/dev/null 2>&1; then
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
fi
command -v pnpm >/dev/null 2>&1 || { echo "ERROR: pnpm not found (expected node 22 via nvm or brew)"; exit 1; }

# The single shared .env is gitignored. Conductor's default "Files to copy" rule
# (.env*) brings it from the repo root into new workspaces; this is the fallback.
if [ ! -f .env ] && [ -n "${CONDUCTOR_ROOT_PATH:-}" ] && [ -f "$CONDUCTOR_ROOT_PATH/.env" ]; then
  cp "$CONDUCTOR_ROOT_PATH/.env" .env
  echo "copied .env from $CONDUCTOR_ROOT_PATH"
fi
if [ ! -f .env ]; then
  echo "WARN: no .env here. Copy .env.example to .env at the repo root and fill in" >&2
  echo "      VITE_CONVEX_URL + Clerk keys; new workspaces will then pick it up." >&2
fi

# Three separate pnpm projects, each with its own lockfile.
pnpm install --frozen-lockfile
pnpm --dir admin-frontend  install --frozen-lockfile
pnpm --dir client-frontend install --frozen-lockfile

echo "setup ok"
