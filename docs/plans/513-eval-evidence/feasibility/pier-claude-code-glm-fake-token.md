# Pier `claude-code` 에이전트 → Z.ai 가짜 토큰 — 실제 예비 실행 경로의 무료 리허설 (2026-10-18)

명령 (호스트, Docker Desktop arm64 · 과제 이미지 amd64 에뮬레이션):

```
pier run -p dl/deep-swe/tasks/abs-stepped-slices -a claude-code -m glm-5.3 \
  --ae ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic --ae ANTHROPIC_AUTH_TOKEN=<fake-token> \
  --ae ANTHROPIC_DEFAULT_OPUS_MODEL=glm-5.3 --ae API_TIMEOUT_MS=20000 --ak version=2.1.302 \
  -o jobs --job-name eval-513-pier-glm-fake -n 1 -q -y --agent-timeout-multiplier 0.06
```

결과 (전체 6분 3초 — 에이전트 이미지 빌드 + 설치 포함):

| 관측 | 값 |
|---|---|
| Claude Code 설치 | 과제 컨테이너 안에 npm 으로 **2.1.302** (`system/init` 의 `claude_code_version`) |
| 모델 | `init.model = glm-5.3` (Pier 가 `-m` 을 `ANTHROPIC_MODEL` + `ANTHROPIC_DEFAULT_*_MODEL` 로 전개) |
| 실행 명령 | `claude --verbose --output-format=stream-json --permission-mode=bypassPermissions --disallowedTools EnterPlanMode --print -- '<instruction.md>' 2>&1 </dev/null \| tee /logs/agent/claude-code.txt` |
| 네트워크 | 트라이얼 폴더에 `docker-compose-egress-proxy.json` · `egress-proxy/` — Pier 가 BASE_URL 호스트(`api.z.ai`)만 허용하는 egress 프록시를 붙였다 |
| 응답 | `api_retry` **10회**, 전부 `error_status 401 · authentication_failed`. 최종 `result`: `"Failed to authenticate. API Error: 401 token expired or incorrect"` · `is_error true` · `num_turns 1` · `duration_ms 181482` |
| Pier 판정 | `NonZeroAgentExitCodeError` (exit 1) → `exception.txt` · `agent_result` 토큰·비용 전부 0 · 검증기는 그래도 돌아 reward 0 (f2p 0/6 · p2p 6/6) |
| 토큰 노출 | `config.json` 에 `"ANTHROPIC_AUTH_TOKEN": "fake****eck"` (마스킹). `claude-code.txt` · `trial.log` · `result.json` 에 토큰 문자열 **0회**. 단 `--ae KEY=VALUE` 는 **호스트 프로세스 인자**에 값이 남는다(`ps`) — 진짜 키는 `--env-file` 로만 넘긴다(`run-pilot.sh`) |

뜻: 예비 실험이 실제로 탈 경로(Pier → 과제 컨테이너 → Claude Code 2.1.302 → Z.ai)는 끝까지 이어진다. 남은 미확인 = 진짜 키로 Z.ai 가 `usage` 를 Anthropic 형식으로 돌려주는가, `--effort` 가 전달되는가(설계 §10 2–3번).

부작용: Z.ai 의 401 은 Claude Code 에서 **재시도 가능 오류**로 분류돼 3분을 쓴다(Anthropic 의 401 은 즉시 종료). 진짜 키로 한도(1113)나 인증 오류를 만나면 그 실행의 시간은 오염된다 — `api_retry` 이벤트가 있는 실행은 시간 집계에서 표시한다(설계 §5.3).
