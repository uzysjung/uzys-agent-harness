# #513 1단계 — 하네스 효과 측정: 실행 가능성 조사와 예비 실험 설계

- 작성 2026-10-18 · 설계 레인(단일 에이전트 · `src/` 무수정 · 유료 실행 0회) · 브랜치 `feat/513-effect-eval`
- 입력: 이슈 #513 본문(사용자 리서치 2026-09-21) · 사용자 추가 요구(GLM Coding Plan 실행 환경 · 키는 env-file · 제한 스모크 절차) · `docs/NORTH_STAR.md` §1 · `docs/USAGE.md` · `docs/TRACKS.md` · `src/manifest.ts` · `test/docker/`
- 증거: `513-eval-evidence/` — `sources.md`(출처 33건 · 확인일) · `feasibility/`(채점기 대조 · 자원표 · 라우팅 스모크 · 하네스 설치/skip-worktree 관측 · Pier A/B 리허설 · 실사용 저장소 조사) · `glm-container/`(Dockerfile · 스크립트) · `pier_agent_b.py` · `run-pilot.sh` · `realuse-repo-survey.sh`
- 독립 설계 검증: 1차 `docs/plans/513-design-verify.md`(BLOCKER 4 · NOTE 11) · 2차 `513-design-verify-r2.md`(BLOCKER 7 · NOTE 9 — 1차 해소 확인) · 3차 `513-design-verify-r3.md`(BLOCKER 3 · NOTE 9 — 2차 해소 확인, trial 내 정리의 집계 분리). 전부 반영했다 — 반영 대조표는 §14.
- 2026-10-15 에 같은 작업이 한도로 중단돼 산출물이 없었다 — 이 문서는 처음부터 다시 썼고, 절마다 push 한다.

---

## 0. 결론 먼저

**실험 질문** — 같은 모델·같은 Claude Code 판에서 이 하네스를 설치하면(B) 미설치(A)보다 필요한 품질의 작업을 더 높은 확률로, 더 적은 총비용·시간으로 완성하는가.

**실행 가능성 판정 (이 머신 · Docker Desktop 6 CPU / 8 GB · arm64, 2026-10-18 실측)**

| 벤치마크 | 로컬 실행 | 채점기 대조(정답 통과 · 빈 변경 실패) | 걸림돌 |
|---|---|---|---|
| **DeepSWE v1.1** (113) | **가능** — Pier 0.3.1 + Docker. 과제 이미지는 linux/amd64 (에뮬레이션, 2.76 GB) | **통과** — oracle `reward 1` (f2p 6/6 · p2p 6/6) · nop `reward 0` (f2p 0/6 · p2p 6/6). 각 1.5분 | 과제가 2 CPU / 8 GB 를 요구 → 로컬 동시 실행은 1~2개. 에이전트 네트워크는 BASE_URL 호스트만 |
| **Terminal-Bench 4.0** (66) | **CPU 과제 63개 가능** — 저장소 클론 + **Pier** `-p`(Harbor 와 같은 결과, B4). GPU 과제 3개(`fp8-rmsnorm-gemm` · `jax-speedrun-gpu` · `math-eval-grader`)는 제외 | **통과** — `sound-change-cascade` oracle `1` · nop `0` — Harbor 로도, **Pier 로도** 각 1분 | 16 CPU / 16–32 GB 과제 14개는 로컬 불가(Modal 필요). 공식 상한 8시간 — 자체 상한을 둔다 |
| **실사용 과제** (공개 저장소) | **후보 10 확보** — 지시 파일 없는 공개 저장소 18곳 중 "이슈를 닫고 테스트를 바꾼 머지 PR" 이 있는 14곳(§5.4). 대조군: 같은 검사가 이 리포에서는 `CLAUDE.md · .claude` 를 찾았다 | hidden test(PR 의 테스트 변경) + 기존 스위트 — DeepSWE 와 같은 구조. 컨테이너 재현은 2단계 첫 확인 | 이 리포 자체는 A 팔이 성립하지 않아 제외(B1) |
| **SWE-Atlas-QnA** (124) | **로컬 부적합** — 모든 과제가 16 CPU / 16 GB 를 요구. 공식 권장은 Modal | **미실행** — 채점이 LLM(Opus 4.5)이라 oracle 대조도 유료 | 코드 변경 시 실패 처리 → B 의 하네스 파일을 채점 diff 에서 빼는 절차가 필수(§4.3). 예비 실험에서 제외, 본실험에서 Modal 로 |
| **GLM 실행 컨테이너** `eval-513-glm` | **준비됨** — Claude Code 2.1.302 + 하네스 26.174.0, 토큰은 `--env-file` 로만 | **라우팅 확인** — 가짜 토큰이 Z.ai 에 도달해 Z.ai 형식 401(`token expired or incorrect`)을 받았고, BASE_URL 을 비운 대조는 Anthropic 형식 401(`Invalid bearer token`)을 받았다 | Claude Code 가 Z.ai 의 401 을 재시도 가능으로 보고 **10회 지수 백오프(3분)** 로 재시도한다 → 인증·한도 오류가 시간 지표를 오염시킨다(§8) |
| **예비 실행 경로 리허설** (Pier → DeepSWE 컨테이너 → Claude Code → Z.ai) | **끝까지 이어짐** — Pier 가 amd64 과제 컨테이너에 Claude Code 2.1.302 를 설치하고 `api.z.ai` 만 허용하는 egress 프록시로 실행 | 가짜 토큰이라 401×10 뒤 `NonZeroAgentExitCodeError` — Pier 가 실패를 기록하고 검증기는 reward 0 을 냈다. 토큰은 로그에 0회, `config.json` 에는 마스킹 | 6분(이미지 빌드 포함). 진짜 키로 남은 확인 = `usage` 형식 · effort 전달(§10) |
| **B 팔 리허설 — trial 안 정리 3회**(2차 구조 · 3차 B1 분리 뒤 재실행) | **정리 구간이 과제 세션보다 먼저 돈다** — 설치 단계(빌드) → `agent/prep/session-1.json` · `session-1-retry.json` … | 가짜 토큰: 정리 세션 1 이 401(API 오류) → 규칙대로 **1회 재실행** → 다시 401 → `agent/prep-infra-error.txt` + exit 96, 과제 세션은 돌지 않음(`claude-code.txt` 없음). 정리 jsonl 은 `agent/prep/sessions/` 에, `agent/sessions/` 는 비어 Pier `agent_result.n_agent_steps = 0`(분리 전에는 2 — 3차 B1). FILL 수 after-install **7**(6절 + 배너 1). A trial 에는 `prep/` 없음 | 세션당 3분(10회 재시도). 진짜 키에서 세션이 성공하면 3회 뒤 과제 세션으로 이어진다 — 그 경로는 2단계 첫 실행에서 본다 |
| **진짜 키 라우팅 스모크**(메인 세션 실행) | **라우팅·인증 정상** — Z.ai 가 `429 · [1113] Insufficient balance or no resource package` 를 돌려줬다(401 아님 = 키 인증 통과) | usage 0 · `duration_ms 179768`(Claude Code 가 1113 을 재시도 가능으로 보고 약 3분). `API_TIMEOUT_MS=20000 · timeout 90` 조합은 결과 없이 exit 124 → 스크립트를 400초·기본 타임아웃으로 고침 | 1113 의 원인(한도 · 키 소속 · 국제판/중국판)은 사용자가 콘솔에서 확인 중(§10 3) |

**1회 실행(과제 1개 · 팔 1개) 추정** — Anthropic 종량 · Opus 5.5 · effort high: DeepSWE **$6–15 · 20–60분**, Terminal-Bench **$5–15 · 20–90분**, 실사용 과제 **$1–4 · 5–30분**. 근거는 §7 (DeepSWE 공식 평균 — Opus 5 max $11.84 · Fable 5 xhigh $13.41 — 에 Opus 5.5 단가($4/$20, Opus 5 의 80%)를 적용한 범위다. **Claude Code 로 돈 공개 수치는 없다** — 그래서 예비 실험의 첫 목적이 이 추정치를 실측으로 바꾸는 것이다).

**예산 세 안** (상세 §7.2 — 설계 검증의 "더 단순한 대안" 1–3 반영)

| 안 | 과제 | 실행 수 | Anthropic 종량 (추정) | GLM 정액 (크레딧 기준) | 벽시계 |
|---|---|---|---|---|---|
| **최소 신호** | 실사용 6 (§5.4 R1·R2·R4·R7·R8·R9) | Opus A/B 12(B 는 정리 3세션 포함) · GLM 배관 스모크 2 과제 | **$50–135** (상한 $150) — 과제 $30 + 도입(정리) $20–55 | Pro 5시간 크레딧 1주기 안 | 1–2일 |
| **권장 (예비 실험)** | 실사용 6 · DeepSWE 12 = 18 (T-Bench 는 예비 밖 — B2) | Opus 상한용 A 10 + A/B 36(정리 54세션 포함) · GLM 스모크 2 과제 | **$355–810** (상한 $850) — 과제 $300–650 + 도입 $55–160 | Pro 1주기 | 3–5일(동시 2) |
| **본실험** | 100 (DeepSWE 40 · T-B 20 · QnA 20 · 실사용 20) × 3회 | 600 + 정리 900 세션 | **$5,400–10,000** + Modal $100–300 | 해당 없음(Opus 로) | 3–4주 |

**B 의 구성(D9, 사용자 결정 2026-10-18 · 재검증 2차 구조)** = 하네스 설치 + **초기 정리 3회**(고정 프롬프트로 `audit-harness-fit` 이 `CLAUDE.md` 를 저장소 근거로 채우는 새 세션 ×3 — **B trial 안에서**, 과제 세션 직전에, 같은 컨테이너·같은 egress·같은 git 상태로, 과제 지시문 없이) vs 순정 A. 정리 비용은 trial 의 정리 구간으로 분리 공시하고 ②′ 로도 보고한다(§4.4).

**추천 = 권장안.** ① **GLM 은 배관 스모크(과제 2–4개)에만** — Pier→컨테이너→Claude Code→Z.ai 경로, B 의 하네스 로드 증거(§10 5), `usage` 형식, effort 전달 여부를 확인하고 끝낸다(발표하지 않고 상한 산정에도 쓰지 않는다). ② **첫 유료 신호는 Opus 5.5 high 로 실사용 6과제 A/B** — NORTH_STAR §1 의 주장("필요한 틀만 남겨 생산성을 높인다")이 가장 직접 걸리고, 과제당 $1–4 라 하네스가 **방해하는** 방향은 작은 표본에서도 보인다. 실사용 과제가 컨테이너에서 재현되지 않으면 DeepSWE 12 가 대신 첫 신호다(T-Bench 는 예비 밖 — §3). ③ 상한은 Opus A 10건으로 먼저 고정한 뒤 DeepSWE 12 A/B. ④ DeepSWE 공개판 `glm-5.3 69%` · `opus-5 74%` 는 A 가 이상하게 낮을 때 배관 결함을 먼저 의심하는 **경보용 기준점**(비교값 아님). 예비 결과는 **발표하지 않는다** — 본실험의 과제군 · 상한 · 지표를 고정하는 데 쓴다.

**사용자 결정 항목** (§10): 예산 안 · 모델/effort(기본 Opus 5.5 high) · 인증(GLM env-file 경로 · Anthropic API 키 vs 구독 토큰) · 공개 여부 · GLM 약관 해석(자동 실행 허용이 명문화돼 있지 않다).

---

## 1. 사실 확인 (출처 번호 = `513-eval-evidence/sources.md`, 확인일 2026-10-18)

### 1.1 DeepSWE v1.1 와 실행기 Pier

- **과제** 113개, 5개 언어(TS · Go · Python · JS · Rust), 91개 저장소. Harbor 과제 형식(`task.toml` · `instruction.md` · `environment/` · `tests/` · `solution/`). 저장소 Apache-2.0 — 단 **과제별 업스트림 코드는 각자의 라이선스**(PROVENANCE.md, 전부 permissive). [S1] [S2]
- **채점(v1.1)**: 에이전트가 커밋한 변경만 `[[verifier.collect]]` 가 `git diff <base> HEAD` 로 뽑아 **별도 깨끗한 컨테이너**에서 테스트. 산출물 `verifier/reward.json`(이진 reward + f2p · p2p 비율) · `ctrf.json`. [S1]
- **Pier 0.3.1** (2026-08-11, Python ≥3.12, Apache-2.0): Harbor 포크. `--agent` 로 `oracle · nop · claude-code · codex · gemini-cli · opencode · cursor-cli · mini-swe-agent · antigravity-sdk`. 레지스트리 플래그 `-d` 는 **없다**(로컬 `-p` 만 — B4). **Claude Code 를 직접 실행한다** — 과제 이미지 빌드 시점(`RUN`, root → agent 사용자)에 설치하는데 apt/yum 계열은 `curl -fsSL https://claude.ai/install.sh | bash -s -- <ver>`, apk 계열만 npm(`claude_code.py:160-166` — N2 정정; `--ak version=` 핀)하고 `claude --verbose --output-format=stream-json --permission-mode=bypassPermissions --print -- <instruction>` 를 돌린다. `--ak reasoning_effort=`(→ `--effort`) · `max_turns` · `max_budget_usd` · `--ae KEY=VALUE`(에이전트 env) · `--env-file`. 모델은 `-m` 값을 `ANTHROPIC_MODEL` 로 넣고, **BASE_URL 이 있으면 `ANTHROPIC_DEFAULT_{OPUS,SONNET,HAIKU}_MODEL` 과 `CLAUDE_CODE_SUBAGENT_MODEL` 까지 같은 값**으로 묶는다. 네트워크 allowlist = `ANTHROPIC_BASE_URL` 호스트(없으면 `api.anthropic.com`), egress 프록시 컨테이너로 집행. 기본으로 `--disallowedTools EnterPlanMode`. `--env-file` 은 `load_dotenv(override=True)` 로 호스트 프로세스 env 에 올리고, 에이전트가 `ANTHROPIC_AUTH_TOKEN`/`ANTHROPIC_API_KEY` 를 거기서 읽어 컨테이너로 넘긴다 — 명령행 인자에 키가 남지 않는다. **실측**: 이 경로로 DeepSWE 과제 1개를 가짜 토큰으로 돌려 Claude Code 2.1.302 설치 → Z.ai 401×10 → Pier 실패 기록까지 확인(`feasibility/pier-claude-code-glm-fake-token.md`). [S3] [S4] [S5]
- **자원**(task.toml 113개 전수): 전 과제 `cpus = 2` · `memory_mb = 8192` · `storage_mb = 20480` · `gpus = 0` · 에이전트 `timeout_sec = 10800`(3h) · 검증기 1800s · 에이전트 `network_mode = "no-network"`(allowlist 외 차단). 샘플 이미지 **linux/amd64 단일 아키텍처** — arm64 Mac 에서는 에뮬레이션(실측 oracle 1.5분). [`feasibility/deepswe-task-resources.txt`]
- **공개 리더보드 수치**(mini-swe-agent · Modal, Pass@1, 과제당 평균): Opus 5 max 74%±4 · **$11.84** · 118k 출력 토큰 · 99 스텝 / Fable 5 xhigh 70%±3 · **$13.41** / Opus 4.8 max 59%±2 · $13.22 / Sonnet 5 max 54%±4 · $26.40 / **glm-5.3 max 69%±3 · $3.99 · 80k 출력**(경보용 기준점 — §6). **벽시계는 공개하지 않는다**(호스트·제공자 부하 의존). Claude Code 로 돈 수치는 없다. [S2]

### 1.2 Terminal-Bench 4.0 와 Harbor

- **과제 66개**(4.0.0 = 3.0 의 74 에서 8개 제거 · 20개 수정, 신규 0). 공식 **에이전트 상한 8시간(28800s)** 전 과제 동일. 저장소 Apache-2.0. 실행 `harbor run -d terminal-bench/terminal-bench@4.0.0 -a claude-code -m anthropic/<model> -k 5` — Harbor 는 `claude-code` 에이전트를 내장. [S6] [S7] [S8] [S9] [S10] [S11]
- **자원**(task.toml 66개 전수): GPU 과제 **3개**(`gpus = 1`). CPU 분포 2(46) · 4(14) · 8(7) · 16(4) · 1(1); 메모리 4096(38) · 8192(22) · 16384(10) · 32768(2). `allow_internet = false` 2개. docker-compose 과제 0. **이 머신(6 CPU / 8 GB)에서 바로 도는 것 = cpus ≤ 4 · memory ≤ 8192 · gpus 0 → 약 50개.** [`feasibility/tbench-task-resources.txt`]
- **채점**: `tests/test.sh` 가 `/logs/verifier/reward.txt`(0/1) 또는 `reward.json`. oracle(`solution/solve.sh`) · nop 에이전트 내장. [S12]
- **Pier 로 재대조**(B4): 저장소 sparse 클론의 `tasks/sound-change-cascade` 를 `pier run -p` 로 — oracle **1** · nop **0** (39초 · 14초), `pier run -p <clone>/tasks -i sound-change-cascade` 가 폴더 이름으로 1개 매치(접두 `terminal-bench/` 불요). 즉 T-Bench 도 DeepSWE 와 같은 러너·B 에이전트·env-file 경로로 돈다(`feasibility/tbench-pier-oracle-nop.txt`).

### 1.3 SWE-Atlas-QnA

- **124 과제**, 11 저장소(Go · Python · C · TS). 필드 `prompt · reference_answer · rubric(JSON) · docker_image · repository_base_commit`. **채점 = LLM 판정(기본 `anthropic/claude-opus-4-5-20251101`)** 이 루브릭 항목별 충족을 판정, 전 항목 충족이면 해결. **제출 뒤 소스 변경이 있으면 실패.** [S13] [S15]
- **harbor 판**(scaleapi/SWE-Atlas, Apache-2.0, 2026-03-30): `data/qa` 124 과제 · 이미지 `ghcr.io/scaleapi/swe-atlas-v1.1@sha256`(digest 핀) · **전 과제 `cpus = 16` · `memory_mb = 16384`** · `allow_internet = true` · 채점기 env `EVAL_API_KEY=${OPENAI_API_KEY}` · `EVAL_BASE_URL` · `EVAL_MODEL`. 공식 실행은 Modal(`-e modal`). claude-code 핀 2.1.293. [S15] [`feasibility/swe-atlas-qna-task-resources.txt`]
- **라이선스**: HF 데이터셋 카드와 API 에 `license` 필드 **없음**(gated 아님). 저장소는 Apache-2.0. 데이터 자체의 사용 조건은 명시가 없어 **불명확** — 공개 발표 전 Scale 에 확인. [S13] [S14]

### 1.4 Claude Code 를 컨테이너에서 비대화로

- `claude -p <prompt>` · `--output-format json|stream-json`. `json` 결과에 `total_cost_usd · usage{input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens} · modelUsage{model: {inputTokens, outputTokens, cacheReadInputTokens, cacheCreationInputTokens, costUSD, costBasis}} · num_turns · duration_ms · duration_api_ms · session_id · is_error · terminal_reason · permission_denials`. **`usage` 는 서브에이전트를 빼고, `total_cost_usd`·`modelUsage` 는 포함** — 총비용은 `modelUsage` 로 센다. `total_cost_usd` 는 **클라이언트 추정**(번들 가격표). [S16] [S17] [S22]
- 상한 플래그: `--max-turns N` · `--max-budget-usd X`(서브에이전트 포함, 초과 가능하니 여유) · `--effort low|medium|high|xhigh|max` · `--model <alias|id>` · `--permission-mode bypassPermissions` (컨테이너 root 는 `IS_SANDBOX=1` 필요 — Pier 가 넣는다) · `--permission-prompts none` · `--no-session-persistence` · `--include-hook-events`. `--bare` 는 CLAUDE.md · 훅 · 스킬을 **읽지 않으므로 B 에는 쓸 수 없다**(A 도 쓰지 않는다 — 두 팔 다 비-bare). [S16] [S17]
- 모델: `opus` → **Opus 5.5**(기본 effort **medium**) · `sonnet` → Sonnet 5.5 · `fable` → Fable 5.1. effort 우선순위 `CLAUDE_CODE_EFFORT_LEVEL` > `--effort` > settings. [S18] [S19]
- 인증: API 키 `ANTHROPIC_API_KEY`, 구독은 `claude setup-token` → `CLAUDE_CODE_OAUTH_TOKEN`, 제3자 엔드포인트는 `ANTHROPIC_BASE_URL` + `ANTHROPIC_AUTH_TOKEN`(Bearer). 격리: `CLAUDE_CONFIG_DIR`(기본 `~/.claude`) · `DISABLE_AUTOUPDATER=1` · `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`. 설정 우선순위 managed > `--settings` > `.claude/settings.local.json` > `.claude/settings.json` > `~/.claude/settings.json`. [S19] [S20] [S21]
- 설치: npm `@anthropic-ai/claude-code@<ver>` 는 **linux-arm64 · linux-x64 네이티브 바이너리**를 받는다(Node 22+ 권장). 최신 **2.1.302 (2026-10-16)**. [S21] [S32]
- 가격(2026-10-18): Opus 5.5 **$4 / $20**(캐시 읽기 $0.20) · Opus 5 $5/$25 · Sonnet 5.5 $2/$10 · Fable 5.1 $10/$50 · Haiku 5.5 $0.10/$0.50. [S23]

### 1.5 Anthropic 평가 가이드 (2026-01-09)

결과물 채점(경로 아님) · pass@k 와 pass^k 구분 · 다중 시행은 깨끗한 환경에서 · 코드 채점기 우선, LLM 판정은 보정 필요 · "다른 도구 호출 순서"를 실패로 보지 않는다. [S24]

### 1.6 GLM Coding Plan (Z.ai) — Claude Code 연결

| 항목 | 확인된 사실 | 출처 |
|---|---|---|
| 공식 연결 방법 | `~/.claude/settings.json` 의 `env` 에 `ANTHROPIC_AUTH_TOKEN=<Z.ai 키>` · `ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic` · `API_TIMEOUT_MS=3000000`. 수동 예시는 `ANTHROPIC_DEFAULT_OPUS_MODEL`/`SONNET` = `glm-5.3[1m]` · `HAIKU` = `glm-5.3-flash[1m]`; `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`. 문서는 Claude Code **2.0.14** 로 검증했다고 적음(현행 2.1.302 과 9개월 차) | [S26] |
| 모델 | **GLM-5.3 · GLM-5.3-Flash** 둘만. GLM-5.2/5.1 요청은 5.3 으로, 4.7 은 5.3-Flash 로 라우팅 | [S25] [S28] |
| 사고 강도 | GLM-5.3 은 `thinking.type=enabled` **만**(disabled 는 요청 실패). `reasoning_effort` low/high/max, **기본 max**. Claude Code `--effort` 가 Z.ai 쪽 `reasoning_effort` 로 전달되는지는 **어느 문서에도 없다 → 불명확**. 실측: 스모크에서 Claude Code 가 `unrecognized_model glm-5.3` 경고를 냈다 — effort 는 인식 모델에만 보내는 것이 기본이라(`CLAUDE_CODE_ALWAYS_ENABLE_EFFORT` 로 강제 가능 [S19]) **기본값으로는 effort 가 전달되지 않을 가능성이 높다**. 2단계 첫 확인 항목 | [S30] [S19] [`feasibility/glm-routing-smoke.md`] |
| 한도 | 크레딧 단위. 5시간 / 주간: **Lite 2,000 / 10,000 · Pro 12,000 / 60,000 · Max 28,000 / 140,000**. 크레딧 = (입력×배수 + 캐시입력×배수 + 출력×배수)/10,000. 오프피크 50%(피크 = 월–금 14–18시 UTC+8). 소진 시 다음 5시간 주기까지 대기, 잔액 차감 없음(오류 1113). "프롬프트 N회/5시간" 수치는 검색 요약에만 있고 공식 본문에서 확인 못함 | [S25] [S28] [S31] |
| 동시 실행 | 수치 없음. "티어에 묶이고 동적 조정, Max > Pro > Lite", Lite 1 프로젝트 · Pro 1–2 · Max 2+ 권장, 오프피크에 상향 | [S27] |
| 약관 — 자동화·벤치마크 | **명시 없음.** "공식 지원 도구 안에서만"(Claude Code 는 지원 도구 [S29]) · 계정 공유 금지 · 위반 시 속도 제한/동결, 3회 초과 시 차단. 자동화된 `claude -p` 실행이 "지원 도구 안"인지 **불명확** — 사용자 결정 항목(§10) | [S27] [S28] |
| `-p` 에서 usage · 비용 | Claude Code 는 Z.ai 가 돌려주는 `usage` 토큰 수를 그대로 집계하지만 **USD 비용은 가격표에 없는 모델이라 `costBasis: unknown` / 0**. 비용은 **토큰 수 + Z.ai 콘솔 크레딧**으로 센다. `--max-budget-usd` 는 사실상 무효 → 시간·턴 상한이 대신한다 | [S22] 실측 |
| 실측 — 라우팅 | 가짜 토큰: Z.ai 도달 → `401 token expired or incorrect` → Claude Code 가 `api_retry`(authentication_failed) 를 **최대 10회** 지수 백오프(관측 8회 · 100초 내 미종료). BASE_URL 비운 대조: Anthropic → `401 Invalid bearer token` → **즉시 종료**(0.3초). curl 직접 호출도 같은 두 오류 본문 | [`feasibility/glm-routing-smoke.md`] |
| 실측 — **진짜 키**(메인 세션, 2026-10-18) | 같은 스모크: Z.ai 응답 **`429 · [1113] Insufficient balance or no resource package`**, usage 0, `duration_ms 179768`. 401 이 아니므로 **키 인증은 통과** — 주소·모델·인증 경로는 맞고, 남은 것은 계정·플랜·한도(공식 FAQ 의 1113 = 크레딧 소진/패키지 없음). Claude Code 는 1113 도 재시도 가능으로 보고 약 3분을 쓴다(`API_TIMEOUT_MS=20000 · timeout 90` 조합은 결과 없이 exit 124). 원인(한도 · 키 소속 · 국제판/중국판)은 사용자가 콘솔에서 확인 중 | 메인 세션 보고(요약만 — §10 3) |

### 1.7 이슈(2026-09-21) 이후 달라진 것

| 항목 | 2026-09-21 | 2026-10-18 |
|---|---|---|
| DeepSWE 리더보드 | Opus 4.8 중심 | Opus 5 · Fable 5 수치 추가(데이터 2026-09-22) — Claude 계열 최고 74% |
| Pier | "claude-code 지원" | 0.3.1 (2026-08-11) — `--ak reasoning_effort/max_turns/max_budget_usd` · `--ae` · `--env-file` 확인 |
| Terminal-Bench 4.0 | "GPU·다중 컨테이너 과제 존재" | **66 과제 · GPU 3 · docker-compose 0** (전수 실측) |
| SWE-Atlas-QnA | 124 과제 | harbor 판은 **16 CPU / 16 GB · Modal**, 채점 Opus 4.5 유료 — 로컬 예비 실험 부적합 |
| Claude Code | — | 2.1.302. `--bare` · `--max-budget-usd` · `--permission-prompts none` · `--effort max/ultracode` 존재. `opus` = Opus 5.5(기본 effort medium) |
| 가격 | — | Opus 5.5 $4/$20 (Opus 5 대비 −20%) |
| 모델 계획 | "opus 5.2 나오면" | 현행 최상위 Opus 는 **5.5** — 실험 모델 후보 |
| 신규 | — | **GLM Coding Plan** 경로(사용자 구독) — 예비 실험의 정액 실행 모델 |

---

## 2. 무엇을 재는가 — 질문을 지표로

| 주지표 | 계산식 | 답하는 질문 |
|---|---|---|
| **① 동일 상한 해결률** | 과제군별 공통 상한(시간 · 턴 · 예산) 안에 제출하고 공식 채점을 통과한 실행 수 ÷ 전체 실행 수. 팔별로 | 같은 자원으로 더 많이 제대로 끝내는가 |
| **② 성공 1건당 총비용** | Σ(성공·실패 전부의 비용) ÷ 성공 실행 수. 비용 = `modelUsage` 토큰 × 평가 당시 요율(입력 · 출력 · 캐시 쓰기 · 캐시 읽기 분리). GLM 은 토큰 수와 크레딧. **②′** = B 의 분자에 그 trial 의 정리 구간 비용(초기 정리 3회, §4.4 — `prep/session-*.json` 의 `modelUsage`)을 더한 값 — ② 와 ②′ 를 나란히 | 완성품 하나에 실제로 얼마 드는가(도입 비용 빼고 · 넣고) |
| **③ 완료시간** | ⓐ 전체: 상한 내 성공률과 타임아웃 비율 ⓑ **A·B 둘 다 성공한 같은 과제**의 벽시계 비율(중앙값 · P90). **주값 = Pier `result.json` 의 `agent_execution` 시작→종료**(MCP 대기 · 훅 포함, 지시 전달부터 에이전트 종료까지), 보조 = Claude Code `result.duration_ms` | 같은 일을 더 빨리 끝내는가 |
| **④ 수정 없이 수용 가능 비율** (실사용 과제만) | 사전 정의한 수용 기준(§5.4) 전부 충족 ÷ 실행 수. 채점자는 팔을 모른다 | 결과물이 그대로 쓸 수 있는가 |

**원인 분석용(점수 아님)**: 상주 토큰(첫 턴 입력 · B 의 session-start 비용 ~5,795 토큰/세션 — 설치 화면 실측) · 턴 수 · 실패한 도구 호출 수 · `permission_denials` · 훅 차단 수(`hook-blocks.log`) · 컨텍스트 압축 횟수(`compact_boundary`) · 서브에이전트 사용량 · **B 가 `.claude/`·`CLAUDE.md` 를 건드린 턴 수**(D9) · **`init.mcp_servers[].status` 와 `mcp_server_errors`**(trial 마다 기록 — `context7` 연결 상태).

**합산 점수를 만들지 않는다.** 벤치마크마다 따로 보고한다(이슈 원칙 그대로).

---

## 3. 과제군과 과제 수 (예비 실험 = 권장안)

| 과제군 | 수 | 선정 규칙(결과를 보기 전에 고정) | 상한(과제당 · 팔당) |
|---|---|---|---|
| **실사용 과제** | **6** | §5.4 의 R1 · R2 · R4 · R7 · R8 · R9 — 공개 저장소 · 지시 파일 없음 · 2026-07 이후 머지 · hidden test 로 자동 채점. **첫 유료 신호의 기본 과제군** | 벽시계 45분 · 턴 80 · Anthropic $8 (+ B 정리 3회) |
| **DeepSWE v1.1** | 12 | **이름으로 고정** — Pier 의 `--sample-seed` 는 `iterdir` 순서를 섞어(`models/job/config.py:136·159`) 머신마다 결과가 다를 수 있으므로, 이 머신에서 seed 513 으로 뽑은 목록을 적고 `EVAL_TASKS` 로 `-i` 넘긴다(재검증 B6 · N9): `textual-kitty-key-phases` · `go-git-worktree-merge-conflicts` · `valibot-recursive-schema-composition` · `bandit-interprocedural-taint-checks` · `etree-xml-diff-patch` · `yaegi-go-embed-directives` · `abs-stepped-slices` · `effect-sse-httpapi-streaming` · `kgateway-consistent-hash-policy` · `sql-formatter-bigquery-pipe-formatting` · `katex-multicolumn-array-spans` · `claude-code-by-agents-recursive-delegation`(이 순서가 seed 순서 — 줄일 때 뒤에서부터). 실사용 과제군을 못 쓰게 되면 이것이 첫 신호 | 벽시계 2h(`--agent-timeout-multiplier 0.67`, B 의 정리 3회 포함) · 턴 150 · $20 |
| **Terminal-Bench 4.0** | **0** | **예비 범위에서 뺀다**(재검증 B2 — `/app` 이 git 저장소가 아니라 B 의 git 처리가 성립하지 않는다; 예비 권장안은 실사용 6 + DeepSWE 12 라 영향 없음). **본실험 결정 필요**: "B 설치 전에 `git init` + 기준 커밋을 만들어 같은 규칙을 적용하는가, 아니면 git 처리 없이(`_git_guard` 가 건너뜀) 돌리는가". 러너는 `pier run -p <clone>/tasks -x fp8-rmsnorm-gemm -x jax-speedrun-gpu -x math-eval-grader --override-gpus 0`(검증 B4), 추가 필터 `cpus ≤ 4` · `memory_mb ≤ 8192` · `allow_internet = true` | — |
| **SWE-Atlas-QnA** | 0 | 예비에서는 제외(16 CPU · Modal · 유료 채점). 본실험에 20 | — |
| **합계** | **18** | Opus A/B × 1회 = **36 실행** (+ B 마다 정리 3세션 = 54). GLM 은 이 중 **2 과제 배관 스모크**만(§7.2) | |

과제 수를 줄여야 하면 **seed 순서의 뒤에서부터** 줄이고, B 결과를 보기 전에 정한다(N9). **최소 신호안** = 실사용 6 만(Opus 12 실행); **본실험**은 이슈 표(40 · 20 · 20 · 20 × 3회 = 600)를 그대로 쓰되 QnA 와 16 CPU 과제는 Modal 로, T-Bench 는 위 git 결정 뒤.

---

## 4. A/B 구성

### 4.1 공통(두 팔 동일)

- Claude Code **2.1.302** 핀(npm) · 모델 **Opus 5.5**(`claude-opus-5-5`) · **effort high** 명시(기본 medium 을 두 팔 다 high 로 — DeepSWE 공식은 max 지만 비용 통제). GLM 단계는 `glm-5.3`(effort 전달 여부는 2단계 첫 확인).
- 실행기 Pier 0.3.1 `claude-code` 에이전트 — `--permission-mode=bypassPermissions --disallowedTools EnterPlanMode` · `--output-format=stream-json --verbose` · `--max-turns` · `--max-budget-usd` · `--effort`. Claude Code 설치는 Pier 가 과제 이미지 빌드 시점에 `curl … install.sh | bash -s -- 2.1.302`(apt 계열)로 한다 — 하네스 설치(B)는 그 뒤 root 단계에서 `npm install -g`(과제 이미지에 npm 이 있어야 한다 — DeepSWE 113 과제는 전부 `mars-base` 이고 표본 1개에 node 24 가 있었다; 없으면 §5.3 양팔 제외). **`--bare` 사용 안 함**(두 팔 모두 프로젝트 `.claude/` · `CLAUDE.md` 를 읽는 정상 모드 — A 는 읽을 것이 없을 뿐이다).
- 격리: 과제마다 새 컨테이너 · `CLAUDE_CONFIG_DIR` 은 컨테이너 안 전용 경로(Pier 기본) · 호스트 `~/.claude` **미마운트** · `DISABLE_AUTOUPDATER=1` · `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` · 세션 잔재 없음(컨테이너 폐기).
- 같은 저장소 · 같은 시작 커밋 · 같은 지시문(벤치마크 `instruction.md` 그대로 — 하네스를 언급하지 않는다) · 같은 CPU/메모리(과제 `task.toml`) · 같은 네트워크 정책.

### 4.2 B 에만 — 설치 명령과 트랙 규칙 (고정)

```
npm install -g @uzysjung/agent-harness@26.174.0
agent-harness install --track base --cli claude        # 벤치마크 과제 전부
agent-harness install --track tooling --cli claude     # 실사용 과제(이 저장소 — 스택이 tooling)
```

- 트랙 규칙: **벤치마크 = `base`**(스택 무관 트랙 — 룰 5 · 에이전트 2 · 훅 2 · 스킬 14 · `context7` MCP · CLAUDE.md 스캐폴드). 과제 저장소의 스택을 보고 트랙을 고르지 않는다 — 고르는 행위 자체가 사람이 개입하는 자리다. 실사용 과제는 저장소가 선언한 트랙(`tooling`) 하나.
- `--with`/`--without` 없음. 과제 지시문에서 특정 스킬을 호출하지 않는다. 설치 뒤 **초기 정리 3회**(§4.4 — 고정 프롬프트로 `audit-harness-fit` 이 `CLAUDE.md` 의 `<!-- FILL -->` 을 채우는 세션 ×3, 과제를 보기 전에, 저장소+시작 커밋 단위로 한 번)를 하고 그 결과를 모든 과제에 똑같이 적용한다(D9).
- 설치 비용은 **에이전트 설치 단계**(Pier 가 네트워크를 여는 구간)에서 쓴다 → 토큰 비용 0, 벽시계는 별도 기록. 초기 정리 3회의 토큰·시간·비용은 **일회성 도입 비용**으로 따로 집계·공시한다(§4.4 · ②′) — ③ 과 ② 의 과제 비용에는 넣지 않는다.
- 하네스 자체를 예비 실험 과제로 **고치지 않는다**. 발견한 결함은 이슈로만 올리고, 고친 판은 본실험에서 쓴다(예비 과제 ≠ 본실험 과제).

### 4.3 B 의 하네스 파일을 채점 diff 에서 빼기 (실측 근거 · 설계 검증 B2 반영)

DeepSWE 이미지에서 `install --track base --cli claude` 를 돌리면 **`.gitignore` 가 바뀌고(tracked) untracked 6개**(`.claude/` · `.uzys-agent-harness/` · `.mcp.json` · `CLAUDE.md` · `CLAUDE-uzys-harness.md` · `.github/workflows/ci.yml`)가 생기며, 상류에 `CLAUDE.md` 가 이미 있으면 새로 만들지 않고 **그 파일에 import 블록을 더한다**(tracked 변경 — `feasibility/harness-skipworktree-in-deepswe-image.txt`). 그대로 두면 에이전트가 `git add .` 한 커밋에 들어가 ⓐ DeepSWE 채점 diff 를 오염시키고 ⓑ QnA 는 "소스 변경"으로 실패한다.

**설치 뒤 tracked 파일을 되돌리지 않는다**(`git checkout -- .` 는 상류 `CLAUDE.md` 에 더해진 import 줄을 지워 앵커 본문이 영영 로드되지 않는 **들키지 않는 부분-A** 를 만든다). 대신: 설치가 고친 tracked 파일(`.gitignore` · 있으면 `CLAUDE.md` · `AGENTS.md`)은 `git update-index --skip-worktree` 로 표시하고, untracked 하네스 경로는 `.git/info/exclude` 에 적는다 — 디스크의 하네스 몫은 그대로 남아 로드되고, `git add .` · `commit -a` · 검증기의 `git diff <base> HEAD` 에는 들어가지 않는다. **실측**(상류 CLAUDE.md 를 커밋해 둔 DeepSWE 이미지): 설치 후 `M .gitignore · M CLAUDE.md · ?? 6개` → skip-worktree + exclude 뒤 `git status --porcelain` 설치 전과 **동일** · 디스크 `CLAUDE.md` 5–14행에 `<!-- uzys-harness:import:start --> @CLAUDE-uzys-harness.md` **잔존** · 에이전트 흉내 커밋 뒤 `git diff <base> HEAD --stat` = `main.go | 1 +` 만, 하네스 경로 0.

git 처리(skip-worktree · exclude · status 대조)는 **`/app` 이 git 저장소일 때만** 한다(`pier_agent_b.py` `_git_guard`) — T-Bench 과제의 `/app` 은 git 이 아니고(재검증 B2) 채점이 git 을 읽지 않아 하네스 파일이 채점에 섞일 길이 없다. 비-git 과제는 `git-repo: no` 한 줄을 남긴다. **설치 전후 `git status --porcelain -uall` 이 같아야 한다**(`-uall` — 디렉터리 축약 없이 파일 단위, 재검증 B3ⓑ). 다르면 exit 97 — 설치 단계는 docker build 의 `RUN` 이라 이것은 **이미지 빌드 실패**다. 그 과제는 **두 팔 모두에서 제외하고 제외 목록에 적는다**(B 에서만 조용히 빠지면 선택 편향 — §5.3). 한계 두 줄: ⓐ 에이전트가 skip-worktree 4 파일 · exclude 8 경로를 고의로 고친 변경은 diff 에서 빠진다(실측: skip-worktree 된 `CLAUDE.md` 에 줄을 더하면 `nothing to commit`) — 벤치마크 과제에서는 일어나지 않는 편집이고 `model.patch` 와 컨테이너 안 `git diff` 사후 점검으로 확인한다. ⓑ 설치가 `.gitignore` 에 더한 패턴(`.env` · `.factory/` · `.goose/` · `.uzys-agent-harness/hook-blocks.log` · `.uzys-agent-harness/update-backups.json` · `.claude.backup-*/` · `*.backup-<시각>*` — `feasibility/harness-install-in-deepswe-image.txt` 의 diff)은 과제 세션 동안 유효하다 — 에이전트가 그 이름의 파일을 만들면 커밋·diff 에서 빠진다(벤치마크 채점은 테스트라 영향 없음; `protect-files` 훅 차단은 §4.5 대로 B 의 실패, 3차 N3).

### 4.4 B 의 초기 정리 3회 (D9 — 사용자 결정 2026-10-18)

**구조(재검증 2차 반영 — 경우를 덧대지 않고 구조를 바꿨다).** 정리를 따로 돌려 `prep.tar` 로 옮겨 붙이는 1차 구현은 키 잘림 · 실패 삼킴 · 삭제 미전파 · 네트워크 열림(재검증 B1·B3·B4)을 낳았다. 그래서 **정리를 B trial 안에서 돈다** — 같은 컨테이너 · 같은 Pier egress 정책(API 호스트만) · 같은 사용자 · 같은 git 상태에서, 과제 세션 직전에 정리 세션 3회를 새 세션으로 돌린다(`pier_agent_b.py` `run()`: 정리 → B2 규칙 재적용 → `super().run()`). `prep-b.sh` · `prep.tar` · 키 매핑은 없다.

**정의 — "초기 정리 1회"** = 설치 화면이 안내하는 정리 흐름을 그대로 따른 **한 세션**. 설치 화면 FILL 줄(실측 `feasibility/harness-install-in-deepswe-image.txt`): "`CLAUDE.md` — a fill-in scaffold. Open and paste each `<!-- FILL: … -->` prompt to your agent to tailor it to this project, or ask the **audit-harness-fit** skill to fill it from repository evidence". 그 두 번째 길을 쓴다 — 스킬 `templates/skills/audit-harness-fit/`(설치본 `.claude/skills/audit-harness-fit/`)의 "Fill or refresh project context → `references/populate.md`" 모드. 프롬프트는 **설치 화면 문구를 명령형으로 옮긴 고정 문장**(바이트 동일은 아니다 — N1)으로 코드(`PREP_PROMPT`)에 박아 둔다:

> `Use the audit-harness-fit skill to fill CLAUDE.md from repository evidence.`

(`--cli claude` 설치에는 `AGENTS.md` 가 없어 `CLAUDE.md` 만.) **3회** = 같은 프롬프트를 **새 세션**으로 3번(같은 `/app` 위에서 누적). 각 세션은 `claude -p "<프롬프트>" --effort <단계 effort> --permission-mode bypassPermissions --permission-prompts none --max-turns 60 --max-budget-usd 10 --disallowedTools EnterPlanMode --output-format json`, 세션 JSON 은 `<trial>/agent/prep/session-{1,2,3}.json`.

**과제를 보기 전에 한다 — 코드가 보증한다.** 정리 구간은 `run()` 의 `instruction` 인자를 참조하지 않는다(과제 지시문은 정리 뒤 `super().run()` 에만 들어간다). 네트워크는 과제 세션과 같은 egress 정책이라 정리 세션이 상류 커밋·이슈를 가져올 길이 **과제 세션과 같은 만큼만** 있다(DeepSWE `no-network` 과제에서는 없다). 기록: `prep/prep-prompt.txt` · 세션 JSON · `prep/prep-git-status.txt`(정리 뒤 `git status --porcelain -uall`) · 세션 jsonl 의 `WebFetch`/`git fetch`/`gh` 호출 수(사후 대조 항목, 기대 0).

**단위 — trial 마다.** 정리는 **B trial 마다** 한다. 같은 저장소의 trial 끼리 정리 결과가 다를 수 있다 — 설치자가 저장소마다 처음 설치하고 정리하는 실제 조건과 같다. 결과 파일(`prep/` 아래 세션 JSON · `fill-count.txt` · `prep-git-status.txt`)을 trial 마다 남기므로 사후에 trial 간 차이를 볼 수 있다. 예비 실험은 1회 반복이라 "같은 B 가 다른 정리를 받는" 영향이 작다(본실험 3회 반복에서는 반복 간 분산의 한 성분으로 공시). 정리 뒤 **B2 규칙**(tracked `.gitignore` · `CLAUDE.md` · `AGENTS.md` · `.mcp.json` skip-worktree, untracked 는 `.git/info/exclude`)을 다시 적용하고 `git status --porcelain -uall` 이 설치 직후 기준선과 같아야 한다 — 다르면 정리가 하네스 경로 밖 소스를 건드린 것이고 아래 실패 규칙의 "제품의 실패" 다.

**정리 세션 실패 규칙(근거: B 에서만 빠지는 선택 편향을 막는다 — §5.3).** ⓐ **API·인프라 오류**(`api_error_status` · `terminal_reason == api_error` · 네트워크 예외)는 **1회 재실행**; 다시 실패하면 `agent/prep-infra-error.txt` 를 남기고 exit 96 → 그 trial 은 §5.3 의 "인프라 오류 → 1회 재실행" 규칙(양팔 동일). ⓑ **그 밖의 실패**(`is_error` · 턴 상한 도달 · 정리가 소스를 건드림)는 **제품의 실패**다 — `agent/prep-failed.txt` 에 사유를 적고 과제 세션 없이 exit 95 → 검증기 reward 0 = **B 의 실패로 집계하고 제외하지 않는다**. 제외하면 "정리가 잘 되는 저장소"만 B 에 남아 하네스에 유리해진다.

**비용은 따로 집계하고 공개한다.** 정리 3회의 토큰 · 시간 · 비용은 trial 의 **정리 구간**으로 분리한다 — 세션 JSON 의 `modelUsage`(서브에이전트 포함; `usage` 아님 — N3) · `duration_ms` · `prep/prep-timing.txt`(세션별 벽시계). Pier 의 `agent_execution` 은 정리 구간을 포함하므로 과제 구간 시간 = `agent_execution` − 정리 벽시계(summarize.sh). 보고서에는 ⓐ 과제 비용만의 ②와 ⓑ 정리 비용을 더한 ②′ 를 **함께** 적는다(이슈 원칙 "초기 작업을 무료로 치지 않는다"). trial 마다 정리하므로 ②′ 의 배분 수는 1 이다.

**B 판정 증거에 더한다**(§10 6 ⓔ): `prep/prep-done.txt` 존재 · `fill-count.txt` 가 `after-install 7 → after-prep <7`(새 스캐폴드 — 6절 + 배너 1, 리허설 실측) **또는** `after-install 0 → prep-git-status.txt 에 CLAUDE.md`(상류에 `CLAUDE.md` 가 있어 FILL 안내가 뜨지 않는 저장소 — N2) · 세션 JSON 3개 · `prep-timing.txt` 3줄.

**모델 일관성.** 정리 세션은 그 trial 의 모델·effort·env 를 그대로 쓴다(`_claude_env()` 가 부모 `run()` 과 같은 조립 — `ANTHROPIC_MODEL` · `DEFAULT_*` · `SUBAGENT_MODEL` · `FORCE_AUTO_BACKGROUND_TASKS` · `ENABLE_BACKGROUND_TASKS`). GLM 단계 = `glm-5.3`, Opus 단계 = `claude-opus-5-5` high. **단 `CLAUDE_CONFIG_DIR` 만 `agent/prep/sessions` 로 분리한다**(3차 검증 B1) — Pier 가 `agent/sessions/projects/*/` 의 jsonl **전부**를 trajectory·`agent_result` 로 합산하므로(`claude_code.py:708`) 같은 곳에 두면 정리 토큰이 과제 비용에 섞인다(리허설: 과제 세션 없이 `n_agent_steps 2`). 분리하면 Claude Code 자동 메모리도 정리→과제로 넘어가지 않아 B 가 과제 세션에 가져가는 것은 **디스크의 하네스 파일(채워진 `CLAUDE.md` 포함)뿐**이다.

### 4.5 비대칭 주의

- Pier 는 BASE_URL 이 있으면 `CLAUDE_CODE_SUBAGENT_MODEL` 도 같은 모델로 묶는다(GLM 단계). Anthropic 단계에서는 서브에이전트가 Claude Code 기본 규칙을 따른다 — B 의 `reviewer`/`implementer` 에이전트 정의가 모델을 지정하면 그것이 적용된다. **첫 인과 비교는 동일 모델 구성**이라야 하므로 Anthropic 단계도 `--ae CLAUDE_CODE_SUBAGENT_MODEL=claude-opus-5-5`(+ 필요 시 `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1`)로 두 팔 다 묶는다. 저가 모델 위임의 제품 효과는 후속 실험.
- B 의 `context7` MCP 는 DeepSWE(`no-network`)에서 연결 실패 → Claude Code 가 `MCP_TIMEOUT`(30s) 뒤 진행. 그 30초와 실패 로그는 **B 의 비용**이다(환경 문제로 빼지 않는다). Terminal-Bench(인터넷 허용 64개)에서는 작동한다 — 그 효과는 거기서만 측정된다고 표기.
- B 의 `protect-files` 훅이 과제상 필요한 편집(lock 파일 · `.env*`)을 막으면 **B 의 실패**다.

---

## 5. 실행 설계

### 5.1 순서와 반복

- 예비 = 과제당 A/B **각 1회**. 과제 단위로 A→B / B→A 를 seed 로 섞어 비슷한 시간대에 돈다(제공자 부하 편향 분산). `run-pilot.sh` 골격은 팔 단위 — 2단계에서 과제 인터리브로 바꾼다(명시).
- **상한은 Opus 단계의 첫 A 실행 10건**(상한 없이 — 턴 300 · 4h 안전망만)의 시간·턴·비용 분포로 고정한다. **상한용 실행은 A 만** 돈다 — 상한을 정하는 사람이 B 결과를 보지 않게(N3). GLM 단계는 배관·B 로드 확인용이고 상한 산정에 쓰지 않는다(두 모델의 프로파일이 다르다 — §6.1).
- B 의 `agent_execution` 은 정리 3세션을 포함한다 — 과제 구간 시간은 `agent_execution` − `prep/prep-timing.txt` 벽시계 합(summarize.sh). 상한(`--agent-timeout-multiplier`)도 정리를 포함하므로 B 에 정리만큼 여유를 더 주지 **않는다** — 그 시간이 제품의 비용이다.
- 보고서가 읽는 상한 값은 스크립트 기본값이 아니라 **각 job 의 `config.json`** 에 기록된 `agents[].kwargs`(`max_turns` · `max_budget_usd` · `reasoning_effort`)와 `agent_timeout_multiplier` 다(N8 — `EVAL_*` 오버라이드가 있어도 실제 값이 남는다).
- 동시 실행 **2**(이 머신 6 CPU / 8 GB, 과제가 2 CPU / 8 GB). 두 팔은 같은 동시성.
- 본실험 = 과제당 3회 독립 실행, **3회 중 1회 성공을 성공으로 세지 않는다** — 실행 단위 성공률(pass@1 추정)로 집계. pass^k 는 보조로.

### 5.2 채점 — 에이전트 밖에서

- DeepSWE: Pier 검증기(별도 컨테이너) `reward.json.reward`. 커밋 안 된 작업은 공식 규약대로 0.
- Terminal-Bench: Harbor 검증기 `reward.txt`.
- 실사용: 과제별 자동 검사(테스트 · 스크립트) + 팔을 모르는 사람 1인의 수용 판정(§5.4 기준표). "완료했다"는 에이전트 응답은 채점이 아니다.
- 정답 패치 · 루브릭은 에이전트 컨테이너에 없다(Pier/Harbor 가 `solution/` · `tests/` 를 넣지 않는다 — oracle 실행으로 확인됨).

### 5.3 실패 처리 (사전 고정)

| 사건 | 처리 |
|---|---|
| 시간 · 턴 · 예산 상한 초과, 컨텍스트 초과, 훅 오차단, MCP 미연결로 멈춤 | **실패로 집계**(두 팔 동일) |
| 제공자 5xx/429 · 인프라 오류(이미지 pull 실패 · Docker OOM) | 같은 규칙으로 **1회 재실행**, 원 로그 보존, 두 팔 똑같이. B 만 골라 재실행하지 않는다 |
| **B 의 에이전트 이미지 빌드 실패**(하네스 설치 실패 · exit 97 · npm 부재) | **그 과제를 두 팔 모두에서 제외**하고 제외 목록(과제 id · 사유)을 보고서에 적는다 — B 에서만 빠지는 선택 편향을 막는다(B2). 빌드 시점이라 `/logs/agent/excluded.txt` 를 쓸 수 없으므로 summarize.sh 가 trial 의 `exception.txt` 에 `exit 97` 이 있는 과제를 제외 목록으로 만든다(N4). Node 가 과제 이미지에 있다는 것은 **표본 1개의 관측**(mars-base, node 24)이라 이 규칙이 그 경우도 덮는다 |
| **정리 세션의 API·인프라 오류**(§4.4) | 세션 1회 재실행 → 다시 실패면 `agent/prep-infra-error.txt` + exit 96 → **그 trial 을 양팔 동일 규칙으로 1회 재실행**(위 제공자 오류 행과 같다) |
| **정리 세션의 그 밖의 실패**(`is_error` · 턴 60 상한 · 정리가 소스를 건드림 · 정리가 커밋을 만듦) | **B 의 실패로 집계(reward 0), 제외하지 않는다** — `agent/prep-failed.txt` 에 사유. 제외하면 정리가 잘 되는 저장소만 B 에 남아 하네스에 유리해진다 |

공시(3차 N8): B 는 trial 당 API 의존 세션이 4개(정리 3 + 과제 1)라 인프라 오류로 양팔 재실행이 걸리는 빈도와 GLM 5시간 크레딧 소진이 A 보다 잦다 — 편향은 아니고(재실행은 양팔) 비용·벽시계에 든다. 재실행 횟수를 팔별로 보고한다.
| GLM 401/1113(한도) 로 재시도 루프 | **그 실행 무효 + 재실행**(한도 회복 뒤). Claude Code 의 10회 재시도(수 분)는 시간 지표를 오염시키므로 `api_retry` 이벤트가 있는 실행은 시간 집계에서 표시한다 |
| 에이전트가 `instruction.md` 밖 정답(업스트림 머지 커밋)을 네트워크로 찾음 | DeepSWE 는 no-network 라 불가. T-Bench 인터넷 허용 과제는 trajectory 에서 fetch 도메인을 사후 점검 |

### 5.4 실사용 과제 후보 (설계 검증 B1 반영 — 공개 저장소, 에이전트 지시 파일 없음)

**실사용 과제 저장소는 에이전트 지시 파일(`CLAUDE.md` · `AGENTS.md` · `.claude/` · `.cursor/` · `.cursorrules` · `GEMINI.md` · `.github/copilot-instructions.md` · `.windsurfrules` · `.clinerules`)이 없는 공개 저장소에서 고른다.** 이 리포는 자기 자신이 하네스라 A 팔이 성립하지 않으므로 제외한다(옛 §5.4 의 #833 · #543 등은 A 가 이미 개발 사본 하네스를 갖고 있었다). 저장소가 선언하는 트랙은 과제를 보기 전에 스택으로 정해 기록한다(Node CLI/라이브러리 · Python 라이브러리 · Rust/Go CLI → 전부 `base`; 스택 트랙은 Vite/Next/FastAPI 류 앱일 때만).

**선정 규칙**: ⓐ **2026-07-01 이후 머지**된 PR 이 이슈를 닫고(`closes/fixes #N`) 테스트 파일을 함께 바꿨다 — 날짜의 이유는 모델 학습 마감 이후의 변경이어야 "기억으로 푸는 과제"가 아니기 때문이고, 스크립트가 `mergedAt` 으로 집행한다(재검증 B7) ⓑ 시작 커밋 = PR 의 base ⓒ 지시문 = 이슈 본문(제목 · 재현 · 기대 동작)만 — PR 본문 · diff · 테스트는 주지 않는다 ⓓ **자동 수용 검사** = PR 의 테스트 파일 변경(hidden test)을 에이전트의 최종 커밋 위에 적용해 실행 → 새 테스트 통과 **그리고** 기존 스위트 그대로 green(DeepSWE 와 같은 f2p/p2p 구조) ⓔ DeepSWE 91 저장소와 겹치는 저장소 제외(`encode/httpx` 탈락) ⓕ 과제 생성 스크립트(2단계)는 **base 커밋 체크아웃**에서 같은 9 경로의 지시 파일 부재를 한 번 더 확인한다(조사는 기본 브랜치 HEAD 를 봤다 — N9).

**조사 결과**(2026-10-18 `gh api`, 머지 ≥ 2026-07-01 필터 — `feasibility/realuse-repo-survey.md` · 스크립트 `realuse-repo-survey.sh`): 후보 20곳 중 **지시 파일 없음 18곳**(`colinhacks/zod` 는 `CLAUDE.md · AGENTS.md · .claude · .cursorrules` 로 탈락). **대조군**: 같은 검사가 이 리포에서 `CLAUDE.md · .claude` 를 **찾았다** — 탐지기가 문다. 최근 머지 PR 30건 안에 규칙 ⓐ 를 지키는 PR 이 있는 곳 **12곳**(`spf13/cobra` 는 #2356 이 2026-04-24, `hynek/structlog` 는 #818 이 2026-06-01 이라 날짜 필터에서 빠졌다 — 재검증 B7). 그중 10곳:

| # | 저장소(언어) | 과제 = 이슈 → PR(hidden test) · 머지일 | 유형 | 자동 수용 검사 |
|---|---|---|---|---|
| R1 | `yargs/yargs` (JS) | #2454 → #2590 choices 중복 제거 · 10-13 | 작은 변경 | PR 테스트 1 + `npm test` |
| R2 | `sharkdp/bat` (Rust) | #4034 → #4035 닫힌 stdout 패닉 · 10-07 | 작은 변경 | PR 테스트 1 + `cargo test` |
| R3 | `jqlang/jq` (C) | #3668 → #3670 `strftime` 빈 결과·오버플로 · 10-13 | 작은 변경 | PR 테스트 2 + `make check` |
| R4 | `go-chi/chi` (Go) | #843 → #1159 자기 자신 Mount 패닉 · 08-27 | 작은 변경 | PR 테스트 1 + `go test ./...` |
| R5 | `stretchr/testify` (Go) | #1211 → #1938 surplus matcher · 08-24 | 작은 변경 | PR 테스트 1 + `go test ./...` |
| R6 | `junegunn/fzf` (Go) | #4903 → #4907 `--listen` 상태 payload · 09-06 | 작은 변경 | PR 테스트 1 + `go test ./...` |
| R7 | `chalk/chalk` (JS) | #604 → #689 underline 스타일·색 · 07-25 | 기능 추가 | PR 테스트 1 + `npm test` |
| R8 | `tj/commander.js` (JS) | #2614 → #2615 유니코드 variadic placeholder · 09-28 | 기능 추가 | PR 테스트 1 + `npm test` |
| R9 | `pallets/click` (Py) | #3822 → #3858 `click.Path` 제네릭 · 09-08 | 기능 추가 | PR 테스트 2 + `pytest` |
| R10 | `casey/just` (Rust) | #3064 → #3755 recipe `--help` · 10-17 | 기능 추가 | PR 테스트 2 + `cargo test` |

예비: 작은 변경 6 · 기능 추가 4 중 **6개**(R1 · R2 · R4 · R7 · R8 · R9 — 언어 4종: JS 3 · Rust · Go · Py)를 쓴다. 나머지 4 + `sindresorhus/execa #1256`(07-07) · `sharkdp/hyperfine #1002`(테스트 전용 PR — 과제로 약함)는 본실험 풀. **작업 재개 유형은 예비에서 0** — 다중 커밋 PR 의 첫 커밋을 WIP 로 쓰는 구성이 가능하지만 후보별 확인이 안 됐다(2단계). 2단계 첫 확인: 각 과제의 base 커밋에서 테스트가 컨테이너 안에서 재현되게 도는가(의존성 설치 네트워크 포함) — 안 되면 그 과제를 뺀다.

채점은 **자동 검사가 주**다. 사람이 "수정 없이 수용" 을 판정할 때는 항목마다 **서면 사유**(재현 절차 · 코드 위치)를 붙인다(N11 — 채점자가 하네스 작성자라 문체로 팔을 알아볼 수 있다). "필요한 질문"과 "이미 준 정보를 다시 묻는 질문"을 구분해 기록한다(`-p` 에서 `AskUserQuestion` 은 비활성 — 질문은 결과 텍스트의 요청으로 나타난다).

### 5.5 격리 체크리스트 (실행 전 · 매 실행)

호스트 `~/.claude` 미마운트 · 컨테이너 `HOME` 비어 있음 · `claude --version` = 2.1.302 두 팔 · `env | grep -c ANTHROPIC_` 가 기대 수 · B 의 `/logs/agent/harness-install-record.json` 존재 · A 의 `/app/.claude` 부재 · `git status --porcelain` 설치 전후 동일(B).

---

## 6. 통계 해석의 한계

- **벤치마크별 표본 × 1회**(합산하지 않는다 — §2): 해결률 차이의 표준오차 ≈ √(2·p(1−p)/n), p=0.5 에서 **실사용 n=6 → 0.29 · DeepSWE n=12 → 0.20**(T-Bench 는 예비 밖). "유의"하게 보이려면 실사용은 **60%p**, DeepSWE 는 **40%p** 차이가 나야 한다. 그보다 작은 차이는 **방향도 확정 못 한다** — 단 하네스가 **방해하는** 방향(성공률 급락 · 시간 2배)은 같은 문턱이 대칭으로 걸리므로 작은 표본에서도 보인다. 예비 실험은 효과 주장이 아니라 ⓐ 배관 ⓑ 상한 설정 ⓒ 본실험 표본 수 산정(관측 분산으로) ⓓ 방해 신호 조기 포착을 위한 것이다.
- **외부 기준점(경보용)**: DeepSWE 공개판 Pass@1 — `glm-5.3 [max] 69%±3 · $3.99 · 80k 출력` · `opus-5 [max] 74%±4`(mini-swe-agent · Modal, S2). 우리 A 가 12과제에서 이 범위를 크게 벗어나 낮으면 효과를 읽기 전에 **배관 결함을 먼저 의심**한다. 러너·에이전트가 달라 비교값이 아니다.
- 분석 단위는 **과제별 짝**: 해결률은 McNemar(불일치 쌍 — A성공·B실패 vs A실패·B성공)를 그대로 공개, 비용·시간은 공통 성공 과제의 로그 비율 중앙값 + 부트스트랩 CI. 같은 저장소에서 나온 과제는 상관을 가진다(DeepSWE 91 저장소 / 113 과제).
- **"차이가 안 보인다"는 "같다"가 아니다.** 품질 유지 주장에는 사전에 허용 열화 폭(예: 해결률 −5%p)을 정한 비열등성 검정이 따로 필요 — 본실험 설계 항목.
- GLM 결과와 Opus 결과를 합치지 않는다(§6.1).

### 6.1 GLM 결과의 해석 한계

GLM-5.3 에서 관측된 B−A 차이는 **Opus 5.5 에 대한 효과가 아니다.** ⓐ 하네스 프로즈는 Claude 계열에서 관측된 실수를 전제로 썼다(NORTH_STAR §1 "상주의 근거") ⓑ GLM 은 사고가 항상 켜져 있고 effort 전달이 불명확해 A 의 비용·시간 프로파일이 다르다 ⓒ Z.ai 의 비표준 오류가 Claude Code 재시도를 유발해 시간 분포가 오염될 수 있다. GLM 단계가 답하는 것은 **"배관이 도는가 · 하네스가 컨테이너에서 실제로 로드되는가 · A 의 시간·턴 분포는 어떤가 · 하네스가 명백히 방해하는 과제 유형이 있는가"** 까지다. **Opus 확인 실행**은 같은 18 과제(최소안은 실사용 6)를 Opus 5.5 high 로 A/B 1회 — 이것이 첫 신호다.

---

## 7. 비용·시간 추정과 예산 세 안

### 7.1 1회 실행 추정 근거

| 과제군 | 공개 근거 | Opus 5.5 high · Claude Code 추정 | 벽시계 추정 |
|---|---|---|---|
| DeepSWE | mini-swe-agent 평균: Opus 5 max $11.84 (118k 출력) · Fable 5 xhigh $13.41 · Sonnet 5 max $26.40 [S2] | Opus 5.5 단가 = Opus 5 의 0.8 · effort high < max · Claude Code 의 캐시 활용 → **$6–15** | 공개 없음. 99 스텝 × 10–30초 → **20–60분** |
| Terminal-Bench | 공개 비용 없음(8h 상한) | DeepSWE 와 같은 급으로 가정, 상한 $20 → **$5–15** | **20–90분**(2h 상한) |
| 실사용(이 저장소) | 이 리포 세션 경험(비공개) | **$1–4** | **5–30분** |
| QnA(본실험) | 읽기 전용 | **$2–5** + 판정 $0.5–1 | 10–20분 |

**B 의 추가 상주 토큰 ≈ 5.8k/턴 입력**(설치 화면 실측) — 100턴이면 입력 580k → 캐시 읽기 단가($0.20/M)면 ≈ $0.12, 캐시 미스면 $2.3. 즉 B 의 상주 비용은 과제당 **$0.1–2.3**: 작지 않지만 지배적이지도 않다. 측정값으로 바꿀 것.

### 7.2 세 안

| | 최소 신호 | **권장(예비)** | 본실험 |
|---|---|---|---|
| 과제 | 실사용 6 | **18** (실 6 · DS 12) — T-Bench 는 예비 밖(B2) | 100 (DS 40 · TB 20 · QnA 20 · 실 20) |
| Opus 실행 | A/B 12 | 상한용 **A 10**(DS, 상한 없이) + A/B **36** = 46 | 600 (×3회) |
| **초기 정리(D9, Opus) — B trial 마다 3 세션** | 6 × 3 = **18** | 18 × 3 = **54** | 300 B trial × 3 = **900** |
| GLM 실행 | 배관 스모크 2 과제 × A/B(B 는 정리 3 포함) = 4 trial | 같음 4 trial | 없음 |
| **Anthropic 종량 — 과제** | 실 12×$2.5 ≈ **$30** | A 10×$12 + DS 24×$10 + 실 12×$2.5 ≈ **$390** → $300–650 | DS 240×$10 + TB 120×$10 + QnA 120×$5 + 실 120×$2.5 ≈ **$4,500** |
| **Anthropic 종량 — 도입(정리)** | 18 × $1–3(맥락 채우기 세션, 턴 60 상한) ≈ **$20–55** | 54 × $1–3 ≈ **$55–160** | 900 × $1–3 ≈ **$900–2,700** |
| **Anthropic 합계** | **$50–135**, 상한 $150 | **$355–810**, 상한 $850 | **$5,400–10,000** |
| **GLM 정액** | 4 trial(정리 6 세션 포함) — Pro(12,000/5h) 1주기 안. 크레딧 공식의 배수가 비공개라 **크레딧 수는 실측으로**(Z.ai 콘솔 전·후 스냅샷) | 같음 | 해당 없음 |
| 인프라 | 로컬 Docker $0 | 로컬 $0 | Modal(QnA 16 CPU · GPU 3) **$100–300** |
| 벽시계 | 1–2일 | **3–5일**(동시 2 · 정리 세션 5–15분 ×54 ≈ 5–14h 포함) | 3–4주 |
| 얻는 것 | 배관 + 실사용에서 **방해 여부** | 배관 + Opus 기준 상한 고정 + 첫 신호(2 과제군) + 표본 산정 + 도입 비용 실측 | 공개 가능한 효과 추정(CI 포함) |

trial 마다 정리하므로 본실험의 정리 세션 수는 **B trial 수 × 3** 이다(저장소 단위 재사용이 아니다 — 재검증 2차 구조). 도입 비용 추정의 근거는 없다(한 번도 잰 적 없음) — "맥락 6절을 저장소 근거로 채우는 세션 1회 = 입력 0.2–1M · 출력 5–20k 토큰" 가정. 스모크 2 과제의 정리 6세션에서 실측으로 바꾼다.

가격은 2026-10-18 요율[S23]. 추정의 가장 큰 불확실성은 **Claude Code 가 과제당 쓰는 토큰**이고, 예비 단계 첫 10 실행에서 측정값으로 바꾼다 — 그 시점에 권장안 예산을 재확인한다(초과 예상이면 과제 수를 줄이고 사유 기록).

---

## 8. 하네스에 유리하게 짜일 위험과 차단책

| 위험 | 차단책 |
|---|---|
| 과제를 보고 B 에 맞는 트랙·스킬을 고른다 | 트랙 규칙 고정(§4.2) · `--with/--without` 금지 · 지시문은 벤치마크 원문 |
| A 를 약화(기본 도구 · 프로젝트 문서 제거) | A 는 Pier 기본 `claude-code` 그대로. 과제 저장소의 기존 문서 · 설정은 두 팔 동일 |
| B 의 실패를 "환경 문제"로 뺀다 | 훅 오차단 · MCP 미연결 · 상주 토큰으로 인한 컨텍스트 초과 전부 B 의 실패(§5.3) |
| 예비 과제로 하네스를 고쳐 같은 과제를 다시 잰다 | 예비 과제 목록은 본실험에서 **제외**. 하네스 수정은 이슈로만 |
| 실패한 실행 비용을 빼거나 서브에이전트 비용을 빠뜨린다 | ② 분모·분자 정의 고정 · `modelUsage` 로 집계(`usage` 금지) |
| 성공한 것만 시간 비교 | ③ⓐ 전체 상한 내 성공률 + ⓑ 공통 성공 짝 — 둘 다 공개 |
| 채점자가 팔을 안다 | 실사용 과제 산출물은 팔 표시를 떼고 무작위 순서로 전달 · 판정 근거(재현 절차) 기록 |
| 결과를 보고 상한·지표를 바꾼다 | 이 문서의 §2–§5 + 표본 목록을 **실행 전 커밋 해시로 고정**하고 보고서에 적는다. 상한의 실제 값은 job 의 `config.json` 에서 읽는다(N8). 과제를 줄일 때는 seed 뒤에서부터, B 결과 전에(N9). 바꾸면 Change Log |
| GLM 의 재시도 지연이 A/B 어느 쪽에만 걸린다 | `api_retry` 가 있는 실행을 표시 · 시간 집계에서 분리 보고 |
| 작은 과제에서 B 가 "일을 키운다" 를 못 본다 | 실사용 과제의 작은 변경 3개 — 변경 파일 수 · 턴 수 · 벽시계를 A 대비 그대로 공개 |

---

## 9. 실행 골격 (위치와 구조 — 실행은 2단계)

```
docs/plans/513-eval-evidence/
├─ sources.md                      출처 33건 · 확인일
├─ feasibility/                    채점기 대조 · 자원표 · 라우팅 스모크 · 하네스 설치 관측 (전부 실측 산출물)
├─ glm-container/
│  ├─ Dockerfile                   eval-513-glm: node:22 + Claude Code 2.1.302 + 하네스 26.174.0 · 토큰 없음 · BASE_URL=Z.ai
│  ├─ entry.sh                     토큰 유무 확인(값 미출력) · 온보딩 플래그
│  ├─ smoke-glm.sh                 돈 안 드는 라우팅 확인 3종(Z.ai · Anthropic 대조 · 네트워크 차단)
│  ├─ run-task.sh                  과제 1개·팔 1개 실행 골격(컨테이너 안) — Pier 밖에서 실사용 과제를 돌릴 때
│  ├─ probe.sh                     curl 직접 대조
│  ├─ harness-in-task.sh           과제 이미지 안 하네스 설치 → git 이 보는 것(§4.3 근거)
│  └─ harness-skipworktree-test.sh 상류 CLAUDE.md 가 있을 때 skip-worktree + exclude 처리 검증(B2 실측)
├─ pier_agent_b.py                 Pier 커스텀 에이전트(모듈 — `--agent-import-path pier_agent_b:HarnessedClaudeCode`): B = 하네스 설치 단계(빌드, git 과제만 git 처리) + run() 앞단 정리 3세션(같은 컨테이너·egress) + B2 재적용 + 과제 세션
├─ check-token-leak.sh             토큰 값으로 산출물 grep — 메모리 비교 · 파일 수만 출력 · 대조군(심은 파일 → 1) 내장
├─ realuse-repo-survey.sh          실사용 후보 저장소의 지시 파일 부재 + 2026-07-01 이후 머지 · 테스트 동반 PR 조사(gh api, 대조군 포함)
└─ run-pilot.sh                    예비 실행 러너 — env-file · provider(glm|anthropic) · bench(deepswe|tbench) · EVAL_TASKS 로 과제 고정(-i). DRY_RUN=1 지원
```

흐름: `EVAL_TASKS='…' run-pilot.sh <env-file> anthropic deepswe` → Pier 가 과제 컨테이너 이미지를 빌드하고(설치 단계에서 Claude Code · [B] 하네스 설치 + skip-worktree/exclude) → [B] `/opt/eval-513` → `/logs/agent` 복사 → [B] 정리 세션 ×3(`agent/prep/`) → B2 재적용 → `claude --print …` → 커밋 수집 → 별도 검증 컨테이너 채점 → `jobs/<job>/<trial>/{config.json, result.json, agent/claude-code.txt, agent/prep/…, agent/sessions/…/*.jsonl, verifier/reward.json, artifacts/model.patch}`. 집계 스크립트 `summarize.sh`(두 job 의 result.json 을 과제로 맞춘 짝 표 · ①②②′③ · `exit 97`/`prep-infra-error` 과제의 양팔 제외 목록 · `prep-failed` 는 B 실패 · 과제 구간 시간 = `agent_execution` − 정리 벽시계)는 2단계 첫 산출물. 실사용 과제는 Harbor 과제 형식(`task.toml` · `instruction.md` = 이슈 본문 · `tests/` = PR 의 테스트 변경 + 기존 스위트 · `environment/Dockerfile` = base 커밋 체크아웃)으로 만들어 같은 러너로 돈다 — 과제 생성 스크립트도 2단계.

---

## 10. 제한된 영역의 스모크 테스트 — 키를 받은 메인 세션이 그대로 따라 한다

전제: 사용자가 메인 세션에 GLM 키를 준다. 레인은 키를 요구하지 않는다. **아래는 유료 실행이다(2단계).** 순서대로 하고 각 단계의 산출물 경로를 보고에 적는다.

1. **env-file 을 저장소 밖에 만든다**(절대 저장소 안 · 커밋 · 로그 금지)
   ```
   mkdir -p ~/eval-513 && chmod 700 ~/eval-513
   printf 'ANTHROPIC_AUTH_TOKEN=%s\n' '<키>' > ~/eval-513/glm.env && chmod 600 ~/eval-513/glm.env
   ```
2. **과제 저장소를 받고 스모크 과제 id 를 고정한다**(재검증 B6 — 클론이 실행보다 앞에 온다)
   ```
   git clone --depth 1 https://github.com/datacurve-ai/deep-swe ~/eval-513/deep-swe   # tasks 35 MB · 과제 이미지는 Pier 가 받는다
   export EVAL_TASKS='textual-kitty-key-phases go-git-worktree-merge-conflicts'          # §3 의 seed 513 목록 앞 2개 — 이름으로 고정
   ```
3. **라우팅 확인(진짜 키, 1턴)** — 비용: 토큰 수백
   ```
   bash docs/plans/513-eval-evidence/glm-container/smoke-glm.sh ~/eval-513/glm.env
   ```
   기대값 표(스크립트도 같은 표를 찍는다):

   | `zai` 결과 | 뜻 |
   |---|---|
   | result `pong` · `modelUsage` 키가 `glm-5.3` 하나 · `usage.input_tokens > 0` · `total_cost_usd` 0/`costBasis unknown` | 정상. 비용 USD 는 신뢰하지 않는다 — 토큰과 Z.ai 콘솔 크레딧이 기준 |
   | `401 token expired or incorrect` | 키가 틀렸다(가짜 토큰 대조와 같은 본문) |
   | **`429 · [1113] Insufficient balance or no resource package`** | **계정·플랜·한도 문제. 라우팅(주소 · 모델 · 인증)은 정상** — 401 이 아니므로 키 인증은 통과한 것. 콘솔에서 한도 · 키 소속(개인/팀 플랜) · 국제판/중국판을 확인 |
   | exit 124(timeout) · 결과 없음 | timeout 이 Claude Code 의 10회 재시도(약 3분)를 담지 못했다 — 스크립트는 400초로 두었다 |

   **메인 세션 실측(진짜 키, 2026-10-18)**: Z.ai 응답 `429 · [1113] Insufficient balance or no resource package`, usage 0, `duration_ms 179768` — 키 인증 통과(401 아님), Claude Code 가 1113 을 재시도 가능으로 보고 약 3분을 썼다. 처음 쓴 `API_TIMEOUT_MS=20000 · timeout 90` 조합은 이 재시도 때문에 결과 없이 124 로 끝났고 네트워크 차단 대조도 124 였다 → 스크립트를 timeout 400초 · 진짜 키일 때 `API_TIMEOUT_MS` 기본값으로 고쳤다. 1113 의 원인(한도 · 키 소속 · 국제판/중국판)은 사용자가 콘솔에서 확인 중 — 결과가 나오면 여기에 적는다. `init.model` 은 `--output-format json` 에 없으므로(N6) `modelUsage` 키로 확인한다.
4. **effort 전달 확인(선택, 1턴)** — `-e CLAUDE_CODE_ALWAYS_ENABLE_EFFORT=1` 을 더해 3 을 반복하고 응답 지연·출력 토큰 차이를 본다. 차이가 없으면 "GLM 에서 effort 미전달"로 기록하고 두 팔 모두 같은 조건이니 그대로 진행.
5. **과제 2개 A/B 각 1회** (DeepSWE, 상한 축소) — B 는 trial 안에서 정리 3회 → 과제 세션(§4.4). 별도 준비 단계는 없다.
   ```
   EVAL_MAX_TURNS=60 EVAL_AGENT_TIMEOUT_MULT=0.5 EVAL_CONCURRENCY=1 \
     bash docs/plans/513-eval-evidence/run-pilot.sh ~/eval-513/glm.env glm deepswe
   ```
   상한: 벽시계 **90분**(10800×0.5 — B 는 정리 3세션 15–45분 추정(§7.2)을 이 안에 포함하므로 0.25(45분)로는 과제 세션이 시작 못 할 수 있다, 3차 검증 B3) · 과제 세션 턴 60 · 정리 세션 턴 60 ×3 · 동시 1. 비용 상한은 턴(60+180)이 맡고 있어 벽시계를 늘려도 크레딧 상한은 그대로다. 스모크 뒤 실측 정리 시간으로 권장안의 `0.67`(2h)이 충분한지 §5.1 에 적는다. 먼저 `DRY_RUN=1` 로 명령을 눈으로 본다(`-i` 두 개가 보여야 한다).
6. **B 가 실제로 B 였는지** (설계 검증 B3 반영 — `init` 에 `hooks` 필드는 없다) — 각 B trial 에서
   ⓐ `agent/claude-code.txt` 첫 줄 `system/init` 의 **`skills`** 에 설치 기록의 스킬 id 전부(`objective-brief` · `audit-harness-fit` · `north-star` · `gh-issue-workflow` · 메서드 스킬 10종) · **`agents`** 에 `reviewer` · `implementer` · **`mcp_servers`** 에 `context7`(status 무관)
   ⓑ 과제 세션 jsonl `agent/sessions/projects/-app/*.jsonl`(B 1개 · A 1개, 호스트 trial 폴더에 남는다)에 session-start 훅 출력 문자열 `Session started. Branch:` — B 에만. 정리 세션 jsonl 은 `agent/prep/sessions/projects/-app/`(Pier 집계 밖, 3차 B1)
   ⓒ `agent/harness-install-record.json` · `harness-git-status-diff.txt`(0바이트) — 설치 단계가 `/opt/eval-513/` 에 쓰고 B 클래스의 `run()` 이 `super().run()` 직전에 `/logs/agent/` 로 복사한 것(빌드 시점에 `/logs/agent` 에 쓴 파일은 실행 시 bind mount 에 가려진다)
   ⓓ A trial 의 같은 자리에 ⓐ 의 하네스 스킬·에이전트·`context7` 과 ⓑ 의 문자열이 **없음**
   ⓔ (D9) `agent/prep/prep-done.txt` 존재 · `agent/prep/session-{1,2,3}.json` 3개 · `agent/prep/prep-timing.txt` 3줄 · `agent/fill-count.txt` 가 `after-install 7 → after-prep <7` **또는** `after-install 0 → prep-git-status.txt 에 CLAUDE.md`(상류 CLAUDE.md 저장소, N2) · 정리 세션이 과제 세션(`claude-code.txt`)보다 **먼저**(세션 jsonl 의 시각 순서) · A trial 에는 `agent/prep/` 이 없음.
   다섯 중 하나라도 어긋나면 결과를 쓰지 않고 멈춘다. `agent/prep-failed.txt` 가 있는 B trial 은 결과를 쓰되 **B 실패**로 집계하고(§5.3), `agent/prep-infra-error.txt` 가 있으면 양팔 재실행. **가짜 토큰 리허설로 양성/음성 대조 완료**(`feasibility/pier-B-arm-rehearsal.md`): B 의 `init.skills` 30개 중 하네스 스킬 **14개 전부** · `agents` 에 `implementer` · `reviewer` · `mcp_servers` = `[{context7, pending, project}]` · 세션 jsonl 에 `Session started. Branch:` **3회** · `/logs/agent/` 에 `harness-install-record.json` · `harness-git-status-diff.txt`(0바이트) · `harness-git.txt`(`skip-worktree .gitignore`); A 는 `skills` 16(내장만) · `agents` 5(내장만) · `mcp_servers []` · 문자열 **0회**. 덤으로 **SessionStart 훅 이벤트(`hook_started` · `hook_response`, `hook_name: SessionStart:startup`)는 `--include-hook-events` 없이도 stream-json 에 항상 나온다** — B 에 1쌍, A 에 0 → ⓑ 의 가장 싼 확인. 주의: B 에서는 이 훅 이벤트가 `init` 보다 앞에 오므로 `init` 은 첫 줄로 읽지 말고 `"subtype":"init"` 으로 찾는다. 보조: `init.memory_paths` 는 두 팔 모두 `{auto: …/memory/}` 만 — `CLAUDE.md` 를 열거하지 않는다(보조 증거로 쓸 수 없음, 실측).
7. **usage · 비용 · 채점 · 결과 위치** — trial 마다
   - `result.json` → `agent_result.{n_input_tokens, n_output_tokens, cost_usd, n_agent_steps}`(**과제 세션만** — 정리 세션은 `prep/sessions` 로 분리돼 Pier 집계 밖, 3차 B1) · `verifier_result.rewards` · `agent_execution`(정리 포함 벽시계)
   - `agent/claude-code.txt` 마지막 `result` 줄 → `usage` · `modelUsage` · `num_turns` · `duration_ms` · `permission_denials` · `api_retry` 유무
   - **정리 구간(B)**: `agent/prep/session-{1,2,3}.json` 의 `modelUsage` · `duration_ms` · `is_error` · `agent/prep/prep-timing.txt`(세션별 벽시계·FILL 수) · `agent/prep/hook-blocks-after-prep.txt`(과제 세션 훅 차단 수의 기준선, N4) — 이것이 ②′ 의 도입 비용. `session-{i}-retry.json` 이 있으면 그 세션은 API 오류로 1회 재실행된 것(첫 시도 JSON 은 그대로 남는다, N1). `prep-infra-error.txt` 가 있으면 `session-*.stderr` 로 원인이 정말 인프라(네트워크 · OOM · `command not found`)인지 먼저 본다 — JSON 없이 죽은 B 고유 결함(훅 오류 등)이 인프라로 분류될 수 있다(N9)
   - `verifier/reward.json`(`reward` · `f2p` · `p2p`) · `artifacts/model.patch`(채점된 diff — 하네스 파일이 들어 있으면 §4.3 실패)
   - Z.ai 콘솔의 5시간 크레딧 소비량(실행 전·후 스냅샷) — 이것이 GLM 의 "비용"
8. **정리** — `docker rmi eval-513-glm` 와 Pier 가 만든 `<task>__*-main` · `*-pier-egress-proxy` 이미지. `~/eval-513/jobs` 는 보존하되 **토큰 값으로** 유출 검사(재검증 B5):
   ```
   bash docs/plans/513-eval-evidence/check-token-leak.sh ~/eval-513/glm.env ~/eval-513/jobs /tmp/eval-513-smoke
   ```
   검사 대상은 **산출물 폴더만**(`jobs/` + 3번 스모크 산출물) — `~/eval-513` 전체를 주면 env-file 자체를 찾아 항상 1 이 난다(3차 검증 B2 실측; 스크립트가 그 호출을 exit 3 으로 거절한다). 토큰은 env-file 에서 읽어 메모리에서만 비교하고 출력은 일치 **파일 수**만. 대조군(토큰을 심은 임시 파일 → 1)이 함께 돌아 0 이 "없다"의 증거가 된다(실측: 심은 파일 1 · 깨끗한 폴더 0 · 1단계 `jobs/` 0 · env-file 포함 폴더 → exit 3 거절). 0 이면 `docs/plans/513-eval-evidence/pilot-smoke/` 에 요약만 복사, 아니면 그 파일은 복사하지 않는다(키는 실행 중 컨테이너 env 에 있어 에이전트가 `env` 를 치면 로그에 남을 수 있다).

이 8단계가 끝나면 권장안(Opus 18 과제)으로 가는 데 바뀔 것은 provider · 과제 목록(§3) · 상한값뿐이다.

---

## 11. 사용자 결정 항목

| # | 결정 | 기본값(가정) | 왜 사용자가 정하나 |
|---|---|---|---|
| D1 | **예산 안** | 권장(예비) — Anthropic 상한 $850(상한용 A 10 + A/B 36 + 정리 54세션) + GLM 은 배관 스모크 2 과제만. 18 과제 = 실사용 6 · DeepSWE 12(T-Bench 는 예비 밖). 실사용 6 이 컨테이너에서 재현되지 않으면 DeepSWE 12 로 시작 | 돈 |
| D2 | **모델 · effort** | Opus 5.5 · high (두 팔 동일) | Fable 5.1 은 2.5배 단가, Opus 5.5 medium(기본)은 더 싸지만 리더보드와 거리가 멀다 |
| D3 | **Anthropic 인증** | API 키(`ANTHROPIC_API_KEY`, 종량 — `total_cost_usd` 가 실제 과금과 같은 가격표) | 구독 토큰(`claude setup-token`)은 비용이 보이지 않고 한도가 실험을 끊는다 |
| D4 | **GLM 토큰 주입** | env-file 하나(`~/eval-513/glm.env`, 저장소 밖 · 0600). 컨테이너 직접 실행은 `docker run --env-file`, Pier 실행은 `pier run --env-file`(dotenv → 호스트 env → 에이전트 컨테이너). **남지 않는 곳** = `pier` 자신의 argv · `lock.json` · `config.json`(마스킹). **있는 곳** = 실행 중 호스트 `ps`(Pier 가 `docker compose exec -e KEY=VALUE` 로 넘긴다) · 컨테이너 env(에이전트가 `env` 를 치면 로그에 남는다) — 단일 사용자 머신 전제. `--ae ANTHROPIC_AUTH_TOKEN=` 은 `pier` argv 에도 남으니 쓰지 않는다 | 키 소유자가 경로와 보관 방식을 정한다 |
| **D9 (결정 2026-10-18)** | **B 의 상태** | **B = 하네스 설치 + 초기 정리 3회**, 비교 대상은 순정 A(미설치). 예비 실험도 이 구성. 정리는 **B trial 안에서**(재검증 2차 구조 — 저장소 단위 재사용이 아니라 trial 마다). 정의·실패 규칙·비용 분리·증거 = §4.4. B 가 과제 중 `.claude/`·`CLAUDE.md` 를 건드린 턴 수는 그래도 따로 센다(§2) | 사용자 결정 완료 |
| D5 | **GLM 약관 해석** | 자동화된 `claude -p` 실행이 "지원 도구 안"인지 **불명확** — 저위험 가정(Claude Code 는 지원 도구, 계정 공유 없음, 동시 1–2) | 위반 시 계정 제한은 사용자의 손실 |
| D6 | **공개 여부** | 설계·스크립트는 이 리포에 공개(이미 공개 리포) · 결과는 본실험까지 비공개 | 예비 결과는 효과 주장이 아니다(§6) |
| D7 | **QnA 를 본실험에 넣는가** | 넣되 Modal — 라이선스 미표기는 Scale 에 확인 뒤 | 비용 + 라이선스 |
| D8 | **실사용 과제 채점자** | 자동 검사(hidden test + 기존 스위트)가 주. 사람 판정은 사용자 본인(팔 가림은 레인이 한다)이되 "수정 없이 수용" 항목마다 **서면 사유**(N11 — 문체로 팔을 알아볼 수 있다) | 수용 기준의 최종 판정자 |

---

## 12. 가정 (문서에 흩어진 기본값을 모았다)

- 이 머신의 Docker Desktop 자원(6 CPU / 8 GB)이 2단계에도 그대로 — 더 주면 동시성 2→3.
- Opus 5.5 가 2단계 시점에도 `opus` 별칭의 대상이다 — 바뀌면 전체 ID(`claude-opus-5-5`)로 핀(이미 그렇게 썼다).
- Pier 0.3.1 의 claude-code 에이전트가 2.1.302 를 npm 으로 설치할 수 있다(설치 명령은 소스에서 확인, 실설치는 2단계 첫 실행에서 확인).
- Z.ai 가 Claude Code 의 `usage` 필드를 Anthropic 형식으로 돌려준다(curl 대조는 오류 본문만 봤다 — 2단계 2번에서 확인).
- 실사용 과제 6개의 시작 커밋에서 `npm run ci` 가 재현 가능하게 돈다(Node 20+, 네트워크 허용).
- "하네스 설치본이 로드된다"의 증거는 `system/init` 의 hooks·skills 목록과 `hook_response` 이벤트로 충분하다(Claude Code 가 CLAUDE.md 를 읽었다는 직접 이벤트는 없다 — 첫 턴 입력 토큰 수 차이(A 대비 +5k 안팎)를 보조 증거로).

---

## 14. 설계 검증(`513-design-verify.md`) 반영 대조표

| 건 | 반영 위치 | 실측 증거 |
|---|---|---|
| B1 실사용 과제의 A 가 이미 하네스 | §5.4 전면 교체 — 지시 파일 없는 공개 저장소 10 후보 · hidden test 채점 · 이 리포 제외 | `feasibility/realuse-repo-survey.md`(18곳 none · 대조군 이 리포 FOUND) |
| B2 `git checkout -- .` 가 부분-A | §4.3 교체 · `pier_agent_b.py` skip-worktree + exclude · 빌드 실패 = 양팔 제외(§5.3) | `feasibility/harness-skipworktree-in-deepswe-image.txt`(import 줄 잔존 · status 동일 · diff 제외) |
| B3 B 증거 4항목 거짓음성 | §10 5 교체 — `init.skills/agents/mcp_servers` · 세션 jsonl `Session started. Branch:` · `/opt/eval-513` 경유 복사 | `feasibility/pier-B-arm-rehearsal.md`(B 양성 · A 음성) |
| B4 Pier 에 `-d` 없음 | §3 T-Bench 행 · `run-pilot.sh` `-p <clone>/tasks -x … --override-gpus 0` | `feasibility/tbench-pier-oracle-nop.txt`(Pier oracle 1 · nop 0 · `-i` 폴더명) |
| N1 토큰 노출 | D4 정정 · §10 7 grep 범위 `jobs/` 전체 | — |
| N2 설치 방식·node 표본 1 | §1.1 · §5.3 | — |
| N3 상한은 Opus A 10건 | §5.1 · §7.2 | — |
| N4 벤치마크별 SE | §6 | — |
| N5 D9 B 의 상태 | §11 D9 · §2 원인 분석용 | — |
| N6 MCP 상태 기록 | §2 원인 분석용 | — |
| N7 시간 주값 `agent_execution` | §2 ③ | — |
| N8 `config.json` 에서 읽는다 | §5.1 · §8 | — |
| N9 seed 뒤에서부터 · 실행 전 확정 | §3 · §8 | — |
| N11 자동 검사 우선 · 서면 사유 | §5.4 · D8 | — |
| 더 단순한 대안 1–3 | §0 추천 · §3 · §6 기준점 · §7.2 | — |
| **D9 사용자 결정** (B = 설치 + 초기 정리 3회) | §4.4 · §4.2 · §2 ②′ · §7.2 도입 비용 행 · §10 5/6ⓔ/7 · `pier_agent_b.py` | 프롬프트·FILL 수 6 은 설치 화면·`src/project-claude-merge.ts` 실측 · trial 내 정리 리허설 = `feasibility/pier-B-inline-prep-rehearsal.md` |

**2차 검증(`513-design-verify-r2.md`) 반영**

| 건 | 반영 | 증거 |
|---|---|---|
| B1 prep.tar 키 잘림 · '설치만 한 B' 분기 | **구조 변경** — 정리를 B trial 안에서(키·tar·분기 없음) | `pier_agent_b.py` `run()` · 리허설 |
| B2 T-Bench `/app` 비-git | `_git_guard` — git 과제만 git 처리; T-Bench 는 예비 밖, 본실험 git 초기화 결정 항목(§3) | — |
| B3 정리 실패 삼킴 · `-uall` · 겹쳐 풀기 | 세션별 판정(API 1회 재실행 · 그 밖 B 실패) · `-uall` · tar 없음 | `pier_agent_b.py` · 리허설(401 → 재실행 → `prep-infra-error.txt`) |
| B4 정리가 네트워크 열린 컨테이너 | 같은 Pier egress 안에서 정리 | 리허설의 `egress-proxy/` |
| B5 토큰 grep 이 토큰을 안 봄 | `check-token-leak.sh` — 값으로 grep · 메모리 비교 · 건수만 · 대조군 1 | 실측 심은 파일 1 · 깨끗 0 · `jobs/` 0 |
| B6 §10 순서 · 과제 id | 클론 → `EVAL_TASKS` 고정(seed 513 목록 앞 2) → 실행 | `sample513.py` 재현(iterdir 순서 의존 명시) |
| B7 R4 cobra 04-24 · structlog 06-01 | 날짜 필터를 스크립트에 · R4 = `go-chi/chi` #1159(08-27) · structlog 풀 제외 · 이유 한 줄 | `realuse-repo-survey.md`(머지일 열) |
| N1 프롬프트 ≠ 바이트 동일 | "명령형으로 옮긴 고정 문장" 으로 서술 | — |
| N2 상류 CLAUDE.md 저장소 FILL 0 | ⓔ 두 갈래 | — |
| N3 ②′ 가 `usage` | `modelUsage` 로 | — |
| N4 exit 98 구별 불가 | 빌드 실패 = `exception.txt` 'exit 97' · 실행 중 = `prep-failed.txt`/`prep-infra-error.txt` 파일로 구별 | — |
| N5 run() 경로 리허설 없음 · 사용자 차이 | 새 구조 리허설 · 설치 단계 `chmod a+rwX` 하네스 파일 전부 | 리허설 |
| N6 `.mcp.json` tracked | `SHARED_TRACKED` 에 추가 | — |
| N7 예산 재계산 | §7.2 — T-Bench 0 · 정리 = B trial × 3 | — |
| N8 설치 오류 삼킴 | `prep-b.sh` 삭제로 해당 없음 | — |
| N9 base 커밋에서 지시 파일 재확인 | §5.4 규칙 ⓕ | — |

**3차 검증(`513-design-verify-r3.md`) 반영**

| 건 | 반영 | 증거 |
|---|---|---|
| B1 정리 토큰·스텝이 `agent_result` 에 합산 | `_prep_session` 이 `CLAUDE_CONFIG_DIR=agent/prep/sessions`(Pier 집계 밖) · §4.4 모델 일관성 · §10 6ⓑ/7 · `run-pilot.sh` 주석 | 리허설 B3: `agent/prep/sessions/projects/-app/*.jsonl` 생성 · `agent/sessions/` 비어 있음 · `n_agent_steps 0`(`feasibility/pier-B-inline-prep-rehearsal.md`) |
| B2 §10 8 이 env-file 을 훑어 항상 1 | 검사 대상 = `~/eval-513/jobs /tmp/eval-513-smoke` · `check-token-leak.sh` 가 env-file 포함 폴더를 exit 3 으로 거절 | 실측: env-file 포함 폴더 → exit 3 · `jobs/` → 0 |
| B3 §10 5 상한 45분 vs 정리 15–45분 | `EVAL_AGENT_TIMEOUT_MULT=0.5`(90분) · 근거 문장 | — |
| N1 재실행이 JSON 덮어씀 | `session-{i}-retry.json` | 리허설 B3 |
| N2 정리가 커밋을 만들면 | `head-before.txt` 대조 → exit 95 사유 | — |
| N3 `.gitignore` 추가 패턴 | §4.3 한계 ⓑ | — |
| N4 `hook-blocks.log` 기준선 | `prep/hook-blocks-after-prep.txt` | — |
| N5 `_claude_env` 두 키 | `FORCE_AUTO_BACKGROUND_TASKS` · `ENABLE_BACKGROUND_TASKS` 추가 | — |
| N6 `init.model` 은 json 에 없음 · `API_TIMEOUT_MS` | §10 3 `modelUsage` 키로 · 스크립트: 진짜 키면 기본값, timeout 400초 | 메인 세션 진짜 키 실측(1113) |
| N7 T-Bench 잔존 문장 4곳 | §0 · §6 · §6.1 · D1 | — |
| N8 B 의 API 노출량 공시 | §5.3 | — |
| N9 JSON 없는 실패 = 인프라 분류 | §10 7 — `session-*.stderr` 로 먼저 확인 | — |
| **진짜 키 실측 기록**(메인 세션) | §1.6 행 추가 · §10 3 기대값 표 · `smoke-glm.sh` 기대값 출력 | 1113 · usage 0 · 179768 ms — 요약만 |

## 13. 1단계에서 하지 않은 것 (Non-Goals 확인)

유료 실행 0회(진짜 GLM 토큰 포함) · 본실험 미착수 · 다른 CLI 비교 없음 · `src/` 무수정 · 하네스 기능 변경 없음 · QnA 환경 미기동(16 CPU 요구 + 유료 채점 — 이유 §1.3). 레인 전용 이미지 `eval-513-glm` · Pier 가 만든 과제·프록시 이미지 · 내려받은 DeepSWE 과제 이미지(2.76 GB)는 작업 끝에 `docker rmi` 로 지웠다(T-Bench 과제 이미지는 Harbor 가 실행 뒤 스스로 지운다). 호스트에 남긴 것 = `uv tool` 로 설치한 `datacurve-pier 0.3.1` · `harbor 0.24.0`(2단계에서 다시 쓴다 · `uv tool uninstall` 로 제거 가능) · 스크래치패드의 벤치마크 저장소 클론(날짜가 바뀌면 비워진다).
