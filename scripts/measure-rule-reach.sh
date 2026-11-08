#!/usr/bin/env bash
# 이 저장소의 지시 파일(CLAUDE.md · .claude/CLAUDE.md · .claude/rules/*.md)이 Codex · OpenCode · Antigravity 에
# 실제로 닿는지 잰다. 루트 AGENTS.md 의 안내가 있을 때(pointer)와 없을 때(control), 각 CLI 가 답하기 전에
# `.claude/rules/` 의 룰 파일을 읽는지 센다.
# 실 모델을 부르므로(인증 · 비용) 상시 스위트 · CI 밖이다. 언제 돌리나 = .claude/rules/test-policy.md §다른 CLI 도달.
#
# usage: bash scripts/measure-rule-reach.sh <out-dir> [codex|opencode|antigravity ...]   (CLI 를 안 주면 셋 다)
#   RUNS(pointer, 기본 3) · CONTROL_RUNS(기본 2) · OC_MODEL · AGY_MODEL 로 바꾼다.
#   판정 = python3 -I scripts/measure-rule-reach.py <out-dir>
#
# 안전장치 — 저장소가 아니라 지시 파일만 복사한 임시 사본에서 돈다.
#   Codex: read-only 샌드박스 · env 허용 목록.
#   OpenCode: 셸 · 실행 · 웹 · 하위 에이전트 · 폴더 밖 접근 금지, 사용자 전역 설정 · 개인 지시문 · 외부 스킬 · 세션 DB 미사용.
#     자격은 export | import 파이프로 임시 폴더에만 옮기고(화면 · 파일에 안 찍힌다) 끝나면 그 폴더째 지운다.
#   Antigravity: plan 모드 + --sandbox. 권한 자동 승인 플래그는 쓰지 않는다.
set -u

OUT="${1:?usage: measure-rule-reach.sh <out-dir> [cli...]}"; shift
CLIS=("$@"); [ "${#CLIS[@]}" -eq 0 ] && CLIS=(codex opencode antigravity)
REPO="$(cd "$(dirname "$0")/.." && pwd)"
RUNS="${RUNS:-3}"; CONTROL_RUNS="${CONTROL_RUNS:-2}"
OC_MODEL="${OC_MODEL:-openai/gpt-6-astra}"
AGY_MODEL="${AGY_MODEL:-gemini-4-argon-high}"
TIMEOUT="${TIMEOUT:-600}"
PROMPT='`src/sum.ts` 에 두 수를 더하는 `add` 함수를 추가하는 일을 맡았다고 하자. 파일은 고치지 말고, 어떤 순서로 작업하고 무엇으로 확인할지 3줄로 계획만 답하라.'
mkdir -p "$OUT"

make_fixture() { # <dest> <arm>
  local d="$1"
  mkdir -p "$d/.claude/rules" "$d/docs"
  cp "$REPO/CLAUDE.md" "$d/" && cp "$REPO/.claude/CLAUDE.md" "$d/.claude/" &&
    cp "$REPO"/.claude/rules/*.md "$d/.claude/rules/" && cp "$REPO/docs/SPEC.md" "$d/docs/" || return 1
  if [ "$2" = pointer ]; then cp "$REPO/AGENTS.md" "$d/" || return 1; fi
  git -C "$d" init -q
}

run_codex() { # <proj> <run-dir>
  (cd "$1" && env -i PATH="$PATH" HOME="$HOME" TERM=dumb LANG=en_US.UTF-8 ${CODEX_HOME:+CODEX_HOME="$CODEX_HOME"} \
    perl -e 'alarm shift; exec @ARGV' "$TIMEOUT" codex exec -s read-only --skip-git-repo-check --ephemeral --json \
    -o "$2/last.txt" -- "$PROMPT" < /dev/null > "$2/events.jsonl" 2> "$2/stderr.log")
}

OCX=""
cleanup() { if [ -n "$OCX" ]; then rm -rf "$OCX"; fi; }
trap cleanup EXIT

oc_env() {
  env -i PATH="$PATH" HOME="$HOME" TERM=dumb LANG=en_US.UTF-8 \
    XDG_CONFIG_HOME="$OCX/config" XDG_DATA_HOME="$OCX/data" XDG_STATE_HOME="$OCX/state" \
    OPENCODE_DISABLE_AUTOUPDATE=1 OPENCODE_DISABLE_CLAUDE_CODE_PROMPT=1 OPENCODE_DISABLE_EXTERNAL_SKILLS=1 \
    OPENCODE_DISABLE_LSP_DOWNLOAD=1 OPENCODE_CONFIG_CONTENT="$OC_SCOPE" "$@"
}

OC_SCOPE='{"$schema":"https://opencode.ai/config.json","permissions":[
{"action":"shell","resource":"*","effect":"deny"},{"action":"execute","resource":"*","effect":"deny"},
{"action":"webfetch","resource":"*","effect":"deny"},{"action":"websearch","resource":"*","effect":"deny"},
{"action":"subagent","resource":"*","effect":"deny"},{"action":"external_directory","resource":"*","effect":"deny"}],
"agent":{"build":{"tools":{"bash":false,"shell":false,"execute":false,"webfetch":false,"websearch":false,"task":false}}}}'

oc_setup() {
  OCX="$(mktemp -d)"; mkdir -p "$OCX/config" "$OCX/data" "$OCX/state"
  opencode auth export < /dev/null | oc_env opencode auth import --standalone > /dev/null
  local codes=("${PIPESTATUS[@]}")
  if [ "${codes[0]}" -ne 0 ] || [ "${codes[1]}" -ne 0 ]; then
    echo "opencode 자격 옮기기 실패 (export=${codes[0]} import=${codes[1]}) — opencode 측정을 건너뛴다" >&2
    return 1
  fi
}

run_opencode() { # <proj> <run-dir>
  (cd "$1" && oc_env perl -e 'alarm shift; exec @ARGV' "$TIMEOUT" opencode run --standalone --auto --format json \
    -m "$OC_MODEL" "$PROMPT" < /dev/null > "$2/events.jsonl" 2> "$2/stderr.log")
}

run_antigravity() { # <proj> <run-dir>
  (cd "$1" && env -i PATH="$PATH" HOME="$HOME" TERM=dumb LANG=en_US.UTF-8 \
    perl -e 'alarm shift; exec @ARGV' "$TIMEOUT" agy -p "$PROMPT" --output-format stream-json --mode plan --sandbox \
    --model "$AGY_MODEL" < /dev/null > "$2/events.jsonl" 2> "$2/stderr.log")
}

for cli in "${CLIS[@]}"; do
  case "$cli" in
    codex) command -v codex > /dev/null || { echo "codex 없음 — 건너뛴다" >&2; continue; } ;;
    opencode) { command -v opencode > /dev/null && oc_setup; } || { echo "opencode 측정 불가 — 건너뛴다" >&2; continue; } ;;
    antigravity) command -v agy > /dev/null || { echo "agy 없음 — 건너뛴다" >&2; continue; } ;;
    *) echo "알 수 없는 CLI: $cli" >&2; exit 2 ;;
  esac
  for arm in pointer control; do
    n="$RUNS"; [ "$arm" = control ] && n="$CONTROL_RUNS"
    i=0
    while [ "$i" -lt "$n" ]; do
      i=$((i + 1))
      run="$OUT/$cli/$arm-$i"
      if [ -e "$run" ]; then echo "이미 있음: $run (다른 <out-dir> 를 쓴다)" >&2; exit 3; fi
      mkdir -p "$run"
      make_fixture "$run/proj" "$arm" || { echo "fixture 실패: $run" >&2; exit 4; }
      "run_$cli" "$run/proj" "$run"
      echo "$cli $arm-$i exit=$?"
    done
  done
  if [ "$cli" = opencode ]; then cleanup; OCX=""; fi
done
