#!/usr/bin/env bash
#
# NORVI AI — Wiederherstellung aus einem Backup von deploy/backup.sh
#
#   ./deploy/restore.sh backups/norvi-2026-09-12_033000.tar.gz
#   ./deploy/restore.sh backups/norvi-...tar.gz --with-env   # auch die .env zurückholen
#
# Der Dienst sollte dabei gestoppt sein:
#
#   sudo systemctl stop norvi     # bzw. bun run stop (pm2)
#   ./deploy/restore.sh <archiv>
#   sudo systemctl start norvi

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

ARCHIVE="${1:-}"
WITH_ENV=0
for arg in "${@:2}"; do
  [ "$arg" = "--with-env" ] && WITH_ENV=1
done

if [ -z "$ARCHIVE" ] || [ ! -f "$ARCHIVE" ]; then
  echo "Aufruf: ./deploy/restore.sh <archiv.tar.gz> [--with-env]" >&2
  exit 1
fi

if [ ! -f .env ] && [ "$WITH_ENV" -eq 0 ]; then
  echo "FEHLER: .env fehlt. Entweder erst .env anlegen oder mit --with-env aus dem Backup holen." >&2
  exit 1
fi

echo "==> Stelle wieder her aus $ARCHIVE"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
tar -xzf "$ARCHIVE" -C "$WORK"
SRC="$(find "$WORK" -maxdepth 1 -type d -name 'norvi-*' | head -n 1)"

if [ -z "$SRC" ]; then
  echo "FEHLER: Das Archiv hat nicht den erwarteten Aufbau." >&2
  exit 1
fi

if [ "$WITH_ENV" -eq 1 ] && [ -f "$SRC/env.backup" ]; then
  [ -f .env ] && cp .env ".env.vor-restore-$(date +%Y%m%d%H%M%S)"
  cp "$SRC/env.backup" .env
  chmod 600 .env
  echo "    .env zurückgeholt (alte Datei als .env.vor-restore-* gesichert)"
fi

read_env() {
  sed -n "s/^[[:space:]]*$1[[:space:]]*=[[:space:]]*//p" .env | tail -n 1 | tr -d '"'"'"'\r'
}

DATABASE_URL="$(read_env DATABASE_URL)"
UPLOAD_DIR="$(read_env UPLOAD_DIR)"
UPLOAD_DIR="${UPLOAD_DIR:-data/uploads}"

# --- Datenbank ---------------------------------------------------------------
if [ -f "$SRC/norvi.db" ]; then
  case "$DATABASE_URL" in
    file:*)
      DB_PATH="${DATABASE_URL#file:}"
      case "$DB_PATH" in
        /*) : ;;
        *) DB_PATH="$PROJECT_ROOT/${DB_PATH#./}" ;;
      esac
      mkdir -p "$(dirname "$DB_PATH")"
      if [ -f "$DB_PATH" ]; then
        cp "$DB_PATH" "$DB_PATH.vor-restore-$(date +%Y%m%d%H%M%S)"
        echo "    Bestehende Datenbank als *.vor-restore-* gesichert"
      fi
      # Alte WAL-Reste entfernen, sonst mischt SQLite zwei Stände.
      rm -f "$DB_PATH-wal" "$DB_PATH-shm"
      cp "$SRC/norvi.db" "$DB_PATH"
      echo "    Datenbank wiederhergestellt: $DB_PATH"
      ;;
    *)
      echo "    HINWEIS: DATABASE_URL zeigt nicht auf eine lokale Datei — Datenbank übersprungen."
      ;;
  esac
else
  echo "    Keine Datenbank im Archiv (entfernte DB) — übersprungen."
fi

# --- Uploads -----------------------------------------------------------------
if [ -d "$SRC/uploads" ]; then
  UPLOAD_PATH="$UPLOAD_DIR"
  case "$UPLOAD_PATH" in
    /*) : ;;
    *) UPLOAD_PATH="$PROJECT_ROOT/${UPLOAD_PATH#./}" ;;
  esac
  mkdir -p "$UPLOAD_PATH"
  cp -R "$SRC/uploads/." "$UPLOAD_PATH/" 2>/dev/null || true
  COUNT="$(find "$UPLOAD_PATH" -type f | wc -l | tr -d ' ')"
  echo "    Uploads wiederhergestellt: $COUNT Datei(en) in $UPLOAD_PATH"
fi

if [ -f "$SRC/git-commit.txt" ]; then
  echo "    Backup-Stand entstand bei Commit $(cat "$SRC/git-commit.txt")"
fi

echo "==> Fertig. Dienst wieder starten (sudo systemctl start norvi)."
