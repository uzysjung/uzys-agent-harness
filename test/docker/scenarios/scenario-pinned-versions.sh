#!/usr/bin/env bash
# v26.80.0 (Phase P) — npm/npx-run 자산 버전 pinning 실설치 검증.
#
# 질문: pinned 버전(`pkg@version`)으로 실제 registry 설치가 성공하고, 설치된 버전이
#       정확히 pin 과 일치하는가? (vetting 시점 코드 = 실행 코드)
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

LOG=/tmp/pin-install.log
agent-harness install --track tooling --project-dir "${PROJ}" \
  --with openspec --with bmad-method --cli claude --scope project >"${LOG}" 2>&1
INSTALL_EXIT=$?

failed=0

echo "── 출력 라벨에 pinned 버전 표기 (Transparent Defaults) ──"
grep -qE "openspec@1\.4\.1|@fission-ai/openspec@1\.4\.1" "${LOG}" \
  && echo "  ✓ openspec 라벨에 @1.4.1" || { echo "  ✗ FAIL: openspec pinned 라벨 없음"; failed=1; }
grep -qE "bmad-method@6\.8\.0" "${LOG}" \
  && echo "  ✓ bmad 라벨에 @6.8.0" || { echo "  ✗ FAIL: bmad pinned 라벨 없음"; failed=1; }

echo ""
echo "── npm: 설치된 openspec 버전 == pin (1.4.1) ──"
INSTALLED=$(node -p "require('${PROJ}/node_modules/@fission-ai/openspec/package.json').version" 2>/dev/null)
if [[ "${INSTALLED}" == "1.4.1" ]]; then
  echo "  ✓ node_modules/@fission-ai/openspec = ${INSTALLED} (pin 일치)"
else
  echo "  ✗ FAIL: 설치 버전 '${INSTALLED:-없음}' ≠ pin 1.4.1"
  failed=1
fi

echo ""
echo "── npx-run: bmad@6.8.0 실행 산출물 (_bmad) ──"
if [[ -d "${PROJ}/_bmad" ]]; then
  echo "  ✓ ${PROJ}/_bmad 생성 (pinned npx 실행 성공)"
else
  echo "  ✗ FAIL: _bmad 없음 (bmad-method@6.8.0 실행 실패)"
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
