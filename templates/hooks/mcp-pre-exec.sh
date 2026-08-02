#!/bin/bash
# ============================================================
# mcp-pre-exec.sh — PreToolUse hook (mcp__.* matcher)
#
# 목적: MCP tool 호출을 화이트리스트 + 위험 패턴으로 차단.
#       CVE-2025-59536, CVE-2026-21852 (hooks/MCP RCE) 대응.
#
# 호출: templates/settings.json의 PreToolUse 매처 "mcp__.*" 에서 실행.
# 입력: stdin JSON (tool_name, tool_input, cwd, session_id, ...)
# 출력: stderr 경고 + exit 2 차단 또는 exit 0 통과
#
# 화이트리스트: $CLAUDE_PROJECT_DIR/.mcp-allowlist
#   - 한 줄에 하나의 서버 이름 (예: context7, github, chrome-devtools)
#   - '#' 주석, 빈 줄 허용
#   - 파일 없으면 모든 MCP 호출 통과 (opt-in 구조 — 사용자가 의도적으로 활성)
#
# 위험 파라미터 패턴: stdin의 tool_input에 다음 패턴 감지 시 차단
#   - rm -rf, curl | sh, wget | bash, eval, base64 decode + exec
#
# Exit codes:
#   0: 통과 (MCP 아님, 화이트리스트 매칭, 또는 allowlist 없음)
#   2: 차단 (서버 비매칭 또는 위험 패턴 감지)
#
# 차단 로그: $CLAUDE_PROJECT_DIR/.uzys-agent-harness/hook-blocks.log — 차단 시에만 1줄.
# ============================================================
set -u

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
ALLOWLIST="$PROJECT_DIR/.mcp-allowlist"

# 차단 계측 — 차단 경로에서만 1줄 append. 통과를 기록하면 로그가 차단 계측으로 못 쓰인다.
# 실패 허용은 이 함수 안에서만 선언한다 (cli-development.md §set 플래그): 로그를 못 쓰는
# 상태여도 차단 판정은 그대로여야 한다 — 계측이 방어를 깨면 안 된다. stderr 를 버리는 것은
# 이 훅의 stderr 가 사용자에게 보이는 차단 사유이기 때문이다.
log_block() {
  local dir="$PROJECT_DIR/.uzys-agent-harness"
  {
    mkdir -p "$dir" &&
      printf '%s\tmcp-pre-exec\t%s\n' \
        "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$(printf '%s' "$1" | tr '\n\r' '  ')" \
        >>"$dir/hook-blocks.log"
  } 2>/dev/null || return 0
}

# stdin JSON 파싱
INPUT=$(cat 2>/dev/null || echo "{}")

TOOL_NAME=""
if command -v jq &>/dev/null; then
  TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null || echo "")
else
  # jq 없을 때 bash 폴백
  TOOL_NAME=$(echo "$INPUT" | grep -oE '"tool_name"[[:space:]]*:[[:space:]]*"[^"]*"' | sed -E 's/.*"([^"]*)"$/\1/')
fi

# MCP tool 이 아니면 즉시 통과
case "$TOOL_NAME" in
  mcp__*__*) ;;
  *) exit 0 ;;
esac

# 서버 이름 추출: mcp__<server>__<tool> → <server>
SERVER_NAME=$(echo "$TOOL_NAME" | awk -F'__' '{print $2}')

if [ -z "$SERVER_NAME" ]; then
  echo "[mcp-pre-exec] WARN: cannot extract server name from '$TOOL_NAME'" >&2
  exit 0
fi

# 화이트리스트 대조 (파일 없으면 opt-in 미활성 — 통과)
if [ ! -f "$ALLOWLIST" ]; then
  exit 0
fi

# 화이트리스트에 서버 있는지 확인 (주석/빈 줄 제외)
MATCHED=false
while IFS= read -r line; do
  # 주석과 빈 줄 skip
  case "$line" in
    ""|"#"*) continue ;;
  esac
  # trim whitespace
  clean=$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
  if [ "$clean" = "$SERVER_NAME" ]; then
    MATCHED=true
    break
  fi
done < "$ALLOWLIST"

if [ "$MATCHED" = false ]; then
  log_block "$TOOL_NAME (server not in allowlist)"
  echo "[mcp-pre-exec] BLOCKED: MCP server '$SERVER_NAME' not in allowlist" >&2
  echo "" >&2
  echo "Tool: $TOOL_NAME" >&2
  echo "Allowlist: $ALLOWLIST" >&2
  echo "" >&2
  echo "이 서버를 허용하려면 '$SERVER_NAME'을 $ALLOWLIST 에 한 줄로 추가." >&2
  exit 2
fi

# 위험 파라미터 패턴 검사 (tool_input 전체를 문자열로)
TOOL_INPUT_JSON=""
if command -v jq &>/dev/null; then
  TOOL_INPUT_JSON=$(echo "$INPUT" | jq -r '.tool_input // empty' 2>/dev/null || echo "")
else
  TOOL_INPUT_JSON=$(echo "$INPUT" | grep -oE '"tool_input"[[:space:]]*:[[:space:]]*\{[^}]*\}')
fi

if [ -n "$TOOL_INPUT_JSON" ]; then
  if echo "$TOOL_INPUT_JSON" | grep -qE "rm -rf|curl[^|]*\| *sh|wget[^|]*\| *bash|\beval\b.*\\\$|base64[[:space:]]+-d.*\| *sh"; then
    log_block "$TOOL_NAME (suspicious tool_input pattern)"
    echo "[mcp-pre-exec] BLOCKED: suspicious parameter pattern in tool_input" >&2
    echo "" >&2
    echo "Tool: $TOOL_NAME" >&2
    echo "위험 패턴 감지: rm -rf / curl|sh / wget|bash / eval \$... / base64-d|sh" >&2
    echo "" >&2
    echo "의도된 사용이면 .mcp-allowlist 대신 이 서버의 다른 호출 경로 검토 필요." >&2
    exit 2
  fi
fi

exit 0
