#!/bin/bash
# spec-drift-check.sh
# SPEC/TODO 문서의 drift를 검출한다. Verify 또는 Ship 단계에서 호출 가능.
#
# 검출 항목:
#  1. SPEC 문서에 unchecked 항목 존재 (docs/SPEC.md → SPEC.md 중 첫 존재 파일)
#  2. TODO 문서에 unchecked 항목 존재 (docs/todo.md → docs/TODO.md → todo.md → TODO.md
#     → tasks/todo.md 중 첫 존재 파일 — first-match 라 대소문자 무시 FS 에서도 이중 카운트 없음)
#  3. SPEC Status가 "Define"인데 build/verify gate가 완료된 경우 (gate-status.json 존재 시)
#  4. Ship 단계에서는 모든 unchecked가 차단
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

# 후보 목록 중 첫 존재 파일 (없으면 빈 문자열). v26.107.0 — docs/ 고정이던 탐지를
# 실제 워크플로 산출 레이아웃(root SPEC.md·tasks/todo.md 등)까지 확장 (SOD 리뷰 I-3).
first_existing() {
  local f
  for f in "$@"; do
    if [ -f "$f" ]; then
      echo "$f"
      return 0
    fi
  done
  echo ""
}

SPEC_FILE=$(first_existing "$DOCS_DIR/SPEC.md" "$PROJECT_DIR/SPEC.md")
TODO_FILE=$(first_existing "$DOCS_DIR/todo.md" "$DOCS_DIR/TODO.md" "$PROJECT_DIR/todo.md" \
  "$PROJECT_DIR/TODO.md" "$PROJECT_DIR/tasks/todo.md")

# 1. SPEC unchecked 검사
if [ -n "$SPEC_FILE" ]; then
  UNCHECKED=$(count_unchecked "$SPEC_FILE")
  UNCHECKED=${UNCHECKED:-0}
  if [ "$UNCHECKED" -gt 0 ] 2>/dev/null; then
    echo "DRIFT: ${SPEC_FILE#"$PROJECT_DIR"/}에 unchecked 항목 ${UNCHECKED}건" >&2
    DRIFT=$((DRIFT + 1))
  fi
fi

# 2. TODO unchecked 검사
if [ -n "$TODO_FILE" ]; then
  UNCHECKED=$(count_unchecked "$TODO_FILE")
  UNCHECKED=${UNCHECKED:-0}
  if [ "$UNCHECKED" -gt 0 ] 2>/dev/null; then
    echo "DRIFT: ${TODO_FILE#"$PROJECT_DIR"/}에 unchecked 항목 ${UNCHECKED}건" >&2
    DRIFT=$((DRIFT + 1))
  fi
fi

# 3. SPEC Status 일관성 — gate-status.json과 대조 (6-gate 워크플로 사용 프로젝트만; 파일 없으면 skip)
GATE_FILE="$PROJECT_DIR/.claude/gate-status.json"
if [ -f "$GATE_FILE" ] && [ -n "$SPEC_FILE" ] && command -v jq &> /dev/null; then
  BUILD_DONE=$(jq -r '.build.completed // false' "$GATE_FILE")
  VERIFY_DONE=$(jq -r '.verify.completed // false' "$GATE_FILE")

  # SPEC Status가 "Define"인지 확인 (frontmatter 형식만, 본문 파이프라인 설명 제외)
  if grep -qE "^> \*\*Status\*\*:.*Define" "$SPEC_FILE"; then
    if [ "$BUILD_DONE" = "true" ] || [ "$VERIFY_DONE" = "true" ]; then
      echo "DRIFT: SPEC Status='Define'인데 Build/Verify gate가 완료됨" >&2
      DRIFT=$((DRIFT + 1))
      # Ship 게이트에서는 차단 (Build 이후에도 SPEC이 Define이면 안 됨)
      [ "$1" = "ship" ] && BLOCK=1
    fi
  fi
fi

# 4. Ship 단계에서는 모든 unchecked가 차단
if [ "$1" = "ship" ] && [ "$DRIFT" -gt 0 ]; then
  BLOCK=1
fi

# Summary
if [ "$DRIFT" -eq 0 ]; then
  echo "OK: SPEC/TODO 동기화 상태 정상"
  exit 0
fi

if [ "$BLOCK" -eq 1 ]; then
  echo "" >&2
  echo "BLOCKED (ship gate): SPEC/TODO drift 발견 — 동기화 후 재시도" >&2
  exit 2
fi

echo "" >&2
echo "WARNING: SPEC drift ${DRIFT}건. 동기화 권장." >&2
exit 1
