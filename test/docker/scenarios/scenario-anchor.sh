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

echo ""
echo "✓ scenario-anchor PASS"
