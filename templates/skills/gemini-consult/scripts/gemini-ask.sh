#!/usr/bin/env bash
# Consult Gemini (via Antigravity `agy`) headless for natural Korean phrasing,
# multi-persona review, or image generation. Prints the model's text response
# on stdout, wrapped in <untrusted-gemini-output> tags; progress → stderr.
#
# Usage:
#   gemini-ask.sh [-m "MODEL"] "PROMPT"           # text (Korean polish / persona review)
#   gemini-ask.sh [-m "MODEL"] <<'EOF'            # multi-line prompt via stdin
#   ...multi-line prompt...
#   EOF
#   gemini-ask.sh -g OUT_DIR [-m "MODEL"] "PROMPT"  # image gen: files copied to OUT_DIR
#   gemini-ask.sh -- "-leading-dash prompt"       # `--` ends option parsing
#
# Exit codes: 2 usage · 3 agy missing · 4 secret-shaped prompt refused ·
#             5 image mode produced no files · 124 timed out ·
#             otherwise agy's own exit code.
#
# Guardrails: runs from a throwaway temp dir so the current repo is NOT added
# to agy's workspace and shipped to Google; env stripped to an allowlist;
# secret-shaped prompts refused. Image mode NEVER uses
# --dangerously-skip-permissions — agy has no OS sandbox, its permission system
# IS the sandbox. Instead the prompt forbids shell saves (which headless mode
# auto-denies anyway) and the wrapper collects the generated artifact from
# agy's own brain directory.
set -euo pipefail

AGY="${AGY_BIN:-$(command -v agy || echo "$HOME/.local/bin/agy")}"
# The "gemini 3.1 pro" the user asked for. Override with -m or GEMINI_CONSULT_MODEL.
# See `agy models` for the full list (e.g. "Gemini 3.1 Pro (Low)" is faster).
MODEL="${GEMINI_CONSULT_MODEL:-Gemini 3.1 Pro (High)}"
TIMEOUT_S="${GEMINI_CONSULT_TIMEOUT:-300}"
# Where agy drops generated artifacts (images land here, not in cwd, because
# headless mode denies the shell "command" permission a cwd-save would need).
BRAIN_DIR="${GEMINI_CONSULT_BRAIN:-$HOME/.gemini/antigravity-cli/brain}"
OUTDIR=""

while getopts "m:g:" opt; do
  case "$opt" in
    m) MODEL="$OPTARG" ;;
    g) OUTDIR="$OPTARG" ;;
    *) echo 'usage: gemini-ask.sh [-m "MODEL"] [-g OUT_DIR] "PROMPT"' >&2; exit 2 ;;
  esac
done
shift $((OPTIND - 1))

# Prompt from first arg, else from stdin.
PROMPT="${1:-}"
if [ -z "$PROMPT" ] && [ ! -t 0 ]; then
  PROMPT="$(cat)"
fi
[ -n "$PROMPT" ] || { echo "gemini-ask.sh: empty prompt" >&2; exit 2; }
# getopts stops at the first non-option token — flags AFTER the prompt would be
# silently ignored, so fail loud instead.
[ $# -le 1 ] || {
  echo "gemini-ask.sh: unexpected args after prompt: ${*:2} (flags must precede the prompt)" >&2
  exit 2
}

# Cheap deterministic pre-flight: refuse prompts carrying secret-shaped strings.
# The sk- pattern requires a token boundary so ordinary kebab-case text
# ("risk-based-...") doesn't false-positive into override fatigue.
if [ -z "${GEMINI_CONSULT_ALLOW_SECRETS:-}" ] && printf '%s' "$PROMPT" | grep -qE \
    -e 'AKIA[0-9A-Z]{16}' \
    -e 'ghp_[A-Za-z0-9]{36}' \
    -e '(^|[^A-Za-z0-9_-])sk-[A-Za-z0-9_-]{20,}' \
    -e 'xox[baprs]-[A-Za-z0-9-]{10,}' \
    -e '-----BEGIN [A-Z ]*PRIVATE KEY-----'; then
  echo "gemini-ask.sh: prompt contains a secret-shaped string — refusing to send it to an external model. (Set GEMINI_CONSULT_ALLOW_SECRETS=1 only for a confirmed false positive.)" >&2
  exit 4
fi

[ -x "$AGY" ] || {
  echo "gemini-ask.sh: agy not found at $AGY — install: https://antigravity.google/cli" >&2
  exit 3
}

MARKER=""
if [ -n "$OUTDIR" ]; then
  mkdir -p "$OUTDIR"
  # -P/pwd -P: physical resolution — a symlink pointing at $HOME or / must not
  # slip past the string comparison below (2nd-pass security verifier repro).
  OUTDIR="$(cd -P "$OUTDIR" && pwd -P)"
  if [ "$OUTDIR" = "/" ] || [ "$OUTDIR" = "$HOME" ]; then
    echo "gemini-ask.sh: refusing $OUTDIR as OUT_DIR — pick a scratch subdirectory" >&2
    exit 2
  fi
  # Headless agy auto-denies the shell permission a "save to cwd" would need,
  # so forbid the attempt up front (avoids a hard failure) and collect the
  # artifact from BRAIN_DIR afterwards instead.
  PROMPT="$PROMPT

중요: 이미지 생성 도구로 생성만 해. 셸 명령이나 파일 복사/저장은 절대 시도하지
마 (headless 권한 거부로 전체 호출이 실패한다). 완료 후 생성된 파일명만 알려줘."
  # Marker: only artifacts newer than this belong to THIS call. A concurrent
  # agy session in the same window could add files too — rare, surfaced by name.
  MARKER="$(mktemp)"
fi

# Neutral cwd → agy won't pull the current repo into its workspace context.
WORKDIR="$(mktemp -d)"
MSGFILE="$(mktemp)"
trap 'rm -rf "$WORKDIR" "$MSGFILE" ${MARKER:+"$MARKER"}' EXIT
cd "$WORKDIR"

# Env allowlist: don't hand agy ambient tokens (GH_TOKEN, AWS_*, ...). HOME
# stays so agy auth (~/.gemini) keeps working.
# NOTE: --model must precede -p, and the prompt must be the value right after
# -p. Any flag between -p and the prompt breaks prompt delivery.
#
# Portable timeout without GNU `timeout`: background the command DIRECTLY —
# backgrounding a shell *function* makes $! a wrapper-subshell PID, so killing
# it orphans the real agy process (2nd-pass verifier repro) — and poll from
# the main shell, so there is no watcher process to orphan on the success path.
env -i PATH="$PATH" HOME="$HOME" TERM="${TERM:-dumb}" \
  LANG="${LANG:-en_US.UTF-8}" \
  ${LC_ALL:+LC_ALL="$LC_ALL"} \
  ${HTTP_PROXY:+HTTP_PROXY="$HTTP_PROXY"} \
  ${HTTPS_PROXY:+HTTPS_PROXY="$HTTPS_PROXY"} \
  ${NO_PROXY:+NO_PROXY="$NO_PROXY"} \
  "$AGY" --model="$MODEL" -p "$PROMPT" >"$MSGFILE" &
APID=$!
TIMED_OUT=0
ELAPSED=0
while kill -0 "$APID" 2>/dev/null; do
  if [ "$ELAPSED" -ge "$TIMEOUT_S" ]; then
    TIMED_OUT=1
    kill "$APID" 2>/dev/null || true
    sleep 2
    kill -9 "$APID" 2>/dev/null || true
    break
  fi
  sleep 1
  ELAPSED=$((ELAPSED + 1))
done
set +e
wait "$APID"
RC=$?
set -e
if [ "$TIMED_OUT" -eq 1 ]; then
  echo "gemini-ask.sh: agy killed after ${TIMEOUT_S}s (GEMINI_CONSULT_TIMEOUT) — do NOT blindly retry the same prompt" >&2
  exit 124
fi
[ "$RC" -eq 0 ] || exit "$RC"

COPIED=0
if [ -n "$OUTDIR" ]; then
  # Collect artifacts this call generated (never clobber existing files).
  while IFS= read -r -d '' f; do
    base="$(basename "$f")"
    dest="$OUTDIR/$base"
    if [ -e "$dest" ]; then
      dest="$OUTDIR/gemini-$$-$base"
      echo "gemini-ask.sh: $base already exists in OUT_DIR — saved as $(basename "$dest")" >&2
    fi
    cp "$f" "$dest"
    COPIED=$((COPIED + 1))
    echo "gemini-ask.sh: output → $dest" >&2
  done < <(find "$BRAIN_DIR" -type f \( -name '*.png' -o -name '*.jpg' -o -name '*.jpeg' -o -name '*.webp' \) -newer "$MARKER" -print0 2>/dev/null)
fi

# Delimiters make the untrusted-data boundary machine-visible, not just policy.
printf '<untrusted-gemini-output>\n'
cat "$MSGFILE"
printf '\n</untrusted-gemini-output>\n'

# Image mode with zero artifacts is a failure, not a success with a warning.
if [ -n "$OUTDIR" ] && [ "$COPIED" -eq 0 ]; then
  echo "gemini-ask.sh: image mode produced no artifacts under $BRAIN_DIR (exit 5) — read the message above for why" >&2
  exit 5
fi
