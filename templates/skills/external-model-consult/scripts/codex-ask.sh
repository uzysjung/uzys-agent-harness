#!/usr/bin/env bash
# Consult OpenAI Codex (via non-interactive `codex exec`) for concise rewriting /
# document structuring, or for image generation. Prints the model's FINAL message
# on stdout, wrapped in <untrusted-codex-output> tags; progress goes to stderr.
#
# Usage:
#   codex-ask.sh [-m MODEL] "PROMPT"                # text mode (read-only sandbox)
#   codex-ask.sh [-m MODEL] <<'EOF'                 # multi-line prompt via stdin
#   ...multi-line prompt...
#   EOF
#   codex-ask.sh -g OUT_DIR [-m MODEL] "PROMPT"     # image mode: generated files
#                                                   # are copied into OUT_DIR
#   codex-ask.sh -i FILE [-i FILE ...] "PROMPT"     # attach input image(s)
#   codex-ask.sh -- "-leading-dash prompt"          # `--` ends option parsing
#
# Exit codes: 2 usage · 3 codex missing · 4 secret-shaped prompt refused ·
#             5 image mode produced no files · 124 timed out ·
#             otherwise codex's own exit code.
#
# Guardrails: throwaway temp cwd (the repo is NEVER in Codex's workspace);
# read-only sandbox for text; workspace-write only for image mode, scoped to
# the temp dir with shell network access pinned off; ephemeral session; env
# stripped to an allowlist; secret-shaped prompts refused before sending.
set -euo pipefail

CODEX="${CODEX_BIN:-$(command -v codex || echo "$HOME/.local/bin/codex")}"
# Empty = codex's own configured default model. Override with -m or env.
MODEL="${CODEX_CONSULT_MODEL:-}"
TIMEOUT_S="${CODEX_CONSULT_TIMEOUT:-300}"
OUTDIR=""
ATTACH=()

while getopts "m:g:i:" opt; do
  case "$opt" in
    m) MODEL="$OPTARG" ;;
    g) OUTDIR="$OPTARG" ;;
    i) ATTACH+=("$OPTARG") ;;
    *) echo 'usage: codex-ask.sh [-m MODEL] [-g OUT_DIR] [-i FILE] "PROMPT"' >&2; exit 2 ;;
  esac
done
shift $((OPTIND - 1))

# Prompt from first arg, else from stdin.
PROMPT="${1:-}"
if [ -z "$PROMPT" ] && [ ! -t 0 ]; then
  PROMPT="$(cat)"
fi
[ -n "$PROMPT" ] || { echo "codex-ask.sh: empty prompt" >&2; exit 2; }
# getopts stops at the first non-option token, so flags AFTER the prompt are
# never parsed — fail loud instead of silently running the wrong mode
# (e.g. `codex-ask.sh "PROMPT" -g dir` would otherwise run text mode).
[ $# -le 1 ] || {
  echo "codex-ask.sh: unexpected args after prompt: ${*:2} (flags must precede the prompt)" >&2
  exit 2
}

# Cheap deterministic pre-flight: refuse prompts carrying secret-shaped strings
# (this policy should be code, not model discipline). The sk- pattern requires a
# token boundary so ordinary kebab-case text ("risk-based-...") doesn't false-
# positive into override fatigue. Override only for a confirmed false positive.
if [ -z "${CODEX_CONSULT_ALLOW_SECRETS:-}" ] && printf '%s' "$PROMPT" | grep -qE \
    -e 'AKIA[0-9A-Z]{16}' \
    -e 'ghp_[A-Za-z0-9]{36}' \
    -e '(^|[^A-Za-z0-9_-])sk-[A-Za-z0-9_-]{20,}' \
    -e 'xox[baprs]-[A-Za-z0-9-]{10,}' \
    -e '-----BEGIN [A-Z ]*PRIVATE KEY-----'; then
  echo "codex-ask.sh: prompt contains a secret-shaped string — refusing to send it to an external model. (Set CODEX_CONSULT_ALLOW_SECRETS=1 only for a confirmed false positive.)" >&2
  exit 4
fi

[ -x "$CODEX" ] || {
  echo "codex-ask.sh: codex not found (set CODEX_BIN or install: https://developers.openai.com/codex/cli)" >&2
  exit 3
}

if [ "${#ATTACH[@]}" -gt 0 ]; then
  for f in "${ATTACH[@]}"; do
    [ -f "$f" ] || { echo "codex-ask.sh: attach file not found: $f" >&2; exit 2; }
  done
fi

# Neutral cwd → codex can't see the current repo. The final-message file lives
# OUTSIDE the workdir so every file left inside is agent-generated output.
WORKDIR="$(mktemp -d)"
MSGFILE="$(mktemp)"
trap 'rm -rf "$WORKDIR" "$MSGFILE"' EXIT

# Resolve attach paths to absolute BEFORE leaving the caller's cwd.
ABS_ATTACH=()
if [ "${#ATTACH[@]}" -gt 0 ]; then
  for f in "${ATTACH[@]}"; do
    ABS_ATTACH+=("$(cd "$(dirname "$f")" && pwd)/$(basename "$f")")
  done
fi

SANDBOX="read-only"
if [ -n "$OUTDIR" ]; then
  SANDBOX="workspace-write" # image files must be written somewhere
  mkdir -p "$OUTDIR"
  # -P/pwd -P: physical resolution — a symlink pointing at $HOME or / must not
  # slip past the string comparison below (2nd-pass security verifier repro).
  OUTDIR="$(cd -P "$OUTDIR" && pwd -P)"
  if [ "$OUTDIR" = "/" ] || [ "$OUTDIR" = "$HOME" ]; then
    echo "codex-ask.sh: refusing $OUTDIR as OUT_DIR — pick a scratch subdirectory" >&2
    exit 2
  fi
fi

cd "$WORKDIR"

ARGS=(exec -s "$SANDBOX" --skip-git-repo-check --ephemeral -o "$MSGFILE")
if [ "$SANDBOX" = "workspace-write" ]; then
  # Image generation talks to the model API regardless; this pins the SANDBOXED
  # SHELL's network off so ambient user config can't silently enable it.
  ARGS+=(-c 'sandbox_workspace_write.network_access=false')
fi
if [ -n "$MODEL" ]; then
  ARGS+=(-m "$MODEL")
fi
# NOTE: codex's `-i/--image <FILE>...` is VARIADIC — a bare `-i f.png PROMPT`
# swallows the prompt as a second image path. The `=` form binds exactly one
# value, and `--` ends option parsing before the positional prompt.
if [ "${#ABS_ATTACH[@]}" -gt 0 ]; then
  for f in "${ABS_ATTACH[@]}"; do
    ARGS+=(--image="$f")
  done
fi
ARGS+=(-- "$PROMPT")

# Env allowlist: `-s read-only` restricts WRITES, not reads — codex's shell can
# still read the inherited environment, so don't hand it ambient tokens
# (GH_TOKEN, AWS_*, npm tokens, ...). HOME stays so codex auth keeps working.
#
# Portable timeout without GNU `timeout`: background the command DIRECTLY —
# backgrounding a shell *function* makes $! a wrapper-subshell PID, so killing
# it orphans the real codex process (2nd-pass verifier repro) — and poll from
# the main shell, so there is no watcher process to orphan on the success path.
# Progress → stderr; stdout carries ONLY the final message.
env -i PATH="$PATH" HOME="$HOME" TERM="${TERM:-dumb}" \
  LANG="${LANG:-en_US.UTF-8}" \
  ${LC_ALL:+LC_ALL="$LC_ALL"} \
  ${CODEX_HOME:+CODEX_HOME="$CODEX_HOME"} \
  ${HTTP_PROXY:+HTTP_PROXY="$HTTP_PROXY"} \
  ${HTTPS_PROXY:+HTTPS_PROXY="$HTTPS_PROXY"} \
  ${NO_PROXY:+NO_PROXY="$NO_PROXY"} \
  "$CODEX" "${ARGS[@]}" 1>&2 &
CPID=$!
TIMED_OUT=0
ELAPSED=0
while kill -0 "$CPID" 2>/dev/null; do
  if [ "$ELAPSED" -ge "$TIMEOUT_S" ]; then
    TIMED_OUT=1
    kill "$CPID" 2>/dev/null || true
    sleep 2
    kill -9 "$CPID" 2>/dev/null || true
    break
  fi
  sleep 1
  ELAPSED=$((ELAPSED + 1))
done
set +e
wait "$CPID"
RC=$?
set -e
if [ "$TIMED_OUT" -eq 1 ]; then
  echo "codex-ask.sh: codex killed after ${TIMEOUT_S}s (CODEX_CONSULT_TIMEOUT) — do NOT blindly retry the same prompt" >&2
  exit 124
fi
[ "$RC" -eq 0 ] || exit "$RC"

COPIED=0
if [ -n "$OUTDIR" ]; then
  # Everything the agent left in the workdir is output — hand it to the caller.
  # Never clobber an existing file: collisions get a unique prefix instead,
  # because the workdir (and anything left in it) is deleted on exit.
  while IFS= read -r -d '' f; do
    base="$(basename "$f")"
    dest="$OUTDIR/$base"
    if [ -e "$dest" ]; then
      dest="$OUTDIR/codex-$$-$base"
      echo "codex-ask.sh: $base already exists in OUT_DIR — saved as $(basename "$dest")" >&2
    fi
    cp "$f" "$dest"
    COPIED=$((COPIED + 1))
    echo "codex-ask.sh: output → $dest" >&2
  done < <(find "$WORKDIR" -type f -print0)
fi

# Delimiters make the untrusted-data boundary machine-visible, not just policy.
printf '<untrusted-codex-output>\n'
cat "$MSGFILE"
printf '\n</untrusted-codex-output>\n'

# Image mode with zero artifacts is a failure, not a success with a warning —
# a caller checking only the exit code must not mistake it for "image ready".
if [ -n "$OUTDIR" ] && [ "$COPIED" -eq 0 ]; then
  echo "codex-ask.sh: image mode produced no files (exit 5) — read the message above for why" >&2
  exit 5
fi
