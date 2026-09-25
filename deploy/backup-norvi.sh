#!/usr/bin/env bash
set -euo pipefail
umask 077

PROJECT_DIR="${NORVI_PROJECT_DIR:-/home/norviadmin/norvi}"
BACKUP_DIR="${NORVI_BACKUP_DIR:-/home/norviadmin/backups/norvi}"
UPLOAD_DIR="${PROJECT_DIR}/data/uploads"

DB_PATH="${PROJECT_DIR}/norvi.db"
if [[ -f "${PROJECT_DIR}/.env" ]]; then
  DB_URL="$(grep -m1 '^DATABASE_URL=' "${PROJECT_DIR}/.env" | cut -d= -f2- || true)"
  if [[ "$DB_URL" == file:* ]]; then
    DB_VALUE="${DB_URL#file:}"
    DB_VALUE="${DB_VALUE%%\?*}"
    if [[ "$DB_VALUE" = /* ]]; then
      DB_PATH="$DB_VALUE"
    else
      DB_PATH="${PROJECT_DIR}/${DB_VALUE#./}"
    fi
  fi
fi
STAMP="$(date +%Y%m%d-%H%M%S)"
TARGET="${BACKUP_DIR}/${STAMP}"

mkdir -p "$TARGET"

if [[ -f "$DB_PATH" ]]; then
  python3 - "$DB_PATH" "$TARGET/norvi.db" <<'PY'
import sqlite3
import sys

source_path, target_path = sys.argv[1:3]
source = sqlite3.connect(f"file:{source_path}?mode=ro", uri=True)
target = sqlite3.connect(target_path)
try:
    source.backup(target)
    result = target.execute("PRAGMA quick_check").fetchone()
    if not result or result[0] != "ok":
        raise RuntimeError(f"backup quick_check failed: {result}")
finally:
    target.close()
    source.close()
PY
fi

if [[ -d "$UPLOAD_DIR" ]]; then
  cp -a "$UPLOAD_DIR" "$TARGET/uploads"
fi

mapfile -t snapshots < <(find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort)
if (( ${#snapshots[@]} > 14 )); then
  for old in "${snapshots[@]:0:${#snapshots[@]}-14}"; do
    rm -rf -- "$BACKUP_DIR/$old"
  done
fi

echo "NORVI backup created: $TARGET"
