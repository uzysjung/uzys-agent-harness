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

case "${1:-smoke}" in
  smoke)
    run_scenario smoke
    ;;
  project|global|uninstall|antigravity-render|pinned-versions)
    run_scenario "$1"
    ;;
  all)
    run_scenario smoke
    run_scenario project
    run_scenario global
    run_scenario uninstall
    run_scenario antigravity-render
    run_scenario pinned-versions
    ;;
  *)
    echo "usage: $0 [smoke|project|global|uninstall|antigravity-render|pinned-versions|all]" >&2
    exit 1
    ;;
esac
