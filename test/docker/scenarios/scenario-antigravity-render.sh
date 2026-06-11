#!/usr/bin/env bash
# v26.78.1 (R2) — `--cli antigravity` 설치 출력 렌더 검증 (no-false-ship Surface Parity).
#
# antigravity transform 은 순수 파일 생성(.agents/*) — real agy 바이너리 불요. 따라서
# 경량 mock 이미지에서 install OUTPUT 을 grep 해 R2 fix(antigravity 산출물 섹션 +
# Summary CLI 행이 "Antigravity", claude prepend 없음)를 end-to-end 확인한다.
#
# 배경: v26.78.0 까지 Summary CLI 행이 codex/opencode pairwise if-chain + claude 무조건
# prepend → `--cli antigravity` 가 "Claude" 로 잘못 출력, 산출물 섹션도 codex/opencode
# 게이트라 antigravity 자산 0건 렌더(invisible).

set -uo pipefail

echo "▸ scenario-antigravity-render: --cli antigravity 출력 렌더 (R2)"
echo ""

PROJ=/tmp/proj-agy-render
rm -rf "${PROJ}"
mkdir -p "${PROJ}"
cd "${PROJ}" || { echo "FAIL: cd ${PROJ}"; exit 1; }

LOG=/tmp/agy-render.log
claude-harness install --track tooling --cli antigravity --with uzys-harness --scope project \
  >"${LOG}" 2>&1 || { echo "FAIL: install 실패"; cat "${LOG}"; exit 1; }

failed=0
assert_grep() {
  local pattern="$1" desc="$2"
  if grep -qE "${pattern}" "${LOG}"; then
    echo "  ✓ ${desc}"
  else
    echo "  ✗ FAIL: ${desc} (pattern: ${pattern})"
    failed=1
  fi
}

echo "── 산출물 섹션 (R2: antigravity invisible 이던 버그) ──"
assert_grep "Antigravity artifacts" "산출물 섹션 헤더 노출"
assert_grep "\.agents/rules/uzys-harness\.md" "rules 행 노출"
assert_grep "\.agents/skills/uzys-\*/SKILL\.md" "skills 행 노출"
assert_grep "\.agents/workflows/uzys-\*\.md" "workflows 행 노출"

echo ""
echo "── Summary CLI 행 (R2: claude 무조건 prepend 버그) ──"
# CLI 행에 Antigravity 가 있고, claude 미선택이므로 "Claude" 가 없어야 한다.
CLI_ROW=$(grep -E "CLI" "${LOG}" | grep -i "antigravity" | head -1)
if [[ -n "${CLI_ROW}" ]]; then
  echo "  ✓ Summary CLI 행에 Antigravity 노출"
  if echo "${CLI_ROW}" | grep -qi "claude"; then
    echo "  ✗ FAIL: claude 미선택인데 CLI 행에 'Claude' 표기 (거짓)"
    echo "    row: ${CLI_ROW}"
    failed=1
  else
    echo "  ✓ claude 미선택 → 'Claude' prepend 없음"
  fi
else
  echo "  ✗ FAIL: Summary CLI 행에 Antigravity 없음"
  failed=1
fi

echo ""
if [[ "${failed}" -eq 0 ]]; then
  echo "━━━ PASS: scenario-antigravity-render (R2 렌더 end-to-end) ━━━"
  exit 0
else
  echo "━━━ FAIL: scenario-antigravity-render ━━━"
  echo "── install 출력 전문 ──"
  cat "${LOG}"
  exit 1
fi
