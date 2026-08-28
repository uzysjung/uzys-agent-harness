#!/usr/bin/env bash
# v26.80.0 (Phase P) — npm/npx-run 자산 버전 pinning 실설치 검증.
#
# 질문: pinned 버전(`pkg@version`)으로 실제 registry 설치가 성공하고, 설치된 버전이
#       정확히 pin 과 일치하는가? (vetting 시점 코드 = 실행 코드)
#       → 사용자 확정 세 질문 중 ③ "설치된 항목은 원하는 버전인가" 를 맡는 자리다.
#
# 2026-08-28 (#369) — pin 값을 여기 다시 타이핑해 두던 것을 **카탈로그에서 유도**로 바꿨다.
#   bmad 가 6.8.0 → 6.9.0 으로 정상 갱신되자 이 시나리오만 red 로 남았다. 그리고 "화면 라벨에
#   @<pin> 이 찍히나" 단언은 뺐다 — 우리 출력과 우리 상수를 맞대는 자기 대조라, 실제로
#   틀릴 수 있는 축(레지스트리가 무엇을 설치했나)을 못 본다.
#
# 범위: npm(openspec) + npx-run(bmad) — Phase P 가 바꾼 두 설치 경로만.
#       plugin/skill 경로는 본 변경 무관(코드 무변경) + 버전 pin 불가(COMPATIBILITY §pinning 잔여 리스크).
# 컨테이너 격리 전용 (호스트 글로벌 write 0). 경량 mock 이미지로 충분 (real claude 불요).

set -uo pipefail

echo "▸ scenario-pinned-versions: npm/npx pinned 설치 (Phase P)"
echo ""

PROJ=/tmp/pin-proj
rm -rf "${PROJ}"
mkdir -p "${PROJ}"
cd "${PROJ}" || { echo "FAIL: cd"; exit 1; }

failed=0

# pin 은 카탈로그가 SSOT 다. 여기 다시 적으면 두 번째 사본이 되고, 그 사본은 반드시 썩는다.
CATALOG=/work/src/external-assets.ts
pin_of() {
  awk -v want="$1" '
    /^  \{/ { blk="" }
    { blk = blk $0 "\n" }
    /^  \},/ {
      if (blk ~ ("id: \"" want "\"")) {
        if (match(blk, /version: "[^"]+"/)) {
          v = substr(blk, RSTART, RLENGTH); gsub(/version: "|"/, "", v); print v
        }
      }
      blk=""
    }' "${CATALOG}"
}
OPENSPEC_PIN="$(pin_of openspec)"
BMAD_PIN="$(pin_of bmad-method)"
# 유도가 비면 아래 비교는 ''=='' 로 조용히 통과한다 — 부재가 아니라 탐지기 고장이다.
if [[ -z "${OPENSPEC_PIN}" || -z "${BMAD_PIN}" ]]; then
  echo "FAIL: ${CATALOG} 에서 pin 을 못 읽었다 (openspec='${OPENSPEC_PIN}' bmad='${BMAD_PIN}')."
  echo "      카탈로그 항목 형태가 바뀌었는지 먼저 보라 — 이 실행은 무효다."
  exit 1
fi
echo "▸ 카탈로그에서 유도한 pin: openspec=${OPENSPEC_PIN} · bmad-method=${BMAD_PIN}"
echo ""

LOG=/tmp/pin-install.log
agent-harness install --track tooling --project-dir "${PROJ}" \
  --with openspec --with bmad-method --cli claude --scope project >"${LOG}" 2>&1
INSTALL_EXIT=$?

echo "── ③ npm: 설치된 openspec 버전 == pin (${OPENSPEC_PIN}) ──"
INSTALLED=$(node -p "require('${PROJ}/node_modules/@fission-ai/openspec/package.json').version" 2>/dev/null)
if [[ "${INSTALLED}" == "${OPENSPEC_PIN}" ]]; then
  echo "  ✓ node_modules/@fission-ai/openspec = ${INSTALLED} (pin 일치)"
else
  echo "  ✗ FAIL: 설치 버전 '${INSTALLED:-없음}' ≠ pin ${OPENSPEC_PIN}"
  failed=1
fi

echo ""
echo "── ② npx-run: bmad@${BMAD_PIN} 실행 산출물 (_bmad) ──"
if [[ -d "${PROJ}/_bmad" ]]; then
  echo "  ✓ ${PROJ}/_bmad 생성 (pinned npx 실행 성공)"
else
  echo "  ✗ FAIL: _bmad 없음 (bmad-method@${BMAD_PIN} 실행 실패)"
  failed=1
fi

echo ""
if [[ "${failed}" -eq 0 ]]; then
  echo "━━━ PASS: scenario-pinned-versions (install exit=${INSTALL_EXIT}) ━━━"
  exit 0
else
  echo "━━━ FAIL: scenario-pinned-versions ━━━"
  echo "── install 로그 tail ──"
  tail -40 "${LOG}"
  exit 1
fi
