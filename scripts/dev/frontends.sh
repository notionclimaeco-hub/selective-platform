#!/usr/bin/env bash
# Start admin-frontend and client-frontend together on a per-workspace port pair.
#
#   admin-frontend  -> BASE_PORT
#   client-frontend -> BASE_PORT + 1
#
# BASE_PORT is the first free-to-use port for this checkout, resolved in order:
#   1. CONDUCTOR_PORT  (Conductor gives every workspace CONDUCTOR_PORT..CONDUCTOR_PORT+9,
#                       so parallel workspaces never collide)
#   2. PORT            (manual override outside Conductor: PORT=4000 pnpm dev:frontends)
#   3. 3000            (plain `pnpm dev:frontends` on a laptop)
#
# --strictPort makes Vite exit instead of silently drifting to another port, so a
# collision is loud and the printed URLs are always the real ones.
#
# Both dev servers stay in this shell's process group: Ctrl-C / Conductor's Stop
# button terminates both.
set -euo pipefail

cd "$(dirname "$0")/../.."

BASE_PORT="${CONDUCTOR_PORT:-${PORT:-3000}}"
ADMIN_PORT="$BASE_PORT"
CLIENT_PORT="$((BASE_PORT + 1))"

if [ ! -f .env ]; then
  echo "WARN: no .env in $(pwd). Convex/Clerk will not connect. See .env.example." >&2
fi

port_in_use() { lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }
for p in "$ADMIN_PORT" "$CLIENT_PORT"; do
  if port_in_use "$p"; then
    echo "ERROR: port $p is already in use (another workspace or a stray dev server)." >&2
    echo "       Find it with: lsof -nP -iTCP:$p -sTCP:LISTEN" >&2
    exit 1
  fi
done

echo "==> admin-frontend  : http://localhost:$ADMIN_PORT"
echo "==> client-frontend : http://localhost:$CLIENT_PORT"
echo
# Vite listens on every interface (see vite.config.ts `server.host`), so the
# same ports work from a phone on the tailnet via the Tailscale IP or MagicDNS name.
if command -v tailscale >/dev/null 2>&1 || [ -x /Applications/Tailscale.app/Contents/MacOS/Tailscale ]; then
  TS_BIN="$(command -v tailscale || echo /Applications/Tailscale.app/Contents/MacOS/Tailscale)"
  TS_IP="$("$TS_BIN" ip -4 2>/dev/null | head -1 || true)"
  [ -n "$TS_IP" ] && echo "==> tailnet         : http://$TS_IP:$ADMIN_PORT (admin) · http://$TS_IP:$CLIENT_PORT (client)"
fi
echo

prefix() { while IFS= read -r line; do printf '%s %s\n' "$1" "$line"; done; }

cleanup() { trap - TERM INT EXIT; kill 0 2>/dev/null || true; }
trap cleanup TERM INT EXIT

pnpm --dir admin-frontend  exec vite dev --port "$ADMIN_PORT"  --strictPort 2>&1 | prefix "[admin  $ADMIN_PORT]" &
pnpm --dir client-frontend exec vite dev --port "$CLIENT_PORT" --strictPort 2>&1 | prefix "[client $CLIENT_PORT]" &

wait
