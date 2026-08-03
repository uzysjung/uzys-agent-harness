#!/bin/bash
# spec-drift-check.sh
# SPEC/TODO 문서의 drift를 검출한다. Verify 또는 Ship 단계에서 호출 가능.
#
# 훅이 아니라 **명시 호출** 스크립트다 — 자동 발화 경로는 없다.
#   bash .uzys-agent-harness/spec-drift-check.sh        # 경고 수준 (verify)
#   bash .uzys-agent-harness/spec-drift-check.sh ship   # 차단 수준 (ship)
# 호출자 = `ship-checklist.md` SPEC/PRD 정합성 항목 · `doc-governance.md` 검증 게이트 절.
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

# unchecked 항목을 센다. 단 `ship-gate:ignore` 구간은 제외한다 — 게이트가 잡으려는 것은 "이번
# 사이클에 하기로 해놓고 안 한 것"이지 "언젠가 할 일(백로그)"이 아니다. 백로그는 정상적으로 항상
# 존재하므로 구분 없이 세면 게이트가 상시 차단이 되고, 그러면 사람들은 체크박스를 안 쓰는 쪽으로
# 우회한다 → 셀 게 없어 게이트가 죽는다.
#
# 기본값은 검사다. 면제는 표식이 있는 쪽이어야 한다. 표식이 짝이 안 맞으면 면제를 통째로
# 무시한다(fail-closed) — 표식 하나 잘못 써서 게이트가 통째로 꺼지는 경로를 만들지 않는다.
#
# 표식은 **단독 줄**일 때만 인정한다(앞뒤 공백만 허용). 그래야 이 기능을 설명하는 산문이
# — 예: 백틱으로 인용한 사용법 — 파서에 진짜 표식으로 잡히지 않는다. 기능을 그 기능이
# 적용되는 파일 안에서 문서화할 수 없으면 안 된다. (실제로 그 함정을 밟고 추가한 규칙이다.)
count_unchecked() {
  local file="$1"
  awk '
    /^[ \t]*<!--[ ]*ship-gate:ignore-start[ ]*-->[ \t]*$/ { skip = 1; opened++; next }
    /^[ \t]*<!--[ ]*ship-gate:ignore-end[ ]*-->[ \t]*$/   { skip = 0; closed++; next }
    /^- \[ \]|^  - \[ \]/                                 { total++; if (!skip) counted++ }
    END {
      if (opened != closed) {
        printf "spec-drift-check: ship-gate:ignore 표식 불일치 (start %d / end %d) — 면제를 무시한다\n", opened, closed > "/dev/stderr"
        print total + 0
      } else {
        print counted + 0
      }
    }
  ' "$file"
}

# 후보 목록 중 첫 존재 파일 (없으면 빈 문자열). docs/ 고정이 아니라 실제 워크플로
# 산출 레이아웃(root SPEC.md·tasks/todo.md 등)까지 훑는다.
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
