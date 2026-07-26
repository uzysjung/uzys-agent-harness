#!/usr/bin/env bash
# v26.133.0 (ADR-048) — scenario-external-preserve: 재설치가 codex/opencode 산출물을 덮치는가.
#
# ADR-047 이 `.claude/` 에 붙인 소유자 판정이 외부 CLI 산출물에는 없었다. 실측(2026-07-20)으로
# `.codex/hooks` · `.codex/config.toml` · `.agents/skills` · `opencode.json` ·
# `.opencode/commands` 전부 편집분 소실 + 백업 0 이 확인됐다.
#
# 단위 테스트는 `runInstall` 을 직접 부르지만 여기서는 **설치된 실 CLI** 로 사용자가 치는
# 명령을 그대로 친다 — 두 경로는 서로의 증거가 되지 않는다 (no-false-ship).
#
# 검증:
#   ① install log 에 외부 CLI 기준선(externalFiles)이 기록된다
#   ② 사용자가 고친 `.codex/hooks/*.sh` 가 재설치에서 `.backup-<stamp>` 로 보존된다
#   ③ opencode 산출물도 같은 보호를 받는다 (CLI 종류로 보호가 갈리지 않는다)
#   ④ 편집 없이 재설치를 반복해도 백업본이 쌓이지 않는다 — 특히 codex/opencode 가 공유하는
#      AGENTS.md. 기준선 전달이 끊기면 여기서 먼저 터진다.

set -euo pipefail

echo "▸ scenario-external-preserve: 재설치가 codex/opencode 산출물을 덮치는가 (ADR-048)"
echo ""

PROJ=/tmp/proj-external-preserve
rm -rf "${PROJ}"
mkdir -p "${PROJ}"
cd "${PROJ}"

agent-harness install --track tooling --cli codex --cli opencode --scope project >/dev/null
echo "✓ install 완료 (cli=codex,opencode)"

LOG="${PROJ}/.uzys-agent-harness/.harness-install.json"

# ① 기준선이 기록됐는가 — 없으면 아래 판정이 전부 "판정 불가"로 떨어진다.
BASE_COUNT=$(jq '(.externalFiles // []) | length' "${LOG}")
if [[ "${BASE_COUNT}" -eq 0 ]]; then
  echo "FAIL: install log 에 externalFiles 기준선이 없다 — 소유 판정 불가"
  exit 1
fi
echo "✓ 외부 CLI 기준선 ${BASE_COUNT}건 기록"

HOOK="${PROJ}/.codex/hooks/session-start.sh"
OCJSON="${PROJ}/opencode.json"
AGENTS="${PROJ}/AGENTS.md"
for f in "${HOOK}" "${OCJSON}" "${AGENTS}"; do
  if [[ ! -f "${f}" ]]; then
    echo "FAIL: ${f} 가 설치되지 않았다 — 검증 대상이 없다"
    exit 1
  fi
done

# ④ 먼저 무편집 재설치 — 백업이 하나도 없어야 한다.
agent-harness install --track tooling --cli codex --cli opencode --scope project >/dev/null
NOISE=$(find "${PROJ}" -name '*.backup-*' | wc -l | tr -d ' ')
if [[ "${NOISE}" -ne 0 ]]; then
  echo "FAIL: 편집이 없는데 백업이 ${NOISE}건 생겼다 — 기준선 전달이 끊겼다"
  find "${PROJ}" -name '*.backup-*'
  exit 1
fi
echo "✓ 무편집 재설치 — 백업 미축적 (AGENTS.md 공유 경로 포함)"

# ② · ③ 사용자 편집 후 재설치.
MARK="# 사용자가 직접 고친 내용 $$"
printf '%s\n' "${MARK}" >> "${HOOK}"
printf '%s\n' "${MARK}" >> "${OCJSON}"
printf '%s\n' "${MARK}" >> "${AGENTS}"

agent-harness install --track tooling --cli codex --cli opencode --scope project >/dev/null

check_preserved () {
  local target="$1" label="$2"
  local backup
  backup=$(find "$(dirname "${target}")" -maxdepth 1 -name "$(basename "${target}").backup-*" | head -1)
  if [[ -z "${backup}" ]]; then
    echo "FAIL: ${label} 편집분 백업이 없다 — 사용자 내용이 사라졌다"
    exit 1
  fi
  if ! grep -qF "${MARK}" "${backup}"; then
    echo "FAIL: ${label} 백업에 사용자 편집 내용이 없다"
    exit 1
  fi
  # 최신판이 자리에 (ADR-046 사용자 결정: 최신판 활성 · 편집분 백업).
  if grep -qF "${MARK}" "${target}"; then
    echo "FAIL: ${label} 이 최신판으로 갱신되지 않았다"
    exit 1
  fi
  echo "✓ ${label} — 편집분 보존 + 최신판 활성"
}

check_preserved "${HOOK}" ".codex/hooks/session-start.sh"
check_preserved "${OCJSON}" "opencode.json"
check_preserved "${AGENTS}" "AGENTS.md"

echo ""
echo "▸ scenario-external-preserve PASS"
