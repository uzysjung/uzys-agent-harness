#!/usr/bin/env bash
# #374 — `update` 가 **외부 스킬**(npx skills add 로 깐 것)을 갱신하는가.
#
# 그전까지 update 는 우리가 렌더한 CLI 산출물만 새로 썼다. 상류 저장소가 스킬을 고쳐도
# 설치받은 사람은 영영 못 받았고, 화면에는 `✓ external CLI artifacts` 가 떠서 다 된 것처럼
# 보였다(실측: npx 호출 install 2회 · update 0회).
#
# scenario-update-external(ADR-049)은 **우리 산출물**을 검증한다. 이쪽은 **남의 저장소에서
# 받아온 스킬 본문**이라 서로 다른 코드를 탄다 — 한쪽 증거가 다른 쪽 증거가 되지 않는다.
#
# 검증:
#   ① install 이 두 자리(.claude/ · .agents/)에 스킬을 깔고 skills-lock.json 을 남긴다 (#372)
#   ② 사용자 디스크의 스킬 본문을 변이시킨 뒤 update 를 돌리면 **두 사본 다** 상류판으로 돌아온다
#   ③ update 화면에 `external skills` 행이 뜬다 (갱신하고도 안 알리는 침묵 방지)
#
# **대상 스킬을 열거하지 않는다** — skills-lock.json 에서 derive 한다. 여기 이름을 적으면
# 카탈로그가 바뀌는 순간 이 시나리오가 조용히 아무것도 검증하지 않게 된다.

set -euo pipefail

echo "▸ scenario-update-external-skills: update 가 외부 스킬을 갱신하는가 (#374)"
echo ""

PROJ=/tmp/proj-upd-skills
rm -rf "${PROJ}"
mkdir -p "${PROJ}"
cd "${PROJ}"

agent-harness install --track tooling --scope project --cli claude --cli codex >/dev/null

LOCK="${PROJ}/skills-lock.json"
if [[ ! -f "${LOCK}" ]]; then
  echo "FAIL: install 이 skills-lock.json 을 안 남겼다 — 외부 스킬이 하나도 안 깔렸다"
  echo "      (네트워크 · skills CLI 실패 가능. 이 시나리오는 실 설치를 전제한다)"
  exit 1
fi

SKILL_ID="$(jq -r '.skills | keys[0]' "${LOCK}")"
if [[ -z "${SKILL_ID}" || "${SKILL_ID}" == "null" ]]; then
  echo "FAIL: skills-lock.json 에 스킬이 없다"
  exit 1
fi
echo "✓ install 완료 — 잠금 파일의 첫 스킬 = ${SKILL_ID}"

CLAUDE_COPY="${PROJ}/.claude/skills/${SKILL_ID}/SKILL.md"
AGENTS_COPY="${PROJ}/.agents/skills/${SKILL_ID}/SKILL.md"

# --- ① 두 자리에 다 깔렸나 (#372 회귀 가드) ---
for f in "${CLAUDE_COPY}" "${AGENTS_COPY}"; do
  if [[ ! -f "${f}" ]]; then
    echo "FAIL: ${f} 가 없다 — #372(--copy 누락) 회귀다"
    exit 1
  fi
done
echo "✓ .claude/ · .agents/ 두 자리 모두 존재"

# --- ② 변이 → update → 두 사본이 다 돌아오는가 ---
MARK="MUTATED-BY-SCENARIO-374"
for f in "${CLAUDE_COPY}" "${AGENTS_COPY}"; do
  printf '\n%s\n' "${MARK}" >> "${f}"
done
# 변이가 실제로 걸렸는지 **먼저** 증명한다 — 안 걸린 초록은 통과의 증거가 아니다.
BEFORE=$( { grep -l "${MARK}" "${CLAUDE_COPY}" "${AGENTS_COPY}" || true; } | wc -l | tr -d ' ')
if [[ "${BEFORE}" -ne 2 ]]; then
  echo "FAIL: 변이가 두 사본에 안 걸렸다 (${BEFORE}/2) — 이 실행은 무효다"
  exit 1
fi
echo "✓ 변이 2/2 반영 확인"

OUT="${PROJ}/update-out.txt"
agent-harness update > "${OUT}" 2>&1 || {
  echo "FAIL: update 가 실패했다"
  tail -30 "${OUT}"
  exit 1
}

REMAIN=0
for f in "${CLAUDE_COPY}" "${AGENTS_COPY}"; do
  if grep -q "${MARK}" "${f}"; then
    echo "  ✗ 갱신 안 됨: ${f}"
    REMAIN=$((REMAIN + 1))
  fi
done
if [[ "${REMAIN}" -ne 0 ]]; then
  echo "FAIL: update 후에도 변이가 ${REMAIN}개 사본에 남아 있다 — #374 결함 그대로다"
  exit 1
fi
echo "✓ update 가 두 사본을 모두 상류판으로 되돌렸다"

# --- ③ 화면이 그 사실을 말하는가 ---
if ! grep -q "external skills" "${OUT}"; then
  echo "FAIL: update 화면에 'external skills' 행이 없다 — 갱신하고도 안 알린다"
  echo "--- update 출력 ---"
  cat "${OUT}"
  exit 1
fi
echo "✓ update 화면에 external skills 행이 뜬다"

echo ""
echo "▸ scenario-update-external-skills PASS"
