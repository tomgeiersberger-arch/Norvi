#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="desktop-commander-remote.service"
SOURCE="$(cd "$(dirname "$0")" && pwd)/${SERVICE_NAME}"
TARGET="/etc/systemd/system/${SERVICE_NAME}"

if ! command -v npx >/dev/null 2>&1; then
  echo "FEHLER: npx ist nicht installiert." >&2
  exit 1
fi

echo "WICHTIG: Desktop Commander muss fuer Benutzer norviadmin mindestens einmal"
echo "interaktiv autorisiert worden sein:"
echo "  npx --yes @wonderwhy-er/desktop-commander@0.2.51 remote"
echo
echo "Die systemd-Unit enthaelt keine Tokens. Sie verwendet nur die bereits lokal"
echo "gespeicherte Autorisierung im Home-Verzeichnis von norviadmin."
echo

sudo install -m 0644 "$SOURCE" "$TARGET"
sudo systemctl daemon-reload
sudo systemctl enable --now desktop-commander-remote

echo
echo "Status:"
systemctl --no-pager --full status desktop-commander-remote || true
echo
echo "Logs:"
echo "  journalctl -u desktop-commander-remote -f"
