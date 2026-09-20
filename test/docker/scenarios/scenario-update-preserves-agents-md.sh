#!/usr/bin/env bash
# #503 — scenario-update-preserves-agents-md: `update` 가 설치자가 채운 AGENTS.md 절을 살리는가.
#
# 단위 테스트는 transform 을 직접 부른다. 여기서는 **설치된 CLI 로 사용자가 치는 명령**을 그대로
# 친다 — install → 사람이 파일을 채움 → update. 두 경로는 서로의 증거가 되지 않는다
# (no-false-ship). 이 시나리오가 없으면 "transform 은 보존하는데 update 경로는 안 탄다"를 못 본다.
#
# 검증:
#   ① `--cli codex` 설치본의 `## Project Context` 에 적은 문단이 update 뒤에도 그대로다
#   ② 하네스 몫(`## Harness Rules`)은 그대로 자리에 있다 — 보존이 갱신을 죽이지 않았다
#   ③ 마커가 실재한다 (다음 update 가 조각만 갈아 끼울 수 있는 상태)
#   ④ update 를 한 번 더 돌려도 문단이 남고 백업이 쌓이지 않는다
#
# ④ 가 "백업 0" 이 아닌 이유(실측 2026-09-21, 이 시나리오가 처음 드러냄): `--cli codex` 로만
# 깔아도 `update` 는 **OpenCode transform 까지** 같은 `AGENTS.md` 에 돌린다 — refreshOnly 가
# "파일이 있으면 그 CLI 가 깔린 것"으로 판정하는데 이 파일은 두 CLI 가 공유하기 때문이다. 그래서
# 첫 update 는 Codex 판을 OpenCode 판으로 바꾸고(`## Session Start` 가 빠진다) 편집분 백업을 한 번
# 남긴다. **이 변경 이전에도 같았다**(그때는 파일이 통째로 덮여 눈에 안 띄었을 뿐) — #503 범위
# 밖의 별건이라 여기서는 보존과 **누적 없음**만 문다.

set -euo pipefail

echo "▸ scenario-update-preserves-agents-md: update 가 채워 둔 AGENTS.md 절을 살리는가 (#503)"
echo ""

PROJ=/tmp/proj-agents-preserve
rm -rf "${PROJ}"
mkdir -p "${PROJ}"
cd "${PROJ}"

agent-harness install --track tooling --cli codex --scope project >/dev/null
echo "✓ install 완료 (cli=codex)"

AGENTS="${PROJ}/AGENTS.md"
if [[ ! -f "${AGENTS}" ]]; then
  echo "FAIL: AGENTS.md 가 설치되지 않았다 — 검증 대상이 없다"
  exit 1
fi
if ! grep -qF '## Project Context' "${AGENTS}"; then
  echo "FAIL: '## Project Context' 절이 없다 — 이 시나리오의 전제가 깨졌다"
  exit 1
fi
if ! grep -qF '<!-- uzys-harness:anchor:start -->' "${AGENTS}"; then
  echo "FAIL: 하네스 조각 마커가 없다 — 보존 배선이 안 실렸다"
  exit 1
fi
echo "✓ AGENTS.md + 절 + 마커 확인"

# --- 설치자가 절을 채운다 (헤딩 바로 아래에 한 문단) ---
MARK="우리 팀 결제 서비스. 빌드는 make build. $$"
awk -v mark="${MARK}" '
  { print }
  $0 == "## Project Context" && !done { print ""; print mark; done = 1 }
' "${AGENTS}" > "${AGENTS}.tmp"
mv "${AGENTS}.tmp" "${AGENTS}"

if ! grep -qF "${MARK}" "${AGENTS}"; then
  echo "FAIL: 문단을 넣지 못했다 — 대조군 없이 아래 판정을 신뢰할 수 없다"
  exit 1
fi
echo "✓ Project Context 에 문단 추가 (대조군 확인)"

# --- update (비대화형) ---
set +e
agent-harness update >/tmp/agents-preserve-out.txt 2>&1
RC=$?
set -e
if [[ "${RC}" -ne 0 ]]; then
  echo "FAIL: update 가 exit ${RC}"
  tail -30 /tmp/agents-preserve-out.txt
  exit 1
fi
if ! grep -q "Update complete" /tmp/agents-preserve-out.txt; then
  echo "FAIL: 'Update complete' 가 없다 — exit 0 이지만 아무것도 안 했을 수 있다"
  tail -30 /tmp/agents-preserve-out.txt
  exit 1
fi
echo "✓ update exit 0"

# --- ① 설치자 문단 보존 ---
if ! grep -qF "${MARK}" "${AGENTS}"; then
  echo "FAIL: update 가 설치자가 채운 문단을 지웠다 (#503 회귀)"
  exit 1
fi
echo "✓ Project Context 문단 보존"

# --- ② 하네스 몫은 자리에 ---
if ! grep -qF '## Harness Rules' "${AGENTS}"; then
  echo "FAIL: '## Harness Rules' 가 사라졌다 — 보존이 갱신을 죽였다"
  exit 1
fi
if ! grep -qF '## Protected Files' "${AGENTS}"; then
  echo "FAIL: '## Protected Files' 가 사라졌다"
  exit 1
fi
echo "✓ 하네스 소유 절 유지"

# --- ③ 마커 유지 (다음 update 도 조각만 갈아 끼운다) ---
if ! grep -qF '<!-- uzys-harness:anchor:start -->' "${AGENTS}"; then
  echo "FAIL: update 뒤 마커가 사라졌다 — 다음 갱신이 다시 통째로 덮는다"
  exit 1
fi
echo "✓ 마커 유지"

# --- ④ 한 번 더 돌려도 보존 + 백업 누적 0 ---
count_backups() {
  find "${PROJ}" -maxdepth 1 -name 'AGENTS.md.backup-*' | wc -l | tr -d ' '
}
BEFORE=$(count_backups)

agent-harness update >/tmp/agents-preserve-out2.txt 2>&1 || {
  echo "FAIL: 두 번째 update 가 실패했다"
  tail -30 /tmp/agents-preserve-out2.txt
  exit 1
}

if ! grep -qF "${MARK}" "${AGENTS}"; then
  echo "FAIL: 두 번째 update 가 설치자 문단을 지웠다"
  exit 1
fi
AFTER=$(count_backups)
if [[ "${AFTER}" -ne "${BEFORE}" ]]; then
  echo "FAIL: 두 번째 update 가 백업을 ${BEFORE}→${AFTER} 로 늘렸다 — 돌릴 때마다 쌓인다"
  # 무엇이 달라졌는지 없이는 다음 사람이 같은 자리를 또 판다.
  diff "$(find "${PROJ}" -maxdepth 1 -name 'AGENTS.md.backup-*' | sort | tail -1)" "${AGENTS}" || true
  exit 1
fi
echo "✓ 재실행에도 문단 보존 + 백업 누적 0 (${AFTER}건 유지)"

echo ""
echo "PASS: scenario-update-preserves-agents-md"
