# B 팔 리허설(trial 안 정리 · 3차 검증 B1 분리 뒤) · 가짜 토큰 · 2026-10-18

명령: PYTHONPATH=. pier run -p dl/deep-swe/tasks/abs-stepped-slices --agent-import-path pier_agent_b:HarnessedClaudeCode --ak track=base -m glm-5.3 --ak reasoning_effort=high --ae ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic --ae ANTHROPIC_AUTH_TOKEN=<fake> --ae API_TIMEOUT_MS=20000 --ak version=2.1.302 --agent-timeout-multiplier 0.12

## Pier 결과
┡━━━━━━━━━━━━━━━━━━━━━━━━━━━╇━━━━━━━┩
│ NonZeroAgentExitCodeError │     1 │
└───────────────────────────┴───────┘
Job Info
Total runtime: 8m 13s
Results written to jobs/eval-513-pier-glm-fake-B3/result.json
Inspect results by running `pier view jobs`
env PYTHONPATH=. pier run -p dl/deep-swe/tasks/abs-stepped-slices   --ak  -m   4.42s user 2.35s system 1% cpu 8:15.83 total
exit 0

## trial 폴더 agent/ · agent/prep/
fill-count.txt
git-repo.txt
harness-git-status-diff.txt
harness-git.txt
harness-install-record.json
harness-install.log
head-before.txt
prep
prep-infra-error.txt
setup
status-after.txt
status-before.txt
--
prep-prompt.txt
prep-timing.txt
session-1-retry.json
session-1-retry.stderr
session-1.json
session-1.stderr
sessions

## 3차 B1 — 집계 분리 확인
agent/sessions/projects/-app/*.jsonl (과제 세션; 정리 실패로 과제 세션은 없었다 → 0 기대): 0
agent/prep/sessions/projects/-app/*.jsonl (정리 세션 jsonl → 2 기대: session-1 + retry): 2
result.json agent_result.n_agent_steps (0 기대 — 분리 전 B2 는 2): "n_agent_steps": 
"n_agent_steps":    [B2: "n_agent_steps": 2
"n_agent_steps": 2]
trajectory.json steps 수 (0 기대): n/a

## 정리 구간 타이밍(prep-timing.txt) — 재실행은 -retry 접미(3차 N1)
session-1 exit=1 wall=183s fill=7
session-1-retry exit=1 wall=192s fill=7

## 실패 규칙 발화
prep session 1: api/infra error twice — rerun this trial for BOTH arms (§5.3)

## session-1.json / session-1-retry.json 핵심 필드 (첫 시도 JSON 이 보존된다)
session-1.json {'is_error': True, 'api_error_status': 401, 'terminal_reason': 'api_error', 'num_turns': 1, 'duration_ms': 176007}
session-1-retry.json {'is_error': True, 'api_error_status': 401, 'terminal_reason': 'api_error', 'num_turns': 1, 'duration_ms': 181227}

## 설치 단계 증거
git-repo: yes
after-install 7
skip-worktree .gitignore
head-before: cb1b3b671d0e…
status-diff bytes:        0

## 과제 세션(돌지 않아야 한다): claude-code.txt 없음(기대) · exception: Command failed (exit 96)

## A trial 에는 prep 폴더가 없다: 0

## 토큰 유출 검사(check-token-leak.sh, 가짜 토큰 값)
token-leak files=0 (control=1 ok)

## 보충 — n_agent_steps 원문(B3)
 null,
agent/trajectory.json 존재: 0 (정리 jsonl 이 Pier 집계 경로 밖이라 trajectory 자체가 만들어지지 않았다 — 분리 전 B2 는 steps 4 · n_agent_steps 2)
