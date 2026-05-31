#!/usr/bin/env bash
# Real-CLI 검증 runner — B2(codex) + B1(antigravity).
# 실 codex/agy 바이너리를 컨테이너에 설치해 harness project-scope 자산 인식 검증.
# 호스트 글로벌 미오염 (host mount 없음, 컨테이너 격리).
#
# 사용:
#   ./test/docker/run-realcli.sh              # build + codex + antigravity
#   ./test/docker/run-realcli.sh codex        # codex 만
#   ./test/docker/run-realcli.sh antigravity  # antigravity 만
#   ./test/docker/run-realcli.sh build        # 이미지 빌드만

set -euo pipefail

cd "$(dirname "$0")/../.."

IMAGE=uzys-harness-realcli:latest

build() {
  echo "▸ docker build (real codex + agy)"
  docker build -t "${IMAGE}" -f test/docker/Dockerfile.realcli .
}

run_scenario() {
  local name="$1"
  echo ""
  echo "━━━ realcli scenario: ${name} ━━━"
  docker run --rm \
    -e HOME=/home/uzys \
    "${IMAGE}" \
    "/work/test/docker/scenarios/scenario-realcli-${name}.sh"
}

case "${1:-all}" in
  build)
    build
    ;;
  codex|antigravity)
    build
    run_scenario "$1"
    ;;
  all)
    build
    run_scenario codex
    run_scenario antigravity
    ;;
  *)
    echo "usage: $0 [build|codex|antigravity|all]" >&2
    exit 1
    ;;
esac
