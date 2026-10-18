# #513 실험 설계 재검증(3차) — **BLOCK (BLOCKER 3건 · NOTE 9건)**

- 검증자: design-verifier (읽기 전용, 2026-10-18)
- 대상: `docs/plans/513-effect-eval-design.md` @ `c828c41` (`feat/513-effect-eval`) — 범위는 2차 이후 바뀐 곳: `pier_agent_b.py` · `run-pilot.sh` · `check-token-leak.sh` · `sample513.py` · 설계 §3 · §4.4 · §5.3 · §5.4 · §10
- 직접 대조한 근거: Pier 0.3.1 설치본(`~/.local/share/uv/tools/datacurve-pier/lib/python3.12/site-packages/pier/` — `agents/installed/claude_code.py` · `agents/installed/base.py` · `trial/trial.py` · `pier run --help`) · 1차 레인의 실제 trial 산출물(`…/bf8b3ed9…/scratchpad/jobs/eval-513-pier-glm-fake-B2/abs-stepped-slices__ztqjmJQ/` — `result.json` · `agent/trajectory.json` · `agent/sessions/projects/-app/*.jsonl` · `agent/prep/*` · `verifier/reward.json` · `config.json`; A 대조 = `eval-513-pier-glm-fake/`) · 레인 클론 `dl/deep-swe/tasks/abs-stepped-slices/environment/Dockerfile` · 이 리포 `.claude/hooks/docker-only-realcli.sh` · `templates/skills/audit-harness-fit/references/populate.md` · `check-token-leak.sh` 를 임시 폴더에서 실행(두 가지 입력)
- 프로젝트 파일은 고치지 않았다.

요약: **2차 BLOCKER 7건은 모두 해소됐다**(코드와 리허설 산출물이 일치한다 — §1). 새 구조(trial 안 정리)는 2차가 지적한 네 결함을 실제로 없앴고, 정리 세션이 과제 정보를 볼 길도 코드·이미지·egress 세 겹으로 막혀 있다. 그러나 **정리 비용이 Pier 의 `result.json` 에 과제 비용과 섞인다**(실측으로 확인 — BLOCKER 1) 와 **§10 을 순서대로 치면 8번이 항상 "유출 1"** 로 끝나고(실측 — BLOCKER 2) **5번의 45분 상한이 설계 자체의 정리 시간 추정(15–45분)과 충돌**(BLOCKER 3)한다. 셋 다 수정은 한두 줄이다.

---

## 1. 2차 BLOCKER 해소 판정 (코드 ↔ 리허설 산출물 직접 대조)

| 건 | 판정 | 내가 직접 확인한 것 |
|---|---|---|
| **B1** prep.tar 키 잘림 · '설치만 한 B' 분기 | **해소** | `pier_agent_b.py` 에 `prep.tar` · `task_id` · `prep_dir` 참조 0건(`grep`). `run()` 은 정리 → 재적용 → `super().run()` 단일 경로(180–220행) — 조건 분기로 다른 B 가 되는 자리가 없다. 설계 본문의 `prep.tar` 언급은 §4.4 170행 · §14 450행의 이력 서술만 |
| **B2** T-Bench `/app` 비-git | **해소** | `_git_guard()`(62–64행)가 `git -C /app rev-parse --git-dir` 로 감싼다 — `install_spec()` 의 `git_part` · `git_after`, `run()` 의 재적용 모두 통과. 비-git 은 `git-repo: no`(102행). 리허설 `agent/git-repo.txt` = `git-repo: yes`. §3 T-Bench 행 = **0**(예비 밖) · `run-pilot.sh:43` 은 본실험용으로 남김 |
| **B3** 정리 실패 삼킴 · `-uall` · 겹쳐 풀기 | **해소** | 세션마다 `ok`(type=result · !is_error · num_turns>0 · exit 0) 판정(188행) → API/인프라면 1회 재실행(191–199) → 그래도면 `prep-infra-error.txt` + `exit 96`(197–198) · 그 밖은 `prep-failed.txt` + `exit 95`(200–202). `git status --porcelain -uall` 3곳(87 · 93 · 209행). tar 없음. **리허설 실측**: `prep-timing.txt` 2줄(`session-1 exit=1 wall=184s` · `187s`) → `prep-infra-error.txt` 존재 → `exception.txt` `Command failed (exit 96)` → `claude-code.txt` 없음(과제 세션 미실행) → **`verifier/reward.json` = `{"reward": 0, …}`** — Pier `trial/trial.py:973–1010` 이 `NonZeroAgentExitCodeError` 를 잡아 로그 내려받고 **검증기를 그대로 돌린다**. 즉 "exit 95 → reward 0 = B 실패 집계" 가 코드로 성립한다 |
| **B4** 정리가 네트워크 열린 컨테이너 | **해소** | 정리 세션이 `exec_as_agent` 로 과제 컨테이너 안에서 돈다(150행). 리허설 trial 에 `egress-proxy/` · `docker-compose-egress-proxy.json` 존재, 정리 세션이 **Z.ai 의 401 본문**(`token expired or incorrect`)을 받았다 = 허용 호스트로만 나갔다. DeepSWE 이미지는 `git remote remove origin` + 미래 커밋·태그 gc(`environment/Dockerfile` 7–15행) → 정답이 git 히스토리에도 없다 |
| **B5** 토큰 grep 이 토큰을 안 봄 | **해소**(단 §10 8 의 호출이 새 결함 — BLOCKER 2) | `check-token-leak.sh:12` `cut -d= -f2-` 로 값 추출 · `grep -rlF -- "$tok"` · 대조군 심은 파일 1 요구(16–19행). 임시 폴더 실측: 심은 파일 1 · 깨끗한 `jobs/` 0 |
| **B6** §10 순서 · 과제 id | **해소** | §10 2 가 클론 → `EVAL_TASKS` 고정, 5 가 실행. `run-pilot.sh:24` 가 `EVAL_TASKS` 없으면 exit 3, `:46` 이 `-i` 로 변환(`pier run --help` 에 `--include-task-name -i` 확인). `deepswe-seed513-sample.txt` 의 12개 = §3 목록 12개(순서 포함 동일) · §10 `EVAL_TASKS` = 그 앞 2개 |
| **B7** R4 cobra 04-24 · structlog 06-01 | **해소** | `realuse-repo-survey.sh:7·37` 이 `MERGED_AFTER=2026-07-01` 로 `mergedAt` 을 거른다. `realuse-repo-survey.md` 표: `spf13/cobra` · `hynek/structlog` = `-`, `go-chi/chi #1159 → #843 · 2026-08-27`. §5.4 표 R4 = chi · §3 "R1 · R2 · R4 · R7 · R8 · R9" |

2차 NOTE 중 코드로 닫은 것도 확인: N3 `modelUsage`(§2 ②′ · §4.4) ✓ · N4 95/96/97 파일로 구별 ✓ · N5 `chmod -R a+rwX` 하네스 파일 전부(110행) ✓ · N6 `SHARED_TRACKED` 에 `.mcp.json`(56행) ✓ · N8 `prep-b.sh` 삭제 ✓.

---

## 2. BLOCKER (새 구조에서 생긴 결함)

### BLOCKER 1. 정리 세션의 토큰·스텝이 Pier `result.json` 의 **과제 비용에 합산**된다 — `CLAUDE_CONFIG_DIR` 를 과제 세션과 같은 곳에 두기 때문

- **근거(코드)**: `pier_agent_b.py:144` `env["CLAUDE_CONFIG_DIR"] = …/sessions`(주석: "과제 세션과 같은 곳 → 세션 jsonl 이 함께 남는다"). Pier 는 trial 끝에 `populate_context_post_run()`(`claude_code.py:1114–1144`) → `_get_session_dir()`(`:201–240`, `sessions/projects/*/` 아래 `*.jsonl` 의 부모 디렉터리 하나) → `_convert_events_to_trajectory()`(`:708` **`session_dir.glob("*.jsonl")` 전부**)로 trajectory 를 만들고 `final_metrics` 를 `agent_result`(`n_input_tokens` · `n_output_tokens` · `cost_usd` · `n_agent_steps`)에 넣는다. 정리 세션 3개 jsonl 이 같은 `projects/-app/` 에 있으니 **전부 합산**된다.
- **근거(실측)**: 리허설 B2 trial 은 과제 세션이 돌지 않았는데(`claude-code.txt` 없음) `result.json` `agent_result.n_agent_steps = 2`, `agent/trajectory.json` `steps` 4개 = 정리 세션 2회의 user/agent 턴(메시지 = `Use the audit-harness-fit skill …` / `Failed to authenticate…`), `final_metrics.total_steps 4`. 토큰이 0 인 것은 401 때문이고, 진짜 키에서는 정리 3회의 입력·출력 토큰이 그대로 `agent_result` 에 들어간다.
- **실패 시나리오**: §10 7 "`result.json` → `agent_result.{n_input_tokens, n_output_tokens, cost_usd}`(과제 세션)" 과 `run-pilot.sh:16` "과제 세션의 Claude Code result 에서 Pier 가 채운다" 가 **거짓**이다. summarize.sh 가 이 값을 ② 의 과제 비용으로 읽으면 B 의 과제 비용에 도입 비용이 섞여 ② 와 ②′ 의 구분(§2 · 이슈 원칙)이 무너진다. 부수 효과로 Claude Code **자동 메모리**(`projects/-app/memory/`, 두 팔 `init.memory_paths` 에 실측)도 정리 세션 → 과제 세션으로 넘어간다 — 하네스 파일이 아닌 상태가 B 에만 전달된다.
- **고칠 코드(`pier_agent_b.py`)** — 정리 세션만 설정 디렉터리를 가른다. Pier 의 집계는 `sessions/projects/` 만 보므로 `prep/sessions/` 는 자동으로 빠진다:
  ```python
  PREP_DIR = f"{AGENT_LOGS}/prep"
  PREP_CONFIG_DIR = f"{PREP_DIR}/sessions"   # Pier 집계(claude_code.py:201·708) 밖 — 정리 jsonl 은 여기 남는다
  …
  async def _prep_session(self, environment, i, env):
      env = {**env, "CLAUDE_CONFIG_DIR": PREP_CONFIG_DIR}
      …
  ```
  `_claude_env()` 144행 주석은 "과제 세션과 같은 값 — 정리 세션은 `_prep_session` 이 `PREP_CONFIG_DIR` 로 바꾼다" 로.
- **고칠 문장**: §4.4 "모델 일관성" 끝에 — "단 `CLAUDE_CONFIG_DIR` 만 `agent/prep/sessions` 로 분리한다. Pier 가 `agent/sessions/projects/*/` 의 jsonl **전부**를 trajectory·`agent_result` 로 합산하므로(`claude_code.py:708`) 같은 곳에 두면 정리 토큰이 과제 비용에 섞인다(리허설 B2: 과제 세션 없이 `n_agent_steps 2`). 분리하면 Claude Code 자동 메모리도 정리→과제로 넘어가지 않아 B 가 과제 세션에 가져가는 것은 디스크의 하네스 파일(채워진 `CLAUDE.md` 포함)뿐이다." §10 6ⓑ — "정리 세션 jsonl 은 `agent/prep/sessions/projects/-app/`, 과제 세션 jsonl 은 `agent/sessions/projects/-app/`(B 1개 · A 1개 — `Session started. Branch:` 는 B 의 과제 세션 jsonl 에만)". §10 7 첫 항목 — "(과제 세션 — 정리 세션은 `prep/sessions` 로 분리돼 Pier 집계 밖)". `run-pilot.sh:16` 주석도 같은 뜻으로. ⓔ 의 "정리가 과제보다 먼저" 는 두 폴더의 jsonl 시각으로 그대로 본다.
- 대안(자동 메모리 전달을 B 의 일부로 보고 싶다면): 공유 디렉터리를 유지하고 summarize.sh 가 `prep/session-*.json` 의 `modelUsage` 를 `agent_result` 에서 **빼는** 길 — 집계 코드가 늘고 `n_agent_steps` 등은 분리할 수 없다. 권하지 않는다.

### BLOCKER 2. §10 8 의 유출 검사 명령이 **항상 "유출 1 · exit 1"** 을 낸다 — 검사 대상 `~/eval-513` 안에 env-file 자체가 있다

- **근거**: §10 1 이 `~/eval-513/glm.env` 를 만들고, §10 8 이 `check-token-leak.sh ~/eval-513/glm.env ~/eval-513` 로 **그 상위 폴더**를 검사한다. `grep -rlF -- "$tok" ~/eval-513` 은 `glm.env` 를 찾는다. **실측**(임시 폴더 — `glm.env` + 깨끗한 `jobs/x.txt`): 상위 폴더 → `token-leak files=1 (control=1 ok)` exit 1 / `jobs/` 만 → `files=0` exit 0.
- **실패 시나리오**: 메인 세션이 8번에서 "유출 있음" 을 보고 결과를 `pilot-smoke/` 로 복사하지 못하거나, 거꾸로 "env-file 때문이겠지" 하고 1 을 무시하는 습관이 생겨 진짜 유출 1 도 넘어간다. `run-pilot.sh:69` 는 이미 `$JOBS` 로 좁혀 안내한다 — 문서가 스크립트와 어긋났다.
- **고칠 문장(§10 8)**: 
  ```
  bash docs/plans/513-eval-evidence/check-token-leak.sh ~/eval-513/glm.env ~/eval-513/jobs /tmp/eval-513-smoke
  ```
  (3번 스모크 산출물 `/tmp/eval-513-smoke/*.json|*.stderr` 도 진짜 키로 돈 세션 출력이라 함께 본다.) 
- **고칠 코드(`check-token-leak.sh`, 13행 뒤)** — 같은 실수를 스크립트가 거절한다:
  ```bash
  envabs="$(cd "$(dirname "$ENV_FILE")" && pwd -P)/$(basename "$ENV_FILE")"
  for d in "$@"; do
    dabs=$(cd "$d" 2>/dev/null && pwd -P) || continue
    case "$envabs" in "$dabs"/*) echo "env-file 이 검사 대상 안에 있다($d) — 항상 1 이 난다. jobs/ 처럼 산출물 폴더만 준다" >&2; exit 3;; esac
  done
  ```

### BLOCKER 3. §10 5 의 벽시계 상한 45분(`EVAL_AGENT_TIMEOUT_MULT=0.25`)은 설계 자신의 정리 시간 추정(세션 5–15분 ×3 = **15–45분**)과 충돌한다 — B 의 과제 세션이 시작조차 못 하면 스모크의 목적(§10 6 ⓐ–ⓔ)이 성립하지 않는다

- **근거**: §7.2 299행 "정리 세션 5–15분 ×54" · §4.4 정리 세션 턴 60 ×3 · §10 5 "상한: 벽시계 45분(10800×0.25 — B 의 정리 3세션 포함) · 과제 세션 턴 60". Pier 의 상한은 `execution.run_agent` 의 `asyncio.wait_for` 가 **`run()` 전체**(정리+과제)를 감싼다(리허설 traceback `execution.py:254`). 정리가 추정 상단(45분)이면 과제 세션 0분, 중앙(30분)이어도 GLM 60턴 과제에 15분. 타임아웃이면 `claude-code.txt` 가 없어 ⓐ(`init.skills`) · ⓔ(정리가 과제보다 먼저) 를 확인할 수 없고, §10 6 규칙대로 "멈춘다" → 크레딧만 쓰고 다시 돈다.
- **고칠 문장(§10 5)**: `EVAL_AGENT_TIMEOUT_MULT=0.5` 로 바꾸고 상한 줄을 "벽시계 **90분**(10800×0.5 — B 는 정리 3세션 15–45분 추정(§7.2)을 이 안에 포함하므로 0.25(45분)로는 과제 세션이 시작 못 할 수 있다) · 과제 세션 턴 60 · 정리 세션 턴 60 ×3 · 동시 1" 로. 비용 상한은 턴(60+180)이 이미 맡고 있어 벽시계를 늘려도 크레딧 상한은 그대로다. 스모크 뒤 실측 정리 시간으로 권장안의 `0.67` 이 충분한지 §5.1 에 적는다.

---

## 3. 질문별 판정 (요청 2 · 3)

**정리 세션이 과제 정보를 보는가 → 보지 못한다(코드 · 이미지 · 네트워크 세 겹).** ⓐ 지시문: Pier 는 `instruction` 을 `trial.py:316 → execution.run_agent → agent.run(instruction, …)` 인자로만 넘기고 컨테이너에 파일로 쓰지 않는다; `run()` 180–217행은 `instruction` 을 참조하지 않고 220행 `super().run()` 에만 넘긴다. 정리 세션의 argv 는 `PREP_PROMPT` 고정(162행). ⓑ 환경: 정리 시점 컨테이너에는 `/app`(시작 커밋) · `/logs/agent/{setup, 설치 증거}` 만 — `tests/` · `solution/` 은 검증 컨테이너로만 간다(oracle 대조로 확인된 사실 그대로). env 는 `_claude_env()` 가 조립한 것만(모델·토큰·설정 경로). ⓒ 히스토리·네트워크: DeepSWE 이미지는 `git checkout -B <default> $BASE_SHA` + `git remote remove origin` + 미래 브랜치·태그 삭제 + `gc --prune=now`(Dockerfile 7–15행) → `git log --all` 로도 정답이 없다; egress 는 API 호스트만(B4). 남는 것은 `/app` 자체이고 그것은 과제 세션도 똑같이 본다.

**정리가 바꾼 파일이 채점 diff 에 들어가는가 → 들어가지 않는다.** 정리가 만지는 `CLAUDE.md` · `.claude/` · `.uzys-agent-harness/` 는 untracked → `.git/info/exclude`(92행) 라 `git add .`/`-A` 에서 빠지고, `git add CLAUDE.md` 를 명시해도 excluded 경로는 `-f` 없이 거부된다; 상류에 tracked 로 있던 `CLAUDE.md` · `.gitignore` · `.mcp.json` · `AGENTS.md` 는 skip-worktree 라 `git add` 가 변경을 보지 않는다. 정리 뒤 재적용(208행)과 `status-before` 대조(209–216행)가 하네스 밖 변경을 잡아 exit 95. 사각 하나 = **커밋**(NOTE 2) — `git status` 는 커밋된 변경을 보지 못한다.

**정리·설치가 에이전트의 소스 변경을 숨기는가 → 두 축으로, 둘 다 좁다.** ⓐ skip-worktree 4 파일 + exclude 8 경로를 과제 중 에이전트가 고치면 diff 에서 빠진다(§4.3 한계에 이미 적혀 있다). ⓑ **새로 적어야 할 축**: 설치가 `.gitignore` 에 더한 패턴(`.env` · `.factory/` · `.goose/` · `*.backup-…` — `harness-install-in-deepswe-image.txt` 의 diff)이 과제 세션 동안 **살아 있다**. 에이전트가 과제상 `.env` 를 만들어 커밋하려 하면 ignore 되고(B 의 `protect-files` 훅도 막는다 — §4.5 가 "B 의 실패" 로 정의) 그 파일은 diff 에서 빠진다. DeepSWE 채점은 테스트라 영향이 거의 없지만 §4.3 한계 문장에 이 패턴 목록을 더해야 "한계 한 줄" 이 완전해진다(NOTE 3).

**정리 실패 규칙의 비대칭·편향 → 규칙은 대칭이고 집계 방향도 맞다; 비용·분산만 B 쪽이 크다.** exit 96(API/인프라) → 양팔 재실행 = §5.3 제공자 오류 행과 같은 처리 ✓(A 의 성공 결과도 버리고 다시 뽑으므로 기대값 편향은 없다). exit 95(제품) → B reward 0 ✓(D9 취지). 타임아웃이 정리 중에 와도 §5.3 첫 행으로 B 실패 ✓. 비대칭은 **노출량**이다 — B 는 trial 당 API 의존 세션이 4개라 "양팔 재실행" 이 더 자주 걸리고, GLM 5시간 크레딧 창을 B 가 먼저 소진할 확률이 높다. 편향이 아니라 비용·시간 문제이므로 §5.3 에 한 줄 공시(NOTE 8). 분류 사각 하나: JSON 이 전혀 없는 실패(`_exit_nonzero and not type`, 178행)를 전부 인프라로 본다 — Claude Code 가 하네스 훅 때문에 비정상 종료하는 B 고유 결함이 있다면 인프라로 둔갑한다. `session-{i}.stderr` 가 남으므로 사후 판별은 가능(NOTE 9).

**정리 비용이 과제 비용과 섞이는가 → 섞인다(BLOCKER 1).** 벽시계 쪽(`agent_execution` − `prep-timing.txt`)은 설계대로 분리되지만, 토큰·스텝 쪽은 Pier 집계가 jsonl 을 전부 합친다. 분리 뒤에는 `prep/session-*.json` 의 `modelUsage` = 도입 비용, `result.json`/`claude-code.txt` = 과제 비용으로 깨끗하게 갈린다.

**§10 스모크를 키 파일만 받은 메인 세션이 그대로 치면** — 1 ✓ · 2 ✓(클론 → `EVAL_TASKS`; `run-pilot.sh:41` 기본 경로 `~/eval-513/deep-swe/tasks` 와 일치) · 3 ✓ **단** 스크립트가 이미지를 스스로 빌드하므로(`smoke-glm.sh:27`, §13 에서 지운 이미지가 문제되지 않는다) 통과하나, 기대 항목 "`init.model` 이 `glm-5.3`" 은 `--output-format json`(`:36`) 에는 `init` 이벤트가 없어 확인 불가(NOTE 6) · 4 선택 · 5 **BLOCKER 3**(상한) — 그 밖은 통과: `pier run --help` 에 `-i · -x · -n · -y · --job-name · --env-file · --agent-import-path · --override-gpus` 전부 존재, `PYTHONPATH` 상대경로는 `cd` 뒤 리포 루트 기준이라 맞고, `--env-file` 값은 `cli/jobs.py:584` `load_dotenv` → `os.environ` → `base.py:257 _get_env` 로 정리 세션에도 같은 경로로 닿는다(리허설은 `--ae` = `_extra_env` 경로였지만 `_get_env` 가 둘을 함께 본다). 이 리포의 `docker-only-realcli.sh` 훅은 `agent-harness … install` · `claude plugin install` 이 명령 텍스트에 있을 때만 막으므로 `bash …/run-pilot.sh …` · `bash …/smoke-glm.sh …` 는 통과한다 · 6 ✓(ⓐ–ⓔ 가 리허설 산출물과 일치; BLOCKER 1 반영 시 ⓑ 경로 문구만 수정) · 7 **BLOCKER 1**(`agent_result` 가 과제 세션이라는 서술) · 8 **BLOCKER 2**.

---

## 4. NOTE (선택 개선 — 문장·diff 포함)

- **N1. 재실행이 첫 시도의 세션 JSON 을 덮어쓴다.** `_prep_session(environment, i, env)` 를 같은 `i` 로 다시 부르면(192행) `session-{i}.json` · `.stderr` 가 덮인다 — 리허설: `prep-timing.txt` 2줄, `session-1.json` 1개. "API 오류라 재실행했다" 의 증거(`api_error_status`)가 사라진다. diff: `_prep_session(self, environment, i, env, attempt=1)` · `out = f"{PREP_DIR}/session-{i}{'' if attempt == 1 else '-retry'}.json"`(stderr 도 같이), 재호출은 `attempt=2`. §10 7 정리 구간 항목에 "`session-{i}-retry.json` 이 있으면 그 세션은 API 오류로 1회 재실행된 것".
- **N2. 정리가 커밋을 만들면 status 대조가 보지 못한다.** `populate.md:88` 은 커밋을 범위 밖으로 두지만 `bypassPermissions` 모델이 하는 일을 막지는 않는다. 설치 단계에 `git rev-parse HEAD > {EVIDENCE_DIR}/head-before.txt;` 를 `git_part` 에 더하고, `run()` 2) 에서 `[ "$(git rev-parse HEAD)" = "$(cat {AGENT_LOGS}/head-before.txt)" ] || echo 'prep made a commit'` 를 상태 대조와 같이 exit 95 사유로. 한 줄이고, 그러면 §4.4 "다르면 정리가 소스를 건드린 것" 이 커밋까지 참이 된다.
- **N3. §4.3 한계에 `.gitignore` 추가 패턴을 적는다.** "설치가 `.gitignore` 에 더한 `.env` · `.factory/` · `.goose/` · `.uzys-agent-harness/…` · `*.backup-…` 패턴은 과제 세션 동안 유효하다 — 에이전트가 그 이름의 파일을 만들면 커밋·diff 에서 빠진다(벤치마크 채점은 테스트라 영향 없음, `protect-files` 훅 차단은 §4.5 대로 B 의 실패)."
- **N4. `hook-blocks.log` 기준선.** 정리 세션이 `protect-files` 에 걸리면 그 줄이 과제 세션의 "훅 차단 수"(§2 원인 분석용)에 섞인다. `run()` 2) 끝에 `wc -l < .uzys-agent-harness/hook-blocks.log 2>/dev/null > {PREP_DIR}/hook-blocks-after-prep.txt` 한 줄 — summarize 가 뺀다.
- **N5. `_claude_env()` 가 부모와 두 키 다르다.** 부모 `run()`(`claude_code.py:1217–1228`)은 `FORCE_AUTO_BACKGROUND_TASKS=1` · `ENABLE_BACKGROUND_TASKS=1` 을 넣는데 `_claude_env()` 126–131행에는 없다. §4.4 "그 trial 의 env 를 그대로" 를 참으로 하려면 두 줄 추가(`env` dict 에 `"FORCE_AUTO_BACKGROUND_TASKS": "1", "ENABLE_BACKGROUND_TASKS": "1"`).
- **N6. §10 3 의 `init.model` 확인은 `json` 출력에서 불가.** `smoke-glm.sh:36` 은 `--output-format json` — `init` 은 stream-json 이벤트다(1차 스모크 `glm-routing-smoke.md:15` 는 stream-json 으로 봤다). 문장을 "`modelUsage` 의 키가 `glm-5.3` 하나인지 확인" 으로 바꾸거나 스크립트를 `stream-json` 으로. 또 `API_TIMEOUT_MS=20000`(`:33`)은 가짜 토큰용 값이라 진짜 키 + GLM 기본 `reasoning_effort=max` 에서 첫 응답이 20초를 넘기면 `pong` 대신 타임아웃이 난다 — 진짜 키일 때는 이미지 기본값(3,000,000)을 쓰도록 `[ -n "$ENV_FILE" ] || …` 로 가른다.
- **N7. §3 "T-Bench 0" 과 어긋난 문장 4곳.** §0 추천 ②③(39행) "DeepSWE 12 + T-Bench 6" · §6(261행) "T-Bench n=6 → 0.29" · §6.1(269행) "같은 24 과제" · D1(402행) "DeepSWE 12 + T-Bench 6 = 18 과제". 전부 "DeepSWE 12" · "18 과제(실 6 · DS 12)" · "n=12 → 0.20" 으로 §3 과 맞춘다 — D1 은 사용자가 읽는 결정 표라 먼저 고친다.
- **N8. §5.3 공시 한 줄.** "B 는 trial 당 API 의존 세션이 4개(정리 3 + 과제 1)라 인프라 오류로 양팔 재실행이 걸리는 빈도와 GLM 크레딧 소진이 A 보다 잦다 — 편향은 아니고(재실행은 양팔) 비용·벽시계에 든다. 재실행 횟수를 팔별로 보고한다."
- **N9. `_is_api_or_infra` 의 "JSON 없음 = 인프라".** 178행. B 고유 원인(훅 스크립트 오류 등)으로 Claude Code 가 JSON 없이 죽으면 인프라로 분류돼 양팔 재실행이 된다. `session-{i}.stderr` 에 `claude: command not found`/OOM 류가 없는데 JSON 도 없으면 사람이 본다 — §10 7 정리 구간 항목에 "`prep-infra-error.txt` 가 있으면 `session-*.stderr` 로 원인이 인프라인지 먼저 확인" 한 줄.

### 확인해서 문제 없음

`exec_as_agent(command="exit 95/96")` 가 `NonZeroAgentExitCodeError` 로 올라가 trial 이 멈추고 검증기가 돈다(96 리허설 · 95 는 같은 경로) ✓ · `_sh` 가 `; true` 로 끝나는 명령만 받아 정리 세션의 exit 1 이 예외로 새지 않는다(리허설 `exit=1` 두 번 뒤 코드가 계속 진행) ✓ · `ok` 판정(`type=result` · `!is_error` · `num_turns>0` · exit 0) 이 401 세션을 실패로 잡았다 ✓ · 재적용의 `git update-index` 는 에이전트 사용자로 돌지만 A 의 에이전트도 같은 사용자로 `commit` 하므로 `.git` 쓰기 권한은 전제에 들어 있다 ✓ · `chmod -R a+rwX` 는 x 비트가 없던 파일에 x 를 주지 않아 git 모드 변경을 만들지 않는다(그래서 chmod 가 status 대조 뒤에 와도 안전) ✓ · `_skip_worktree_cmd` 의 `git ls-files --error-unmatch` 가 untracked 를 건너뛰어 상류 파일이 없을 때 `|| true` 로 조용하다 ✓ · `config.json` 에 `kwargs {track, reasoning_effort, version}` 과 마스킹된 토큰이 남는다(§5.1 N8 · D4 서술과 일치) ✓ · A 리허설 trial 에 `prep/` 없음 · `Session started` 0 ✓ · §4.4 FILL 수 7 = `fill-count.txt` `after-install 7` ✓ · 자산 변경 규칙(`change-management`) 범위 — 이 PR 은 `docs/plans/` 만 건드린다 ✓.

---

## 5. 판정

**`BLOCK`** — BLOCKER 1(정리 세션 `CLAUDE_CONFIG_DIR` 를 `agent/prep/sessions` 로 분리 — Pier 가 jsonl 을 합산한다, 실측) · 2(§10 8 검사 대상을 `~/eval-513/jobs /tmp/eval-513-smoke` 로 — 지금은 env-file 을 찾아 항상 1, 실측) · 3(§10 5 `EVAL_AGENT_TIMEOUT_MULT=0.5` — 설계 자체의 정리 추정 15–45분이 45분 상한을 먹는다). 셋 다 한두 줄이고 리허설 재실행은 BLOCKER 1 만 필요하다(가짜 토큰으로 `agent/prep/sessions/projects/-app/*.jsonl` 생성 · `agent/sessions/` 비어 있음 · `result.json n_agent_steps 0` 을 보면 된다). 재검토는 `pier_agent_b.py` `_prep_session` · `check-token-leak.sh` · §4.4 모델 일관성 · §10 5/6ⓑ/7/8 만 보면 된다.
