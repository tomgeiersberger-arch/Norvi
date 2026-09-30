#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_MODEL="qwen3:1.7b"
TARGET_MODEL="norvi-direct:latest"

command -v ollama >/dev/null 2>&1 || {
  echo "Ollama ist nicht installiert oder nicht im PATH." >&2
  exit 1
}

echo "[NORVI] Lade schnelle 2B-Basis: $BASE_MODEL"
ollama pull "$BASE_MODEL"

echo "[NORVI] Erzeuge $TARGET_MODEL ohne verstecktes Thinking"
ollama create "$TARGET_MODEL" -f "$ROOT/deploy/Modelfile.norvi-direct"

echo "[NORVI] Fertig. Empfohlene .env:"
echo "AI_MODEL=$TARGET_MODEL"
echo "AI_FAST_MODEL=$TARGET_MODEL"
echo "AI_ULTRA_SERIOUS_MODEL=$TARGET_MODEL"
