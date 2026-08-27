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

# `all` 은 **첫 실패에서 멈추지 않는다** (2026-08-28, #369). 멈추면 "몇 개가 red 인지"를
# 알 수 없어서, 이 저장소가 63일간 red 를 못 본 자리를 다시 만든다 — 한 번에 하나씩만
# 보이면 고칠 때마다 전체를 다시 돌려야 하고, 그러면 아무도 안 돌린다(#237).
run_all() {
  local failed=0 name code
  local results=""
  for name in $(scenario_names); do
    # `|| code=$?` 는 errexit 를 건드리지 않는다. `set +e`/`set -e` 로 껐다 켜면 호출자의
    # 상태를 덮어써서, 이 함수의 `return 1` 이 errexit 에 걸려 요약 뒤 흐름이 끊긴다.
    code=0
    run_scenario "${name}" || code=$?
    if [ "${code}" -ne 0 ]; then
      failed=$((failed + 1))
    fi
    results="${results}${name}\t${code}\n"
  done

  echo ""
  echo "━━━ 요약 ━━━"
  printf "%b" "${results}" | while IFS="$(printf '\t')" read -r name code; do
    [ -z "${name}" ] && continue
    if [ "${code}" = "0" ]; then printf '  ✓ %s\n' "${name}"; else printf '  ✗ %s (exit %s)\n' "${name}" "${code}"; fi
  done
  local total
  total=$(scenario_names | grep -c .)
  echo ""
  if [ "${failed}" -eq 0 ]; then
    echo "전부 green — ${total}개"
    return 0
  fi
  echo "red ${failed}개 / ${total}개"
  return 1
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
  # errexit 에 기대지 않고 명시적으로 옮긴다 — CI 가 판정에 쓰는 값이다.
  run_all || exit 1
elif [ -f "$(dirname "$0")/scenarios/scenario-${NAME}.sh" ]; then
  run_scenario "$NAME"
else
  echo "usage: $0 [$(scenario_names | tr '\n' '|' | sed 's/|$//')|all]" >&2
  exit 1
fi
