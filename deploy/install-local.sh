#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
OS="$(uname -s)"

echo "==> NORVI Local AI Setup ($OS)"

if ! command -v curl >/dev/null 2>&1; then
  echo "curl fehlt. Bitte zuerst curl installieren." >&2
  exit 2
fi

if ! command -v bun >/dev/null 2>&1; then
  echo "==> Installiere Bun"
  curl -fsSL https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"
fi

if ! command -v ollama >/dev/null 2>&1; then
  echo "==> Installiere Ollama"
  curl -fsSL https://ollama.com/install.sh | sh
fi

if ! curl -fsS --max-time 2 http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
  echo "==> Starte Ollama"
  if [[ "$OS" == "Linux" ]] && command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files ollama.service >/dev/null 2>&1; then
    sudo systemctl enable --now ollama
  elif [[ "$OS" == "Darwin" ]]; then
    open -a Ollama >/dev/null 2>&1 || nohup ollama serve >/tmp/norvi-ollama.log 2>&1 &
  else
    nohup ollama serve >/tmp/norvi-ollama.log 2>&1 &
  fi
fi

for _ in $(seq 1 30); do
  curl -fsS --max-time 2 http://127.0.0.1:11434/api/tags >/dev/null 2>&1 && break
  sleep 1
done

curl -fsS --max-time 2 http://127.0.0.1:11434/api/tags >/dev/null
exec bun deploy/setup-local.ts "$@"
