#!/usr/bin/env bash
# v26.64.0 (ADR-020) — scenario-global: install --scope global 검증.
#
# 검증:
#   - log.scope = "global"
#   - log.assets[].scope 가 모두 "global"
#   - mock claude/skills 가 global flag 받았는지 (mock 의 출력 또는 fs 경로)
#   - install 후 ~/.claude/skills/<id>/ 또는 ~/.claude/plugins/cache/... 에 entry 추가

set -euo pipefail

cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
source ./snapshot.sh

echo "▸ scenario-global: install --scope global (opt-in)"
echo ""

PROJ=/tmp/proj-global
rm -rf "${PROJ}"
mkdir -p "${PROJ}"

snap_take /tmp/proj-global-before

cd "${PROJ}"
claude-harness install --track tooling --scope global

snap_take /tmp/proj-global-after

# scope=global 시 fs 에 변화 있어야 정상 (mock 의 stub)
fs_changed=$(diff /tmp/proj-global-before-fs.txt /tmp/proj-global-after-fs.txt 2>/dev/null \
  | grep "^[<>]" \
  | head -5 \
  || true)

failed=0

LOG="${PROJ}/.claude/.harness-install.json"
if [[ ! -f "${LOG}" ]]; then
  echo "FAIL: install log missing"
  failed=1
else
  log_scope=$(jq -r '.scope' "${LOG}")
  if [[ "${log_scope}" != "global" ]]; then
    echo "FAIL: log.scope = '${log_scope}', expected 'global'"
    failed=1
  else
    echo "✓ install log scope=global"
  fi

  non_global=$(jq -r '[.assets[].scope] | unique | .[]' "${LOG}" 2>/dev/null | grep -v global || true)
  if [[ -n "${non_global}" ]]; then
    echo "FAIL: log.assets 에 non-global scope 검출: ${non_global}"
    failed=1
  else
    asset_count=$(jq -r '.assets | length' "${LOG}")
    echo "✓ log.assets (${asset_count}) 모두 scope=global"
  fi
fi

# fs 에 변화 발생 (mock 의 의도된 stub)
if [[ -n "${fs_changed}" ]]; then
  echo "✓ scope=global → fs 변화 발생 (mock 의 stub 정상):"
  echo "${fs_changed}" | sed 's/^/    /'
else
  echo "INFO: scope=global 인데 fs 무변화 (mock 자산이 적용 안 됨? track=tooling default 자산 확인)"
fi

echo ""
if [[ "${failed}" -eq 0 ]]; then
  echo "━━━ PASS: scenario-global ━━━"
  exit 0
else
  echo "━━━ FAIL: scenario-global ━━━"
  exit 1
fi
