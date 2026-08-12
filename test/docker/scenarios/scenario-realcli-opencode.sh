#!/usr/bin/env bash
# B3 — 실 OpenCode 가 프로젝트 루트 `AGENTS.md` 를 지시문으로 읽는가.
#
# WHY: ADR-071 이 룰의 OpenCode 도달 전량을 **이 전제 하나**에 걸었다. 룰을 `.opencode/rules/`
#   + `instructions` 글롭으로 보내던 초안은 codex 와 `AGENTS.md` 를 공유하는 조합에서 서로를
#   덮어써 폐기했고, 대신 `AGENTS.md` 본문 embed 로 통일하며 **글롭을 지웠다**. 그래서 이 전제가
#   틀리면 OpenCode 설치자의 룰이 0종이 된다. 공식 문서와 저장소 호환 실측은 일치하지만
#   실 바이너리 확인이 없었다 — 여기가 그 자리다.
#
# 검증 tier (codex/antigravity 시나리오와 같은 구조):
#   A 구조 (hard assert): harness 가 `AGENTS.md` 에 §Harness Rules + 룰 본문을 정확히 write.
#   B 탐색 (evidence):    실 opencode 바이너리가 `AGENTS.md` 를 지시문 소스로 다루는가.
#   C 실행:               실제 세션은 인증이 필요 → 범위 외 (정직 표기).

set -uo pipefail # set -e 제외: Tier B probe 는 실패 허용(증거 수집).

echo "▸ scenario-realcli-opencode: 실 OpenCode 가 프로젝트 루트 AGENTS.md 를 읽는가?"
echo ""

PROJ=/tmp/proj-opencode
rm -rf "${PROJ}"
mkdir -p "${PROJ}"
cd "${PROJ}" || {
  echo "FAIL: cd ${PROJ}"
  exit 1
}

failed=0

# ── Tier A: harness 가 AGENTS.md 에 룰을 넣는다 ──────────────────────────
echo "── Tier A: harness project-scope write (hard assert) ──"
agent-harness install --track tooling --cli opencode --scope project >/tmp/install-oc.log 2>&1 ||
  {
    echo "FAIL: install 실패"
    cat /tmp/install-oc.log
    exit 1
  }

AGENTS="${PROJ}/AGENTS.md"
if [[ ! -f "${AGENTS}" ]]; then
  echo "FAIL: ${AGENTS} 없음"
  exit 1
fi

if grep -q '^## Harness Rules' "${AGENTS}"; then
  echo "✓ §Harness Rules 절 존재"
else
  echo "FAIL: §Harness Rules 절 없음 — 룰이 AGENTS.md 에 안 들어갔다"
  failed=1
fi

# 룰 본문이 실제로 들어갔는가. canary 는 배포 룰 고유 문장이다(앵커에는 없다 —
# tests/resident-reach-4cli.test.ts 가 그 조건을 별도로 단언한다).
missing=0
while IFS= read -r canary; do
  [[ -z "${canary}" ]] && continue
  if ! grep -qF "${canary}" "${AGENTS}"; then
    echo "FAIL: 룰 canary 미도달 — ${canary}"
    missing=1
  fi
done <<'CANARIES'
공유 이력을 바꾸거나
Select the test level and technique
무엇으로 검증할지는 이 저장소가 정한다
한 사실의 기준 문서는 하나다
합의된 범위와 완료 기준 안에서는
빈 결과는 부재의 증거가 아니다
CANARIES
if [[ "${missing}" -eq 0 ]]; then
  echo "✓ 배포 룰 6종 본문이 AGENTS.md 안에 있다"
else
  failed=1
fi

# 글롭이 없는 경로를 가리키면 안 된다 (#300 의 본체가 그 형태였다).
if grep -q '"instructions"' "${PROJ}/opencode.json"; then
  if grep -q 'rules/\*\.md' "${PROJ}/opencode.json"; then
    echo "FAIL: opencode.json 에 룰 글롭이 남아 있다 — AGENTS.md 와 중복 상주"
    failed=1
  else
    echo "✓ opencode.json instructions 에 룰 글롭 없음 (AGENTS.md 가 나른다)"
  fi
fi
echo ""

# ── Tier B: 실 opencode 가 AGENTS.md 를 지시문 소스로 다루는가 ───────────
echo "── Tier B: 실 opencode discovery (evidence) ──"
opencode --version 2>&1 | sed 's/^/  opencode: /'

# B-1. 패키지 본문에 AGENTS.md 처리가 있는가.
#      **탐지기를 먼저 검증한다** — 알려진 양성(`opencode.json`)이 안 잡히면 grep 자체가
#      못 도는 것이고, 그때의 "AGENTS.md 없음"은 부재의 증거가 아니다(cli-development 룰).
OC_ROOT="$(npm root -g 2>/dev/null)/opencode-ai"
if [[ -d "${OC_ROOT}" ]]; then
  echo "  패키지: ${OC_ROOT}"
  canary_hits="$(grep -rlF 'opencode.json' "${OC_ROOT}" 2>/dev/null | wc -l | tr -d ' ')"
  echo "  [탐지기 자기검증] 'opencode.json' 참조 파일 수: ${canary_hits}"
  if [[ "${canary_hits}" -eq 0 ]]; then
    echo "  [warn] 알려진 양성이 0건 — grep 이 패키지 본문을 못 읽는다. 아래 결과는 증거가 아니다."
  else
    agents_hits="$(grep -rlF 'AGENTS.md' "${OC_ROOT}" 2>/dev/null | wc -l | tr -d ' ')"
    echo "  'AGENTS.md' 참조 파일 수: ${agents_hits}"
    if [[ "${agents_hits}" -eq 0 ]]; then
      echo "  ✗ B-1: 패키지 본문에 AGENTS.md 참조 0건 — ADR-071 의 전제가 흔들린다"
      failed=1
    else
      # **존재만으로는 부족하다** — 문자열이 있다는 것과 그것이 지시문 로딩 경로라는 것은 다르다.
      # 그래서 주변 문맥을 뽑아, 프로젝트 컨텍스트/지시문 어휘와 함께 나오는 자리가 있는지 본다.
      # (정확한 문장을 단언하지 않는 이유: opencode 판올림마다 프롬프트 문면이 바뀐다.)
      ctx="$(grep -rhaoE '.{0,90}AGENTS\.md.{0,90}' "${OC_ROOT}" 2>/dev/null | tr -c '[:print:]\n' '.')"
      sem="$(printf '%s\n' "${ctx}" | grep -icE 'project|context|instruction|preference')"
      echo "  지시문 어휘와 함께 나오는 문맥: ${sem}건"
      if [[ "${sem}" -gt 0 ]]; then
        echo "  ✓ B-1: 실 바이너리가 AGENTS.md 를 **프로젝트 컨텍스트 소스로** 다룬다"
        printf '%s\n' "${ctx}" | grep -iE 'project|context|instruction|preference' | head -3 |
          cut -c1-160 | sed 's/^/    · /'
      else
        echo "  ✗ B-1: AGENTS.md 문자열은 있으나 지시문 맥락이 아니다 — 전제 재확인 필요"
        failed=1
      fi
    fi
  fi
else
  echo "  [warn] opencode-ai 글로벌 패키지 경로를 못 찾음 (${OC_ROOT}) — B-1 미수집"
fi

# B-2. CLI 표면에 AGENTS.md 가 등장하는가 (help / init).
echo ""
echo "  [help 표면]"
opencode --help 2>&1 | grep -iE 'agents|instruction|rule' | head -5 | sed 's/^/    /' ||
  echo "    (매치 없음)"

echo ""
echo "── Tier C: 실제 세션 로드 — 인증 필요, 범위 외 (미검증으로 표기) ──"
echo ""

if [[ "${failed}" -eq 0 ]]; then
  echo "PASS: scenario-realcli-opencode"
else
  echo "FAIL: scenario-realcli-opencode"
fi
exit "${failed}"
