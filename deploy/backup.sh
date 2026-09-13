#!/usr/bin/env bash
#
# NORVI AI — Backup der Laufzeitdaten (SQLite-Datenbank + Uploads).
#
# Aufruf (aus dem Projektverzeichnis oder mit absolutem Pfad):
#
#   ./deploy/backup.sh                      # nach ./backups
#   ./deploy/backup.sh /mnt/nas/norvi       # nach eigenem Ziel
#   KEEP=30 ./deploy/backup.sh              # 30 Stände behalten (Standard: 14)
#
# Als täglicher Cronjob um 03:30 Uhr:
#
#   crontab -e
#   30 3 * * * /home/ubuntu/norvi/deploy/backup.sh /mnt/nas/norvi >> /var/log/norvi-backup.log 2>&1
#
# Das Backup läuft im laufenden Betrieb: für SQLite wird `sqlite3 .backup`
# benutzt, das einen konsistenten Stand zieht, ohne den Server zu stoppen.
# Wenn sqlite3 fehlt, wird die Datei kopiert — dafür sollte NORVI kurz stehen.

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

DEST="${1:-$PROJECT_ROOT/backups}"
KEEP="${KEEP:-14}"
STAMP="$(date +%Y-%m-%d_%H%M%S)"

echo "==> NORVI Backup $STAMP"

if [ ! -f .env ]; then
  echo "FEHLER: .env fehlt in $PROJECT_ROOT — es ist unklar, welche Datenbank gesichert werden soll." >&2
  exit 1
fi

# DATABASE_URL / UPLOAD_DIR aus der .env lesen, ohne die Datei auszuführen.
read_env() {
  sed -n "s/^[[:space:]]*$1[[:space:]]*=[[:space:]]*//p" .env | tail -n 1 | tr -d '"'"'"'\r'
}

DATABASE_URL="$(read_env DATABASE_URL)"
UPLOAD_DIR="$(read_env UPLOAD_DIR)"
UPLOAD_DIR="${UPLOAD_DIR:-data/uploads}"

if [ -z "$DATABASE_URL" ]; then
  echo "FEHLER: DATABASE_URL ist in der .env nicht gesetzt." >&2
  exit 1
fi

mkdir -p "$DEST"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
STAGE="$WORK/norvi-$STAMP"
mkdir -p "$STAGE"

# --- Datenbank ---------------------------------------------------------------
case "$DATABASE_URL" in
  file:*)
    DB_PATH="${DATABASE_URL#file:}"
    case "$DB_PATH" in
      /*) : ;;
      *) DB_PATH="$PROJECT_ROOT/${DB_PATH#./}" ;;
    esac

    if [ ! -f "$DB_PATH" ]; then
      echo "FEHLER: Datenbankdatei nicht gefunden: $DB_PATH" >&2
      exit 1
    fi

    if command -v sqlite3 >/dev/null 2>&1; then
      echo "    Datenbank (konsistente Kopie im laufenden Betrieb): $DB_PATH"
      sqlite3 "$DB_PATH" ".backup '$STAGE/norvi.db'"
    else
      echo "    HINWEIS: sqlite3 nicht installiert (sudo apt install -y sqlite3)."
      echo "    Datenbank wird direkt kopiert — am besten bei gestopptem Dienst."
      cp "$DB_PATH" "$STAGE/norvi.db"
      # Write-Ahead-Log mitnehmen, falls vorhanden.
      [ -f "$DB_PATH-wal" ] && cp "$DB_PATH-wal" "$STAGE/norvi.db-wal"
      [ -f "$DB_PATH-shm" ] && cp "$DB_PATH-shm" "$STAGE/norvi.db-shm"
    fi
    ;;
  libsql:*|http:*|https:*)
    echo "    HINWEIS: DATABASE_URL zeigt auf eine entfernte Datenbank (Turso/libSQL)."
    echo "    Deren Backup übernimmt der Anbieter. Gesichert werden hier nur Uploads und .env."
    ;;
  *)
    echo "    WARNUNG: unbekanntes DATABASE_URL-Format — Datenbank wird übersprungen." >&2
    ;;
esac

# --- Uploads -----------------------------------------------------------------
UPLOAD_PATH="$UPLOAD_DIR"
case "$UPLOAD_PATH" in
  /*) : ;;
  *) UPLOAD_PATH="$PROJECT_ROOT/${UPLOAD_PATH#./}" ;;
esac

if [ -d "$UPLOAD_PATH" ]; then
  COUNT="$(find "$UPLOAD_PATH" -type f | wc -l | tr -d ' ')"
  echo "    Uploads: $COUNT Datei(en) aus $UPLOAD_PATH"
  mkdir -p "$STAGE/uploads"
  # -T verhindert, dass bei leerem Verzeichnis abgebrochen wird.
  cp -R "$UPLOAD_PATH/." "$STAGE/uploads/" 2>/dev/null || true
else
  echo "    Uploads: Verzeichnis $UPLOAD_PATH existiert noch nicht — übersprungen."
fi

# --- Konfiguration -----------------------------------------------------------
# Die .env enthält Secrets. Sie liegt mit im Archiv, damit ein Restore
# vollständig ist — das Archiv wird darum auf 0600 gesetzt.
cp .env "$STAGE/env.backup"
git -C "$PROJECT_ROOT" rev-parse HEAD > "$STAGE/git-commit.txt" 2>/dev/null || true

# --- Archiv ------------------------------------------------------------------
ARCHIVE="$DEST/norvi-$STAMP.tar.gz"
tar -czf "$ARCHIVE" -C "$WORK" "norvi-$STAMP"
chmod 600 "$ARCHIVE"

SIZE="$(du -h "$ARCHIVE" | cut -f1)"
echo "==> Fertig: $ARCHIVE ($SIZE)"

# --- Alte Stände aufräumen ---------------------------------------------------
TOTAL="$(find "$DEST" -maxdepth 1 -name 'norvi-*.tar.gz' | wc -l | tr -d ' ')"
if [ "$TOTAL" -gt "$KEEP" ]; then
  REMOVE=$((TOTAL - KEEP))
  echo "    Räume $REMOVE alte(n) Stand auf (behalte $KEEP)"
  find "$DEST" -maxdepth 1 -name 'norvi-*.tar.gz' -print0 \
    | sort -z \
    | head -z -n "$REMOVE" \
    | xargs -0 -r rm -f
fi

echo
echo "Wiederherstellen:  ./deploy/restore.sh $ARCHIVE"
