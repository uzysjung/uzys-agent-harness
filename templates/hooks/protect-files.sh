#!/bin/bash
# PreToolUse Hook: Write/Edit 대상이 보호 파일이면 차단
# Python 의존 없음 — jq 또는 순수 bash로 동작
set -e

# --- 차단 계측 ---
# 차단 경로에서만 1줄 append 한다. 통과를 기록하면 로그가 차단 계측으로 못 쓰인다.
# 이것이 "무엇이 실제로 막고 있는가"를 판정할 유일한 데이터다 — 없으면 훅을 남길지 지울지가
# 느낌 대 느낌으로 남는다.
#
# 실패 허용을 **이 함수 안에서만** 선언한다 (cli-development.md §set 플래그 — `set -e` 와
# `|| true` 를 흩뿌리지 않는다). 로그를 못 써도 차단은 그대로 exit 2 여야 한다: `set -e` 하에서
# append 실패는 스크립트를 exit 1 로 끝내고, 호출자는 exit 2 만 차단으로 읽으므로 차단이
# **통과로 바뀐다.** stderr 를 버리는 것은 이 훅의 stderr 가 사용자에게 보이는 차단 사유이기
# 때문이다 (부재 확인이 아니라 부수 기록이라 "빈 결과는 부재의 증거가 아니다" 대상이 아니다).
log_block() {
  local dir="${CLAUDE_PROJECT_DIR:-.}/.uzys-agent-harness"
  {
    mkdir -p "$dir" &&
      printf '%s\tprotect-files\t%s\n' \
        "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$(printf '%s' "$1" | tr '\n\r' '  ')" \
        >>"$dir/hook-blocks.log"
  } 2>/dev/null || return 0
}

INPUT_JSON=$(cat)

# jq가 있으면 사용, 없으면 grep 폴백
if command -v jq &> /dev/null; then
  FILE_PATH=$(echo "$INPUT_JSON" | jq -r '.tool_input.file_path // .tool_input.path // ""' 2>/dev/null)
else
  # 순수 bash 폴백: file_path 추출
  FILE_PATH=$(echo "$INPUT_JSON" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*: *"//;s/"//')
  if [ -z "$FILE_PATH" ]; then
    FILE_PATH=$(echo "$INPUT_JSON" | grep -o '"path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*: *"//;s/"//')
  fi
fi

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

BASENAME=$(basename "$FILE_PATH")

# 보호 패턴 확인
case "$BASENAME" in
  # 예시·템플릿 파일에는 시크릿이 없다 — 에이전트가 만들고 고치는 것이 정상이다 (2차 감사 G-01).
  .env.example|.env.sample|.env.template)
    exit 0
    ;;
  # #604 — `.env*` 글롭에는 `.envrc`(direnv) 도 들어간다. 패턴이 `.env.*`(점 추가)라
  # 두 번째 점이 없는 .envrc 가 새어나갔다 — 실제 시크릿을 담는 파일이다.
  # #634 — 문서가 말하는 "lock files, certificate/key files" 에 맞춰 잠금·인증서·비밀키
  # 확장자를 보강한다(폐쇄 목록 유지 — 과잉 차단은 게이트를 무력화하는 우회를 부른다).
  .env|.env.*|.envrc|.envrc.*)
    log_block "$FILE_PATH"
    echo "BLOCKED: Protected file: $BASENAME. Environment files must be edited manually." >&2
    exit 2
    ;;
  package-lock.json|npm-shrinkwrap.json|yarn.lock|pnpm-lock.yaml|Cargo.lock|poetry.lock|uv.lock|\
Gemfile.lock|composer.lock|bun.lock|bun.lockb|Pipfile.lock|packages.lock.json|flake.lock|deno.lock|go.sum)
    log_block "$FILE_PATH"
    echo "BLOCKED: Protected file: $BASENAME. Lock files should not be edited directly." >&2
    exit 2
    ;;
  *.pem|*.key|*.p12|*.pfx|*.crt|*.cer|*.csr|*.jks|id_rsa|id_dsa|id_ecdsa|id_ed25519)
    log_block "$FILE_PATH"
    echo "BLOCKED: Protected file: $BASENAME. Certificate/key files must not be modified by agents." >&2
    exit 2
    ;;
esac

exit 0
