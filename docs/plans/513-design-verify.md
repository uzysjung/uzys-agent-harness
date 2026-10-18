# #513 실험 설계 검증 결과 — **BLOCK (BLOCKER 4건 · NOTE 11건)**

- 검증자: design-verifier (읽기 전용, 2026-10-18)
- 대상: `docs/plans/513-effect-eval-design.md` @ `5344551` (`feat/513-effect-eval`) + `docs/plans/513-eval-evidence/`
- 대조한 근거: Pier 0.3.1 설치본 소스(`~/.local/share/uv/tools/datacurve-pier/.../pier/`) · 이 리포 `src/` · `templates/` · `docs/TRACKS.md` · 레인이 남긴 실제 job 산출물(`…/bf8b3ed9…/scratchpad/jobs/eval-513-pier-glm-fake/`) · 레인의 DeepSWE 클론(`…/scratchpad/dl/deep-swe`) · 출처 URL 직접 fetch(DeepSWE 블로그 · tbench.ai · docs.z.ai 3면 · code.claude.com 3면 · HF API · SWE-Atlas raw task.toml) · `pier run --help`
- 프로젝트 파일은 고치지 않았다.

BLOCKER 4건은 전부 수정 규모가 작다. 설계 방향 자체는 이슈 #513 의 원칙(실패 비용 포함 · 공통 성공 짝 시간 · 외부 채점 · 상한 사전 고정 · 합산 금지)을 충실히 옮겼다.

---

## BLOCKER

### B1. 실사용 과제의 A 팔이 이미 하네스를 갖고 있다 — "미설치 vs 설치" 비교가 성립하지 않는다

- **근거**: §5.4 후보 6개 전부 이 저장소의 PR(#833 · #817 · #635 · #543 · #769 · 릴리즈 커밋). 그 PR 들의 base 커밋에는 개발 사본 하네스가 그대로 있다 — `git ls-tree 4dfcf29^ .claude/` → `agents · hooks · rules(6) · settings.json · skills · CLAUDE.md`, 루트 `CLAUDE.md` 도 전체 지시문. 즉 A = "개발 사본 하네스(룰 6 · 훅 3 · 에이전트)" 이고 B = "그 위에 `install --track tooling`" — B 가 재는 것은 하네스 효과가 아니라 **배포판이 개발 사본을 displaced 로 덮어쓴 효과**다. §8 "A 를 약화하지 않는다"의 반대 방향 결함이고, 이슈가 가장 중시한 "작은 변경에서 B 가 일을 키우는가"(§8 마지막 행)를 이 과제군으로는 답할 수 없다.
- **실패 시나리오**: 실사용 6과제의 B−A 차이가 어느 방향이든 "하네스 효과"로 읽히는데, 실제로는 개발 사본(룰 6·훅 3) 과 배포판(룰 6·훅 2·스킬 14·MCP) 의 차이다.
- **고칠 문장(§5.4 선정 규칙 ⓐ 앞에)**: "실사용 과제 저장소는 **에이전트 지시 파일(`CLAUDE.md` · `AGENTS.md` · `.claude/` · `.cursor/` 등)이 없는 공개 저장소**에서 고른다. 이 리포는 자기 자신이 하네스라 A 팔이 성립하지 않으므로 제외한다. 저장소가 선언하는 트랙은 과제를 보기 전에 스택으로 정해 기록한다." 후보를 당장 못 정하면 예비 실험에서 실사용 과제군을 0 으로 두고 DeepSWE·T-Bench 만 돌린다 — 억지로 채우면 결과가 오염된다.

### B2. `git checkout -- .` 가 함께 쓰는 파일의 **하네스 몫**까지 되돌려 B 가 조용히 부분-A 가 된다

- **근거**: 설치기는 루트 `CLAUDE.md` 가 이미 있으면 새로 만들지 않고 **import 블록을 그 파일에 더한다**(`src/project-claude-merge.ts:26-35` `IMPORT_MARKER_START` · `importBlock`). `pier-agent-b.py:56` 의 `git checkout -- .` 는 tracked 파일 전부를 되돌리므로 그 import 줄이 사라지고 `CLAUDE-uzys-harness.md`(앵커 본문)는 영영 로드되지 않는다. `.claude/rules/` · 훅 · 스킬은 남으니 `init.skills` 검사는 통과한다 — **들키지 않는 부분-A** 다. 2026년 상류 저장소에 `CLAUDE.md`/`AGENTS.md` 가 있는 비율은 작지 않다(DeepSWE 91 저장소 중 몇 개인지는 이미지를 받아 봐야 안다 — 미측).
- **같은 경로의 두 번째 결함**: 설치 단계는 **docker build 시점의 `RUN`** 이다(Pier `environments/agent_setup.py:36-43` `dockerfile_install_commands`, 레인 산출물 `agent-build-context/Dockerfile` 로 확인). `exit 97` 은 이미지 빌드 실패 = 환경 오류로 기록되고, §5.3 규칙으로는 "인프라 오류 → 1회 재실행" 뒤 또 실패 → **그 과제가 B 에서만 조용히 빠진다**(선택 편향).
- **고칠 문장(§4.3 전체 교체)**: "설치 뒤 tracked 파일을 되돌리지 않는다. 설치가 고친 tracked 파일(`.gitignore` · 있으면 `CLAUDE.md` · `AGENTS.md`)은 `git update-index --skip-worktree` 로 표시하고, untracked 하네스 경로는 `.git/info/exclude` 에 적는다 — 디스크의 하네스 몫은 그대로 남아 로드되고, `git add .`·`commit -a`·검증기의 `git diff <base> HEAD` 에는 들어가지 않는다. `git status --porcelain` 설치 전후 동일 검사는 유지한다. 검사 실패 = 이미지 빌드 실패이므로 **그 과제는 두 팔 모두에서 제외하고 목록에 적는다** — B 에서만 빠지지 않게 한다."
- **코드(`pier-agent-b.py:56`)**: `git checkout -- .` → `git update-index --skip-worktree .gitignore; for f in CLAUDE.md AGENTS.md; do git ls-files --error-unmatch "$f" >/dev/null 2>&1 && git update-index --skip-worktree "$f"; done`.
- **한계 한 줄(문서에 넣을 것)**: "에이전트가 그 파일을 고의로 고친 변경도 diff 에서 빠진다 — 벤치마크 과제에서는 발생하지 않는 편집이고, `model.patch` 사후 점검으로 확인한다."

### B3. "B 가 실제로 B 였는지" 4항목 중 **ⓐ·ⓑ·ⓒ 가 구조적으로 거짓음성** — 그대로 돌리면 모든 B 실행을 폐기하게 된다

- **근거**:
  - ⓑ `system/init` 에 `hooks` 필드가 **없다**. 레인의 실제 init 이벤트 키 = `additional_directories · agents · analytics_disabled · apiKeySource · capabilities · claude_code_version · cwd · fast_mode_* · mcp_servers · memory_paths · messaging_socket_path · model · original_cwd · output_style · per_turn_effort_active · permissionMode · plugins · product_feedback_disabled · session_id · skills · slash_commands · subtype · terminal_slash_commands · tools · type · uuid · view_mode` (`…/abs-stepped-slices__zq4RduV/agent/claude-code.txt` 첫 줄).
  - ⓒ `hook_response` 이벤트는 `--include-hook-events` 가 있어야 나오는데 Pier 의 실행 명령에는 없고(`agents/installed/claude_code.py:1345-1349` — `claude --verbose --output-format=stream-json --permission-mode=bypassPermissions {extra_flags} --print -- …`), `--ak` 로 더할 수도 없다(`CLI_FLAGS` 폐쇄 목록 `:51-96` — max_turns · reasoning_effort · thinking · thinking_display · max_thinking_tokens · max_budget_usd · fallback_model · append_system_prompt · allowed_tools · disallowed_tools 뿐).
  - ⓐ `/logs/agent/harness-install-record.json` 은 **빌드 시점에 이미지 레이어에** 쓰이는데 `/logs/agent` 는 실행 시 호스트 trial 폴더가 **bind mount** 된다(`environments/docker/docker.py:263-264` `"source": trial_paths.agent_dir … "target": env_paths.agent_dir`) → 가려져서 trial 산출물에 없다. (레인의 `docker-compose-mounts.json` 에는 verifier 마운트만 보이는데 agent 마운트는 다른 compose 조각에서 붙는다 — 코드가 근거.)
  - §10 5 "넷 중 하나라도 어긋나면 결과를 쓰지 않고 멈춘다" → 셋이 항상 어긋난다.
- **고칠 문장(§10 5번 교체)**: "각 B trial 에서 ⓐ `init.skills` 에 하네스 스킬명(`objective-brief` · `audit-harness-fit` 등 설치 기록의 스킬 id 전부) · `init.agents` 에 `reviewer` · `implementer` · `init.mcp_servers` 에 `context7`(status 무관) ⓑ `agent/sessions/projects/-app/*.jsonl`(호스트에 남는다 — 레인 산출물 `agent/sessions/projects/-app/a443ceb1-….jsonl` 로 확인)에 session-start 훅 출력 문자열 `Session started. Branch:` ⓒ `/logs/agent/harness-install-record.json` — 설치 단계가 `/opt/eval-513/` 에 쓰고 B 클래스가 `run()` 을 오버라이드해 `super().run()` 전에 `environment.exec("cp -r /opt/eval-513/. /logs/agent/")` ⓓ A trial 의 같은 자리에 셋 다 없음. 넷 중 하나라도 어긋나면 멈춘다."
- **보조**: `memory_paths` 가 CLAUDE.md 를 열거하는지는 A 실행(CLAUDE.md 없음, `{'auto': …}` 만 관측)만 봐서 모른다 — 스모크에서 확인하고 되면 보조 증거로. 훅 출력이 세션 JSONL 에 어떤 레코드 타입으로 남는지도 스모크에서 확인(A 실행의 레코드 타입: `api-request · system/api_error · attachment · user · assistant · cost-state …`).

### B4. `run-pilot.sh tbench` 가 실행되지 않는다 — Pier 에는 `-d` 가 없다

- **근거**: `pier run --help` 는 `-p/--path`(로컬 task/dataset) · `-i/--include-task-name` · `-x/--exclude-task-name` · `-l/--n-tasks` · `--sample-seed` · `--override-gpus` · `--env-file` · `--agent-import-path` 는 있고 `-d`/`--dataset` 레지스트리 플래그가 **없다**(`cli/jobs.py` 에도 없음). `run-pilot.sh:40` 은 `-d terminal-bench/terminal-bench@4.0.0` 을 조립한다. T-Bench 채점기 대조(`feasibility/tbench-harbor-log-tail.txt`)는 `harbor run -d …` 로 했다 — 그 경로는 커스텀 B 에이전트·`--env-file` 동등성이 미확인이다. §10 스모크(DeepSWE)는 영향 없지만 §9·§10 말미 "권장안으로 가는 데 바뀔 것은 과제 수와 상한값뿐"은 거짓이다.
- **고칠 문장(§3 T-Bench 행 · `run-pilot.sh:40`)**: "Terminal-Bench 는 저장소(`harbor-framework/terminal-bench@2e29ca91`)를 클론해 `pier run -p <clone>/tasks -x fp8-rmsnorm-gemm -x jax-speedrun-gpu -x math-eval-grader --override-gpus 0 …` 로 돈다 — DeepSWE 와 같은 러너 · 같은 B 에이전트 · 같은 env-file 경로. 2단계 첫 확인 항목에 'Pier 로 T-Bench oracle/nop 재대조' 를 추가한다(지금까지의 대조는 harbor 였다)." (`-x` 값이 `terminal-bench/` 접두를 요구하는지는 Pier 로 한 번 돌려 확인.)

---

## NOTE (선택 개선 — 순서는 영향 크기)

- **N1. 토큰 노출 주장 정정(D4 · §1.1 · `pier-claude-code-glm-fake-token.md`)**. Pier 는 에이전트 env 를 `docker compose exec -e KEY=VALUE …` **호스트 프로세스 인자**로 넘긴다(`environments/docker/docker.py:751-753`). `--env-file` 이어도 실행 중 호스트 `ps` 에 토큰이 보인다 — `--ae` 와의 차이는 `pier` 자신의 argv 와 `lock.json`(`models/job/lock.py` `sanitize_cli_invocation`) · `config.json` 마스킹뿐이다. 또 컨테이너 env 에 있으므로 에이전트가 `env` 를 치면 `claude-code.txt` 와 세션 JSONL 에 남는다(레인의 "0회" 는 에이전트가 명령을 한 번도 안 돌린 실행의 관측). → D4 를 "pier argv · lock.json · config.json 에는 안 남는다. 실행 중 호스트 ps 와 컨테이너 env 에는 있다 — 단일 사용자 머신 전제" 로 고치고, §10 7 의 토큰 grep 을 `jobs/` 전체(`sessions/` 포함)로 넓힌다.
- **N2. §1.1 · §12 사실 정정**. Pier 는 apt 계열 이미지에서 Claude Code 를 npm 이 아니라 `curl -fsSL https://claude.ai/install.sh | bash -s -- 2.1.302` 로 설치한다(`claude_code.py:160-166`; npm 은 apk 계열만. 레인의 생성 Dockerfile 로 확인). 하네스는 npm 이 필요하다 — DeepSWE 113 과제 env Dockerfile 전부 `FROM public.ecr.aws/x8v8d7g8/mars-base:latest`(레인 클론 전수) 이고 표본 1개에 node 24 가 있었으니 아마 전부 있지만 **표본 1 의 관측**이다. B2 의 "실패 시 두 팔 제외" 규칙이 이 경우도 덮는다. 설치 단계는 root 로 돈다(`docker.py:385 _resolve_user(None)`, 생성 Dockerfile `USER root`) — `npm install -g` 권한 문제 없음.
- **N3. GLM 단계에서 상한을 고정해 Opus 에 적용하는 것이 §0 ① 의 역할인데, 두 모델의 시간·턴 프로파일이 다르다**(§6.1 ⓑ 가 스스로 인정). DeepSWE 공개판에 `glm-5.3 [max] 69%±3 · $3.99 · 80k 출력` 이 **있다**(블로그 표, 문서 미인용) — Opus 5 74% 와 해결률은 비슷하지만 토큰 프로파일은 다르다. → "상한은 Opus 단계 첫 A 실행 10건(§7.2 의 측정 지점과 같음)의 분포로 고정한다. GLM 단계는 배관·B 로드 확인용." 또 24 과제 A/B 를 함께 돌리면 상한을 정하는 사람이 B 결과도 보게 된다 — 상한용 실행은 **A 만**.
- **N4. §6 표준오차는 합산 n=24 기준인데 §2 는 합산하지 않는다.** 벤치마크별로 적어라: DeepSWE n=12 → SE≈0.20(차이 ≥40%p 라야 보임) · T-Bench 6 · 실사용 6 → ≈0.29. "예비 실험은 효과 주장이 아니다" 는 문장은 그대로 맞다.
- **N5. B 의 상태 = 설치 직후 미채움 스캐폴드**가 하네스의 "실제 쓰임"을 대표하는가 — 사용자 결정 항목으로 올려라(D9). 설치기는 새 `CLAUDE.md` 에 `<!-- FILL: … -->` 절들과 **보이는 배너** "To fill: open this file and paste each `<!-- FILL: … -->` comment's instruction into your coding agent"(`src/project-claude-merge.ts:179`) 를 쓰고, 설치 화면 NEXT/FILL 도 채우라고 안내한다(`feasibility/harness-install-in-deepswe-image.txt`). 즉 B 에이전트는 매 턴 "나를 채우라"는 지시를 읽는다 — 과제 대신 CLAUDE.md 를 채우는 턴은 B 의 비용으로 맞게 집계되지만, 그것은 "제품을 안내대로 안 쓴" 상태의 비용이다. 추천: 예비는 지금대로 설치 직후(사람 손이 안 들어가는 유일한 상태)로 두되, B trial 마다 `.claude/`·`CLAUDE.md` 를 건드린 턴 수를 따로 세어 공개하고, 본실험에서 "설치 + `audit-harness-fit` 1회(일회성 비용 공시)" 팔을 넣을지 그때 정한다. 이슈 본문이 이미 "audit-harness-fit 같은 초기 작업을 무료로 치지 않는다" 고 썼으니 방향은 맞다. `base` 트랙 내용(룰 5 · 에이전트 2 · 훅 2 · 스킬 14 · context7 · CLAUDE.md 스캐폴드 · ci-scaffold)은 `docs/TRACKS.md` · 설치 로그와 일치.
- **N6. context7**. `-p` 에서는 프로젝트 `.mcp.json` 서버를 **묻지 않고 로드**한다(code.claude.com `mcp.md`: "In claude -p runs … Claude Code can't show that prompt: it loads project-scoped servers without asking"). no-network 에서 실패하는 것 · `MCP_TIMEOUT` 기본 30 s(`env-vars.md`) 는 맞다. 첫 턴 대기는 `CLAUDE_CODE_MCP_STARTUP_WAIT_MS`(≥2.1.274)가 정한다 — 설정하지 말고(B 의 비용) `init.mcp_servers[].status` · `mcp_server_errors` 를 trial 마다 기록한다는 문장만 추가. T-Bench(`allow_internet=true`)에서는 Pier 가 egress 프록시를 붙이지 않으니(`docker.py:392`) 작동한다는 문서 주장은 맞다.
- **N7. 시간 정의 불일치**. §2 ③ "지시 전달 → 최종 커밋" 인데 수집하는 값은 Claude Code `duration_ms` 와 Pier 의 에이전트 벽시계(MCP 대기 포함)다. 하나로 못 박아라 — Pier `agent_execution` 시작→종료를 주값, `duration_ms` 보조.
- **N8. 상한 고정 vs `EVAL_*` 환경변수 오버라이드**. §8 "커밋 해시로 고정" 은 스크립트 기본값만 고정한다. 괜찮은 이유 = Pier `config.json` 이 실제 kwargs(`max_turns` 등)를 기록한다(레인 산출물 `config.json` 의 `agents[].kwargs`) — 보고서는 스크립트가 아니라 `config.json` 값을 읽는다고 적어라.
- **N9. 결과 뒤 변경 여지 두 곳**: §7.2 "초과 예상이면 과제 수를 줄이고" → "seed 순서의 **뒤에서부터** 줄이고, B 결과를 보기 전에 정한다"; §3 "언어 편중이면 seed 를 한 번만 바꾼다" → 표본 목록은 **실행 전에** 뽑아 보고 정한다.
- **N10. 출처 표본 대조 결과(모두 일치)**: DeepSWE 블로그 Opus 5 max $11.84 · 118k · 99 스텝 / Fable 5 xhigh $13.41 · 80k · 68 스텝 / "Wall-clock time is no longer reported" ✓ · T-Bench 4.0 "All tasks … flat agent timeout of 8 hours" ✓ · Z.ai 크레딧 Lite 2,000/10,000 · Pro 12,000/60,000 · Max 28,000/140,000 ✓ · 사용 정책 "may only be used within officially supported tools" · 동시성 "Max > Pro > Lite" ✓ · Claude Code 2.0.14 검증 문구 ✓ · HF `gated:false` · license 없음 ✓ · SWE-Atlas `cpus=16 · memory_mb=16384 · allow_internet=true · EVAL_MODEL 기본 anthropic/claude-opus-4-5-20251101` ✓ · cost-tracking "`usage` 는 서브에이전트 제외, `total_cost_usd`·`modelUsage` 포함 · 클라이언트 추정" ✓ · `CLAUDE_CODE_SUBAGENT_MODEL_FORCE`(≥2.1.257) · `CLAUDE_CODE_ALWAYS_ENABLE_EFFORT` · `CLAUDE_CODE_EFFORT_LEVEL` > `--effort` ✓. 내가 안 본 것: GLM 모델 2종 · 오류 1113 · T-Bench 66 과제 수(레인 클론 집계를 신뢰).
- **N11. D8 채점자 = 하네스 작성자**. 팔을 가려도 문체로 알아볼 수 있다. 실사용 과제 판정은 자동 검사(테스트·스크립트)를 주로 하고 사람 판정은 "수정 없이 수용" 한 항목에 **서면 사유**를 붙인다고 적어라.

### 확인해서 문제 없음

성공 1건당 비용의 분모·분자(실패 포함) ✓ · 공통 성공 짝 + 전체 성공률 병기 ✓ · 채점은 별도 컨테이너(Pier `[[verifier.collect]]` = `git diff <base> HEAD`, task.toml 확인) ✓ · `api_retry` 표시·무효 규칙 ✓ · GLM/Opus 분리 ✓ · effort 미전달 처리(§10 3) ✓ · `--bare` 미사용 ✓ · B 의 에이전트 정의는 `model: opus`(`templates/agents/*.md`) 라 Anthropic 단계에서 메인과 같은 Opus 5.5 — §4.4 의 FORCE 는 불필요하나 무해 ✓ · `--ak track=` 은 B 클래스가 소비한 뒤 부모로 간다(`BaseInstalledAgent.__init__` kwargs 처리) ✓ · 설치 단계가 빌드 시점이라 "설치 토큰 비용 0" ✓ · DeepSWE 과제 이미지는 `public.ecr.aws/d3j8x8q7/swe-bench-202605:<id>-v1.1` 핀이라 A/B 사이 드리프트 없음 ✓ · `--env-file` → `load_dotenv(override=True)` → 호스트 env → 에이전트 env(`cli/jobs.py:588`, `claude_code.py:1220-1221`) ✓ · Pier 가 BASE_URL 있으면 `ANTHROPIC_DEFAULT_*_MODEL` + `CLAUDE_CODE_SUBAGENT_MODEL` 을 묶는다(`claude_code.py:1291-1295`) ✓ · `protect-files` 훅은 Write|Edit 만 매치하므로 `go mod tidy` 류 Bash 편집은 안 막는다(B 위험은 직접 편집 때만, 설계대로 B 실패로 집계) ✓.

---

## 더 단순한 대안 (같은 질문에 더 싸게)

1. **GLM 단계를 24 과제 A/B 에서 "배관 스모크 2–4 과제 + 상한용 A 단독" 으로 줄인다.** GLM 결과는 발표하지 않고 Opus 효과도 아니라고 문서가 스스로 말한다 — 그렇다면 48 실행의 가치는 배관 확인뿐이고, 그것은 §10 스모크가 이미 한다. 절약 = GLM 40여 실행 + 401 재시도·effort·usage 불확실성(§1.6) + 약관 질문(D5)의 노출 시간.
2. **첫 유료 신호는 실사용 과제(B1 수정 뒤 저장소) Opus 6–10 과제 A/B** 로 — 과제당 $1–4 · 5–30분이라 전체 $30–80. NORTH_STAR §1 의 주장("필요한 틀만 남겨 생산성을 높인다")이 가장 직접 걸리는 곳이고, 하네스가 **방해하는** 방향은 작은 표본에서도 보인다(30%p 문턱은 대칭이다).
3. **DeepSWE 공개판 `glm-5.3 69%` · `opus-5 74%` 를 A 의 외부 기준점으로** 적어 두면(비용 0) A 자체가 이상하게 낮게 나올 때 배관 결함을 먼저 의심할 수 있다 — 단 mini-swe-agent 수치라 비교가 아니라 경보용.

---

## 사용자 결정 항목(§11) 의견

| # | 의견 |
|---|---|
| D1 예산 | 권장안 금액 자체는 타당하나 **구성을 바꾸라**: GLM 은 스모크(대안 1), Opus 24 과제 중 실사용 6 은 B1 해결 뒤에만. 미해결이면 DeepSWE 12 + T-Bench 6 = 18 과제로 시작 |
| D2 모델·effort | Opus 5.5 high 두 팔 동일 — 동의. DeepSWE 리더보드가 max 인 것은 비교 대상이 아니니 상관없다 |
| D3 Anthropic 인증 | API 키 — 동의(`total_cost_usd` 가 과금 가격표와 같아지는 유일한 경로) |
| D4 GLM 토큰 | env-file — 동의하되 N1 대로 "`--ae` 는 ps 에 보이므로 쓰지 않는다 / env-file 은 인자에 안 남는다" 를 "pier argv·lock·config 에 안 남는다; 실행 중 ps·컨테이너 env 에는 있다" 로 고쳐라 |
| D5 약관 | 저위험 가정에 동의 — Claude Code 는 공식 지원 도구이고 `-p` 도 같은 바이너리, 동시 1–2 는 Pro 권장 범위 안. 다만 대안 1 로 노출 시간을 줄이는 쪽이 더 낫다 |
| D6 공개 | 동의 |
| D7 QnA | 본실험 결정으로 미루는 것 동의. QnA 의 "소스 변경 = 실패" 는 B2 의 skip-worktree 구조가 그대로 덮는다 |
| D8 채점자 | 사용자 채점 가능하되 N11 조건(자동 검사 우선 · 서면 사유) 추가 |
| **D9(신규)** | B 의 상태: 설치 직후 미채움 vs 설치 + `audit-harness-fit` 1회. 예비는 전자로, 후자는 본실험 팔 후보 — N5 |

---

## 판정

**`BLOCK`** — B1(실사용 저장소 교체) · B2(`git checkout -- .` → skip-worktree + 두 팔 제외 규칙) · B3(B 증거 4항목 교체 + `/opt/eval-513` 경유 복사) · B4(T-Bench 러너 `-p` 경로) 를 반영한 뒤 재검토는 **바뀐 절(§4.3 · §5.4 · §10 5 · `pier-agent-b.py` · `run-pilot.sh`)만** 보면 된다. 네 건 모두 설계 방향이 아니라 배선·근거의 결함이라 수정 diff 는 작다.
