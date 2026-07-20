#!/usr/bin/env bash
# v26.132.0 (ADR-047) — scenario-policy-preserve: 재설치·update 가 사용자가 고친 룰/훅을 덮치는가.
#
# 사용자 보고 증상 그대로다: "재설치하면 rules, hooks 를 그냥 덮치는 것 같다".
# 단위 테스트는 `runInstall`/`runUpdateMode` 를 직접 부르지만, 여기서는 **설치된 실 CLI** 로
# 사용자가 하는 것과 같은 명령을 친다 — 두 경로는 서로의 증거가 되지 않는다.
#
# 검증:
#   ① 재설치(`install` 재실행)가 사용자 편집분을 `.backup-<stamp>` 로 보존 + 최신판이 자리에
#   ② 훅(.sh)도 같은 보호를 받는다 (자산 종류로 보호가 갈리지 않는다)
#   ③ 편집 없이 재설치를 반복해도 백업본이 쌓이지 않는다 (노이즈 미축적)
#   ④ 사용자가 직접 만든 커스텀 룰이 update 의 prune 에 살아남는다
#   ⑤ install log 에 정책 파일 기준선(policyFiles)이 기록된다

set -euo pipefail

echo "▸ scenario-policy-preserve: 재설치가 사용자 편집분을 덮치는가 (ADR-047)"
echo ""

PROJ=/tmp/proj-policy-preserve
rm -rf "${PROJ}"
mkdir -p "${PROJ}"
cd "${PROJ}"

agent-harness install --track tooling --scope project >/dev/null
echo "✓ install 완료"

RULES="${PROJ}/.claude/rules"
HOOKS="${PROJ}/.claude/hooks"
LOG="${PROJ}/.claude/.harness-install.json"

# ⑤ 기준선이 기록됐는가 — 이게 없으면 아래 판정이 전부 "판정 불가"로 떨어진다.
BASE_COUNT=$(jq '(.policyFiles // []) | length' "${LOG}")
if [[ "${BASE_COUNT}" -eq 0 ]]; then
  echo "FAIL: install log 에 policyFiles 기준선이 없다 — 소유 판정 불가"
  exit 1
fi
echo "✓ 정책 파일 기준선 ${BASE_COUNT}건 기록"

# 검증 대상 선정. 없으면 이 시나리오는 아무것도 검증하지 못하므로 실패시킨다.
RULE=$(find "${RULES}" -maxdepth 1 -name '*.md' | head -1)
HOOK=$(find "${HOOKS}" -maxdepth 1 -name '*.sh' | head -1)
if [[ -z "${RULE}" || -z "${HOOK}" ]]; then
  echo "FAIL: 룰 또는 훅이 설치되지 않았다 — 검증 대상이 없다"
  exit 1
fi

# --- ① 사용자가 룰을 고친 뒤 재설치 ---
printf '\n<!-- MY TEAM EDIT -->\n' >> "${RULE}"
printf '\n# MY HOOK EDIT\n' >> "${HOOK}"

agent-harness install --track tooling --scope project >/dev/null
echo "✓ 재설치 완료"

RULE_BK=$(find "${RULES}" -name "$(basename "${RULE}").backup-*" | head -1)
if [[ -z "${RULE_BK}" ]]; then
  echo "FAIL: 편집한 룰의 백업본이 없다 — 사용자 작업 소실 (= 보고된 증상 재현)"
  exit 1
fi
if ! grep -q "MY TEAM EDIT" "${RULE_BK}"; then
  echo "FAIL: 백업본에 편집 내용이 없다 — 백업이 무의미하다"
  exit 1
fi
echo "✓ 룰 편집분 보존 ($(basename "${RULE_BK}"))"

if grep -q "MY TEAM EDIT" "${RULE}"; then
  echo "FAIL: 편집분이 자리에 남았다 — 갱신이 안 됐다 (ADR-046/047: 최신판이 활성)"
  exit 1
fi
echo "✓ 최신판이 자리를 차지"

# --- ② 훅도 같은 보호 ---
HOOK_BK=$(find "${HOOKS}" -name "$(basename "${HOOK}").backup-*" | head -1)
if [[ -z "${HOOK_BK}" ]] || ! grep -q "MY HOOK EDIT" "${HOOK_BK}"; then
  echo "FAIL: 훅 편집분이 보존되지 않았다 — 자산 종류로 보호가 갈린다"
  exit 1
fi
echo "✓ 훅 편집분 보존 ($(basename "${HOOK_BK}"))"

# --- ③ 편집 없이 재설치 반복 — 백업이 늘면 안 된다 ---
BEFORE=$(find "${RULES}" "${HOOKS}" -name '*.backup-*' | wc -l)
agent-harness install --track tooling --scope project >/dev/null
agent-harness install --track tooling --scope project >/dev/null
AFTER=$(find "${RULES}" "${HOOKS}" -name '*.backup-*' | wc -l)
if [[ "${AFTER}" -ne "${BEFORE}" ]]; then
  echo "FAIL: 편집이 없는데 백업이 늘었다 (${BEFORE} → ${AFTER}) — 기준선이 갱신되지 않는다"
  exit 1
fi
echo "✓ 재설치 반복해도 백업 미증가 (${AFTER}건 유지)"

# --- ④ 사용자가 직접 만든 커스텀 룰이 update 의 prune 에 살아남는가 ---
CUSTOM="${RULES}/my-team-convention.md"
printf '# 우리 팀 규칙\n' > "${CUSTOM}"

agent-harness update >/dev/null

if [[ ! -f "${CUSTOM}" ]]; then
  echo "FAIL: 사용자가 만든 커스텀 룰이 삭제됐다 (prune 이 소유를 확인하지 않는다)"
  exit 1
fi
if ! grep -q "우리 팀 규칙" "${CUSTOM}"; then
  echo "FAIL: 커스텀 룰 내용이 바뀌었다"
  exit 1
fi
echo "✓ 사용자 커스텀 룰이 update 후에도 온전"

echo ""
echo "PASS: scenario-policy-preserve"
