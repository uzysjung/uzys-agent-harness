#!/usr/bin/env bash
# 돈이 들지 않는 라우팅 확인 (#513 1단계).
#
#   bash docs/plans/513-eval-evidence/glm-container/smoke-glm.sh [env-file]
#
# env-file 을 안 주면 가짜 토큰으로 돈다 — 요청이 Z.ai 엔드포인트까지 가서 인증 오류로 돌아오면
# 라우팅 구성이 맞다는 것만 증명된다. 대조로 ANTHROPIC_BASE_URL 을 비운 실행(Anthropic 기본 엔드포인트)의
# 오류도 함께 본다 — 두 오류가 다르면 BASE_URL 이 실제로 적용된 것이다.
#
# 진짜 토큰(= 유료)으로 돌리는 것은 2단계다. 이 스크립트는 토큰 값을 출력하지 않는다.
set -uo pipefail
cd "$(dirname "$0")/../../../.."

IMAGE=eval-513-glm
ENV_FILE="${1:-}"
OUT="${SMOKE_OUT:-/tmp/eval-513-smoke}"
mkdir -p "$OUT"

if [ -n "$ENV_FILE" ]; then
  case "$ENV_FILE" in "$PWD"/*) echo "env-file 은 저장소 밖에 둔다: $ENV_FILE" >&2; exit 3;; esac
  ENV_ARGS=(--env-file "$ENV_FILE")
else
  ENV_ARGS=(-e ANTHROPIC_AUTH_TOKEN=fake-token-for-routing-check)
fi

echo "▸ build"
docker build -q -t "$IMAGE" -f docs/plans/513-eval-evidence/glm-container/Dockerfile . || exit 1

run() { # name, extra docker args...
  local name="$1"; shift
  # API_TIMEOUT_MS 를 짧게 — 가짜 토큰 확인은 20초면 끝나야 한다 (이미지 기본 3,000,000ms 는 실제 실행용).
  # timeout 으로도 묶는다: 엔드포인트가 응답을 안 주면 그 자체가 관측이다 (2026-10-18 실측 — 아래 설계 문서 §사실 확인).
  timeout --kill-after=10 90 \
    docker run --rm "${ENV_ARGS[@]}" -e API_TIMEOUT_MS=20000 "$@" "$IMAGE" \
    claude -p "Reply with the single word: pong" --model opus --max-turns 1 --output-format json \
    > "$OUT/$name.json" 2> "$OUT/$name.stderr"
  local code=$?
  echo "  $name: exit=$code result=$(jq -r '.result // .error // "<no result field>"' "$OUT/$name.json" 2>/dev/null | head -c 200 | sed 's/[A-Za-z0-9_-]\{30,\}/<redacted>/g')"
}

echo "▸ 1) BASE_URL=Z.ai (이미지 기본값)"
run zai
echo "▸ 2) 대조: BASE_URL 비움 → Anthropic 기본 엔드포인트"
run anthropic-control -e ANTHROPIC_BASE_URL=
echo "▸ 3) 대조: 네트워크 차단 → 엔드포인트 미도달"
run no-network --network none

echo
echo "판정: 1) 과 2) 의 오류 본문이 서로 다르고, 1) 이 Z.ai 쪽 인증 오류면 라우팅은 맞다. 3) 은 연결 오류여야 한다."
echo "원문: $OUT/*.json · *.stderr (토큰은 담기지 않는다 — Claude Code 는 요청 헤더를 출력하지 않는다)"
