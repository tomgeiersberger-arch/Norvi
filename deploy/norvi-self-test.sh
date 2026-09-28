#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${NORVI_PROJECT_DIR:-/home/norviadmin/norvi}"
BUN="${BUN_BIN:-$HOME/.bun/bin/bun}"
MODE="${1:-}"

cd "$ROOT"
if [[ ! -x "$BUN" ]]; then
  BUN="$(command -v bun || true)"
fi
[[ -n "$BUN" ]] || { echo "[FAIL] Bun fehlt." >&2; exit 1; }
# Turborepo and package scripts invoke Bun by name. Remote/systemd shells may
# know the absolute BUN_BIN while not having its directory in PATH.
export PATH="$(dirname "$BUN"):$PATH"

fail=0
ok() { printf '[ OK ] %s\n' "$*"; }
bad() { printf '[FAIL] %s\n' "$*" >&2; fail=1; }
warn() { printf '[WARN] %s\n' "$*" >&2; }

if [[ "$MODE" != "--runtime-only" ]]; then
  "$BUN" run typecheck && ok "Typecheck" || bad "Typecheck"
  "$BUN" run lint && ok "Lint" || bad "Lint"
  "$BUN" run build:web && ok "Web-Build" || bad "Web-Build"
fi

if systemctl is-active --quiet norvi.service; then
  ok "norvi.service aktiv"
else
  bad "norvi.service nicht aktiv"
fi

if curl -fsS --max-time 8 http://127.0.0.1:4200/api/health >/dev/null; then
  ok "Lokaler Healthcheck"
else
  bad "Lokaler Healthcheck fehlgeschlagen"
fi

DB_PATH="$ROOT/norvi.db"
if [[ -f "$ROOT/.env" ]]; then
  DB_URL="$(grep -m1 '^DATABASE_URL=' "$ROOT/.env" | cut -d= -f2- || true)"
  if [[ "$DB_URL" == file:* ]]; then
    DB_VALUE="${DB_URL#file:}"
    DB_VALUE="${DB_VALUE%%\?*}"
    if [[ "$DB_VALUE" = /* ]]; then
      DB_PATH="$DB_VALUE"
    else
      DB_PATH="$ROOT/${DB_VALUE#./}"
    fi
  fi
fi

if [[ -f "$DB_PATH" ]]; then
  if python3 - "$DB_PATH" <<'PY'
import sqlite3, sys
con = sqlite3.connect(f"file:{sys.argv[1]}?mode=ro", uri=True)
try:
    row = con.execute("PRAGMA quick_check").fetchone()
    raise SystemExit(0 if row and row[0] == "ok" else 1)
finally:
    con.close()
PY
  then
    ok "SQLite quick_check"
  else
    bad "SQLite quick_check"
  fi
else
  bad "SQLite-Datei fehlt: $DB_PATH"
fi

if curl -fsS --max-time 5 http://127.0.0.1:11434/api/tags >/dev/null; then
  ok "Ollama erreichbar"
  if [[ -f "$ROOT/.env" ]]; then
    while IFS='=' read -r key model; do
      model="${model%%#*}"
      model="$(printf '%s' "$model" | xargs)"
      [[ -z "$model" ]] && continue
      if ollama list 2>/dev/null | awk 'NR>1 {print $1}' | grep -Fxq "$model"; then
        ok "$key=$model vorhanden"
      elif [[ "$key" == "AI_DEEP_MODEL" ]]; then
        warn "$key=$model fehlt in Ollama (nur Gründlich-Modus betroffen)"
      else
        bad "$key=$model fehlt in Ollama"
      fi
    done < <(grep -E '^(AI_MODEL|AI_FAST_MODEL|AI_DEEP_MODEL|AI_VISION_MODEL)=' "$ROOT/.env" || true)
  fi
else
  bad "Ollama nicht erreichbar"
fi

export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
export DBUS_SESSION_BUS_ADDRESS="${DBUS_SESSION_BUS_ADDRESS:-unix:path=$XDG_RUNTIME_DIR/bus}"

if systemctl --user is-enabled --quiet norvi-backup.timer 2>/dev/null; then
  ok "Backup-Timer aktiviert"
else
  warn "Backup-Timer nicht aktiviert"
fi

PUBLIC_URL=""
if [[ -f "$ROOT/data/public-url.txt" ]]; then
  PUBLIC_URL="$(head -n1 "$ROOT/data/public-url.txt" | tr -d '\r\n')"
fi
if [[ -n "$PUBLIC_URL" ]]; then
  if curl -fsS --max-time 12 "$PUBLIC_URL/api/health" >/dev/null; then
    ok "Öffentlicher HTTPS-Healthcheck"
  else
    warn "Öffentlicher Link momentan nicht erreichbar: $PUBLIC_URL"
  fi
fi

if (( fail != 0 )); then
  echo "NORVI Selbsttest: FEHLER" >&2
  exit 1
fi
echo "NORVI Selbsttest: OK"
