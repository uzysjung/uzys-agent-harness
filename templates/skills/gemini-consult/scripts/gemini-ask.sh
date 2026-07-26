#!/usr/bin/env bash
# Consult Gemini (via Antigravity `agy`) headless for natural Korean phrasing,
# multi-persona review, or image generation. Prints the model's text response
# on stdout, wrapped in <untrusted-gemini-output> tags; progress → stderr.
#
# Usage:
#   gemini-ask.sh [-t TIER] [-m MODEL] "PROMPT"     # text (Korean polish / persona review)
#   gemini-ask.sh [-t TIER] [-m MODEL] <<'EOF'      # multi-line prompt via stdin
#   ...multi-line prompt...
#   EOF
#   gemini-ask.sh -g OUT_DIR [-t TIER] "PROMPT"     # image gen: files copied to OUT_DIR
#   gemini-ask.sh -- "-leading-dash prompt"         # `--` ends option parsing
#
# TIER (default: pro) selects a model FAMILY; the concrete model is resolved
# from `agy models` at call time, so no version string is pinned in here:
#   pro    — gemini-*-pro-*   : every Gemini call this skill makes
#   claude — claude-*         : a non-Gemini reply, or the Gemini quota is spent
# `-m SLUG` skips tier resolution entirely — pass an exact slug from
# `agy models`, or a custom model configured in agy's settings.
#
# Exit codes: 2 usage · 3 agy missing / no model matches TIER ·
#             4 secret-shaped prompt refused ·
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
# Pick a FAMILY (see resolution below), never a version. Empty MODEL means
# "resolve TIER against `agy models`"; a non-empty one is used verbatim.
TIER="${GEMINI_CONSULT_TIER:-pro}"
MODEL="${GEMINI_CONSULT_MODEL:-}"
TIMEOUT_S="${GEMINI_CONSULT_TIMEOUT:-300}"
# Where agy drops generated artifacts (images land here, not in cwd, because
# headless mode denies the shell "command" permission a cwd-save would need).
BRAIN_DIR="${GEMINI_CONSULT_BRAIN:-$HOME/.gemini/antigravity-cli/brain}"
OUTDIR=""

while getopts "m:g:t:" opt; do
  case "$opt" in
    m) MODEL="$OPTARG" ;;
    g) OUTDIR="$OPTARG" ;;
    t) TIER="$OPTARG" ;;
    *) echo 'usage: gemini-ask.sh [-t pro|claude] [-m MODEL] [-g OUT_DIR] "PROMPT"' >&2; exit 2 ;;
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
MODELS_ERR=""
trap 'rm -rf "$WORKDIR" "$MSGFILE" ${MARKER:+"$MARKER"} ${MODELS_ERR:+"$MODELS_ERR"}' EXIT
cd "$WORKDIR"

# Tier → concrete model, resolved from `agy models` on every call. Pinning a
# version here rots: agy retires slugs (an unknown one dies with "invalid model
# selection", exit 1), and the families do NOT share a version line — measured
# 2026-07-26, a flash line was 3.6 while pro was still 3.1 — so neither "newest" nor
# "best" can be spelled as a constant.
if [ -z "$MODEL" ]; then
  case "$TIER" in
    pro) TIER_RE='^gemini-.*-pro(-|$)' ;;
    claude) TIER_RE='^claude-' ;;
    *) echo "gemini-ask.sh: unknown tier '$TIER' (expected pro | claude; use -m for an exact slug)" >&2; exit 2 ;;
  esac
  MODELS_ERR="$(mktemp)"
  MODELS="$(env -i PATH="$PATH" HOME="$HOME" TERM="${TERM:-dumb}" "$AGY" models 2>"$MODELS_ERR")" || MODELS=""
  # Rank candidates: version desc, then capability (opus > sonnet), then effort
  # (high/thinking > medium > low). Digits are read positionally so both slug
  # shapes rank alike — `gemini-3.1-pro-high` and `claude-opus-4-6-thinking`.
  # Fixed-width keys mean a plain `sort -r` suffices (BSD sort has no -V), and
  # `awk NR==1` (not `head -1`) avoids a SIGPIPE under `set -o pipefail`.
  MODEL="$(printf '%s\n' "$MODELS" | grep -E "$TIER_RE" | awk -F- '
    {
      maj = 0; min = 0; qual = 0; eff = 0
      for (i = 1; i <= NF; i++) {
        if ($i ~ /^[0-9]+(\.[0-9]+)?$/) {
          if (maj == 0) { split($i, v, "."); maj = v[1] + 0; min = v[2] + 0 }
          else if (min == 0) { min = $i + 0 }
        }
        if ($i == "opus") qual = 2
        else if ($i == "sonnet") qual = 1
        if ($i == "high" || $i == "thinking") eff = 3
        else if ($i == "medium") eff = 2
        else if ($i == "low") eff = 1
      }
      printf "%03d%03d%d%d %s\n", maj, min, qual, eff, $0
    }' | sort -r | awk 'NR == 1 { print $2 }')" || MODEL=""
  if [ -z "$MODEL" ]; then
    # Never silently fall back to some other tier: the caller asked for this
    # family for a reason, and a wrong-family answer looks like a right one.
    echo "gemini-ask.sh: no '$TIER' model offered by \`agy models\` — available:" >&2
    printf '%s\n' "$MODELS" | sed 's/^/  /' >&2
    if [ -s "$MODELS_ERR" ]; then
      # Surface agy's own stderr — an auth/network failure here looks exactly
      # like "tier not offered" if you only see the empty list.
      echo "gemini-ask.sh: \`agy models\` stderr:" >&2
      cat "$MODELS_ERR" >&2
    fi
    exit 3
  fi
  echo "gemini-ask.sh: tier '$TIER' → model '$MODEL'" >&2
else
  echo "gemini-ask.sh: model '$MODEL' (explicit)" >&2
fi

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
