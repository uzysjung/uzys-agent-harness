#!/usr/bin/env bash
# #370 (G1) — CLI 를 **하나만** 골라 설치했을 때, 고른 번들 스킬이 그 도구 자리에 오는가.
#
# 왜 따로 필요한가: 지금 컨테이너는 4 CLI 를 **한 호출**에 몰아 준다(dev-method-skills).
#   그건 합집합이라 "OpenCode 만 쓰는 사람이 받는가"를 못 본다 — #344 가 정확히 그 형태였다
#   (개발 트랙 기본 추천 자산이 Claude Code 에만 도달했고, 발견한 것은 사용자였다).
#
# 묻는 것은 둘뿐이다:
#   ① 설치가 끝났나 (exit 0)
#   ② 고른 번들 스킬이 그 도구 트리에 실재하나
#
# **어느 디렉터리가 그 도구의 자리인지 표로 적지 않는다.** 규약은 도구마다 다르고(실측
#   2026-08-28: claude=`.claude/skills/<id>/` · codex·antigravity=`.agents/skills/<id>/` ·
#   opencode=`.opencode/commands/<id>.md`), 표를 적으면 규약이 정상적으로 바뀔 때 제품이
#   아니라 이 표가 먼저 썩는다. 항목이 그 도구 트리 안에 있으면 됐다.
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

  missing=""
  for id in ${SKILL_IDS}; do
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
    echo "  ✓ ${cli}: 설치 완료 · 번들 스킬 ${SKILL_COUNT}종 전부 도달"
  fi
done

echo ""
if [[ "${failed}" -eq 0 ]]; then
  echo "PASS: scenario-single-cli"
else
  echo "FAIL: scenario-single-cli"
fi
exit "${failed}"
