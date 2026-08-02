#!/usr/bin/env bash
# Docker test runner — v26.64.0.
# image build + 시나리오 실행. 사용자 PC 글로벌 미오염 (host mount 없음).
#
# 사용:
#   ./test/docker/run.sh                     # build + smoke 만
#   ./test/docker/run.sh smoke                # smoke 만
#   ./test/docker/run.sh project              # scenario-project (Phase 2 후 작동)
#   ./test/docker/run.sh antigravity-render   # v26.78.1 R2 — --cli antigravity 출력 렌더
#   ./test/docker/run.sh pinned-versions      # v26.80.0 P — npm/npx pinned 버전 실설치
#   ./test/docker/run.sh all                  # 모든 시나리오 (Phase 3 후)

set -euo pipefail

cd "$(dirname "$0")/../.."

IMAGE=uzys-harness-test:v26.64

echo "▸ docker build"
docker build -t "${IMAGE}" -f test/docker/Dockerfile .

run_scenario() {
  local name="$1"
  echo ""
  echo "━━━ scenario: ${name} ━━━"
  docker run --rm \
    -e HOME=/home/uzys \
    "${IMAGE}" \
    "/work/test/docker/scenarios/scenario-${name}.sh"
}

# 시나리오 목록은 scenarios/ 디렉터리에서 derive 한다 — 열거 사본을 여기 두면 신규 시나리오가
# 조용히 거부된다 (2026-08-02 scenario-anchor 가 실제로 그렇게 튕겼다. realcli-* 는 별도 러너).
scenario_names() {
  for f in "$(dirname "$0")"/scenarios/scenario-*.sh; do
    b="$(basename "$f" .sh)"; b="${b#scenario-}"
    case "$b" in realcli-*) ;; *) echo "$b" ;; esac
  done
}

NAME="${1:-smoke}"
if [ "$NAME" = "all" ]; then
  for s in $(scenario_names); do
    run_scenario "$s"
  done
elif [ -f "$(dirname "$0")/scenarios/scenario-${NAME}.sh" ]; then
  run_scenario "$NAME"
else
  echo "usage: $0 [$(scenario_names | tr '\n' '|' | sed 's/|$//')|all]" >&2
  exit 1
fi
