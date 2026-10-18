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

# Claude Code 는 Z.ai 의 401(가짜 토큰) · 429/1113(한도·플랜) 을 재시도 가능으로 보고 10회 지수 백오프(약 3분)를 쓴다 — 메인 세션이 진짜 키로 실측(2026-10-18:
# `429 · [1113] Insufficient balance or no resource package`, duration_ms 179768). timeout 은 그 재시도를 담아야 결과 JSON 이 남는다(90초면 124 로 끝나 결과가 없다).
# API_TIMEOUT_MS 는 가짜 토큰일 때만 짧게 — 진짜 키 + GLM 기본 reasoning_effort=max 는 첫 응답이 20초를 넘길 수 있어 이미지 기본값(3,000,000)을 쓴다.
if [ -n "$ENV_FILE" ]; then TIMEOUT_ARGS=(); RUN_TIMEOUT=400; else TIMEOUT_ARGS=(-e API_TIMEOUT_MS=20000); RUN_TIMEOUT=400; fi
run() { # name, extra docker args...
  local name="$1"; shift
  timeout --kill-after=10 "$RUN_TIMEOUT" \
    docker run --rm "${ENV_ARGS[@]}" ${TIMEOUT_ARGS[@]+"${TIMEOUT_ARGS[@]}"} "$@" "$IMAGE" \
    claude -p "Reply with the single word: pong" --model opus --max-turns 1 --output-format json \
    > "$OUT/$name.json" 2> "$OUT/$name.stderr"
  local code=$?
  echo "  $name: exit=$code result=$(jq -r '.result // .error // "<no result field>"' "$OUT/$name.json" 2>/dev/null | head -c 200 | sed 's/[A-Za-z0-9_-]\{30,\}/<redacted>/g') model=$(jq -r '.modelUsage // {} | keys | join(",")' "$OUT/$name.json" 2>/dev/null)"
}

echo "▸ 1) BASE_URL=Z.ai (이미지 기본값)"
run zai
echo "▸ 2) 대조: BASE_URL 비움 → Anthropic 기본 엔드포인트"
run anthropic-control -e ANTHROPIC_BASE_URL=
echo "▸ 3) 대조: 네트워크 차단 → 엔드포인트 미도달"
run no-network --network none

echo
echo "판정: 1) 과 2) 의 오류 본문이 서로 다르고, 1) 이 Z.ai 쪽 응답이면 라우팅은 맞다. 3) 은 연결 오류(또는 재시도 끝 타임아웃)여야 한다."
echo "기대값 — 1) 가짜 토큰: 401 'token expired or incorrect' · 진짜 키·정상: result 'pong', modelUsage 키 = glm-5.3 · 진짜 키·429 [1113] 'Insufficient balance or no resource package' = 계정·플랜·한도 문제, 라우팅(주소·모델·인증)은 정상 — 콘솔에서 한도·키 소속·국제판/중국판 확인"
echo "원문: $OUT/*.json · *.stderr (토큰은 담기지 않는다 — Claude Code 는 요청 헤더를 출력하지 않는다)"
