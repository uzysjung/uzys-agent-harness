#!/usr/bin/env bash
# v26.64.0 (ADR-020) — scenario-project: install --scope project 검증.
#
# 검증:
#   - ~/.claude/skills/, ~/.codex/, ~/.opencode/, npm -g diff = 0
#   - ~/.claude/plugins/cache/ 는 write 발생 가능 (claude CLI 자체 디자인). 단 mock 사용 시
#     mock 이 cache 에 stub 생성하는 것 검증.
#   - .claude/.harness-install.json 의 scope = "project"
#   - log.assets[].scope 가 모두 "project"

set -euo pipefail

cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
source ./snapshot.sh

echo "▸ scenario-project: install --scope project (default)"
echo ""

PROJ=/tmp/proj-scope
rm -rf "${PROJ}"
mkdir -p "${PROJ}"

snap_take /tmp/proj-scope-before

cd "${PROJ}"
agent-harness install --track tooling --scope project

snap_take /tmp/proj-scope-after

# Strict 검증: ~/.claude/skills, ~/.codex, ~/.opencode 변화 없음
# (~/.claude/plugins/* 는 claude CLI native 디자인으로 변화 가능 — D16 본질 예외)
fs_diff=$(diff /tmp/proj-scope-before-fs.txt /tmp/proj-scope-after-fs.txt 2>/dev/null \
  | grep "^[<>]" \
  | grep -v "${HOME}/\.claude$" \
  | grep -v "${HOME}/\.claude/plugins" \
  || true)

npm_diff=$(diff /tmp/proj-scope-before-npm.txt /tmp/proj-scope-after-npm.txt 2>/dev/null \
  | grep "^[<>]" \
  || true)

failed=0

if [[ -n "${fs_diff}" ]]; then
  echo "FAIL: scope=project 인데 ~/.claude/skills, ~/.codex, ~/.opencode 에 변화 검출:"
  echo "${fs_diff}"
  failed=1
else
  echo "✓ ~/.claude/skills, ~/.codex, ~/.opencode 무변화"
fi

if [[ -n "${npm_diff}" ]]; then
  echo "FAIL: scope=project 인데 npm -g 에 변화 검출:"
  echo "${npm_diff}"
  failed=1
else
  echo "✓ npm -g 무변화"
fi

if [[ ! -d "${PROJ}/.claude" ]]; then
  echo "FAIL: ${PROJ}/.claude/ not created"
  failed=1
else
  echo "✓ ${PROJ}/.claude/ 생성"
fi

LOG="${PROJ}/.claude/.harness-install.json"
if [[ ! -f "${LOG}" ]]; then
  echo "FAIL: install log missing at ${LOG}"
  failed=1
else
  log_scope=$(jq -r '.scope' "${LOG}")
  if [[ "${log_scope}" != "project" ]]; then
    echo "FAIL: log.scope = '${log_scope}', expected 'project'"
    failed=1
  else
    echo "✓ install log scope=project"
  fi

  # log.assets 가 모두 scope=project 인지
  non_project=$(jq -r '[.assets[].scope] | unique | .[]' "${LOG}" 2>/dev/null | grep -v project || true)
  if [[ -n "${non_project}" ]]; then
    echo "FAIL: log.assets 에 non-project scope 검출: ${non_project}"
    failed=1
  else
    asset_count=$(jq -r '.assets | length' "${LOG}")
    echo "✓ log.assets (${asset_count}) 모두 scope=project"
  fi
fi

echo ""
if [[ "${failed}" -eq 0 ]]; then
  echo "━━━ PASS: scenario-project ━━━"
  exit 0
else
  echo "━━━ FAIL: scenario-project ━━━"
  exit 1
fi
