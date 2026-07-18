#!/usr/bin/env bash
# ============================================================
# fresh-dogfood-setup.sh — P2-01 First-Run Success 확인용 clean-env 셋업 (HITO 측정은 ADR-043 에서 폐기).
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

echo "▸ harness project-scope 설치 (npx @uzysjung/agent-harness)"
echo "  (~/.claude 글로벌 자산 미오염 — project-scope)"
( cd "$DIR" && npx -y @uzysjung/agent-harness install \
    --track tooling --cli claude --with uzys-harness --scope project )

echo ""
echo "✓ 셋업 완료. First-Run Success 확인 RUN (별도 fresh 세션):"
echo ""
echo "    cd $DIR"
echo "    claude"
echo "    # 6-gate 로 mini-wc 완주 (SPEC: docs/evals/fresh-dogfood-protocol.md):"
echo "    #   /uzys:spec → /uzys:plan → /uzys:build → /uzys:test → /uzys:review → /uzys:ship"
echo ""
echo "  판정 = First-Run Success Rate (NORTH_STAR 2차 지표): 설치~완주까지 사용자 수동 개입"
echo "  (에러 fix / 누락 파일 / 추가 install) 0건이면 성공."
echo ""
echo "  결과를 docs/evals/fresh-dogfood-<date>.md 에 기록. 발견 이슈는 gap.md 스키마로"
echo "  (benchmark-parity 룰 §Dogfood pass — 새 스키마 신설 금지)."
