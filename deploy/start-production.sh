#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# NORVI AI — Production-Start auf Ubuntu.
#
# Macht in einem Durchgang: Abhaengigkeiten installieren, Datenbankschema
# anlegen, Frontend bauen, Server starten.
#
#   ./deploy/start-production.sh              # baut und startet im Vordergrund
#   ./deploy/start-production.sh --pm2        # baut und startet via pm2 (Hintergrund)
#   ./deploy/start-production.sh --build-only # nur bauen, nicht starten
# -----------------------------------------------------------------------------
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

MODE="foreground"
case "${1:-}" in
  --pm2) MODE="pm2" ;;
  --build-only) MODE="build-only" ;;
  "") ;;
  *)
    echo "Unbekannte Option: $1" >&2
    echo "Erlaubt: --pm2, --build-only" >&2
    exit 1
    ;;
esac

if ! command -v bun >/dev/null 2>&1; then
  echo "FEHLER: bun ist nicht installiert. Einmalig ausfuehren:" >&2
  echo "  curl -fsSL https://bun.sh/install | bash && exec \$SHELL" >&2
  exit 1
fi

if [ ! -f "$ROOT/.env" ]; then
  echo "FEHLER: .env fehlt. Anlegen mit:" >&2
  echo "  cp .env.example .env && nano .env" >&2
  exit 1
fi

# Pflichtvariablen pruefen, damit der Server nicht erst im Betrieb auffaellt.
missing=()
for key in DATABASE_URL BETTER_AUTH_SECRET AI_BASE_URL AI_MODEL; do
  value="$(grep -E "^${key}=" "$ROOT/.env" | tail -n1 | cut -d= -f2- || true)"
  [ -z "${value//[[:space:]]/}" ] && missing+=("$key")
done
if [ "${#missing[@]}" -gt 0 ]; then
  echo "FEHLER: In der .env fehlen Werte: ${missing[*]}" >&2
  echo "Siehe .env.example fuer die erwarteten Werte." >&2
  exit 1
fi

PORT="$(bun --print "require('./__ports.cjs').website")"

echo "==> Abhaengigkeiten installieren"
bun install --frozen-lockfile

echo "==> Laufzeitverzeichnisse anlegen"
mkdir -p "$ROOT/data/uploads"

echo "==> Datenbankschema aktualisieren"
bun run db:push

echo "==> Frontend + API bauen"
bun run build

case "$MODE" in
  build-only)
    echo "==> Fertig gebaut. Start spaeter mit: bun run serve"
    ;;
  pm2)
    echo "==> Start via pm2 auf Port ${PORT}"
    bun run start
    bunx pm2 save
    echo "==> Laeuft im Hintergrund. Logs: bunx pm2 logs web-app"
    ;;
  foreground)
    echo "==> Start auf Port ${PORT} (Strg+C beendet)"
    NODE_ENV=production PORT="$PORT" exec bun --env-file=.env packages/web/src/__server.ts
    ;;
esac
