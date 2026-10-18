# GLM 라우팅 스모크 (가짜 토큰, 2026-10-18) — 이미지 eval-513-glm (Claude Code 2.1.302 · 하네스 26.174.0 · node:22-bookworm-slim, linux/arm64)

## 1) ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic · ANTHROPIC_AUTH_TOKEN=<가짜> · API_TIMEOUT_MS=20000 · --model opus (→ ANTHROPIC_DEFAULT_OPUS_MODEL=glm-5.3)
stream-json 이벤트 (init 제외, uuid·session_id 생략):
{"type":"system","subtype":"api_retry","attempt":1,"max_retries":10,"retry_delay_ms":562,"error_status":401,"error":"authentication_failed"}
{"type":"system","subtype":"api_retry","attempt":2,"max_retries":10,"retry_delay_ms":1181,"error_status":401,"error":"authentication_failed"}
{"type":"system","subtype":"api_retry","attempt":3,"max_retries":10,"retry_delay_ms":2420,"error_status":401,"error":"authentication_failed"}
{"type":"system","subtype":"api_retry","attempt":4,"max_retries":10,"retry_delay_ms":4340,"error_status":401,"error":"authentication_failed"}
{"type":"system","subtype":"api_retry","attempt":5,"max_retries":10,"retry_delay_ms":8276,"error_status":401,"error":"authentication_failed"}
{"type":"system","subtype":"api_retry","attempt":6,"max_retries":10,"retry_delay_ms":16421,"error_status":401,"error":"authentication_failed"}
{"type":"system","subtype":"api_retry","attempt":7,"max_retries":10,"retry_delay_ms":38580,"error_status":401,"error":"authentication_failed"}
{"type":"system","subtype":"api_retry","attempt":8,"max_retries":10,"retry_delay_ms":35263,"error_status":401,"error":"authentication_failed"}


init 이벤트: "model":"glm-5.3" · "apiKeySource":"none" · "claude_code_version":"2.1.302"
stderr: [claude-code:unrecognized_model] {"model":"glm-5.3","query_source":"sdk"}
debug 로그 (API 줄만):
2026-10-18T02:17:30.734Z [ERROR] API error (attempt 1/11): 401 401 {"error":{"message":"token expired or incorrect","type":"401"}}
2026-10-18T02:17:31.363Z [ERROR] API error (attempt 2/11): 401 401 {"error":{"message":"token expired or incorrect","type":"401"}}
2026-10-18T02:17:32.607Z [ERROR] API error (attempt 3/11): 401 401 {"error":{"message":"token expired or incorrect","type":"401"}}
2026-10-18T02:17:35.101Z [ERROR] API error (attempt 4/11): 401 401 {"error":{"message":"token expired or incorrect","type":"401"}}
2026-10-18T02:17:39.509Z [ERROR] API error (attempt 5/11): 401 401 {"error":{"message":"token expired or incorrect","type":"401"}}
2026-10-18T02:17:47.857Z [ERROR] API error (attempt 6/11): 401 401 {"error":{"message":"token expired or incorrect","type":"401"}}
2026-10-18T02:18:04.391Z [ERROR] API error (attempt 7/11): 401 401 {"error":{"message":"token expired or incorrect","type":"401"}}
2026-10-18T02:18:43.049Z [ERROR] API error (attempt 8/11): 401 401 {"error":{"message":"token expired or incorrect","type":"401"}}
→ 100초 timeout 으로 종료(exit 124). 요청은 Z.ai 에 도달했고 Z.ai 가 401 을 냈다. Claude Code 는 이 401 을 재시도 가능으로 보고 최대 10회 지수 백오프로 재시도한다(attempt 1/11 … 8/11 까지 관측).

## 2) 대조: ANTHROPIC_BASE_URL= (비움) → Anthropic 기본 엔드포인트 (--bare, 가짜 토큰)
{'is_error': True, 'result': 'Failed to authenticate. API Error: 401 Invalid bearer token', 'terminal_reason': 'api_error', 'num_turns': 1, 'duration_ms': 297, 'total_cost_usd': 0}
→ 즉시 종료(exit 1). 오류 본문이 1) 과 다르다(Anthropic 형식 'Invalid bearer token' vs Z.ai 형식 'token expired or incorrect') = BASE_URL 이 실제로 적용됐다.

## 3) curl 직접 대조 (같은 컨테이너, 가짜 토큰) — probe.sh
## z.ai x-api-key
{"error":{"message":"token expired or incorrect","type":"401"}}
http=401 time=0.085607

## z.ai bearer
{"error":{"message":"token expired or incorrect","type":"401"}}
http=401 time=0.071502

## anthropic x-api-key
{"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"},"request_id":"req_011Cg8uTtm97CyeNJ3KVwk4q"}
http=401 time=0.231251

