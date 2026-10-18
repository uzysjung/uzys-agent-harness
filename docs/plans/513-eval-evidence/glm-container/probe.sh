#!/usr/bin/env bash
# 컨테이너 안에서 엔드포인트 도달성만 본다 (가짜 토큰). 토큰 값은 출력하지 않는다.
set -u
body='{"model":"glm-5.3","max_tokens":5,"messages":[{"role":"user","content":"hi"}]}'
echo "## z.ai x-api-key"
curl -sS -m 20 -w "\nhttp=%{http_code} time=%{time_total}\n" -X POST https://api.z.ai/api/anthropic/v1/messages \
  -H "x-api-key: fake-token" -H "anthropic-version: 2023-06-01" -H "content-type: application/json" -d "$body" | head -c 400; echo
echo "## z.ai bearer"
curl -sS -m 20 -w "\nhttp=%{http_code} time=%{time_total}\n" -X POST https://api.z.ai/api/anthropic/v1/messages \
  -H "Authorization: Bearer fake-token" -H "anthropic-version: 2023-06-01" -H "content-type: application/json" -d "$body" | head -c 400; echo
echo "## anthropic x-api-key"
curl -sS -m 20 -w "\nhttp=%{http_code} time=%{time_total}\n" -X POST https://api.anthropic.com/v1/messages \
  -H "x-api-key: fake-token" -H "anthropic-version: 2023-06-01" -H "content-type: application/json" \
  -d '{"model":"claude-opus-5-5","max_tokens":5,"messages":[{"role":"user","content":"hi"}]}' | head -c 400; echo
