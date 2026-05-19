#!/usr/bin/env bash
# Snapshot utility — ~/.claude, ~/.codex, ~/.opencode, npm -g 의 fs state capture.
# v26.64.0 AC1/AC2 검증에서 before/after 비교용.
#
# 사용:
#   source snapshot.sh
#   snap_take /tmp/before
#   ... (install 실행)
#   snap_take /tmp/after
#   snap_diff /tmp/before /tmp/after  # exit 0 = no change, exit 1 = changed

set -euo pipefail

snap_take() {
  local out_prefix="$1"
  # claude-harness 자신은 npm -g 에 깔려있음 → diff 에서 제외 (자기 자신 변동 X 가 정상)
  find "${HOME}/.claude" "${HOME}/.codex" "${HOME}/.opencode" 2>/dev/null \
    | sort > "${out_prefix}-fs.txt" || true
  npm ls -g --depth=0 --parseable 2>/dev/null \
    | grep -v "@uzysjung/claude-harness" \
    | sort > "${out_prefix}-npm.txt" || true
}

snap_diff() {
  local before="$1"
  local after="$2"
  local fs_diff npm_diff
  fs_diff=$(diff "${before}-fs.txt" "${after}-fs.txt" || true)
  npm_diff=$(diff "${before}-npm.txt" "${after}-npm.txt" || true)
  if [[ -n "${fs_diff}" || -n "${npm_diff}" ]]; then
    echo "DIFF: global write detected"
    if [[ -n "${fs_diff}" ]]; then
      echo "--- fs diff ---"
      echo "${fs_diff}"
    fi
    if [[ -n "${npm_diff}" ]]; then
      echo "--- npm diff ---"
      echo "${npm_diff}"
    fi
    return 1
  fi
  return 0
}
