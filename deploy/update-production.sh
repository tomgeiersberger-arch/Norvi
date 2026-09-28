#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${NORVI_PROJECT_DIR:-/home/norviadmin/norvi}"
BUN="${BUN_BIN:-$HOME/.bun/bin/bun}"
cd "$ROOT"

if [[ ! -x "$BUN" ]]; then
  BUN="$(command -v bun || true)"
fi
[[ -n "$BUN" ]] || { echo "Bun fehlt." >&2; exit 1; }
# Turborepo invokes the package manager by name. When this script is started
# from systemd/remote shells, Bun may only be known via BUN_BIN and not PATH.
export PATH="$(dirname "$BUN"):$PATH"
[[ -f .env ]] || { echo ".env fehlt." >&2; exit 1; }

if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  echo "Abbruch: Es gibt lokale Änderungen an getrackten Dateien." >&2
  git status --short
  exit 2
fi

echo "==> Sicherheitsbackup"
if [[ -f deploy/backup-norvi.sh ]]; then
  bash deploy/backup-norvi.sh
fi

echo "==> main aktualisieren"
git fetch origin main
git checkout main
git merge --ff-only origin/main


echo "==> Abhängigkeiten"
"$BUN" install --frozen-lockfile

echo "==> Qualitätssicherung"
"$BUN" run typecheck
"$BUN" run lint
"$BUN" run build:web

echo "==> Datenbankschema"
"$BUN" run db:push

echo "==> User-Services installieren"
USER_SYSTEMD="$HOME/.config/systemd/user"
mkdir -p "$USER_SYSTEMD"
cp deploy/norvi-backup.service "$USER_SYSTEMD/norvi-backup.service"
cp deploy/norvi-backup.timer "$USER_SYSTEMD/norvi-backup.timer"
cp deploy/norvi-quick-tunnel.service "$USER_SYSTEMD/norvi-quick-tunnel.service"

export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
export DBUS_SESSION_BUS_ADDRESS="${DBUS_SESSION_BUS_ADDRESS:-unix:path=$XDG_RUNTIME_DIR/bus}"
systemctl --user daemon-reload
systemctl --user enable --now norvi-backup.timer

echo "==> NORVI neu laden"
pid="$(pgrep -f '^/home/norviadmin/.bun/bin/bun packages/web/src/__server.ts$' | head -1 || true)"
if [[ -n "$pid" ]]; then
  kill -TERM "$pid"
fi

for _ in $(seq 1 30); do
  if curl -fsS --max-time 2 http://127.0.0.1:4200/api/health >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
curl -fsS --max-time 5 http://127.0.0.1:4200/api/health >/dev/null

auth="$(grep -m1 '^REQUIRE_AUTH=' .env | cut -d= -f2- | tr '[:upper:]' '[:lower:]' | xargs || true)"
secret="$(grep -m1 '^BETTER_AUTH_SECRET=' .env | cut -d= -f2- || true)"
if [[ "$auth" =~ ^(true|1|yes|on)$ ]] && [[ -n "${secret//[[:space:]]/}" ]] && command -v cloudflared >/dev/null 2>&1; then
  echo "==> Öffentlichen HTTPS-Tunnel aktivieren"
  systemctl --user stop norvi-quick-tunnel.service 2>/dev/null || true

  # Alte manuell gestartete Quick-Tunnel beenden, damit kein veralteter Link
  # parallel öffentlich erreichbar bleibt.
  while read -r oldpid; do
    [[ -n "$oldpid" ]] && kill "$oldpid" 2>/dev/null || true
  done < <(
    ps -u "$(id -u)" -o pid=,args= |
      awk '/cloudflared tunnel/ && /--url http:\/\/127\.0\.0\.1:4200/ {print $1}'
  )

  rm -f data/public-url.txt
  systemctl --user enable --now norvi-quick-tunnel.service

  for _ in $(seq 1 70); do
    [[ -s data/public-url.txt ]] && break
    sleep 1
  done

  # Der Tunnel aktualisiert WEBSITE_URL und startet NORVI bei einer neuen URL
  # selbst neu. Deshalb nach der URL noch einmal auf lokale Bereitschaft warten.
  for _ in $(seq 1 30); do
    if curl -fsS --max-time 2 http://127.0.0.1:4200/api/health >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
else
  echo "==> Quick Tunnel übersprungen (Auth/Secret/cloudflared nicht sicher bereit)"
fi

echo "==> Laufzeit-Selbsttest"
bash deploy/norvi-self-test.sh --runtime-only

if [[ -s data/public-url.txt ]]; then
  echo "NORVI öffentlich: $(head -n1 data/public-url.txt)"
fi
echo "NORVI Update abgeschlossen."
