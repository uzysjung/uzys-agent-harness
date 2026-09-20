#!/usr/bin/env bash
# #456 (2026-09-20) — scenario-base-track: `--track base` 가 스택 무관 자산만 까는가.
#
# 검증 (사용자 결정 B — 개발 도구 3종도 기본 선택에서 뺀다):
#   ① 룰 = 공통 5종뿐 (cli-development 없음)
#   ② 에이전트 = reviewer + implementer · 훅 = protect-files + session-start
#   ③ 방법론 스킬 5종 + 전 트랙 스킬 4종은 있고, 스택 전용 스킬(python-* · nextjs-* 등)은 0
#   ④ 대조군 tooling: cli-development 가 있다 (이 시나리오가 룰 차이를 실제로 보는지)
set -euo pipefail
echo "▸ scenario-base-track: --track base 는 원칙·방법론·테스트 스킬만 (#456)"
echo ""
fail() { echo "✗ $1" >&2; exit 1; }

PROJ=/tmp/proj-base
rm -rf "${PROJ}"; mkdir -p "${PROJ}"; cd "${PROJ}"
agent-harness install --track base --scope project >/tmp/base-install.txt 2>&1 || { tail -20 /tmp/base-install.txt; fail "install --track base 실패"; }

# ① 룰
RULES=$(ls .claude/rules/*.md | xargs -n1 basename | sed 's/\.md$//' | sort | tr '\n' ' ')
[ "${RULES}" = "change-management doc-governance git-policy ship-checklist test-policy " ] \
  || fail "① 룰이 공통 5종이 아니다: ${RULES}"
echo "✓ ① 룰 = 공통 5종 (cli-development 없음)"

# ② 에이전트·훅
[ -f .claude/agents/reviewer.md ] && [ -f .claude/agents/implementer.md ] || fail "② reviewer/implementer 누락"
[ -f .claude/hooks/protect-files.sh ] && [ -f .claude/hooks/session-start.sh ] || fail "② 훅 2종 누락"
echo "✓ ② reviewer + implementer · 훅 2종"

# ③ 스킬
for s in compaction-handoff clear-korean-communication audit-service-gaps multi-persona-review recurrence-prevention \
         north-star gh-issue-workflow objective-brief audit-harness-fit; do
  [ -f ".claude/skills/${s}/SKILL.md" ] || fail "③ 스킬 ${s} 누락"
done
STACK=$(ls .claude/skills | grep -E '^(python-|nextjs-|react-|shadcn|supabase|postgres|e2e-)' || true)
[ -z "${STACK}" ] || fail "③ 스택 전용 스킬이 깔렸다: ${STACK}"
for s in frontend-design find-skills agent-browser; do
  [ ! -e ".claude/skills/${s}" ] || fail "③ 개발 도구 ${s} 가 기본 선택으로 깔렸다 (사용자 결정 B 위반)"
done
echo "✓ ③ 방법론 5 + 전 트랙 4 있음 · 스택 전용 0 · 개발 도구 3종 미설치"

# ④ 대조군
CTRL=/tmp/proj-tooling-ctrl
rm -rf "${CTRL}"; mkdir -p "${CTRL}"; cd "${CTRL}"
agent-harness install --track tooling --scope project --without agent-browser --without frontend-design --without find-skills >/dev/null 2>&1 || fail "④ 대조군 install 실패"
[ -f .claude/rules/cli-development.md ] || fail "④ 대조군 tooling 에 cli-development 가 없다 — ① 의 차이를 이 시나리오가 못 본다"
echo "✓ ④ 대조군 tooling = cli-development 있음"

echo ""
echo "PASS: scenario-base-track"
