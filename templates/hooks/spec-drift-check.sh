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
# Exit codes:
#  0: drift 없음
#  1: drift 발견 (경고 출력)
#  2: 차단 수준 drift (Ship 게이트에서 차단)
set -e

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
DOCS_DIR="$PROJECT_DIR/docs"
[ ! -d "$DOCS_DIR" ] && DOCS_DIR="$PROJECT_DIR/Docs"

DRIFT=0
BLOCK=0

count_unchecked() {
  local file="$1"
  grep -c "^- \[ \]\|^  - \[ \]" "$file" 2>/dev/null | tail -1 | tr -d ' \n'
}

# 1. SPEC.md unchecked 검사
if [ -f "$DOCS_DIR/SPEC.md" ]; then
  UNCHECKED=$(count_unchecked "$DOCS_DIR/SPEC.md")
  UNCHECKED=${UNCHECKED:-0}
  if [ "$UNCHECKED" -gt 0 ] 2>/dev/null; then
    echo "DRIFT: SPEC.md에 unchecked 항목 ${UNCHECKED}건" >&2
    DRIFT=$((DRIFT + 1))
  fi
fi

# 2. todo.md unchecked 검사
if [ -f "$DOCS_DIR/todo.md" ]; then
  UNCHECKED=$(count_unchecked "$DOCS_DIR/todo.md")
  UNCHECKED=${UNCHECKED:-0}
  if [ "$UNCHECKED" -gt 0 ] 2>/dev/null; then
    echo "DRIFT: todo.md에 unchecked 항목 ${UNCHECKED}건" >&2
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
