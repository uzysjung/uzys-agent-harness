#!/usr/bin/env bash
# v26.64.0 (ADR-020) — scenario-uninstall: install → uninstall reverse 검증.
#
# 검증:
#   - install 후 .uzys-agent-harness/.harness-install.json 존재
#   - uninstall --dry-run 후 .claude/ 보존 (실제 변경 X)
#   - 터미널·플래그 없는 uninstall 은 거절, 무변경 (#561)
#   - uninstall --yes 후 .claude/ 제거, install log 제거

set -euo pipefail

cd "$(dirname "$0")/.."

echo "▸ scenario-uninstall: install → uninstall reverse"
echo ""

PROJ=/tmp/proj-unin
rm -rf "${PROJ}"
mkdir -p "${PROJ}"

cd "${PROJ}"
agent-harness install --track tooling --scope project >/dev/null

LOG="${PROJ}/.uzys-agent-harness/.harness-install.json"
if [[ ! -f "${LOG}" ]]; then
  echo "FAIL: install log missing after install"
  exit 1
fi
echo "✓ install completed, log present"

# --dry-run 동작 확인 (실제 변경 없음)
agent-harness uninstall --dry-run >/dev/null

if [[ ! -d "${PROJ}/.claude" ]]; then
  echo "FAIL: --dry-run 인데 .claude/ 사라짐"
  exit 1
fi
echo "✓ --dry-run 후 .claude/ 보존"

# #561 — 터미널 없이 무엇을 지울지 말하지 않은 uninstall 은 거절하고 아무것도 안 지운다.
# stdin 을 /dev/null 로 고정해 `docker run -t` 로 돌려도 같은 경로를 탄다.
set +e
agent-harness uninstall </dev/null >/tmp/unin-noflag.txt 2>&1
RC=$?
set -e
if [[ "${RC}" -eq 0 ]]; then
  echo "FAIL: 터미널·플래그 없는 uninstall 이 exit 0 — 확인 없이 지우는 기본값으로 돌아갔다 (#561)"
  cat /tmp/unin-noflag.txt
  exit 1
fi
if [[ ! -d "${PROJ}/.claude" || ! -f "${LOG}" ]]; then
  echo "FAIL: 거절했다면서 .claude/ 또는 설치 기록을 지웠다"
  exit 1
fi
echo "✓ 터미널·플래그 없는 uninstall 은 거절 (exit ${RC}) · .claude/ · 기록 보존"

# 실 uninstall — 비TTY 에서 전량 제거는 --yes 로 명시한다 (#561)
agent-harness uninstall --yes </dev/null >/dev/null

if [[ -d "${PROJ}/.claude" ]]; then
  echo "FAIL: uninstall 후에도 .claude/ 남아있음"
  exit 1
fi
echo "✓ uninstall → .claude/ 제거"

# v26.135.0 (#253) — 로그가 `.claude/` 밖으로 나왔다. 예전엔 `.claude/` 삭제에 딸려 갔지만
# 이제는 명시 삭제 경로가 유일하다 — 안 지우면 빈 디렉터리가 남아 "전부 지웠다"가 거짓이 된다.
if [[ -e "${PROJ}/.uzys-agent-harness" ]]; then
  echo "FAIL: uninstall 후에도 .uzys-agent-harness/ 남아있음"
  exit 1
fi
echo "✓ uninstall → .uzys-agent-harness/ 제거"

echo ""
echo "━━━ PASS: scenario-uninstall ━━━"
