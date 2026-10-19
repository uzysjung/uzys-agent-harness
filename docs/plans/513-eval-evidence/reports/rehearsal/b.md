# 26.174.0 · superlight — 묶음 deepswe-swt-v1

- 단계: **superlight** (사전 등록)
- jobs: `/Users/uzysjung/eval-513/rehearsal/b` · 시행 2 · 무효 이동 0 · 생성 2026-10-19T02:32Z
- 결론: **경보 없음** (경보만 — 효과 주장 없음, 설계 §5)

| # | 경보 | 판정 | 근거 |
|---|---|---|---|
| C1 | 하네스가 실렸나 | PASS | B 1/1 일치 |
| C2 | 제출 규율 | PASS | B 0건 · A 0건(참고) |
| C3 | 방해 신호 | 표시만 | A 만 성공 0 · B 만 성공 0 (갈린 과제는 아래 표) |
| C4 | 비용 | N/A | 짝 0 · 시간 B/A 중앙값 — · 입력 토큰 B/A 중앙값 — (WARN > 2.0) |
| C5 | 시간 상한 | PASS | B 0 · A 0 (WARN: B > A + 1) |
| C6 | 측정 안정성 | PASS | 무효 0/2 = 0% (1113·끊김 0 · 인프라 예외 0, WARN > 20%) |

이전 판 대비: 이전 판 기록 없음

## swtbench

| 과제 | 반복 | A 점수 | B 점수 | A 종료 | B 종료 | A 세션 | B 세션 | A 입력토큰 | B 입력토큰 |
|---|---|---|---|---|---|---|---|---|---|
| sympy__sympy-14711 | 1 | 1 | 1 | 스크립트 세션 | 스크립트 세션 | 0m | 0m | — | — |

갈린 과제: 없음

종료 사유 분포:

| 종료 사유 | A | B |
|---|---|---|
| 스크립트 세션 | 1 | 1 |

SWT ΔC(coverage_delta_pred 평균 B − A): 0.00
SWT 보조: A 커밋함 1 · '테스트만' 위반 0 · B 커밋함 1 · '테스트만' 위반 0

성공 1건당 입력 토큰: A 0 · B 0

B 증거 점검(§6):

| job | 팔 | 결과 | 비고 |
|---|---|---|---|
| swtbench-A-r1-sympy__sympy-14711 | A | 일치 | 세션 없음(리허설) — init 점검 생략 |
| swtbench-B-r1-sympy__sympy-14711 | B | 일치 | 세션 없음(리허설) — init 점검 생략 |

## 무효·재실행

- 없음

## 잠금본

```
bundle=deepswe-swt-v1
harness=26.174.0
claude_code=2.1.302
pier=0.3.1
model=glm-5.3
effort=max
max_turns=300
max_budget_usd=1000
base_url=https://api.z.ai/api/anthropic
mult_deepswe=1.0
mult_swtbench=3.0
extra_ak=session=script:/Users/uzysjung/Development/Claude-Workspace/uzysClaudeUniversalEnv/.claude/worktrees/agent-aed53f7b7beb5d6de/docs/plans/513-eval-evidence/rehearsal/commit-test-session.sh
env_file=/Users/uzysjung/eval-513/rehearsal/dummy.env
sha256 1291c7b72d0bf277c3f8036cae7fdb69e0adb248a9554d28545abfd0d182c809  eval_agent.py
sha256 b5cc8639d71feaf4a254a5e23a5f7b671704e6d1ee0b931bcb7ab4956b63a721  eval_common.py
sha256 855ebf919b6e296f1d41785774c46dadd31a712e0634fd9b7ee50e6533e6c7bb  deepswe-hard-v1-order.tsv
sha256 e1d2326e7b68887ffa35fa050f6a4573c0908b933eb5dc0dc0014187ed45b75b  swtbench-verified-order.txt
sha256 236d711319d2c08cf7c2aa76814359c2318a4429f5dfc1087e5414ce7e1d640e  add-worktree-collect.py
```
