#!/bin/bash
# spec-drift-check.sh
# SPEC.md/todo.md/PRD.md의 drift를 검출한다.
# Verify 또는 Ship 단계에서 호출 가능.
#
# 검출 항목:
#  1. SPEC.md의 Verification Checklist에 unchecked 항목 존재
#  2. todo.md의 unchecked 항목 존재
#  3. PRD.md Status가 In Progress인데 모든 Phase가 Complete인 경우
#
# Sub-SPEC 모드 (spec-scaling 지원):
#  SHIP_SUBSPEC=<name> 환경변수 설정 시:
#    - SPEC 파일: docs/specs/<name>.md
#    - todo 파일: docs/plans/<name>-todo.md
#  미설정 시 기본 docs/SPEC.md + docs/todo.md 검사 (기존 동작 유지)
#
# Exit codes:
#  0: drift 없음
#  1: drift 발견 (경고 출력)
#  2: 차단 수준 drift (Ship 게이트에서 차단)
set -e

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
DOCS_DIR="$PROJECT_DIR/docs"
[ ! -d "$DOCS_DIR" ] && DOCS_DIR="$PROJECT_DIR/Docs"

# Sub-SPEC 모드 감지
if [ -n "$SHIP_SUBSPEC" ]; then
  SPEC_FILE="$DOCS_DIR/specs/${SHIP_SUBSPEC}.md"
  TODO_FILE="$DOCS_DIR/plans/${SHIP_SUBSPEC}-todo.md"
  echo "Sub-SPEC mode: SHIP_SUBSPEC=$SHIP_SUBSPEC"
  echo "  SPEC: $SPEC_FILE"
  echo "  Todo: $TODO_FILE"
else
  SPEC_FILE="$DOCS_DIR/SPEC.md"
  TODO_FILE="$DOCS_DIR/todo.md"
fi

DRIFT=0
BLOCK=0

count_unchecked() {
  local file="$1"
  grep -c "^- \[ \]\|^  - \[ \]" "$file" 2>/dev/null | tail -1 | tr -d ' \n'
}

# 1. SPEC unchecked 검사 (sub-SPEC 모드 시 docs/specs/<name>.md)
if [ -f "$SPEC_FILE" ]; then
  UNCHECKED=$(count_unchecked "$SPEC_FILE")
  UNCHECKED=${UNCHECKED:-0}
  if [ "$UNCHECKED" -gt 0 ] 2>/dev/null; then
    echo "DRIFT: $(basename "$SPEC_FILE")에 unchecked 항목 ${UNCHECKED}건" >&2
    DRIFT=$((DRIFT + 1))
  fi
fi

# 2. todo unchecked 검사 (sub-SPEC 모드 시 docs/plans/<name>-todo.md)
if [ -f "$TODO_FILE" ]; then
  UNCHECKED=$(count_unchecked "$TODO_FILE")
  UNCHECKED=${UNCHECKED:-0}
  if [ "$UNCHECKED" -gt 0 ] 2>/dev/null; then
    echo "DRIFT: $(basename "$TODO_FILE")에 unchecked 항목 ${UNCHECKED}건" >&2
    DRIFT=$((DRIFT + 1))
  fi
fi

# 3. Ship 단계에서는 모든 unchecked가 차단
if [ "$1" = "ship" ] && [ "$DRIFT" -gt 0 ]; then
  BLOCK=1
fi

# Summary
if [ "$DRIFT" -eq 0 ]; then
  echo "OK: SPEC/todo/PRD 동기화 상태 정상"
  exit 0
fi

if [ "$BLOCK" -eq 1 ]; then
  echo "" >&2
  echo "BLOCKED (ship gate): SPEC drift 발견 — SPEC.md, todo.md, PRD.md 동기화 후 재시도" >&2
  exit 2
fi

echo "" >&2
echo "WARNING: SPEC drift ${DRIFT}건. 동기화 권장." >&2
exit 1
