#!/usr/bin/env bash
# AIrIA — swap_model.sh
# Builds an Ollama Modelfile from an adapter path and registers the model.
#
# Usage:
#   ./swap_model.sh <new_model_name> <adapter_path> [base_model]
#
# Arguments:
#   $1  new_model_name  — Ollama model name to create (e.g. airia-local-v2)
#   $2  adapter_path    — Path to directory containing LoRA adapter weights
#   $3  base_model      — Base Ollama model (default: gemma3:4b)
#
# Outputs:
#   On success: {"status": "ok", "model": "<new_model_name>"}
#   On failure: {"status": "error", "message": "..."} and exits 1

set -euo pipefail

# ── Args ───────────────────────────────────────────────────────────────────

NEW_MODEL_NAME="${1:-}"
ADAPTER_PATH="${2:-}"
BASE_MODEL="${3:-gemma3:4b}"

if [[ -z "$NEW_MODEL_NAME" || -z "$ADAPTER_PATH" ]]; then
  printf '{"status": "error", "message": "Usage: swap_model.sh <new_model_name> <adapter_path> [base_model]"}\n'
  exit 1
fi

# ── Validate adapter path ──────────────────────────────────────────────────

if [[ ! -d "$ADAPTER_PATH" ]]; then
  printf '{"status": "error", "message": "adapter_path not found or not a directory: %s"}\n' "$ADAPTER_PATH"
  exit 1
fi

# ── Create temp Modelfile ──────────────────────────────────────────────────

MODELFILE_PATH="$(mktemp /tmp/airia-modelfile-XXXXXX.Modelfile)"

# Ensure cleanup on exit (including error paths)
trap 'rm -f "$MODELFILE_PATH"' EXIT

cat > "$MODELFILE_PATH" <<EOF
FROM ${BASE_MODEL}
ADAPTER ${ADAPTER_PATH}
EOF

# ── Run ollama create ──────────────────────────────────────────────────────

if ! command -v ollama &> /dev/null; then
  printf '{"status": "error", "message": "ollama CLI not found in PATH"}\n'
  exit 1
fi

# Capture both stdout and stderr from ollama
OLLAMA_OUTPUT="$(ollama create "$NEW_MODEL_NAME" -f "$MODELFILE_PATH" 2>&1)" || {
  EXIT_CODE=$?
  # Escape any double-quotes in the output for valid JSON
  ESCAPED_OUTPUT="${OLLAMA_OUTPUT//\"/\\\"}"
  printf '{"status": "error", "message": "ollama create failed (exit %d): %s"}\n' \
    "$EXIT_CODE" "$ESCAPED_OUTPUT"
  exit 1
}

# ── Success ────────────────────────────────────────────────────────────────

printf '{"status": "ok", "model": "%s"}\n' "$NEW_MODEL_NAME"
