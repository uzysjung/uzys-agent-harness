#!/usr/bin/env bash
# B1 — 실 Antigravity CLI(agy) 가 harness project-scope 자산을 인식하는가 (Promise=Implementation).
#
# Tier A (hard assert): harness install --cli antigravity 가 **고른 항목을 .agents/ 자리에** 놓는가.
#   묻는 것은 셋뿐이다(2026-08-28 사용자 확정): ① 항목이 복사됐나 ② 설치가 됐나 ③ 원하는 버전인가.
#   내용이 원본과 같은지는 안 묻는다 — 변환 로직은 tests/antigravity/transform.test.ts 가 소유한다.
#
#   2026-08-28 (#369) — 옛 Tier A 는 `.agents/skills/uzys-{phase}` 와 `.agents/workflows/uzys-{phase}.md`
#   를 요구했는데 둘 다 ADR-023(2026-06-26)에서 제품이 없앤 산출물이다. 그 뒤 **63일간 red**.
#   기대 목록을 이름으로 박지 않고 카탈로그·설치 기록에서 유도한다.
# Tier B (evidence): 실 agy 가 .agents/{skills,rules} 를 native 인식하는가.
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
# `--with uzys-harness` 를 뺐다 — ADR-023 으로 없어진 자산이라 지금은 경고만 찍고 건너뛴다.
agent-harness install --track tooling --cli antigravity --scope project >/tmp/install-agy.log 2>&1 \
  || { echo "FAIL: install 실패"; cat /tmp/install-agy.log; exit 1; }

missing=0
check_file() { [[ -f "$1" ]] || { echo "FAIL: $1 없음"; missing=1; }; }

# ① 앵커 룰 + 배포 룰이 항목 단위로 옮겨졌는가. 기대 목록은 배포 룰 디렉터리에서 유도한다.
check_file "${PROJ}/.agents/rules/uzys-harness.md"
RULE_SRC=/work/templates/rules
RULE_COUNT=0
for f in "${RULE_SRC}"/*.md; do
  [[ -e "${f}" ]] || continue
  RULE_COUNT=$((RULE_COUNT + 1))
  check_file "${PROJ}/.agents/rules/$(basename "${f}")"
done
if [[ "${RULE_COUNT}" -eq 0 ]]; then
  echo "FAIL: ${RULE_SRC} 에서 룰을 하나도 못 읽었다 — 이 판정은 무효다"
  missing=1
fi

# ② 고른 외부 스킬이 .agents/skills/ 에 실재하는가 (설치 기록에서 유도).
LOGJSON="${PROJ}/.uzys-agent-harness/.harness-install.json"
if [[ ! -f "${LOGJSON}" ]]; then
  echo "FAIL: 설치 기록(${LOGJSON})이 없다 — 아래 판정은 무효다"
  missing=1
else
  SKILL_IDS=$(jq -r '.assets[] | select(.method == "skill") | .detail.skill // .id' "${LOGJSON}")
  COUNT=$(printf '%s\n' "${SKILL_IDS}" | grep -c . || true)
  if [[ "${COUNT}" -eq 0 ]]; then
    echo "FAIL: 설치 기록에 skill 자산이 0건 — 외부 설치가 통째로 실패했거나 기록 형식이 바뀌었다"
    missing=1
  else
    echo "  설치 기록에서 유도한 외부 스킬 ${COUNT}종: $(printf '%s ' ${SKILL_IDS})"
    for sid in ${SKILL_IDS}; do
      check_file "${PROJ}/.agents/skills/${sid}/SKILL.md"
    done
  fi
fi

if [[ "${missing}" -eq 0 ]]; then
  echo "✓ Tier A: .agents/rules(앵커 + 배포 룰 ${RULE_COUNT}종) + .agents/skills 정상 write"
  echo "  rules:  $(ls "${PROJ}/.agents/rules" 2>/dev/null | tr '\n' ' ')"
  echo "  skills: $(ls "${PROJ}/.agents/skills" 2>/dev/null | tr '\n' ' ')"
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
