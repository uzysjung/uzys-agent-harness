#!/usr/bin/env bash
# #543 — scenario-uninstall-track: `uninstall --track <name>` 이 그 트랙 것만 걷어내는가.
#
# 설치자가 실제로 치는 순서 그대로 친다 — tooling+csr-fastapi · claude+codex 로 install → AGENTS.md 의
# Project Context 를 채움 → update → `uninstall --track csr-fastapi --dry-run` → 실행.
#
# 검증:
#   ① csr-fastapi 만 가져오는 룰 · 스킬이 `.claude/` · `.agents/` 두 자리에서 사라진다
#   ② 공통 룰 · tooling 룰 · 방법론 스킬 · 훅 · 앵커 · `.codex/` 는 그대로다
#   ③ `AGENTS.md` 에 UI 룰(`## UI Components` 본문 · `ui-components.md` 포인터 줄)이 없고 설치자 문단은 그대로다
#   ④ 설치 기록 트랙이 tooling 하나이고 `list` 도 같은 말을 한다(메타파일이 트랙을 되살리지 않는다)
#   ⑤ 이어서 update 해도 백업 0 · `AGENTS.md` 룰 블록 밖 디스크 변화 0 — 트랙 제거의 재렌더는 경로 룰을 본문으로 쓰고
#     update 가 `.claude/rules/` 포인터로 되돌린다(ADR-118 감수 ⓓ) · 그 포인터는 실재 파일을 가리킨다
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
# UI 룰은 `AGENTS.md` 에 본문 절이나 포인터 줄로 들어간다(ADR-118 — claude+codex 는 `.claude/rules/` 포인터)
UI_RULE='^## UI Components$|rules/ui-components\.md`$'
if ! grep -qE "${UI_RULE}" AGENTS.md; then
  echo "FAIL: AGENTS.md 에 UI 룰(본문 · 포인터)이 없다 — ③ 의 대조군이 없다"
  exit 1
fi
echo "✓ 전제 확인 — 빠질 것 · 남을 것 · AGENTS.md 의 UI 룰 존재"

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

# 외부 자산 자리(`npx skills` 가 깐 것 — 설계 D2 로 남긴다)와 그 잠금 파일은 update 가 원격에서 다시 받아 바뀔 수 있다.
# 판정 대상은 하네스 몫이다 — 그 자리를 비교에서 뺀다(2026-10-15 실측: 원격 갱신이 metadata.json 을 더해 간헐 red).
EXTERNAL=$(jq -r '.assets[].files[]?.path' "${PROJ}/.uzys-agent-harness/.harness-install.json" | cut -d/ -f1-3 | sort -u)
snapshot() {
  find . -type f -not -path './.uzys-agent-harness/*' -not -name skills-lock.json -print0 |
    sort -z | xargs -0 sha256sum |
    awk -v ext="${EXTERNAL}" 'BEGIN { n = split(ext, e, "\n") }
      { for (i = 1; i <= n; i++) if (e[i] != "" && index($2, "./" e[i] "/") == 1) next; print }'
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
if grep -qE "${UI_RULE}" AGENTS.md; then
  echo "FAIL: AGENTS.md 에 UI 룰(본문 · 포인터)이 남았다"
  exit 1
fi
grep -qF "${MARK}" AGENTS.md || { echo "FAIL: AGENTS.md 의 설치자 문단이 사라졌다"; exit 1; }
echo "✓ AGENTS.md — UI 룰 제거 · 설치자 문단 보존"

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
# `AGENTS.md` 의 룰 블록(마커부터 끝)은 비교에서 뺀다 — 재렌더(본문) → update(포인터)로 바뀌는 자리다(ADR-118 감수 ⓓ)
before_rules() { awk '/<!-- uzys-harness:rules:start -->/ { exit } { print }' AGENTS.md; }
snapshot_outside() { snapshot | grep -v ' \./AGENTS\.md$'; before_rules | sha256sum; }
AFTER=$(snapshot_outside)
agent-harness update >/tmp/uninstall-track-upd2.txt 2>&1 || {
  echo "FAIL: 트랙 제거 뒤 update 가 실패했다"
  tail -30 /tmp/uninstall-track-upd2.txt
  exit 1
}
if [[ "$(find . -name '*.backup-*' | sort)" != "${BACKUPS_BEFORE}" ]]; then
  echo "FAIL: 트랙 제거 뒤 update 가 백업을 만들었다"
  exit 1
fi
if [[ "$(snapshot_outside)" != "${AFTER}" ]]; then
  echo "FAIL: 트랙 제거 뒤 update 가 AGENTS.md 룰 블록 밖 디스크를 바꿨다"
  diff <(echo "${AFTER}") <(snapshot_outside) || true
  exit 1
fi
# 남은 tooling 의 경로 룰(cli-development)이 Codex 에 닿는다 — 포인터면 그 파일이 실재한다
if grep -qF '→ `.claude/rules/cli-development.md`' AGENTS.md; then
  [[ -f .claude/rules/cli-development.md ]] || { echo "FAIL: 포인터가 없는 파일을 가리킨다"; exit 1; }
elif ! grep -qE '^## Shell Safety$' AGENTS.md; then
  echo "FAIL: 트랙 제거 뒤 update 의 AGENTS.md 에 cli-development 가 본문도 포인터도 없다"
  exit 1
fi
echo "✓ 이어서 update — 백업 0 · AGENTS.md 룰 블록 밖 디스크 변화 0 · cli-development 도달"

# --- ⑥ 대조군 ---
AFTER_UPDATE=$(snapshot)
set +e
agent-harness uninstall --track tooling >/tmp/uninstall-track-last.txt 2>&1
RC2=$?
set -e
if [[ "${RC2}" -eq 0 ]]; then
  echo "FAIL: 마지막 트랙 제거가 성공했다 — 전량 삭제 경로가 둘이 된다"
  exit 1
fi
if [[ "$(snapshot)" != "${AFTER_UPDATE}" ]]; then
  echo "FAIL: 거절했는데 디스크가 바뀌었다"
  exit 1
fi
echo "✓ 대조군 — 마지막 트랙 제거는 거절 (exit ${RC2}), 파일 무변경"

echo ""
echo "PASS: scenario-uninstall-track"
