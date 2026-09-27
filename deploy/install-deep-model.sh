#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_MODEL="qwen3:4b-instruct-2507-q4_K_M"
TARGET_MODEL="norvi-deep:latest"

command -v ollama >/dev/null 2>&1 || {
  echo "Ollama ist nicht installiert oder nicht im PATH." >&2
  exit 1
}

echo "[NORVI] Lade 4B-Instruct-Basis: $BASE_MODEL"
ollama pull "$BASE_MODEL"

echo "[NORVI] Erzeuge $TARGET_MODEL"
ollama create "$TARGET_MODEL" -f "$ROOT/deploy/Modelfile.norvi4b-instruct"

echo "[NORVI] Fertig. In .env setzen:"
echo "AI_DEEP_MODEL=$TARGET_MODEL"
