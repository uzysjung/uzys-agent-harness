#!/usr/bin/env bash
# v26.134.0 (R-3j-A · ADR-049) — scenario-update-external: `update` 가 외부 CLI 산출물도 갱신하는가.
#
# 그전까지 update 는 `.claude/` 만 만졌다. codex/opencode 사용자는 하네스가 개선한 프롬프트·훅을
# `update` 로는 영영 못 받았고, 그 비대칭이 문서 어디에도 안 적혀 있었다.
#
# scenario-external-preserve(ADR-048)는 **재설치** 경로를 검증한다. 두 경로는 서로 다른 코드를
# 타므로 한쪽의 증거가 다른 쪽의 증거가 되지 않는다 — 그래서 별도 시나리오다.
#
# 검증:
#   ① 하네스 구버전 산출물이 최신판으로 갱신된다 (백업 없이 — 사용자가 안 고쳤으므로)
#   ② 사용자 편집분은 `.backup-<stamp>` 로 보존되고 최신판이 자리를 차지
#   ③ 재실행해도 백업이 늘지 않는다 (기준선이 왕복한다)
#   ④ claude 만 깐 프로젝트에 codex/opencode 산출물이 **생기지 않는다**
#   ⑤ update 화면에 외부 CLI 행이 뜬다 (갱신하고도 안 알리는 침묵 방지)

set -euo pipefail

echo "▸ scenario-update-external: update 가 외부 CLI 산출물을 갱신하는가 (R-3j-A)"
echo ""

PROJ=/tmp/proj-upd-ext
rm -rf "${PROJ}"
mkdir -p "${PROJ}"
cd "${PROJ}"

agent-harness install --track tooling --scope project --cli claude --cli codex --cli opencode >/dev/null

LOG="${PROJ}/.claude/.harness-install.json"
CONFIG="${PROJ}/.codex/config.toml"
HOOK="${PROJ}/.codex/hooks/session-start.sh"

for f in "${CONFIG}" "${HOOK}" "${PROJ}/opencode.json"; do
  if [[ ! -f "${f}" ]]; then
    echo "FAIL: install 이 ${f} 를 안 만들었다 — 이 시나리오가 검증할 대상이 없다"
    exit 1
  fi
done
echo "✓ install 완료 — codex/opencode 산출물 존재"

BASE_COUNT=$(jq '(.externalFiles // []) | length' "${LOG}")
if [[ "${BASE_COUNT}" -eq 0 ]]; then
  echo "FAIL: install log 에 externalFiles 기준선이 없다 (ADR-048 회귀)"
  exit 1
fi
echo "✓ 외부 CLI 기준선 기록 ${BASE_COUNT}건"

# --- ① 하네스 구버전 상태를 만든다 ---
# 디스크를 옛 내용으로 바꾸고 **기준선도 그 해시로** 맞춘다. 그래야 소유 판정이 "사용자는
# 안 고쳤다"가 되고, update 가 백업 없이 최신판으로 덮어써야 하는 상황이 재현된다.
FRESH_CONFIG=$(cat "${CONFIG}")
printf '# stale config from an older harness\n' > "${CONFIG}"
STALE_SHA=$(sha256sum "${CONFIG}" | cut -d' ' -f1)
jq --arg sha "${STALE_SHA}" \
   '(.externalFiles[] | select(.path == ".codex/config.toml") | .sha256) |= $sha' \
   "${LOG}" > "${LOG}.tmp" && mv "${LOG}.tmp" "${LOG}"
echo "✓ 구버전 상태 재현 (.codex/config.toml)"

# --- ② 사용자 편집분도 같이 넣는다 ---
printf '\n# MY LOCAL EDIT\n' >> "${HOOK}"

agent-harness update >/tmp/upd-ext.txt 2>&1 || {
  echo "FAIL: update 가 exit 0 이 아니다"
  cat /tmp/upd-ext.txt
  exit 1
}

# ① 구버전이 최신판으로 갱신됐는가
if [[ "$(cat "${CONFIG}")" != "${FRESH_CONFIG}" ]]; then
  echo "FAIL: .codex/config.toml 이 최신판으로 갱신되지 않았다 (= R-3j-A 재현)"
  exit 1
fi
echo "✓ 구버전 산출물이 최신판으로 갱신됨"

# 사용자가 안 고친 파일에는 백업이 생기면 안 된다 (릴리즈마다 쌓이면 보호가 무력해진다)
CFG_BACKUPS=$(find "${PROJ}/.codex" -maxdepth 1 -name 'config.toml.backup-*' | wc -l)
if [[ "${CFG_BACKUPS}" -ne 0 ]]; then
  echo "FAIL: 사용자가 안 고친 config.toml 에 백업이 생겼다 (${CFG_BACKUPS}건)"
  exit 1
fi
echo "✓ 미편집 파일에는 백업 미생성"

# ② 편집분은 백업으로 보존 + 최신판이 자리에
HOOK_DIR="${PROJ}/.codex/hooks"
BACKUPS=$(find "${HOOK_DIR}" -name '*.backup-*' | wc -l)
if [[ "${BACKUPS}" -lt 1 ]]; then
  echo "FAIL: 편집분을 백업하지 않았다 (사용자 작업 소실)"
  exit 1
fi
BK=$(find "${HOOK_DIR}" -name '*.backup-*' | head -1)
if ! grep -q "MY LOCAL EDIT" "${BK}"; then
  echo "FAIL: 백업본에 편집 내용이 없다 — 백업이 무의미하다"
  exit 1
fi
if grep -q "MY LOCAL EDIT" "${HOOK}"; then
  echo "FAIL: 편집분이 자리에 그대로 남았다 — 갱신이 안 됐다"
  exit 1
fi
echo "✓ 편집분은 백업으로, 최신판이 자리에 (ADR-046 승계)"

# ⑤ 화면에 외부 CLI 행이 떠야 한다
if ! sed 's/\x1b\[[0-9;]*[a-zA-Z]//g' /tmp/upd-ext.txt | grep -q 'external CLI'; then
  echo "FAIL: Update 요약에 external CLI 행이 없다 (사용자가 갱신 사실을 알 수 없다)"
  sed 's/\x1b\[[0-9;]*[a-zA-Z]//g' /tmp/upd-ext.txt | tail -25
  exit 1
fi
echo "✓ Update 요약에 external CLI 행 노출"

# --- ③ 재실행: 백업이 늘면 안 된다 ---
# sleep 은 편의가 아니라 **별건 결함 우회**다: `.claude.backup-<stamp>` 의 stamp 가 초 단위라
# 같은 초에 update 를 두 번 돌리면 백업 경로가 충돌하고, `.claude/skills/<id>` 가 외부 설치기
# (`npx skills add`)가 만든 심볼릭 링크일 때 cpSync 가 EINVAL 로 죽는다.
# v26.133.0(게시본)에서도 동일 재현 — 이 릴리즈가 만든 문제가 아니므로 여기서 고치지 않는다.
# 추적: docs/todo.md R-3m.
sleep 2
agent-harness update >/dev/null 2>&1
AFTER=$(find "${HOOK_DIR}" -name '*.backup-*' | wc -l)
if [[ "${AFTER}" -ne "${BACKUPS}" ]]; then
  echo "FAIL: 편집이 없는데 백업이 늘었다 (${BACKUPS} → ${AFTER}) — 기준선 왕복 실패"
  exit 1
fi
echo "✓ 재실행해도 백업 미증가 (${AFTER}건 유지)"

# --- ④ claude 만 깐 프로젝트에 외부 CLI 산출물이 생기지 않는다 ---
PROJ2=/tmp/proj-upd-claudeonly
rm -rf "${PROJ2}"
mkdir -p "${PROJ2}"
cd "${PROJ2}"
agent-harness install --track tooling --scope project --cli claude >/dev/null
agent-harness update >/dev/null 2>&1

for leaked in .codex opencode.json .opencode .agents AGENTS.md; do
  if [[ -e "${PROJ2}/${leaked}" ]]; then
    echo "FAIL: claude 전용 프로젝트에 ${leaked} 가 생겼다 — update 가 안 고른 CLI 를 깔았다"
    exit 1
  fi
done
echo "✓ claude 전용 프로젝트에 외부 CLI 산출물 미생성"

echo ""
echo "PASS: scenario-update-external"
