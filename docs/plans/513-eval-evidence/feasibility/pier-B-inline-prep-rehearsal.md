# B 팔 리허설(2차 구조 — 정리를 trial 안에서) · 가짜 토큰 · 2026-10-18

명령: PYTHONPATH=. pier run -p dl/deep-swe/tasks/abs-stepped-slices --agent-import-path pier_agent_b:HarnessedClaudeCode --ak track=base -m glm-5.3 --ak reasoning_effort=high --ae ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic --ae ANTHROPIC_AUTH_TOKEN=<fake> --ae API_TIMEOUT_MS=20000 --ak version=2.1.302 --agent-timeout-multiplier 0.12

## Pier 결과
┡━━━━━━━━━━━━━━━━━━━━━━━━━━━╇━━━━━━━┩
│ NonZeroAgentExitCodeError │     1 │
└───────────────────────────┴───────┘
Job Info
Total runtime: 7m 51s
Results written to jobs/eval-513-pier-glm-fake-B2/result.json
Inspect results by running `pier view jobs`
env PYTHONPATH=. pier run -p dl/deep-swe/tasks/abs-stepped-slices   --ak  -m   3.64s user 1.71s system 1% cpu 7:53.20 total
exit 0

## trial 폴더 agent/ · agent/prep/
fill-count.txt
git-repo.txt
harness-git-status-diff.txt
harness-git.txt
harness-install-record.json
harness-install.log
prep
prep-infra-error.txt
sessions
setup
status-after.txt
status-before.txt
trajectory.json
--
prep-prompt.txt
prep-timing.txt
session-1.json
session-1.stderr

## 정리 구간 타이밍(prep-timing.txt) — 세션별 exit · 벽시계 · FILL 수
session-1 exit=1 wall=184s fill=7
session-1 exit=1 wall=187s fill=7

## 실패 규칙 발화 — prep-infra-error.txt / prep-failed.txt
prep session 1: api/infra error twice — rerun this trial for BOTH arms (§5.3)

## session-1.json 의 핵심 필드
{'type': 'result', 'is_error': True, 'api_error_status': 401, 'terminal_reason': 'api_error', 'num_turns': 1, 'duration_ms': 184464, 'total_cost_usd': 0}

## 설치 단계 증거(빌드 시점 → /logs/agent 복사)
git-repo: yes
after-install 7
skip-worktree .gitignore
status-diff bytes:        0

## 과제 세션이 돌았는가(돌지 않아야 한다 — 정리 실패로 exit 96)
claude-code.txt: 없음(기대)

## exception.txt 요지
Command failed (exit 96)

## 세션 jsonl (정리 세션들) — Session started 훅 출력 횟수
71e6c4fd-4306-4709-8453-567afec68979.jsonl: 3
d1fc0c5b-b864-45f7-a9e9-15b76cb0695e.jsonl: 3

## A trial(1차 리허설)에는 prep 폴더가 없다
0

## egress 프록시(정리도 같은 정책)
docker-compose-egress-proxy.json
egress-proxy

## 토큰 유출 검사(check-token-leak.sh, dummy.env 의 가짜 토큰)
token-leak files=0 (control=1 ok)
