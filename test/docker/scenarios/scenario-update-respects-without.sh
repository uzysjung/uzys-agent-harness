#!/usr/bin/env bash
# #505 — scenario-update-respects-without: 설치 때 뺀 번들 스킬을 `update` 가 되돌려 깔지 않는가.
#
# 왜 컨테이너인가: 유닛은 `runInstall`/`runUpdateMode` 를 직접 부른다. 설치자가 실제로 치는
# 것은 `agent-harness install --without <id>` 와 `agent-harness update` 이고, 그 사이를 잇는
# 것은 **디스크에 남은 설치 로그** 하나다 — 그 경로 전체를 한 번 밟는다.
#
# 검증:
#   ① `--without <skill>` 설치 → 그 디렉터리 부재 + 대조군 스킬은 존재
#   ② 설치 로그에 `skillExclude` 가 남는다 (update 가 읽을 유일한 근거)
#   ③ update(비대화형) → exit 0 인데도 그 디렉터리는 여전히 부재
#   ④ 음성 대조 — 해제하지 않은 스킬은 지워도 update 가 되돌려 깐다
#      (없으면 ③ 은 "update 가 원래 스킬을 안 깐다"로도 통과한다)

set -euo pipefail

echo "▸ scenario-update-respects-without: update 가 --without 을 존중하는가 (#505)"
echo ""

# 표본. 번들에서 사라지면 ① 의 전제 검사가 시끄럽게 실패한다 — 조용히 초록이 되지 않는다.
DROPPED=recurrence-prevention
KEPT=north-star

PROJ=/tmp/proj-without
rm -rf "${PROJ}"
mkdir -p "${PROJ}"
cd "${PROJ}"

# --- ① --without 설치 ---
agent-harness install --track tooling --scope project --without "${DROPPED}" >/tmp/w-install.txt 2>&1 || {
  echo "FAIL: install 이 exit $? — 아래 출력 참조"
  tail -30 /tmp/w-install.txt
  exit 1
}

if [ -d "${PROJ}/.claude/skills/${KEPT}" ]; then
  echo "✓ 전제: 대조군 스킬 ${KEPT} 은 깔린다"
else
  echo "FAIL: 대조군 ${KEPT} 이 없다 — 표본이 번들에서 사라졌거나 tooling 트랙이 안 고른다"
  ls "${PROJ}/.claude/skills" || true
  exit 1
fi

if [ -d "${PROJ}/.claude/skills/${DROPPED}" ]; then
  echo "FAIL: --without ${DROPPED} 인데 설치가 깔았다"
  exit 1
fi
echo "✓ --without ${DROPPED} → 설치 시점에 없다"

# --- ② 설치 로그가 해제를 남긴다 ---
LOG="${PROJ}/.uzys-agent-harness/.harness-install.json"
if ! grep -q '"skillExclude"' "${LOG}"; then
  echo "FAIL: 설치 로그에 skillExclude 가 없다 — update 가 읽을 근거가 없다"
  cat "${LOG}"
  exit 1
fi
if ! grep -q "\"${DROPPED}\"" "${LOG}"; then
  echo "FAIL: skillExclude 는 있는데 ${DROPPED} 이 없다"
  cat "${LOG}"
  exit 1
fi
echo "✓ 설치 로그에 skillExclude=[${DROPPED}]"

# --- ③ update 뒤에도 없다 ---
set +e
agent-harness update >/tmp/w-update.txt 2>&1
RC=$?
set -e
if [ "${RC}" -ne 0 ]; then
  echo "FAIL: update 가 exit ${RC}"
  tail -30 /tmp/w-update.txt
  exit 1
fi
if ! grep -q "Update complete" /tmp/w-update.txt; then
  echo "FAIL: 'Update complete' 가 없다 — exit 0 이지만 아무것도 안 했을 수 있다"
  tail -30 /tmp/w-update.txt
  exit 1
fi
if [ -d "${PROJ}/.claude/skills/${DROPPED}" ]; then
  echo "FAIL: update 가 해제한 스킬 ${DROPPED} 을 되돌려 깔았다 (#505 재발)"
  exit 1
fi
if [ ! -d "${PROJ}/.claude/skills/${KEPT}" ]; then
  echo "FAIL: 해제하지 않은 ${KEPT} 이 update 뒤에 사라졌다"
  exit 1
fi
echo "✓ update 뒤에도 ${DROPPED} 은 없고 ${KEPT} 은 그대로"

# --- ④ 음성 대조 ---
rm -rf "${PROJ:?}/.claude/skills/${KEPT}"
agent-harness update >/tmp/w-update2.txt 2>&1 || {
  echo "FAIL: 두 번째 update 가 exit $?"
  tail -30 /tmp/w-update2.txt
  exit 1
}
if [ ! -d "${PROJ}/.claude/skills/${KEPT}" ]; then
  echo "FAIL: 음성 대조 실패 — update 가 없는 스킬을 원래 안 깐다면 ③ 은 증거가 아니다"
  exit 1
fi
if [ -d "${PROJ}/.claude/skills/${DROPPED}" ]; then
  echo "FAIL: 같은 update 가 해제한 스킬까지 되살렸다"
  exit 1
fi
echo "✓ 음성 대조: 지운 ${KEPT} 은 돌아오고 해제한 ${DROPPED} 은 안 돌아온다"

echo ""
echo "PASS: scenario-update-respects-without"
