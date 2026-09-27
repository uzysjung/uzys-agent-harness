#!/usr/bin/env bash
# scenario-global — Global 선택지 삭제 뒤의 두 경로 (#560 · ADR-097 결정 1).
#
# 검증:
#   A. 새 설치의 `--scope global` 은 거절된다 — exit ≠ 0 · 대체 명령 안내 · 프로젝트에 아무것도 안 쓴다
#   B. 이미 Global 로 깐 설치본(기록 `scope: global`)은 지금처럼 동작한다 — 같은 플래그를 받고,
#      기록·외부 자산이 계속 global 이다. 옛 설치본은 새 판으로 만들 수 없으므로 project 설치 뒤
#      기록의 scope 를 global 로 바꿔 흉내 낸다(옛 판이 남긴 기록과 같은 모양).

set -euo pipefail

cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
source ./snapshot.sh

failed=0

# ───────── A. 새 설치 — 거절 ─────────
echo "▸ scenario-global A: 새 설치의 --scope global 은 거절"
PROJ=/tmp/proj-global-new
OUT=/tmp/global-new-out.txt
rm -rf "${PROJ}"; mkdir -p "${PROJ}"; cd "${PROJ}"

code=0
agent-harness install --track tooling --scope global > "${OUT}" 2>&1 || code=$?
if [[ "${code}" -eq 0 ]]; then
  echo "FAIL: 새 설치의 --scope global 이 exit 0 — 거절되지 않았다"
  failed=1
else
  echo "✓ 거절 exit ${code}"
fi
if grep -q "npx skills add -g" "${OUT}"; then
  echo "✓ 대체 명령을 안내한다"
else
  echo "FAIL: 대체 명령 안내가 없다"; cat "${OUT}"
  failed=1
fi
written=$(find "${PROJ}" -mindepth 1 | head -5)
if [[ -n "${written}" ]]; then
  echo "FAIL: 거절했는데 프로젝트에 무언가 썼다:"; echo "${written}" | sed 's/^/    /'
  failed=1
else
  echo "✓ 프로젝트에 아무것도 안 썼다"
fi

# ───────── B. 옛 Global 설치본 — 지금처럼 ─────────
echo ""
echo "▸ scenario-global B: 기록이 global 인 설치본은 같은 플래그를 받는다"
PROJ=/tmp/proj-global-old
OUT=/tmp/global-old-out.txt
rm -rf "${PROJ}"; mkdir -p "${PROJ}"; cd "${PROJ}"
agent-harness install --track tooling >/dev/null 2>&1
LOG="${PROJ}/.uzys-agent-harness/.harness-install.json"
if [[ ! -f "${LOG}" ]]; then
  echo "FAIL: 전제 — project 설치가 기록을 안 남겼다"; exit 1
fi
jq '.scope = "global"' "${LOG}" > "${LOG}.tmp" && mv "${LOG}.tmp" "${LOG}"
if [[ "$(jq -r '.scope' "${LOG}")" != "global" ]]; then
  echo "FAIL: 기록 변이가 안 걸렸다 — 이 실행은 무효다"; exit 1
fi

snap_take /tmp/proj-global-before
code=0
agent-harness install --track tooling --scope global > "${OUT}" 2>&1 || code=$?
snap_take /tmp/proj-global-after
if [[ "${code}" -ne 0 ]]; then
  echo "FAIL: 기록이 global 인 설치본에서 --scope global 이 exit ${code}"; tail -20 "${OUT}"
  failed=1
else
  echo "✓ 받았다 (exit 0)"
fi

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
  echo "✓ log.assets ($(jq -r '.assets | length' "${LOG}")) 모두 scope=global"
fi

fs_changed=$(diff /tmp/proj-global-before-fs.txt /tmp/proj-global-after-fs.txt 2>/dev/null | grep "^[<>]" | head -5 || true)
if [[ -n "${fs_changed}" ]]; then
  echo "✓ scope=global → 홈 쪽 변화 발생 (mock stub):"
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
