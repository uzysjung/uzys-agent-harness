#!/usr/bin/env bash
# #551 PR-3 — scenario-install-keeps-yours: 처음 깔아도 · `install --reinstall` 을 돌려도 설치자 설정이 남는다.
#
# `npm pack` 산출물로 깐 `agent-harness`(Dockerfile #568)로 이슈 재현 스크립트를 그대로 돈다 — 저장소 루트를
# 하네스 루트로 쓰는 경로의 증거를 게시판 경로에 전용하지 않는다.
#
#   A. #563 첫 설치 — 설치자 settings.json 의 자기 훅 · statusLine · model 이 라이브에 남고 하네스 훅이 더해진다
#   B. #563 `--reinstall` — 설치 뒤 더한 자기 훅 · model 이 라이브에 남고 `.claude/` 를 옮기지 않는다
#   C. #572 `--reinstall` — 고친 CLAUDE-uzys-harness.md 가 그 파일 하나의 백업에 남고 화면이 그 경로를 댄다
#   D. #574 깨진 .mcp.json — 바이트 그대로 · 백업 0 · 화면 `⊘ left  .mcp.json — could not read it (…)`
#   E. 첫 접촉 — 하네스 자리의 설치자 룰 파일은 그 파일 하나의 백업에 남고 기록이 그 백업을 가리킨다

set -euo pipefail

echo "▸ scenario-install-keeps-yours: 첫 설치 · --reinstall 이 설치자 설정을 지킨다 (#563 · #572 · #574)"
echo ""

fail() { echo "✗ $1" >&2; exit 1; }
plain() { sed 's/\x1b\[[0-9;]*[a-zA-Z]//g' "$1"; }
# 첫 백업 파일(없으면 빈 문자열) — `ls | head` 는 pipefail 아래서 매치가 없으면 스크립트를 조용히 끝낸다
first_backup() {
  local f
  for f in "$1".backup-*; do
    if [ -e "$f" ]; then echo "$f"; return 0; fi
  done
  echo ""
}
run() {
  local out="$1"; shift
  agent-harness "$@" > "${out}" 2>&1 || { cat "${out}" >&2; fail "agent-harness $* 가 실패했다"; }
}

# ── A. #563 첫 설치 · settings.json ─────────────────────────────────────────
P=/tmp/keeps-a
rm -rf "${P}"; mkdir -p "${P}/.claude"; cd "${P}"
cat > .claude/settings.json <<'MARK'
{
  "model": "MARKER-MY-MODEL",
  "hooks": {
    "MyOwnHook": [{"matcher": "*", "hooks": [{"type": "command", "command": "echo MARKER-MY-OWN-HOOK-COMMAND"}]}],
    "SessionStart": [{"hooks": [{"type": "command", "command": "echo MARKER-MY-SESSION-HOOK"}]}]
  },
  "statusLine": {"type": "command", "command": "echo MARKER-MY-OWN-STATUSLINE"}
}
MARK
run /tmp/keeps-a.txt install --track base --cli claude --scope project
for m in MARKER-MY-OWN-HOOK-COMMAND MARKER-MY-OWN-STATUSLINE MARKER-MY-MODEL MARKER-MY-SESSION-HOOK; do
  grep -q "${m}" .claude/settings.json || fail "A: 라이브 settings.json 에서 ${m} 가 사라졌다 (#563)"
done
jq -e '[.hooks.SessionStart[].hooks[].command | select(contains(".claude/hooks/session-start.sh"))] | length == 1' \
  .claude/settings.json > /dev/null || fail "A: 하네스 SessionStart 훅이 정확히 하나 더해지지 않았다"
jq -e '[.hooks.PreToolUse[].hooks[].command | select(contains(".claude/hooks/protect-files.sh"))] | length == 1' \
  .claude/settings.json > /dev/null || fail "A: 하네스 PreToolUse 훅이 정확히 하나 더해지지 않았다"
[ -z "$(first_backup .claude/settings.json)" ] || fail "A: 몫만 더했는데 settings.json 백업이 생겼다 (통째 교체 흔적)"
plain /tmp/keeps-a.txt | grep -q "\.claude/settings.json .*kept yours: statusLine" \
  || fail "A: 화면이 설치자 statusLine 을 남겼다고 말하지 않는다"
echo "✓ A: 첫 설치 — 설치자 훅 · statusLine · model 이 라이브에 남고 하네스 훅이 하나씩 더해졌다"

# ── B. #563 --reinstall · settings.json ──────────────────────────────────────
P=/tmp/keeps-b
rm -rf "${P}"; mkdir -p "${P}"; cd "${P}"
git init -q
run /tmp/keeps-b1.txt install --track tooling --cli claude --scope project
jq '.hooks.MyOwnHook = [{"matcher":"*","hooks":[{"type":"command","command":"echo myown-hook-fires"}]}] | .model = "my-custom-model-pref"' \
  .claude/settings.json > /tmp/keeps-b-settings.json
mv /tmp/keeps-b-settings.json .claude/settings.json
printf '{"permissions":{"allow":["Bash(make build)"]}}\n' > .claude/settings.local.json
run /tmp/keeps-b.txt install --track tooling --cli claude --reinstall
grep -q "myown-hook-fires" .claude/settings.json || fail "B: --reinstall 뒤 라이브 settings.json 에서 설치자 훅이 사라졌다 (#563)"
grep -q "my-custom-model-pref" .claude/settings.json || fail "B: --reinstall 뒤 라이브 settings.json 에서 model 이 사라졌다 (#563)"
[ -f .claude/settings.local.json ] || fail "B: 설치자 settings.local.json 이 제자리에 없다"
for d in .claude.backup-*; do
  [ -e "${d}" ] && fail "B: --reinstall 이 .claude/ 를 옮겼다 (${d})"
done
echo "✓ B: --reinstall — 설치자 훅 · model · settings.local.json 이 제자리 · 폴더 이동 없음"

# ── C. #572 --reinstall · 고친 앵커 ───────────────────────────────────────────
P=/tmp/keeps-c
rm -rf "${P}"; mkdir -p "${P}"; cd "${P}"
git init -q
run /tmp/keeps-c1.txt install --track tooling --cli claude --scope project
printf '\nMY-OWN-EDIT\n' >> CLAUDE-uzys-harness.md
run /tmp/keeps-c.txt install --track tooling --cli claude --reinstall
N=$(grep -rl "MY-OWN-EDIT" . 2>/dev/null | wc -l)
[ "${N}" -ge 1 ] || fail "C: 편집분이 프로젝트 어디에도 없다 (#572 재현)"
grep -q "MY-OWN-EDIT" CLAUDE-uzys-harness.md && fail "C: 편집분이 라이브에 그대로다 — 갱신이 안 됐다"
BK=$(first_backup CLAUDE-uzys-harness.md)
[ -n "${BK}" ] || fail "C: 고친 앵커의 백업이 없다 (#572)"
grep -q "MY-OWN-EDIT" "${BK}" || fail "C: 백업본에 편집 내용이 없다"
plain /tmp/keeps-c.txt | grep -qF "backed up  CLAUDE-uzys-harness.md — you edited it — saved as ${BK}" \
  || fail "C: 화면이 백업한 파일과 그 경로를 대지 않는다"
echo "✓ C: --reinstall — 고친 앵커가 ${BK} 에 남고 화면이 그 경로를 댔다"

# ── D. #574 깨진 .mcp.json ───────────────────────────────────────────────────
P=/tmp/keeps-d
rm -rf "${P}"; mkdir -p "${P}"; cd "${P}"
printf '{\n  "mcpServers": {\n    "my-own": {"command": "my-mcp"},\n  }\n}\n' > .mcp.json
cp .mcp.json /tmp/keeps-d-original.json
run /tmp/keeps-d.txt install --track tooling --cli claude --scope project
cmp -s .mcp.json /tmp/keeps-d-original.json || fail "D: 읽지 못한 .mcp.json 을 고쳐 썼다 (#574)"
[ -z "$(first_backup .mcp.json)" ] || fail "D: 한 바이트도 안 써야 하는데 백업이 생겼다"
plain /tmp/keeps-d.txt | grep -qF "⊘ left  .mcp.json — could not read it (invalid JSON)" \
  || fail "D: 화면이 '⊘ left .mcp.json — could not read it' 을 말하지 않는다"
echo "✓ D: 깨진 .mcp.json — 바이트 그대로 · 백업 0 · 화면 한 줄"

# ── E. 첫 접촉 — 하네스 자리의 설치자 파일 ─────────────────────────────────────
P=/tmp/keeps-e
rm -rf "${P}"; mkdir -p "${P}/.claude/rules"; cd "${P}"
printf '# MY-OWN-GIT-POLICY\n' > .claude/rules/git-policy.md
run /tmp/keeps-e.txt install --track tooling --cli claude --scope project
BK=$(first_backup .claude/rules/git-policy.md)
[ -n "${BK}" ] || fail "E: 하네스 자리의 설치자 파일이 백업 없이 사라졌다"
grep -q "MY-OWN-GIT-POLICY" "${BK}" || fail "E: 백업본에 설치자 내용이 없다"
cmp -s .claude/rules/git-policy.md /work/templates/rules/git-policy.md || fail "E: 하네스 판이 자리를 잡지 않았다"
jq -e --arg bk "${BK}" \
  '[.rootFiles[] | select(.path == ".claude/rules/git-policy.md" and .change == "displaced" and .notes[0] == $bk)] | length == 1' \
  .uzys-agent-harness/.harness-install.json > /dev/null || fail "E: 기록이 비켜 둔 설치자 파일의 백업을 가리키지 않는다"
plain /tmp/keeps-e.txt | grep -qF "backed up  .claude/rules/git-policy.md — had a file with this name — saved as ${BK}" \
  || fail "E: 화면이 '편집' 이 아니라 '같은 이름의 파일' 이라 말하며 백업 경로를 대지 않는다"
echo "✓ E: 첫 접촉 — 설치자 룰이 ${BK} 에 남고 기록(displaced)이 그 백업을 가리킨다"

echo ""
echo "✓ scenario-install-keeps-yours PASS"
