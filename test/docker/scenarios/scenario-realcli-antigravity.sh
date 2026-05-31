#!/usr/bin/env bash
# B1 — 실 Antigravity CLI(agy) 가 harness project-scope 자산을 인식하는가 (Promise=Implementation).
#
# Tier A (hard assert): harness install --cli antigravity --with-uzys-harness --scope project 가
#   .agents/rules/uzys-harness.md + .agents/skills/uzys-{phase}/SKILL.md + .agents/workflows/uzys-{phase}.md write.
# Tier B (evidence): 실 agy 가 .agents/{skills,workflows,rules} 를 native 인식하는가.
#   - 검증 대상 주장(opt-in.ts:61): "Antigravity 가 .agents/skills/ 를 native 인식".
#   - probe: agy plugin/skills 열거 (auth-free 가능), .antigravitycli marker 필요 여부.
# Tier C (실행): 슬래시/프롬프트 실제 실행은 auth(login) 필요 → 범위 외.

set -uo pipefail

echo "▸ scenario-realcli-antigravity: 실 agy 가 project .agents/ 인식?"
echo ""

PROJ=/tmp/proj-antigravity
rm -rf "${PROJ}"
mkdir -p "${PROJ}"
cd "${PROJ}" || { echo "FAIL: cd ${PROJ}"; exit 1; }

failed=0

# ── agy 설치 확인 (build 단계 실패 시 fail-loud) ──
echo "── agy 바이너리 ──"
if ! command -v agy >/dev/null 2>&1; then
  echo "FAIL: agy 미설치 (build 단계 install.sh 실패). PATH=${PATH}"
  ls -la "${HOME}/.local/bin" 2>/dev/null | sed 's/^/  /' || true
  exit 1
fi
agy --version 2>&1 | sed 's/^/  agy: /' || echo "  (agy --version 실패)"
echo ""

# ── Tier A: harness project-scope write ──
echo "── Tier A: harness project-scope write ──"
claude-harness install --track tooling --cli antigravity --with-uzys-harness --scope project >/tmp/install-agy.log 2>&1 \
  || { echo "FAIL: install 실패"; cat /tmp/install-agy.log; exit 1; }

missing=0
check_file() { [[ -f "$1" ]] || { echo "FAIL: $1 없음"; missing=1; }; }
check_file "${PROJ}/.agents/rules/uzys-harness.md"
for phase in spec plan build test review ship; do
  check_file "${PROJ}/.agents/skills/uzys-${phase}/SKILL.md"
  check_file "${PROJ}/.agents/workflows/uzys-${phase}.md"
done
if [[ "${missing}" -eq 0 ]]; then
  echo "✓ Tier A: .agents/rules + skills(6) + workflows(6) 정상 write"
  echo "  rules:     $(ls "${PROJ}/.agents/rules" 2>/dev/null)"
  echo "  skills:    $(ls "${PROJ}/.agents/skills" 2>/dev/null | tr '\n' ' ')"
  echo "  workflows: $(ls "${PROJ}/.agents/workflows" 2>/dev/null | tr '\n' ' ')"
else
  echo "FAIL: Tier A — 일부 파일 누락"
  failed=1
fi
echo ""

# ── Tier B: 실 agy 자산 인식 (evidence) ──
echo "── Tier B: 실 agy discovery (evidence) ──"

echo "  [probe 1] agy 서브커맨드 (skills/plugin 열거 가능?)"
agy --help 2>&1 | grep -iE "skill|plugin|workflow|agent|rule|list" | sed 's/^/    /' || echo "    (관련 서브커맨드 없음)"

echo "  [probe 2] .antigravitycli workspace marker 필요 여부"
if [[ -f "${PROJ}/.antigravitycli" ]]; then
  echo "    marker 존재 (harness 생성)"
else
  echo "    marker 없음 — harness 가 .antigravitycli 미생성. agy 가 .agents/ 자동 인식하는지가 관건"
fi

echo "  [probe 3] agy plugin list (auth-free 로컬 열거)"
PLUGIN_OUT=$(timeout 20 agy plugin list 2>&1 | head -c 2000 || true)
echo "${PLUGIN_OUT}" | sed 's/^/    /'
if echo "${PLUGIN_OUT}" | grep -qiE "uzys"; then
  echo "    → uzys 자산이 plugin list 에 노출 (인식!)"
fi

echo "  [probe 4] agy skills 열거 시도 (있으면)"
SKILLS_OUT=$(timeout 20 agy skills list 2>&1 | head -c 1500 || timeout 20 agy skill list 2>&1 | head -c 1500 || true)
echo "${SKILLS_OUT}" | sed 's/^/    /'
if echo "${SKILLS_OUT}" | grep -qiE "uzys"; then
  echo "    → uzys skill 노출 (인식!)"
fi

echo "  [probe 5] agy --print (비대화형) — auth 벽 확인"
PRINT_OUT=$(cd "${PROJ}" && timeout 25 agy --print "Reply with the exact names of any custom skills or workflows you can see in this workspace." 2>&1 | head -c 1500 || true)
echo "${PRINT_OUT}" | sed 's/^/    /'
if echo "${PRINT_OUT}" | grep -qiE "login|sign in|authenticate|api key|not logged|auth"; then
  echo "    → auth 벽 (login 필요) — 모델 실행 검증 불가 (Tier C). 정직 표기 대상"
elif echo "${PRINT_OUT}" | grep -qiE "uzys"; then
  echo "    → 모델이 uzys 자산 인식 (Promise=Impl 확인!)"
fi
echo ""

echo "── 요약 ──"
echo "  Tier A (구조): $([ "${failed}" -eq 0 ] && echo PASS || echo FAIL)"
echo "  Tier B (탐색): 위 probe 출력으로 판정"
echo "  Tier C (실행): auth-gated, 범위 외"
echo ""

if [[ "${failed}" -eq 0 ]]; then
  echo "━━━ Tier A PASS (Tier B 는 evidence — 상위에서 해석) ━━━"
  exit 0
else
  echo "━━━ FAIL: scenario-realcli-antigravity (Tier A) ━━━"
  exit 1
fi
