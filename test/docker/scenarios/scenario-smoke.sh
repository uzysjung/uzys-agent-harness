#!/usr/bin/env bash
# Smoke test — Docker image build 후 agent-harness 명령 동작 확인.
# v26.64.0 Phase 0 검증용. Phase 2 (--scope flag 구현) 후 본 시나리오 외에 scenario-project / -global / -uninstall 추가.

set -euo pipefail

cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
source ./snapshot.sh

echo "▸ Step 1: agent-harness CLI 동작 확인"
agent-harness --version
agent-harness --help | head -20

echo ""
echo "▸ Step 2: mock CLI 동작 확인"
mkdir -p /tmp/smoke-cwd
cd /tmp/smoke-cwd
claude plugin marketplace add --scope project https://example.com/test
claude plugin install --scope project dummy-plugin
ls -la "${HOME}/.claude/plugins/cache/test-marketplace/dummy-plugin/v0.0.0/"
# project scope skill → cwd 의 node_modules/.claude-skills/. global → ~/.claude/skills/
skills add dummy-org/dummy-skill --yes
ls -la "/tmp/smoke-cwd/node_modules/.claude-skills/dummy-skill/"
skills add other-org/global-skill -g --yes
ls -la "${HOME}/.claude/skills/global-skill/"
cd - >/dev/null

echo ""
echo "▸ Step 3: snapshot 유틸 동작 확인"
mkdir -p /tmp/smoke
snap_take /tmp/smoke/before
echo "   before fs lines: $(wc -l < /tmp/smoke/before-fs.txt)"
echo "   before npm lines: $(wc -l < /tmp/smoke/before-npm.txt)"
# 강제 변동 추가
mkdir -p "${HOME}/.claude/smoke-marker"
snap_take /tmp/smoke/after
if snap_diff /tmp/smoke/before /tmp/smoke/after; then
  echo "FAIL: snap_diff should detect smoke-marker"
  exit 1
fi
echo "   snap_diff 정상 detect"
# cleanup
rmdir "${HOME}/.claude/smoke-marker"

echo ""
echo "✓ SMOKE PASS — Docker test env 정상"
