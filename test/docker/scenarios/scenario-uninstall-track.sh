#!/usr/bin/env bash
# #543 — scenario-uninstall-track: `uninstall --track <name>` 이 그 트랙 것만 걷어내는가.
#
# 설치자가 실제로 치는 순서 그대로 친다 — tooling+csr-fastapi · claude+codex 로 install → AGENTS.md 의
# Project Context 를 채움 → update → `uninstall --track csr-fastapi --dry-run` → 실행.
#
# 검증:
#   ① csr-fastapi 만 가져오는 룰 · 스킬이 `.claude/` · `.agents/` 두 자리에서 사라진다
#   ② 공통 룰 · tooling 룰 · 방법론 스킬 · 훅 · 앵커 · `.codex/` 는 그대로다
#   ③ `AGENTS.md` 에 `## UI Components` 가 없고 설치자 문단은 그대로다
#   ④ 설치 기록 트랙이 tooling 하나이고 `list` 도 같은 말을 한다(메타파일이 트랙을 되살리지 않는다)
#   ⑤ 이어서 update 해도 백업 0 · 디스크 변화 0
#   ⑥ 대조군 — 마지막 트랙 `--track tooling` 은 거절되고 아무것도 안 바뀐다
#   (미리보기) `--dry-run` 은 빼는 이름을 말하고 디스크를 바꾸지 않는다

set -euo pipefail

echo "▸ scenario-uninstall-track: uninstall --track 이 그 트랙 것만 회수하는가 (#543)"
echo ""

PROJ=/tmp/proj-uninstall-track
rm -rf "${PROJ}"
mkdir -p "${PROJ}"
cd "${PROJ}"

agent-harness install --track tooling --track csr-fastapi --cli claude --cli codex --scope project >/dev/null
echo "✓ install 완료 (tracks=tooling,csr-fastapi · cli=claude,codex)"

GONE=(
  .claude/rules/ui-components.md
  .claude/skills/ui-visual-review/SKILL.md
  .agents/skills/ui-visual-review/SKILL.md
)
KEPT=(
  .claude/rules/git-policy.md
  .claude/rules/cli-development.md
  .claude/skills/objective-brief/SKILL.md
  .agents/skills/objective-brief/SKILL.md
  .claude/hooks/session-start.sh
  CLAUDE-uzys-harness.md
  .codex/config.toml
)
for p in "${GONE[@]}" "${KEPT[@]}" AGENTS.md; do
  if [[ ! -e "${PROJ}/${p}" ]]; then
    echo "FAIL: ${p} 가 설치되지 않았다 — 검증 대상이 없다"
    exit 1
  fi
done
if ! grep -qF '## UI Components' AGENTS.md; then
  echo "FAIL: AGENTS.md 에 ## UI Components 가 없다 — ③ 의 대조군이 없다"
  exit 1
fi
echo "✓ 전제 확인 — 빠질 것 · 남을 것 · AGENTS.md 의 ## UI Components 존재"

MARK="우리 팀 결제 정산 배치. 빌드는 make build. $$"
awk -v mark="${MARK}" '
  { print }
  $0 == "## Project Context" && !done { print ""; print mark; done = 1 }
' AGENTS.md > AGENTS.md.tmp
mv AGENTS.md.tmp AGENTS.md
grep -qF "${MARK}" AGENTS.md || { echo "FAIL: 문단을 넣지 못했다"; exit 1; }
agent-harness update >/tmp/uninstall-track-upd.txt 2>&1 || {
  echo "FAIL: update 가 실패했다"
  tail -30 /tmp/uninstall-track-upd.txt
  exit 1
}
grep -qF "${MARK}" AGENTS.md || { echo "FAIL: update 가 문단을 지웠다 — 전제가 깨졌다"; exit 1; }
echo "✓ Project Context 문단 추가 · update 뒤 보존 (전제)"

snapshot() {
  find . -type f -not -path './.uzys-agent-harness/*' -print0 | sort -z | xargs -0 sha256sum
}

# --- 미리보기 ---
BEFORE=$(snapshot)
agent-harness uninstall --track csr-fastapi --dry-run >/tmp/uninstall-track-dry.txt 2>&1
if [[ "$(snapshot)" != "${BEFORE}" ]]; then
  echo "FAIL: --dry-run 이 디스크를 바꿨다"
  exit 1
fi
if ! grep -qF 'removes: rules ui-components · skills ui-visual-review' /tmp/uninstall-track-dry.txt; then
  echo "FAIL: 미리보기가 빼는 이름을 말하지 않는다"
  cat /tmp/uninstall-track-dry.txt
  exit 1
fi
echo "✓ --dry-run — 디스크 무변경 · 빼는 이름(rules ui-components · skills ui-visual-review)"

# --- 실행 ---
set +e
agent-harness uninstall --track csr-fastapi >/tmp/uninstall-track-out.txt 2>&1
RC=$?
set -e
if [[ "${RC}" -ne 0 ]]; then
  echo "FAIL: uninstall --track csr-fastapi 가 exit ${RC}"
  tail -30 /tmp/uninstall-track-out.txt
  exit 1
fi
echo "✓ uninstall --track csr-fastapi exit 0"

# --- ① · ② ---
for p in "${GONE[@]}"; do
  if [[ -e "${PROJ}/${p}" ]]; then
    echo "FAIL: ${p} 가 남았다 — csr-fastapi 만 가져오는 파일이다"
    exit 1
  fi
done
for p in "${KEPT[@]}"; do
  if [[ ! -e "${PROJ}/${p}" ]]; then
    echo "FAIL: ${p} 가 사라졌다 — 남는 트랙 · CLI 가 쓰는 파일이다"
    exit 1
  fi
done
echo "✓ csr 전용 룰 · 스킬 두 자리 회수 · 공통 룰 · tooling 룰 · 방법론 스킬 · 훅 · 앵커 · .codex/ 보존"

# --- ③ ---
if grep -qF '## UI Components' AGENTS.md; then
  echo "FAIL: AGENTS.md 에 ## UI Components 가 남았다"
  exit 1
fi
grep -qF "${MARK}" AGENTS.md || { echo "FAIL: AGENTS.md 의 설치자 문단이 사라졌다"; exit 1; }
echo "✓ AGENTS.md — ## UI Components 제거 · 설치자 문단 보존"

# --- ④ ---
TRACKS=$(jq -c '.spec.tracks' "${PROJ}/.uzys-agent-harness/.harness-install.json")
if [[ "${TRACKS}" != '["tooling"]' ]]; then
  echo "FAIL: 기록 트랙이 [\"tooling\"] 이 아니다 — 실제: ${TRACKS}"
  exit 1
fi
agent-harness list >/tmp/uninstall-track-list.txt 2>&1
if ! grep -qE 'tracks: +tooling$' /tmp/uninstall-track-list.txt; then
  echo "FAIL: list 가 남는 트랙만 말하지 않는다 (메타파일이 트랙을 되살렸다)"
  cat /tmp/uninstall-track-list.txt
  exit 1
fi
echo "✓ 기록 트랙 = [\"tooling\"] · list 도 tooling"

# --- ⑤ ---
BACKUPS_BEFORE=$(find . -name '*.backup-*' | sort)
AFTER=$(snapshot)
agent-harness update >/tmp/uninstall-track-upd2.txt 2>&1 || {
  echo "FAIL: 트랙 제거 뒤 update 가 실패했다"
  tail -30 /tmp/uninstall-track-upd2.txt
  exit 1
}
if [[ "$(find . -name '*.backup-*' | sort)" != "${BACKUPS_BEFORE}" ]]; then
  echo "FAIL: 트랙 제거 뒤 update 가 백업을 만들었다"
  exit 1
fi
if [[ "$(snapshot)" != "${AFTER}" ]]; then
  echo "FAIL: 트랙 제거 뒤 update 가 디스크를 바꿨다"
  diff <(echo "${AFTER}") <(snapshot) || true
  exit 1
fi
echo "✓ 이어서 update — 백업 0 · 디스크 변화 0"

# --- ⑥ 대조군 ---
set +e
agent-harness uninstall --track tooling >/tmp/uninstall-track-last.txt 2>&1
RC2=$?
set -e
if [[ "${RC2}" -eq 0 ]]; then
  echo "FAIL: 마지막 트랙 제거가 성공했다 — 전량 삭제 경로가 둘이 된다"
  exit 1
fi
if [[ "$(snapshot)" != "${AFTER}" ]]; then
  echo "FAIL: 거절했는데 디스크가 바뀌었다"
  exit 1
fi
echo "✓ 대조군 — 마지막 트랙 제거는 거절 (exit ${RC2}), 파일 무변경"

echo ""
echo "PASS: scenario-uninstall-track"
