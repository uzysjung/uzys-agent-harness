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
# `--with uzys-harness` 를 뺐다 — 그 자산은 ADR-023(2026-06-26)에서 통째로 없어졌고, 지금은
# `[WARN] Unknown asset id` 만 찍고 건너뛴다. 죽은 플래그가 남아 있으면 이 시나리오가 무엇을
# 재는지 읽는 사람이 오해한다.
agent-harness install --track tooling --cli antigravity --scope project \
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
assert_grep "\.agents/skills/<id>/SKILL\.md" "skills 행 노출"
# workflows 행 단언은 뺐다 — `.agents/workflows/` 산출은 ADR-023(2026-06-26)에서 제품이
# 없앤 것이고, 이 시나리오는 그 뒤 63일간 그 삭제분을 요구하며 red 였다. 부재 쪽은
# tests/antigravity/transform.test.ts 가 이미 단언한다(디렉터리 자체가 안 생긴다).

# 여기에 "화면의 N == 디스크 디렉터리 수" 대조를 한 번 넣었다가 뺐다. `.agents/skills/` 에는
# **두 writer** 가 쓴다 — antigravity 변환기(내부 번들 스킬)와 `npx skills add`(외부 스킬).
# 화면 행의 N 은 앞의 것만 세므로 디스크 총수와 다른 게 정상인데, 그걸 모르고 맞대면
# 태어나자마자 빨간 게이트가 된다(실측 2026-08-28: 화면 10 · 디스크 12).
# 항목이 실재하는지는 이미 항목 단위로 본다 — 내부 번들은 scenario-dev-method-skills,
# 외부 스킬은 scenario-realcli-antigravity 가 설치 기록에서 유도해 확인한다.

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
