#!/usr/bin/env bash
# v26.64.0 (ADR-020) — scenario-uninstall: install → uninstall reverse 검증.
#
# 검증:
#   - install 후 .claude/.harness-install.json 존재
#   - uninstall --dry-run 후 .claude/ 보존 (실제 변경 X)
#   - uninstall 후 .claude/ 제거, install log 제거

set -euo pipefail

cd "$(dirname "$0")/.."

echo "▸ scenario-uninstall: install → uninstall reverse"
echo ""

PROJ=/tmp/proj-unin
rm -rf "${PROJ}"
mkdir -p "${PROJ}"

cd "${PROJ}"
agent-harness install --track tooling --scope project >/dev/null

LOG="${PROJ}/.claude/.harness-install.json"
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

# 실 uninstall
agent-harness uninstall >/dev/null

if [[ -d "${PROJ}/.claude" ]]; then
  echo "FAIL: uninstall 후에도 .claude/ 남아있음"
  exit 1
fi
echo "✓ uninstall → .claude/ 제거"

echo ""
echo "━━━ PASS: scenario-uninstall ━━━"
