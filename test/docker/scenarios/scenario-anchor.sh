#!/usr/bin/env bash
# 2026-08-02 (ADR-060 P5) — scenario-anchor: @import 앵커 구조의 실설치 검증.
#
# 검증 (최종 리뷰 HIGH-3 — 단위 테스트 증거를 실설치 경로에 전용하지 않는다):
#   A. 신규 프로젝트: 루트 CLAUDE-uzys-harness.md 생성 + 루트 CLAUDE.md 에 import 1줄
#   B. 기존 CLAUDE.md 보유 프로젝트: 본문 무손실 + import 1줄 추가
#   C. 재설치 idempotent: import 줄이 늘지 않는다
#   D. .claude/CLAUDE.md (구 앵커) 는 신규 설치에서 생성되지 않는다

set -euo pipefail

cd "$(dirname "$0")/.."

echo "▸ scenario-anchor: @import 앵커 실설치 (ADR-060 P5)"
echo ""

fail() { echo "✗ $1" >&2; exit 1; }
IMPORT_LINE='@CLAUDE-uzys-harness.md'

# ── A. 신규 프로젝트 ──────────────────────────────────────────────
PROJ_A=/tmp/anchor-fresh
rm -rf "${PROJ_A}"; mkdir -p "${PROJ_A}"; cd "${PROJ_A}"
agent-harness install --track tooling --scope project

[ -f CLAUDE-uzys-harness.md ] || fail "A: 루트 CLAUDE-uzys-harness.md 미생성"
[ -f CLAUDE.md ] || fail "A: 루트 CLAUDE.md 미생성"
COUNT=$(grep -cxF "${IMPORT_LINE}" CLAUDE.md || true)
[ "${COUNT}" = "1" ] || fail "A: import 줄 수 ${COUNT} ≠ 1"
[ ! -f .claude/CLAUDE.md ] || fail "D: 구 앵커 .claude/CLAUDE.md 가 신규 설치에서 생성됨"
echo "✓ A/D: 신규 설치 — 앵커·import·구앵커부재 확인"

# ── B. 기존 CLAUDE.md 보유 프로젝트 ────────────────────────────────
PROJ_B=/tmp/anchor-existing
rm -rf "${PROJ_B}"; mkdir -p "${PROJ_B}"; cd "${PROJ_B}"
printf '# 내 프로젝트\n\n우리 팀 규칙: 커밋은 한국어로\n' > CLAUDE.md
cp CLAUDE.md /tmp/anchor-user-original.md
agent-harness install --track tooling --scope project

grep -qF "우리 팀 규칙: 커밋은 한국어로" CLAUDE.md || fail "B: 사용자 본문 손실"
COUNT=$(grep -cxF "${IMPORT_LINE}" CLAUDE.md || true)
[ "${COUNT}" = "1" ] || fail "B: import 줄 수 ${COUNT} ≠ 1"
echo "✓ B: 기존 CLAUDE.md 무손실 + import 1줄"

# ── C. 재설치 idempotent ──────────────────────────────────────────
agent-harness install --track tooling --scope project
COUNT=$(grep -cxF "${IMPORT_LINE}" CLAUDE.md || true)
[ "${COUNT}" = "1" ] || fail "C: 재설치 후 import 줄 수 ${COUNT} ≠ 1 (idempotent 파손)"
echo "✓ C: 재설치 idempotent"

# ── E. 앵커 편집 후 update: 편집분은 백업, 최신판이 자리 (#480) ─────────────
# 전에는 update 가 기준선 대조 없이 덮어써 편집이 백업 없이 사라졌다(컨테이너 실측 2026-09-20).
printf '\n<!-- MY ANCHOR EDIT -->\n' >> CLAUDE-uzys-harness.md
agent-harness update --project-dir "$(pwd)" > /tmp/anchor-update.txt 2>&1 || fail "E: update 실패"
grep -q "MY ANCHOR EDIT" CLAUDE-uzys-harness.md && fail "E: 편집분이 그대로 남았다 — 갱신이 안 됐다"
BK=$(ls CLAUDE-uzys-harness.md.backup-* 2>/dev/null | head -1)
[ -n "${BK}" ] || fail "E: 앵커 편집분이 백업 없이 사라졌다 (#480 재현)"
grep -q "MY ANCHOR EDIT" "${BK}" || fail "E: 백업본에 편집 내용이 없다"
sed 's/\x1b\[[0-9;]*[a-zA-Z]//g' /tmp/anchor-update.txt | grep -q "CLAUDE-uzys-harness.md edited" \
  || fail "E: Update 요약에 앵커 백업 행이 없다 (조용한 백업은 없는 것과 같다)"
# 재실행: 편집이 없으니 백업이 늘면 안 된다 — 기준선을 다시 찍는지의 증거
agent-harness update --project-dir "$(pwd)" > /dev/null 2>&1 || fail "E: 재실행 update 실패"
N=$(ls CLAUDE-uzys-harness.md.backup-* 2>/dev/null | wc -l)
[ "${N}" = "1" ] || fail "E: 편집 없는 재실행에서 백업이 ${N}개 — 기준선 갱신이 안 된다"
echo "✓ E: 앵커 편집분 백업 + 최신판 활성 + 재실행 무백업"

echo ""
echo "✓ scenario-anchor PASS"
