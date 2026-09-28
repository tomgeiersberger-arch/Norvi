#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="desktop-commander-remote.service"
SOURCE="$(cd "$(dirname "$0")" && pwd)/${SERVICE_NAME}"
USER_SYSTEMD="$HOME/.config/systemd/user"
TARGET="$USER_SYSTEMD/${SERVICE_NAME}"
REMOTE_BIN="${DESKTOP_COMMANDER_BIN:-$HOME/.local/share/desktop-commander/node_modules/.bin/desktop-commander}"

if [[ ! -x "$REMOTE_BIN" ]]; then
  echo "FEHLER: Desktop Commander wurde fuer diesen Benutzer noch nicht dauerhaft installiert." >&2
  echo "Einmal interaktiv starten und autorisieren:" >&2
  echo "  npx --yes @wonderwhy-er/desktop-commander@0.2.51 remote" >&2
  exit 1
fi

mkdir -p "$USER_SYSTEMD"
install -m 0644 "$SOURCE" "$TARGET"

export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
export DBUS_SESSION_BUS_ADDRESS="${DBUS_SESSION_BUS_ADDRESS:-unix:path=$XDG_RUNTIME_DIR/bus}"

systemctl --user daemon-reload
systemctl --user enable --now "$SERVICE_NAME"

echo
echo "Status:"
systemctl --user --no-pager --full status "$SERVICE_NAME" || true

linger="$(loginctl show-user "$(id -un)" -p Linger --value 2>/dev/null || true)"
if [[ "$linger" != "yes" ]]; then
  echo
  echo "HINWEIS: Linger ist noch nicht aktiv. Damit der User-Service auch ohne Login"
  echo "nach Boot/Logout weiterlaeuft, einmalig ausfuehren:"
  echo "  sudo loginctl enable-linger $(id -un)"
fi

echo
echo "Logs:"
echo "  journalctl --user -u $SERVICE_NAME -f"
