#!/usr/bin/env bash
# Consult Gemini (via Antigravity `agy`) headless for natural Korean phrasing or
# multi-persona review. Returns the model's text response on stdout.
#
# Usage:
#   gemini-ask.sh [-m "MODEL"] "PROMPT"
#   gemini-ask.sh [-m "MODEL"] <<'EOF'
#   ...multi-line prompt...
#   EOF
#
# Guardrail: runs from a throwaway temp dir so the current repo is NOT added to
# agy's workspace and shipped to Google. Pass only the text you intend to send.
set -euo pipefail

AGY="${AGY_BIN:-$HOME/.local/bin/agy}"
# The "gemini 3.1 pro" the user asked for. Override with -m or GEMINI_CONSULT_MODEL.
# See `agy models` for the full list (e.g. "Gemini 3.1 Pro (Low)" is faster).
MODEL="${GEMINI_CONSULT_MODEL:-Gemini 3.1 Pro (High)}"

while getopts "m:" opt; do
  case "$opt" in
    m) MODEL="$OPTARG" ;;
    *) echo 'usage: gemini-ask.sh [-m "MODEL"] "PROMPT"' >&2; exit 2 ;;
  esac
done
shift $((OPTIND - 1))

# Prompt from first arg, else from stdin.
PROMPT="${1:-}"
if [ -z "$PROMPT" ] && [ ! -t 0 ]; then
  PROMPT="$(cat)"
fi
[ -n "$PROMPT" ] || { echo "gemini-ask.sh: empty prompt" >&2; exit 2; }

[ -x "$AGY" ] || {
  echo "gemini-ask.sh: agy not found at $AGY — install: https://antigravity.google/cli" >&2
  exit 3
}

# Neutral cwd → agy won't pull the current repo into its workspace context.
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT
cd "$WORKDIR"

# NOTE: --model must precede -p, and the prompt must be the value right after -p.
# Any flag between -p and the prompt breaks prompt delivery.
# `timeout` caps a hung call, but it's not present on stock macOS (GNU coreutils
# only) — fall back to an uncapped run there rather than failing (cli-development
# BSD/GNU rule: `command -v` fallback).
if command -v timeout >/dev/null 2>&1; then
  exec timeout 180 "$AGY" --model="$MODEL" -p "$PROMPT"
fi
exec "$AGY" --model="$MODEL" -p "$PROMPT"
