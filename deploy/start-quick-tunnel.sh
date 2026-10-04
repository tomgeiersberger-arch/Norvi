#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${NORVI_PROJECT_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
CLOUDFLARED="${CLOUDFLARED_BIN:-/usr/local/bin/cloudflared}"
STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/norvi"
LOG_FILE="${STATE_DIR}/cloudflared-quick.log"
PUBLIC_URL_FILE="${PROJECT_DIR}/data/public-url.txt"

mkdir -p "$STATE_DIR" "${PROJECT_DIR}/data"
: >"$LOG_FILE"

"$CLOUDFLARED" tunnel \
  --protocol http2 \
  --no-autoupdate \
  --url http://127.0.0.1:4200 \
  --loglevel info \
  --logfile "$LOG_FILE" &
child=$!

cleanup() {
  kill "$child" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

url=""
for _ in $(seq 1 60); do
  if ! kill -0 "$child" 2>/dev/null; then
    echo "cloudflared stopped before publishing a URL" >&2
    wait "$child" || true
    exit 1
  fi

  url="$(grep -Eo 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG_FILE" | tail -1 || true)"
  [[ -n "$url" ]] && break
  sleep 1
done

if [[ -z "$url" ]]; then
  echo "Timed out waiting for a trycloudflare.com URL" >&2
  exit 1
fi

printf '%s\n' "$url" >"$PUBLIC_URL_FILE"
chmod 600 "$PUBLIC_URL_FILE"

changed="$(python3 - "${PROJECT_DIR}/.env" "$url" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
url = sys.argv[2]
lines = path.read_text().splitlines()
out = []
found = False
changed = False
for line in lines:
    if line.startswith("WEBSITE_URL="):
        found = True
        new = f"WEBSITE_URL={url}"
        changed |= line != new
        out.append(new)
    else:
        out.append(line)
if not found:
    out.append(f"WEBSITE_URL={url}")
    changed = True
path.write_text("\n".join(out) + "\n")
print("1" if changed else "0")
PY
)"

if [[ "$changed" == "1" ]]; then
  pid="$(pgrep -u "$(id -u)" -f 'packages/web/src/__server.ts' | head -1 || true)"
  [[ -n "$pid" ]] && kill -TERM "$pid" || true
fi

echo "NORVI public URL: $url"
wait "$child"
