#!/usr/bin/env bash
# ============================================================
# fresh-dogfood-setup.sh — P2-01 HITO 측정용 clean-env 셋업.
#
# host throwaway 디렉토리에 harness 를 project-scope 설치한다.
# project-scope 라 host 글로벌 자산(~/.claude/skills 등)은 미오염
# (claude CLI 의 ~/.claude/plugins/cache native write 는 설계상 예외).
#
# 사용:
#   bash scripts/fresh-dogfood-setup.sh            # throwaway dir 생성 + 설치
#   bash scripts/fresh-dogfood-setup.sh --dir DIR  # 지정 dir 사용
#
# 설치 후 출력되는 안내대로 **별도 fresh `claude` 세션**에서 6-gate 로 mini-wc 완주.
# 측정 RUN 은 인터랙티브 — 본 스크립트는 셋업까지만.
# 프로토콜: docs/evals/fresh-dogfood-protocol.md
# ============================================================
set -euo pipefail

DIR=""
while [ $# -gt 0 ]; do
  case "$1" in
    --dir) DIR="$2"; shift 2 ;;
    -h|--help) sed -n '2,18p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

if [ -z "$DIR" ]; then
  DIR=$(mktemp -d -t uzys-dogfood 2>/dev/null || mktemp -d "${TMPDIR:-/tmp}/uzys-dogfood.XXXXXX")
fi

echo "▸ throwaway 프로젝트: $DIR"
mkdir -p "$DIR"
( cd "$DIR" && git init -q )

echo "▸ harness project-scope 설치 (npx @uzysjung/claude-harness)"
echo "  (~/.claude 글로벌 자산 미오염 — project-scope)"
( cd "$DIR" && npx -y @uzysjung/claude-harness install \
    --track tooling --cli claude --with-uzys-harness --scope project )

echo ""
echo "✓ 셋업 완료. HITO 측정 RUN (별도 fresh 세션):"
echo ""
echo "    cd $DIR"
echo "    claude"
echo "    # 6-gate 로 mini-wc 완주 (SPEC: docs/evals/fresh-dogfood-protocol.md):"
echo "    #   /uzys:spec → /uzys:plan → /uzys:build → /uzys:test → /uzys:review → /uzys:ship"
echo ""
echo "  완주 후 집계:"
echo "    bash $(cd "$(dirname "$0")/.." && pwd)/scripts/hito-aggregate.sh --dir $DIR/.claude/evals --summary"
echo ""
echo "  결과를 docs/evals/fresh-dogfood-<date>.md 에 기록 (목표 HITO ≤ 3/feature)."
