# #513 실행기 인계 (설계 5차 c88614e 대상 · 2026-10-19)

코드: `eval_agent.py`(EvalClaudeCode) · `eval_common.py`(CLAUDE.md·기대값, Pier 무의존) · `run-tier.sh` · `report.py` · `add-worktree-collect.py` · `test_report.py` · `rehearsal/` · `expected/import-block-26.174.0.txt`.
`pier_agent_b.py` · `run-pilot.sh` · `run-full.sh` 는 옛 시행의 재현 기록이라 남겼다(새 실행기는 참조하지 않는다).

## 임의로 정한 가정·기본값
- CLAUDE.md 형식 = `## Goal\n\n<목표>\n\n## Stack\n\n<스택>\n`(H1 없음, 영어 제목). 상류 CLAUDE.md 가 있으면 그 아래에 빈 줄 하나 + 원문. SWT 저장소 = instance id 의 `owner__repo-번호` → `owner/repo`.
- ③ exclude 대상 = **①직전 대비 ②직후 `git status --porcelain -uall` 에 새로 나온 경로 전부**(추적 → skip-worktree · 미추적 → `/경로` exclude). 설치 기록 경로 목록을 따로 읽지 않는다 — git 이 채점 diff 에 넣을 수 있는 것은 정확히 이 집합이고, 두 팔이 같은 규칙이 된다. 설치 기록은 증거로 복사만.
- B 빌드: 하네스를 `/opt/eval-513/harness` 전용 prefix 에 깔고 래퍼 `/opt/eval-513/bin/agent-harness` 로만 부른다(과제 세션 PATH 에 안 들어감). 이미지에 Node ≥20 이 없으면 Node 22.11.0 을 `/opt/eval-513/node` 에 받는다(SWT 이미지). A 이미지에는 아무것도 더하지 않는다.
- 실행기 자신의 git 명령은 `git -c safe.directory='*'` — 과제 세션이 보는 전역 git 설정은 바꾸지 않는다.
- 과제 폴더는 `trial/config.json` 의 `task.path` 에서 읽는다(Trial.run() 이 에이전트 실행 전에 씀) — `--ak task_dir` 을 따로 넘기면 `-i` 와 어긋날 수 있어서.
- 동시 2 = **같은 과제·반복의 A·B 를 동시에**(bash 3.2 라 `wait -n` 없음 · 짝 안에서 제공자 부하 상쇄). 풀 방식보다 느릴 수 있다(짝마다 느린 쪽을 기다림).
- 잠금본 = `ROOT/lock.txt`(모델·effort·상한·배율·Pier·Claude Code·base_url·`eval_agent.py`/`eval_common.py`/순서 파일 sha·extra_ak·env-file 경로). 다르면 exit 4 — 실행기 코드를 고치면 앞 시행을 재사용할 수 없다(의도). ROOT 기본 = `~/eval-513/jobs-v1/<판>`.
- 무효 재실행 상한: 1113 → 30분 대기 × 12회 · 결과 없이 끊김 → 2회. 그 밖의 예외(빌드 실패 등)는 시행으로 남고 리포트가 "인프라 오류"로 C6 에 센다.
- 이미지 삭제: 과제마다 trial 이미지 + `hb__<과제>*` + 과제 원본 이미지(DeepSWE `docker_image` · SWT `FROM`). 원본 이미지 digest 는 시행 **전에** `docker buildx imagetools inspect` 로 레지스트리에서 읽어 `ROOT/image-digests.tsv` 에(Pier 의 `down --rmi all` 이 끝에 지워 로컬 inspect 로는 못 읽었다 — 리허설 실측 "absent").
- 검증기 시간 초과 + 빈 패치 = "제출 없음 → 0점"(리포트가 인프라 무효로 세지 않고, run-tier.sh 도 다시 돌지 않는다 — 조정자 지시). 패치가 있는데 검증기 시간 초과면 "인프라 오류"(C6).
- 종료 사유: "백그라운드 대기 중 종료" = 메인 스레드 마지막 assistant 메시지 **뒤** 에 `task_updated killed`(옛 bandit·obsidian B 는 killed 가 result 줄 **앞** 에 찍혔다 — 설계 문구 "result 직후" 와 순서가 다름). 제출이 있어도 이 사유가 우선한다(제출 여부는 따로 표기).
- "SWT 커밋함" 은 종료 사유 칸이 아니라 별도 표기(보조 지표 "SWT 커밋 수")로 냈다 — 종료 사유와 겹칠 수 있어서.
- "테스트만" 위반 = 패치 파일 중 경로에 `tests/`·`test/`·`testing/` 이 없고 이름이 `test_*`·`*_test.py`·`tests.py`·`conftest.py` 가 아닌 것이 하나라도.
- C3(라이트) 는 두 벤치마크를 합친 짝으로 센다. C4 "끝까지 간 과제" = 두 팔 모두 스스로 끝냄(제출·미제출·백그라운드). 세션 시간 = 실행기가 잰 ⑤ 시작~finally(시간 상한이면 상한까지).
- 효과 판정 Holm: 부트스트랩 양측 p(Δ* ≤0 / ≥0 비율의 2배)에 Holm 을 걸고, "더 잘 푼다" 는 CI 하한 > 0 **그리고** Holm 통과. 부트스트랩 seed 513.

## 정답이 갈릴 수 있는 지점
- SWT 시간 상한에서 docker exec 취소는 컨테이너 안 claude 를 멈추지 않는다 → SWT finally 가 comm=claude 프로세스를 kill -9 한 뒤 reset 한다. DeepSWE 는 설계대로 정규화가 없어 **남은 claude 가 collect 중에도 돌 수 있다**(Pier 기본 동작 · 두 팔 같음).
- B 의 `.gitignore` 는 skip-worktree 라 채점 diff 에는 안 들어가지만 하네스가 더한 무시 줄(`.env` 등)은 작업 트리에서 계속 효력이 있다 — B 가 만든 `.env` 는 채점 패치에서 빠진다(설치자가 겪는 것과 같은 효과로 봤다).
- C1 의 B sha 기대값은 `expected/import-block-<판>.txt` 로 고정한다. 26.174.0 블록은 리허설 (a) B 의 실제 설치 결과에서 뽑았다(같은 판 npm 패키지). 판이 바뀌면 고정 파일이 없어 구조 검사(A 본문 + `@CLAUDE-uzys-harness.md` 블록)로 내려간다 — 새 판은 리허설 (a) 로 먼저 고정하는 것이 맞다.

## 설계와 다르게 한 곳
- 설계 §3 "③ … 설치 기록의 하네스 경로 전부" → git status 차이로 대체(위 가정 2번째 줄). 리허설 (a) B 실측: git 차이 62경로 = 설치 기록의 경로 전부(policy·skill·root·external·앵커, `.gitignore` 포함) + 기록에 없는 `CLAUDE.md` · `.uzys-agent-harness/.harness-install.json`(기록 파일 자신). 기록에만 있고 차이에 없는 경로 0.
- 리허설 전용 kwarg 두 개(`session=script:<경로>` · `normalize=off`) — run-tier.sh 는 `EVAL_EXTRA_AK` 로만 넘기고 잠금본에 남긴다.

## 리허설 결과(2026-10-19, 산출물 `~/eval-513/rehearsal/{a,b,c-off,c-timeout}` · 리포트 `reports/rehearsal/*.md`)
- (a) DeepSWE superjson A·B: 세션 직전 CLAUDE.md sha = 기대값(A `c1b55e56…` · B 는 고정 블록 기준 일치) · B 설치 기록·import 블록 있음 · 채움 틀 0 · `status-at-start` 두 팔 모두 빈 상태로 동일 · worktree.patch 수집됨(0바이트 — CLAUDE.md·하네스 파일이 안 들어감).
- (b) SWT sympy-14711 A·B(테스트 쓰고 커밋): 정규화 뒤 채점 패치 = 테스트 파일 하나뿐(하네스 60경로·CLAUDE.md·`.gitignore` 없음) · reward 1·1. 실행기가 임시 index 로 만든 패치와 검증기 출력의 패치가 바이트 동일.
- (c) 정규화 끔(A): 실행기 패치 0바이트 → 검증기 1차 시간 초과(빈 지시어로 전체 스위트) → Pier 재시도는 1차가 `rm -rf /testbed/*` 로 바꿔 놓은 트리에서 돌아 "테스트 파일 삭제" 패치를 채점 → FAILED · reward 0 (검증기 1212초). 켬 = (b) reward 1.
- (c′) 시간 상한(배율 0.05 = 60초, 커밋 뒤 600초 대기 세션): AgentTimeoutError 뒤에도 finally 가 돌아 reset --soft · 패치 412바이트 · reward 1.
- 채점 소요(테스트가 든 패치): SWT 검증기 12초(A·B) · DeepSWE 14–15초. 1200초와 거리가 멀어 `--verifier-timeout-multiplier` 는 올리지 않았다.
- 유출: `check-token-leak.sh` glm.env · 더미 env 모두 0(대조군 1). 남은 컨테이너·이미지 0.

## 미심쩍은 부분
- SWT 빈 패치는 검증기 1200초 초과 → Pier 재시도 1회로 시행 하나가 최대 ~40분(nop 확인 42분) — §1 소요 추정에 없다. 또 SWT 검증기 **재시도는 1차가 망가뜨린 /testbed 에서 돈다**(위 (c)) — 패치가 있는 시행이 시간 초과하면 그 재시도 점수는 믿을 수 없어 "인프라 오류"로 둔다.
- `evidence_check` 의 실제 세션 경로(system/init 스킬·에이전트, jsonl `Session started. Branch:`)는 모델 호출 없는 리허설로는 돌지 않았다 — 옛 B 시행에서 필드 이름만 확인했다. 슈퍼라이트 첫 결과에서 C1 비고를 본다.
- `run-tier.sh` 의 `record_digest`(레지스트리 digest)와 `finished` 로그 줄은 리허설 **뒤**에 넣었다 — 리허설 실행은 그 전 판으로 돌았고 digest 명령은 손으로만 확인했다(두 과제 이미지 모두 sha256 이 나옴).
- `background_killed` 는 Claude Code 2.1.302 의 stream-json 모양에 묶여 있다. 판을 올리면 옛 결과로 만든 시험(test_report.py)이 먼저 깨지는지 본다.
- 리포트의 "이전 판 대비" 는 index.md 에서 같은 단계의 다른 판 마지막 줄을 그대로 옮길 뿐이다(수치 비교 아님).

## 리허설 재현 (모델 호출 없음 — 더미 env-file, 세션 = 스크립트)
```
H=docs/plans/513-eval-evidence; R=~/eval-513/rehearsal; printf 'ANTHROPIC_AUTH_TOKEN=rehearsal-dummy-token-not-a-key-513\n' > $R/dummy.env
X="EVAL_ENV_FILE=$R/dummy.env"
# (a) DeepSWE 1과제 A·B
env $X EVAL_JOBS_ROOT=$R/a EVAL_BENCHES=deepswe EVAL_N_DEEPSWE=1 EVAL_EXTRA_AK="session=script:$PWD/$H/rehearsal/noop-session.sh" bash $H/run-tier.sh superlight 26.174.0
# (b) SWT 1과제 A·B — 테스트를 쓰고 커밋하는 세션, 정규화 켬
env $X EVAL_JOBS_ROOT=$R/b EVAL_BENCHES=swtbench EVAL_N_SWT=1 EVAL_EXTRA_AK="session=script:$PWD/$H/rehearsal/commit-test-session.sh" bash $H/run-tier.sh superlight 26.174.0
# (c) 음성 대조 — 같은 세션, 정규화 끔 (켬 = (b))
env $X EVAL_JOBS_ROOT=$R/c-off EVAL_BENCHES=swtbench EVAL_N_SWT=1 EVAL_ARMS=A EVAL_EXTRA_AK="session=script:$PWD/$H/rehearsal/commit-test-session.sh normalize=off" bash $H/run-tier.sh superlight 26.174.0
# (c′) 시간 상한에서도 finally 정규화 — run-tier.sh 는 배율이 고정이라 pier 를 직접
PYTHONPATH=$H pier run -p ~/eval-513/swtbench/tasks/swtbench-verified -i sympy__sympy-14711 --agent-import-path eval_agent:EvalClaudeCode -m glm-5.3 --ak version=2.1.302 --ak harness=off --ak bench=swtbench --ak session=script:$PWD/$H/rehearsal/commit-then-hang-session.sh --env-file $R/dummy.env --agent-timeout-multiplier 0.05 -n 1 -y -o $R/c-timeout --job-name swtbench-A-r1-sympy__sympy-14711
# (d) 리포트 · 유출 · 단위 시험
for c in a b c-off c-timeout; do python3 -I $H/report.py $R/$c superlight 26.174.0 --out $H/reports/rehearsal/$c.md --no-index; done
bash $H/check-token-leak.sh ~/eval-513/glm.env $R; bash $H/check-token-leak.sh $R/dummy.env $R/a $R/b $R/c-off $R/c-timeout
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest $H/test_report.py
```
