#!/usr/bin/env bash
# #370 (G1) — CLI 를 **하나만** 골라 설치했을 때, 고른 번들 스킬이 그 도구 자리에 오는가.
#
# 왜 따로 필요한가: 지금 컨테이너는 4 CLI 를 **한 호출**에 몰아 준다(dev-method-skills).
#   그건 합집합이라 "OpenCode 만 쓰는 사람이 받는가"를 못 본다 — #344 가 정확히 그 형태였다
#   (개발 트랙 기본 추천 자산이 Claude Code 에만 도달했고, 발견한 것은 사용자였다).
#
# 묻는 것은 둘뿐이다:
#   ① 설치가 끝났나 (exit 0)
#   ② 고른 스킬이 그 도구 트리에 실재하나 — **우리가 복사하는 번들 스킬과 `npx skills add`
#      로 받는 외부 스킬 둘 다**. 두 배달 방식은 자리 규약이 달라서(실측 2026-08-28: 외부
#      스킬은 codex·opencode·antigravity 가 `.agents/skills/` **한 자리를 공유**하고 Claude
#      Code 만 별도 사본을 받는다 — `npx skills add --copy` 가 그 사본이다) 한쪽만 보면
#      나머지가 빠져도 안 보인다. 실제로 다중 도구 설치에서 Claude Code 몫이 조용히
#      빠진 적이 있다(exit 0 · 화면 ✓).
#
# **알고 있는 한계**: 도달 여부는 "그 도구 트리 어디엔가 그 이름이 있는가"로 본다. 자리를
#   **틀리게** 넣은 경우(예: claude 만 골랐는데 `.agents/` 에 넣음)는 이 판정을 통과한다.
#   단독 설치라 트리에 그 도구의 자리만 생기는 것이 정상이므로 실무상 부재가 주 위험이고,
#   자리를 표로 못박는 순간 규약이 바뀔 때 제품이 아니라 표가 먼저 썩는다. 넓히려면 그때
#   자기 변경 요청으로 판단한다.
#
# **어느 디렉터리가 그 도구의 자리인지 표로 적지 않는다.** 규약은 도구마다 다르고 바뀐다 —
#   이 주석에 실측표를 적어 뒀다가 **다음 날 ADR-081 로 썩었다**(opencode 몫이 커맨드에서
#   스킬로 옮겨졌다). 판정은 표를 안 보므로 그 변경에도 그대로 돌았다. 항목이 그 도구 트리
#   안에 있으면 됐다.
#
# 자리에 남이 뭘 놔뒀을 때의 동작은 여기서 안 본다 — tests/install-foreign-skill-dir.test.ts
#   가 소유한다(#343).

set -uo pipefail

echo "▸ scenario-single-cli: CLI 하나만 골라도 그 도구 자리에 오는가 (#344 · G1)"
echo ""

failed=0

# 기대 목록은 코드에서 유도한다. 여기 이름을 적으면 두 번째 사본이 되고 반드시 썩는다.
CLI_LIST=$(sed -n '/^export const CLI_BASES/,/;/p' /work/src/types.ts \
  | grep -oE '"[a-z][a-z0-9-]*"' | tr -d '"')
SKILL_IDS=$(sed -n '/^export const DEV_METHOD_SKILL_IDS/,/^\];/p' /work/src/external-assets.ts \
  | grep -oE '"[a-z0-9][a-z0-9-]*"' | tr -d '"')

CLI_COUNT=$(printf '%s\n' "${CLI_LIST}" | grep -c . || true)
SKILL_COUNT=$(printf '%s\n' "${SKILL_IDS}" | grep -c . || true)
# 모집단 0 은 "위반 없음"이 아니라 "아무것도 안 쟀음"이다.
if [[ "${CLI_COUNT}" -lt 2 || "${SKILL_COUNT}" -lt 2 ]]; then
  echo "FAIL: 유도 실패 — CLI ${CLI_COUNT}종 · 스킬 ${SKILL_COUNT}종. 아래 결과는 증거가 아니다"
  exit 1
fi
echo "  CLI ${CLI_COUNT}종: $(printf '%s ' ${CLI_LIST})"
echo "  기대 스킬 ${SKILL_COUNT}종: $(printf '%s ' ${SKILL_IDS})"
echo ""

for cli in ${CLI_LIST}; do
  PROJ="/tmp/single-${cli}"
  rm -rf "${PROJ}"; mkdir -p "${PROJ}"
  cd "${PROJ}" || { echo "FAIL: cd ${PROJ}"; failed=1; continue; }

  agent-harness install --track tooling --cli "${cli}" --scope project \
    >"/tmp/single-${cli}.log" 2>&1
  code=$?
  if [[ "${code}" -ne 0 ]]; then
    echo "  FAIL[${cli}]: 설치가 exit ${code} 로 끝났다 — 고른 자산을 못 받는다"
    tail -12 "/tmp/single-${cli}.log" | sed 's/^/      /'
    failed=1
    continue
  fi

  # 외부 스킬은 **설치 기록에서** 유도한다. 트랙에서 재유도하면 opt-in 으로 고른 것이
  # 조용히 빠지거나 고른 적 없는 것이 기대 목록에 든다.
  LOGJSON=".uzys-agent-harness/.harness-install.json"
  EXT_IDS=$(jq -r '.assets[] | select(.method == "skill") | .detail.skill // .id' "${LOGJSON}")
  EXT_COUNT=$(printf '%s\n' "${EXT_IDS}" | grep -c . || true)
  if [[ "${EXT_COUNT}" -eq 0 ]]; then
    # 0 은 "위반 없음"이 아니라 "아무것도 안 쟀음"이다 — 외부 설치가 통째로 실패했거나
    # 기록 형식이 바뀌었다.
    echo "  FAIL[${cli}]: 설치 기록에 외부 스킬이 0건 — 아래 판정은 증거가 아니다"
    failed=1
    continue
  fi

  missing=""
  for id in ${SKILL_IDS} ${EXT_IDS}; do
    # 그 도구 트리 어디든 그 이름으로 도달하면 됐다. 경로를 지정하지 않는 이유는 위 서문.
    if [[ -z "$(find . -name "${id}*" -print -quit 2>/dev/null)" ]]; then
      missing="${missing} ${id}"
    fi
  done

  if [[ -n "${missing}" ]]; then
    echo "  FAIL[${cli}]: 고른 스킬이 이 도구 자리에 없다 —${missing}"
    echo "      만들어진 트리: $(ls -a | grep -E '^\.[a-z]' | tr '\n' ' ')"
    failed=1
  else
    echo "  ✓ ${cli}: 설치 완료 · 번들 ${SKILL_COUNT}종 + 외부 ${EXT_COUNT}종 전부 도달"
  fi
done

echo ""
if [[ "${failed}" -eq 0 ]]; then
  echo "PASS: scenario-single-cli"
else
  echo "FAIL: scenario-single-cli"
fi
exit "${failed}"
