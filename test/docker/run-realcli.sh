#!/usr/bin/env bash
# Real-CLI 검증 runner — B2(codex) + B1(antigravity).
# 실 codex/agy 바이너리를 컨테이너에 설치해 harness project-scope 자산 인식 검증.
# 호스트 글로벌 미오염 (host mount 없음, 컨테이너 격리).
#
# 사용:
#   ./test/docker/run-realcli.sh              # build + codex + antigravity
#   ./test/docker/run-realcli.sh codex        # codex 만
#   ./test/docker/run-realcli.sh antigravity  # antigravity 만
#   ./test/docker/run-realcli.sh opencode     # opencode 만 (AGENTS.md 자동 로드 전제 검증)
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
  codex|antigravity|opencode)
    build
    run_scenario "$1"
    ;;
  all)
    build
    # 열거 사본을 두지 않는다 — scenarios/ 에서 derive (run.sh 와 같은 이유: 신규 시나리오가
    # 조용히 거부되는 것을 2026-08-02 에 한 번 겪었다).
    #
    # 첫 실패에서 멈추지 않는다 (2026-08-28, #369) — 멈추면 몇 개가 red 인지 알 수 없고,
    # 이 세 시나리오가 63일간 red 인 채 아무도 못 본 자리가 정확히 그 형태였다.
    failed=0
    results=""
    for f in "$(dirname "$0")"/scenarios/scenario-realcli-*.sh; do
      b="$(basename "$f" .sh)"
      b="${b#scenario-realcli-}"
      set +e
      run_scenario "${b}"
      code=$?
      set -e
      [ "${code}" -ne 0 ] && failed=$((failed + 1))
      results="${results}${b}\t${code}\n"
    done
    echo ""
    echo "━━━ 요약 ━━━"
    printf "%b" "${results}" | while IFS="$(printf '\t')" read -r name code; do
      [ -z "${name}" ] && continue
      if [ "${code}" = "0" ]; then printf '  ✓ %s\n' "${name}"; else printf '  ✗ %s (exit %s)\n' "${name}" "${code}"; fi
    done
    echo ""
    if [ "${failed}" -ne 0 ]; then
      echo "red ${failed}개"
      exit 1
    fi
    echo "전부 green"
    ;;
  *)
    echo "usage: $0 [build|codex|antigravity|opencode|all]" >&2
    exit 1
    ;;
esac
