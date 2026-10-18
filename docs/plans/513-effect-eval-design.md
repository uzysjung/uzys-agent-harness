# #513 1단계 — 하네스 효과 측정: 실행 가능성 조사와 예비 실험 설계

- 작성 2026-10-18 · 설계 레인(단일 에이전트 · `src/` 무수정 · 유료 실행 0회) · 브랜치 `feat/513-effect-eval`
- 입력: 이슈 #513 본문(사용자 리서치 2026-09-21) · 사용자 추가 요구(GLM Coding Plan 실행 환경 · 키는 env-file · 제한 스모크 절차) · `docs/NORTH_STAR.md` §1 · `docs/USAGE.md` · `docs/TRACKS.md` · `src/manifest.ts` · `test/docker/`
- 증거: `513-eval-evidence/` — `sources.md`(출처 33건 · 확인일) · `feasibility/`(채점기 대조 4건 · 자원표 3건 · 라우팅 스모크 · 하네스 설치 관측) · `glm-container/`(Dockerfile · 스크립트) · `pier-agent-b.py` · `run-pilot.sh`
- 2026-10-15 에 같은 작업이 한도로 중단돼 산출물이 없었다 — 이 문서는 처음부터 다시 썼고, 절마다 push 한다.

---

## 0. 결론 먼저

**실험 질문** — 같은 모델·같은 Claude Code 판에서 이 하네스를 설치하면(B) 미설치(A)보다 필요한 품질의 작업을 더 높은 확률로, 더 적은 총비용·시간으로 완성하는가.

**실행 가능성 판정 (이 머신 · Docker Desktop 6 CPU / 8 GB · arm64, 2026-10-18 실측)**

| 벤치마크 | 로컬 실행 | 채점기 대조(정답 통과 · 빈 변경 실패) | 걸림돌 |
|---|---|---|---|
| **DeepSWE v1.1** (113) | **가능** — Pier 0.3.1 + Docker. 과제 이미지는 linux/amd64 (에뮬레이션, 2.76 GB) | **통과** — oracle `reward 1` (f2p 6/6 · p2p 6/6) · nop `reward 0` (f2p 0/6 · p2p 6/6). 각 1.5분 | 과제가 2 CPU / 8 GB 를 요구 → 로컬 동시 실행은 1~2개. 에이전트 네트워크는 BASE_URL 호스트만 |
| **Terminal-Bench 4.0** (66) | **CPU 과제 63개 가능** — Harbor 0.24.0 + Docker. GPU 과제 3개(`fp8-rmsnorm-gemm` · `jax-speedrun-gpu` · `math-eval-grader`)는 제외 | **통과** — `sound-change-cascade` oracle `1` · nop `0`. 각 1분 | 16 CPU / 16–32 GB 과제 14개는 로컬 불가(Modal 필요). 공식 상한 8시간 — 자체 상한을 둔다 |
| **SWE-Atlas-QnA** (124) | **로컬 부적합** — 모든 과제가 16 CPU / 16 GB 를 요구. 공식 권장은 Modal | **미실행** — 채점이 LLM(Opus 4.5)이라 oracle 대조도 유료 | 코드 변경 시 실패 처리 → B 의 하네스 파일을 채점 diff 에서 빼는 절차가 필수(§4.3). 예비 실험에서 제외, 본실험에서 Modal 로 |
| **GLM 실행 컨테이너** `eval-513-glm` | **준비됨** — Claude Code 2.1.302 + 하네스 26.174.0, 토큰은 `--env-file` 로만 | **라우팅 확인** — 가짜 토큰이 Z.ai 에 도달해 Z.ai 형식 401(`token expired or incorrect`)을 받았고, BASE_URL 을 비운 대조는 Anthropic 형식 401(`Invalid bearer token`)을 받았다 | Claude Code 가 Z.ai 의 401 을 재시도 가능으로 보고 **10회 지수 백오프(3분)** 로 재시도한다 → 인증·한도 오류가 시간 지표를 오염시킨다(§8) |
| **예비 실행 경로 리허설** (Pier → DeepSWE 컨테이너 → Claude Code → Z.ai) | **끝까지 이어짐** — Pier 가 amd64 과제 컨테이너에 Claude Code 2.1.302 를 설치하고 `api.z.ai` 만 허용하는 egress 프록시로 실행 | 가짜 토큰이라 401×10 뒤 `NonZeroAgentExitCodeError` — Pier 가 실패를 기록하고 검증기는 reward 0 을 냈다. 토큰은 로그에 0회, `config.json` 에는 마스킹 | 6분(이미지 빌드 포함). 진짜 키로 남은 확인 = `usage` 형식 · effort 전달(§10) |

**1회 실행(과제 1개 · 팔 1개) 추정** — Anthropic 종량 · Opus 5.5 · effort high: DeepSWE **$6–15 · 20–60분**, Terminal-Bench **$5–15 · 20–90분**, 실사용 과제 **$1–4 · 5–30분**. 근거는 §7 (DeepSWE 공식 평균 — Opus 5 max $11.84 · Fable 5 xhigh $13.41 — 에 Opus 5.5 단가($4/$20, Opus 5 의 80%)를 적용한 범위다. **Claude Code 로 돈 공개 수치는 없다** — 그래서 예비 실험의 첫 목적이 이 추정치를 실측으로 바꾸는 것이다).

**예산 세 안** (상세 §7)

| 안 | 과제 | 실행 수 | Anthropic 종량 (추정) | GLM 정액 (크레딧 기준) | 벽시계 |
|---|---|---|---|---|---|
| **최소 신호** | DeepSWE 6 · T-Bench 4 · 실사용 6 = 16 | GLM 32 + Opus 확인 16 | **$100–250** (상한 $250) | Pro 5시간 크레딧의 약 1–2주기 | 2–3일(동시 2) |
| **권장 (예비 실험)** | DeepSWE 12 · T-Bench 6 · 실사용 6 = 24 | GLM 48 + Opus 48 | **$300–700** (상한 $750) | Pro 2–4주기 | 4–6일 |
| **본실험** | 100 (DeepSWE 40 · T-B 20 · QnA 20 · 실사용 20) × 3회 | 600 | **$3,500–8,000** + Modal $100–300 | 해당 없음(Opus 로) | 2–3주 |

**추천 = 권장안을 두 단계로.** ① GLM 정액으로 24과제 A/B 1회 — 배관(설치 · 채점 · 집계)과 하네스가 컨테이너에서 실제로 로드되는지, A 의 시간·턴 분포를 얻어 상한을 고정한다. ② 같은 24과제를 Opus 5.5 high 로 A/B 1회 — 첫 신호. GLM 결과는 Opus 에 대한 효과가 아니다(§6.1). 두 단계 모두 **결과를 발표하지 않는다** — 본실험의 과제군 · 상한 · 지표를 고정하는 데 쓴다.

**사용자 결정 항목** (§10): 예산 안 · 모델/effort(기본 Opus 5.5 high) · 인증(GLM env-file 경로 · Anthropic API 키 vs 구독 토큰) · 공개 여부 · GLM 약관 해석(자동 실행 허용이 명문화돼 있지 않다).

---

## 1. 사실 확인 (출처 번호 = `513-eval-evidence/sources.md`, 확인일 2026-10-18)

### 1.1 DeepSWE v1.1 와 실행기 Pier

- **과제** 113개, 5개 언어(TS · Go · Python · JS · Rust), 91개 저장소. Harbor 과제 형식(`task.toml` · `instruction.md` · `environment/` · `tests/` · `solution/`). 저장소 Apache-2.0 — 단 **과제별 업스트림 코드는 각자의 라이선스**(PROVENANCE.md, 전부 permissive). [S1] [S2]
- **채점(v1.1)**: 에이전트가 커밋한 변경만 `[[verifier.collect]]` 가 `git diff <base> HEAD` 로 뽑아 **별도 깨끗한 컨테이너**에서 테스트. 산출물 `verifier/reward.json`(이진 reward + f2p · p2p 비율) · `ctrf.json`. [S1]
- **Pier 0.3.1** (2026-08-11, Python ≥3.12, Apache-2.0): Harbor 포크. `--agent` 로 `oracle · nop · claude-code · codex · gemini-cli · opencode · cursor-cli · mini-swe-agent · antigravity-sdk`. **Claude Code 를 직접 실행한다** — 컨테이너에 npm 으로 설치(`--ak version=` 핀 가능)하고 `claude --verbose --output-format=stream-json --permission-mode=bypassPermissions --print -- <instruction>` 를 돌린다. `--ak reasoning_effort=`(→ `--effort`) · `max_turns` · `max_budget_usd` · `--ae KEY=VALUE`(에이전트 env) · `--env-file`. 모델은 `-m` 값을 `ANTHROPIC_MODEL` 로 넣고, **BASE_URL 이 있으면 `ANTHROPIC_DEFAULT_{OPUS,SONNET,HAIKU}_MODEL` 과 `CLAUDE_CODE_SUBAGENT_MODEL` 까지 같은 값**으로 묶는다. 네트워크 allowlist = `ANTHROPIC_BASE_URL` 호스트(없으면 `api.anthropic.com`), egress 프록시 컨테이너로 집행. 기본으로 `--disallowedTools EnterPlanMode`. `--env-file` 은 `load_dotenv(override=True)` 로 호스트 프로세스 env 에 올리고, 에이전트가 `ANTHROPIC_AUTH_TOKEN`/`ANTHROPIC_API_KEY` 를 거기서 읽어 컨테이너로 넘긴다 — 명령행 인자에 키가 남지 않는다. **실측**: 이 경로로 DeepSWE 과제 1개를 가짜 토큰으로 돌려 Claude Code 2.1.302 설치 → Z.ai 401×10 → Pier 실패 기록까지 확인(`feasibility/pier-claude-code-glm-fake-token.md`). [S3] [S4] [S5]
- **자원**(task.toml 113개 전수): 전 과제 `cpus = 2` · `memory_mb = 8192` · `storage_mb = 20480` · `gpus = 0` · 에이전트 `timeout_sec = 10800`(3h) · 검증기 1800s · 에이전트 `network_mode = "no-network"`(allowlist 외 차단). 샘플 이미지 **linux/amd64 단일 아키텍처** — arm64 Mac 에서는 에뮬레이션(실측 oracle 1.5분). [`feasibility/deepswe-task-resources.txt`]
- **공개 리더보드 수치**(mini-swe-agent · Modal, Pass@1, 과제당 평균): Opus 5 max 74%±4 · **$11.84** · 118k 출력 토큰 · 99 스텝 / Fable 5 xhigh 70%±3 · **$13.41** / Opus 4.8 max 59%±2 · $13.22 / Sonnet 5 max 54%±4 · $26.40. **벽시계는 공개하지 않는다**(호스트·제공자 부하 의존). Claude Code 로 돈 수치는 없다. [S2]

### 1.2 Terminal-Bench 4.0 와 Harbor

- **과제 66개**(4.0.0 = 3.0 의 74 에서 8개 제거 · 20개 수정, 신규 0). 공식 **에이전트 상한 8시간(28800s)** 전 과제 동일. 저장소 Apache-2.0. 실행 `harbor run -d terminal-bench/terminal-bench@4.0.0 -a claude-code -m anthropic/<model> -k 5` — Harbor 는 `claude-code` 에이전트를 내장. [S6] [S7] [S8] [S9] [S10] [S11]
- **자원**(task.toml 66개 전수): GPU 과제 **3개**(`gpus = 1`). CPU 분포 2(46) · 4(14) · 8(7) · 16(4) · 1(1); 메모리 4096(38) · 8192(22) · 16384(10) · 32768(2). `allow_internet = false` 2개. docker-compose 과제 0. **이 머신(6 CPU / 8 GB)에서 바로 도는 것 = cpus ≤ 4 · memory ≤ 8192 · gpus 0 → 약 50개.** [`feasibility/tbench-task-resources.txt`]
- **채점**: `tests/test.sh` 가 `/logs/verifier/reward.txt`(0/1) 또는 `reward.json`. oracle(`solution/solve.sh`) · nop 에이전트 내장. [S12]

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
| **② 성공 1건당 총비용** | Σ(성공·실패 전부의 비용) ÷ 성공 실행 수. 비용 = `modelUsage` 토큰 × 평가 당시 요율(입력 · 출력 · 캐시 쓰기 · 캐시 읽기 분리). GLM 은 토큰 수와 크레딧 | 완성품 하나에 실제로 얼마 드는가 |
| **③ 완료시간** | ⓐ 전체: 상한 내 성공률과 타임아웃 비율 ⓑ **A·B 둘 다 성공한 같은 과제**의 벽시계 비율(중앙값 · P90). 시계는 지시 전달 → 최종 커밋 | 같은 일을 더 빨리 끝내는가 |
| **④ 수정 없이 수용 가능 비율** (실사용 과제만) | 사전 정의한 수용 기준(§5.4) 전부 충족 ÷ 실행 수. 채점자는 팔을 모른다 | 결과물이 그대로 쓸 수 있는가 |

**원인 분석용(점수 아님)**: 상주 토큰(첫 턴 입력 · B 의 session-start 비용 ~5,795 토큰/세션 — 설치 화면 실측) · 턴 수 · 실패한 도구 호출 수 · `permission_denials` · 훅 차단 수(`hook-blocks.log`) · 컨텍스트 압축 횟수(`compact_boundary`) · 서브에이전트 사용량.

**합산 점수를 만들지 않는다.** 벤치마크마다 따로 보고한다(이슈 원칙 그대로).

---

## 3. 과제군과 과제 수 (예비 실험 = 권장안)

| 과제군 | 수 | 선정 규칙(결과를 보기 전에 고정) | 상한(과제당 · 팔당) |
|---|---|---|---|
| **DeepSWE v1.1** | 12 | `--sample-seed 513 -l 12` (Pier 결정적 표본). 언어 편중이 심하면 seed 를 **한 번만** 바꾸고 바꾼 사유를 기록 | 벽시계 2h(`--agent-timeout-multiplier 0.67`) · 턴 150 · Anthropic $20 |
| **Terminal-Bench 4.0** | 6 | 필터: `gpus = 0` · `cpus ≤ 4` · `memory_mb ≤ 8192` · `allow_internet = true` → 약 50개에서 seed 513 으로 6 | 벽시계 2h(과제별 override) · 턴 150 · $20 |
| **SWE-Atlas-QnA** | 0 | 예비에서는 제외(16 CPU · Modal · 유료 채점). 본실험에 20 | — |
| **실사용 과제** | 6 | 이 저장소 머지 이력에서 §5.4 규칙으로 작은 변경 3 · 기능 1 · 재개 2. 시작 커밋은 그 PR 의 base | 벽시계 45분 · 턴 80 · $8 |
| **합계** | **24** | A/B × 1회 = **48 실행** (GLM 48 + Opus 48 = 96) | |

**최소 신호안**은 같은 규칙으로 DeepSWE 6 · T-Bench 4 · 실사용 6 = 16 과제; **본실험**은 이슈 표(40 · 20 · 20 · 20 × 3회 = 600)를 그대로 쓰되 QnA 와 16 CPU 과제는 Modal 로.

---

## 4. A/B 구성

### 4.1 공통(두 팔 동일)

- Claude Code **2.1.302** 핀(npm) · 모델 **Opus 5.5**(`claude-opus-5-5`) · **effort high** 명시(기본 medium 을 두 팔 다 high 로 — DeepSWE 공식은 max 지만 비용 통제). GLM 단계는 `glm-5.3`(effort 전달 여부는 2단계 첫 확인).
- 실행기 Pier 0.3.1 `claude-code` 에이전트 — `--permission-mode=bypassPermissions` · `--output-format=stream-json --verbose` · `--max-turns` · `--max-budget-usd` · `--effort`. **`--bare` 사용 안 함**(두 팔 모두 프로젝트 `.claude/` · `CLAUDE.md` 를 읽는 정상 모드 — A 는 읽을 것이 없을 뿐이다).
- 격리: 과제마다 새 컨테이너 · `CLAUDE_CONFIG_DIR` 은 컨테이너 안 전용 경로(Pier 기본) · 호스트 `~/.claude` **미마운트** · `DISABLE_AUTOUPDATER=1` · `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` · 세션 잔재 없음(컨테이너 폐기).
- 같은 저장소 · 같은 시작 커밋 · 같은 지시문(벤치마크 `instruction.md` 그대로 — 하네스를 언급하지 않는다) · 같은 CPU/메모리(과제 `task.toml`) · 같은 네트워크 정책.

### 4.2 B 에만 — 설치 명령과 트랙 규칙 (고정)

```
npm install -g @uzysjung/agent-harness@26.174.0
agent-harness install --track base --cli claude        # 벤치마크 과제 전부
agent-harness install --track tooling --cli claude     # 실사용 과제(이 저장소 — 스택이 tooling)
```

- 트랙 규칙: **벤치마크 = `base`**(스택 무관 트랙 — 룰 5 · 에이전트 2 · 훅 2 · 스킬 14 · `context7` MCP · CLAUDE.md 스캐폴드). 과제 저장소의 스택을 보고 트랙을 고르지 않는다 — 고르는 행위 자체가 사람이 개입하는 자리다. 실사용 과제는 저장소가 선언한 트랙(`tooling`) 하나.
- `--with`/`--without` 없음. 특정 스킬을 지시문에서 호출하지 않는다. 설치 뒤 `CLAUDE.md` 의 `<!-- FILL -->` 을 채우지 않는다(설치 직후 상태 = 설치자가 처음 받는 상태).
- 설치 비용은 **에이전트 설치 단계**(Pier 가 네트워크를 여는 구간)에서 쓴다 → 토큰 비용 0, 벽시계는 별도 기록(일회성 도입 비용으로 공시, ③에 포함하지 않는다).
- 하네스 자체를 예비 실험 과제로 **고치지 않는다**. 발견한 결함은 이슈로만 올리고, 고친 판은 본실험에서 쓴다(예비 과제 ≠ 본실험 과제).

### 4.3 B 의 하네스 파일을 채점 diff 에서 빼기 (실측 근거)

DeepSWE 이미지에서 `install --track base --cli claude` 를 돌리면 **`.gitignore` 가 바뀌고(tracked) untracked 6개**(`.claude/` · `.uzys-agent-harness/` · `.mcp.json` · `CLAUDE.md` · `CLAUDE-uzys-harness.md` · `.github/workflows/ci.yml`)가 생긴다(`feasibility/harness-install-in-deepswe-image.txt`). 그대로 두면 에이전트가 `git add .` 한 커밋에 들어가 ⓐ DeepSWE 채점 diff 를 오염시키고 ⓑ QnA 는 "소스 변경"으로 실패한다. 처리(`pier-agent-b.py`): 설치 직후 `git checkout -- .` 로 tracked 변경을 되돌리고, untracked 하네스 경로를 `.git/info/exclude` 에 적는다. **설치 전후 `git status --porcelain` 이 같아야 하고, 다르면 그 trial 은 실패(exit 97)로 기록한다** — 예외를 조용히 만들지 않는다. 되돌린 `.gitignore` 줄은 백업 글롭 · `.env` 등이라 실행에 영향이 없다.

### 4.4 비대칭 주의

- Pier 는 BASE_URL 이 있으면 `CLAUDE_CODE_SUBAGENT_MODEL` 도 같은 모델로 묶는다(GLM 단계). Anthropic 단계에서는 서브에이전트가 Claude Code 기본 규칙을 따른다 — B 의 `reviewer`/`implementer` 에이전트 정의가 모델을 지정하면 그것이 적용된다. **첫 인과 비교는 동일 모델 구성**이라야 하므로 Anthropic 단계도 `--ae CLAUDE_CODE_SUBAGENT_MODEL=claude-opus-5-5`(+ 필요 시 `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1`)로 두 팔 다 묶는다. 저가 모델 위임의 제품 효과는 후속 실험.
- B 의 `context7` MCP 는 DeepSWE(`no-network`)에서 연결 실패 → Claude Code 가 `MCP_TIMEOUT`(30s) 뒤 진행. 그 30초와 실패 로그는 **B 의 비용**이다(환경 문제로 빼지 않는다). Terminal-Bench(인터넷 허용 64개)에서는 작동한다 — 그 효과는 거기서만 측정된다고 표기.
- B 의 `protect-files` 훅이 과제상 필요한 편집(lock 파일 · `.env*`)을 막으면 **B 의 실패**다.

---

## 5. 실행 설계

### 5.1 순서와 반복

- 예비 = 과제당 A/B **각 1회**. 과제 단위로 A→B / B→A 를 seed 로 섞어 비슷한 시간대에 돈다(제공자 부하 편향 분산). `run-pilot.sh` 골격은 팔 단위 — 2단계에서 과제 인터리브로 바꾼다(명시).
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
| GLM 401/1113(한도) 로 재시도 루프 | **그 실행 무효 + 재실행**(한도 회복 뒤). Claude Code 의 10회 재시도(수 분)는 시간 지표를 오염시키므로 `api_retry` 이벤트가 있는 실행은 시간 집계에서 표시한다 |
| 에이전트가 `instruction.md` 밖 정답(업스트림 머지 커밋)을 네트워크로 찾음 | DeepSWE 는 no-network 라 불가. T-Bench 인터넷 허용 과제는 trajectory 에서 fetch 도메인을 사후 점검 |

### 5.4 실사용 과제 후보 (이 저장소 — 공개 저장소라 재현 가능)

선정 규칙: ⓐ 2026-10 머지된 PR 중 이슈에 AC 가 있고 ⓑ `npm run ci` 가 채점기 역할을 하며 ⓒ 하네스 자산(룰 · 스킬 본문)을 고치는 PR 은 제외(B 가 자기 지시문을 바꾸는 과제는 순환). 시작 커밋 = PR base. 지시문 = 이슈 본문의 배경 · 문제 · AC 만(PR 본문 · diff 는 주지 않는다).

| 유형 | 후보 | 수용 기준 예시(채점자용) |
|---|---|---|
| 작은 변경 | #833 — 새 루트 `CLAUDE.md` 에 트랙 안내 줄을 쓰지 않는다 | 지정 테스트 red→green · 기존 스위트 green · 변경 파일이 2개 이하 · 문서에 없는 플래그 주장 0 |
| 작은 변경 | #817/#777 — update·uninstall 화면이 파일마다 한 일을 말한다 | 화면 스냅샷 테스트 통과 · 다른 명령 화면 불변 |
| 작은 변경 | #635 — session-start 가 감지한 SPEC 경로를 안내 | 훅 스크립트 단위 테스트 통과 · shellcheck 0 |
| 기능 추가 | #543 — `uninstall --track` + 위저드 "Remove one track" | AC 5항(마지막 트랙 거절 · 공유 자산 보존 · 기록 갱신 · dry-run · 화면) 전부 · 커버리지 게이트 유지 |
| 작업 재개 | #769 PR 의 중간 커밋에서 시작 — 남은 AC 2개와 리뷰 코멘트를 주고 완성 | 기존 WIP 변경 보존(diff 가 WIP 를 되돌리지 않음) · 남은 AC green · 커밋 메시지가 이슈를 가리킴 |
| 작업 재개 | 릴리즈 커밋 뒤 태그 전 red 상태에서 "CI 를 녹색으로" | **게이트를 고치지 않고** 순서(로컬 태그)로 해결 — 게이트 수정은 실패 |

"필요한 질문"과 "이미 준 정보를 다시 묻는 질문"을 구분해 기록한다(`-p` 에서 `AskUserQuestion` 은 비활성 — 질문은 결과 텍스트의 요청으로 나타난다).

### 5.5 격리 체크리스트 (실행 전 · 매 실행)

호스트 `~/.claude` 미마운트 · 컨테이너 `HOME` 비어 있음 · `claude --version` = 2.1.302 두 팔 · `env | grep -c ANTHROPIC_` 가 기대 수 · B 의 `/logs/agent/harness-install-record.json` 존재 · A 의 `/app/.claude` 부재 · `git status --porcelain` 설치 전후 동일(B).

---

## 6. 통계 해석의 한계

- **표본 24 과제 × 1회**: 해결률 차이의 표준오차 ≈ √(2·p(1−p)/24) ≈ **0.14**(p=0.5). 이 크기로 "유의"하게 보이려면 **30%p 이상** 차이가 나야 한다. 그보다 작은 차이는 **방향도 확정 못 한다**. 예비 실험은 효과 주장이 아니라 ⓐ 배관 ⓑ 상한 설정 ⓒ 본실험 표본 수 산정(관측 분산으로)을 위한 것이다.
- 분석 단위는 **과제별 짝**: 해결률은 McNemar(불일치 쌍 — A성공·B실패 vs A실패·B성공)를 그대로 공개, 비용·시간은 공통 성공 과제의 로그 비율 중앙값 + 부트스트랩 CI. 같은 저장소에서 나온 과제는 상관을 가진다(DeepSWE 91 저장소 / 113 과제).
- **"차이가 안 보인다"는 "같다"가 아니다.** 품질 유지 주장에는 사전에 허용 열화 폭(예: 해결률 −5%p)을 정한 비열등성 검정이 따로 필요 — 본실험 설계 항목.
- GLM 결과와 Opus 결과를 합치지 않는다(§6.1).

### 6.1 GLM 결과의 해석 한계

GLM-5.3 에서 관측된 B−A 차이는 **Opus 5.5 에 대한 효과가 아니다.** ⓐ 하네스 프로즈는 Claude 계열에서 관측된 실수를 전제로 썼다(NORTH_STAR §1 "상주의 근거") ⓑ GLM 은 사고가 항상 켜져 있고 effort 전달이 불명확해 A 의 비용·시간 프로파일이 다르다 ⓒ Z.ai 의 비표준 오류가 Claude Code 재시도를 유발해 시간 분포가 오염될 수 있다. GLM 단계가 답하는 것은 **"배관이 도는가 · 하네스가 컨테이너에서 실제로 로드되는가 · A 의 시간·턴 분포는 어떤가 · 하네스가 명백히 방해하는 과제 유형이 있는가"** 까지다. **Opus 확인 실행**은 같은 24 과제(최소안은 실사용 6 + DeepSWE 2)를 Opus 5.5 high 로 A/B 1회 — 이것이 첫 신호다.

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
| 과제 | 16 (DS 6 · TB 4 · 실 6) | **24** (DS 12 · TB 6 · 실 6) | 100 (DS 40 · TB 20 · QnA 20 · 실 20) |
| 실행 | GLM 32 + Opus 16(실 6 · DS 2 × A/B) | GLM 48 + **Opus 48** | Opus 600 (×3회) |
| **Anthropic 종량** | DS 4×$10 + 실 12×$2.5 ≈ **$70** → 범위 **$100–250**, 상한 $250 | DS 24×$10 + TB 12×$10 + 실 12×$2.5 ≈ **$390** → 범위 **$300–700**, 상한 $750 | DS 240×$10 + TB 120×$10 + QnA 120×$5 + 실 120×$2.5 ≈ **$4,500** → **$3,500–8,000** |
| **GLM 정액** | 32 실행 × (입력 ~1–3M · 출력 ~50–150k 토큰) — 크레딧 공식의 배수가 비공개라 **크레딧 수 추정 불가**. Pro(12,000/5h) 기준 실행 2–4개/5시간 주기로 보고 **2–4주기** | **4–8주기**(1–2일 분산) | 해당 없음 |
| 인프라 | 로컬 Docker $0 | 로컬 $0 | Modal(QnA 16 CPU · GPU 3) **$100–300** |
| 벽시계 | 2–3일 | **4–6일** | 2–3주 |
| 얻는 것 | 배관 + 실사용 방해 여부 | 배관 + 상한 고정 + 첫 신호 + 표본 산정 | 공개 가능한 효과 추정(CI 포함) |

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
| 결과를 보고 상한·지표를 바꾼다 | 이 문서의 §2–§5 + `run-pilot.sh` 의 상한 값을 **실행 전 커밋 해시로 고정**하고 보고서에 적는다. 바꾸면 Change Log |
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
│  └─ harness-in-task.sh           과제 이미지 안 하네스 설치 → git 이 보는 것(§4.3 근거)
├─ pier-agent-b.py                 Pier 커스텀 에이전트: B = claude-code + 하네스 설치 단계(§4.3 처리 포함)
└─ run-pilot.sh                    예비 실행 러너 — env-file · provider(glm|anthropic) · bench · n · seed. DRY_RUN=1 지원
```

흐름: `run-pilot.sh <env-file> glm deepswe 12` → Pier 가 과제 컨테이너를 띄우고(설치 단계에서 Claude Code · [B] 하네스 설치) → `claude --print …` → 커밋 수집 → 별도 검증 컨테이너 채점 → `jobs/<job>/<trial>/{result.json, agent/claude-code.txt, verifier/reward.json, artifacts/model.patch}`. 집계 스크립트 `summarize.sh`(result.json → 과제별 짝 표 · ①②③)는 2단계 첫 산출물.

---

## 10. 제한된 영역의 스모크 테스트 — 키를 받은 메인 세션이 그대로 따라 한다

전제: 사용자가 메인 세션에 GLM 키를 준다. 레인은 키를 요구하지 않는다. **아래는 유료 실행이다(2단계).** 순서대로 하고 각 단계의 산출물 경로를 보고에 적는다.

1. **env-file 을 저장소 밖에 만든다**(절대 저장소 안 · 커밋 · 로그 금지)
   ```
   mkdir -p ~/eval-513 && chmod 700 ~/eval-513
   printf 'ANTHROPIC_AUTH_TOKEN=%s\n' '<키>' > ~/eval-513/glm.env && chmod 600 ~/eval-513/glm.env
   ```
2. **라우팅 확인(진짜 키, 1턴)** — 비용: 토큰 수백
   ```
   bash docs/plans/513-eval-evidence/glm-container/smoke-glm.sh ~/eval-513/glm.env
   ```
   기대: `zai` 결과 `pong` · `anthropic-control` 은 401 · 산출물 `/tmp/eval-513-smoke/zai.json` 에 `usage.input_tokens > 0`, `total_cost_usd` 0 또는 `modelUsage.*.costBasis = "unknown"`(비용 USD 는 신뢰하지 않는다 — 토큰과 Z.ai 콘솔 크레딧이 기준). `init.model` 이 `glm-5.3` 인지 확인.
3. **effort 전달 확인(선택, 1턴)** — `-e CLAUDE_CODE_ALWAYS_ENABLE_EFFORT=1` 을 더해 2 를 반복하고 응답 지연·출력 토큰 차이를 본다. 차이가 없으면 "GLM 에서 effort 미전달"로 기록하고 두 팔 모두 같은 조건이니 그대로 진행.
4. **과제 1~2개 A/B 각 1회** (DeepSWE, 상한 축소)
   ```
   git clone --depth 1 https://github.com/datacurve-ai/deep-swe ~/eval-513/deep-swe   # tasks 35 MB
   EVAL_MAX_TURNS=60 EVAL_AGENT_TIMEOUT_MULT=0.17 EVAL_CONCURRENCY=1 \
     bash docs/plans/513-eval-evidence/run-pilot.sh ~/eval-513/glm.env glm deepswe 2 513
   ```
   상한: 벽시계 30분(10800×0.17) · 턴 60 · 동시 1. 먼저 `DRY_RUN=1` 로 명령을 눈으로 본다.
5. **B 가 실제로 B 였는지** — 각 B trial 에서 ⓐ `agent/harness-install-record.json` 존재 ⓑ `agent/claude-code.txt` 의 `system/init` 이벤트에 `hooks`(SessionStart · PreToolUse) 와 `.claude/skills` 의 스킬 이름이 보임 ⓒ 첫 `assistant` 턴 이전에 `hook_response`(session-start) 이벤트 ⓓ A trial 의 같은 자리에는 그것들이 **없음**. 넷 중 하나라도 어긋나면 결과를 쓰지 않고 멈춘다.
6. **usage · 비용 · 채점 · 결과 위치** — trial 마다
   - `result.json` → `agent_result.{n_input_tokens, n_output_tokens, cost_usd}` · `verifier_result.rewards`
   - `agent/claude-code.txt` 마지막 `result` 줄 → `usage` · `modelUsage` · `num_turns` · `duration_ms` · `permission_denials` · `api_retry` 유무
   - `verifier/reward.json`(`reward` · `f2p` · `p2p`) · `artifacts/model.patch`(채점된 diff — 하네스 파일이 들어 있으면 §4.3 실패)
   - Z.ai 콘솔의 5시간 크레딧 소비량(실행 전·후 스냅샷) — 이것이 GLM 의 "비용"
7. **정리** — `docker rmi eval-513-glm` · `~/eval-513/jobs` 는 보존(토큰 없음 확인 뒤 `docs/plans/513-eval-evidence/pilot-smoke/` 에 요약만 복사).

이 7단계가 끝나면 권장안 1단계(GLM 24 과제)로 가는 데 바뀔 것은 과제 수와 상한값뿐이다.

---

## 11. 사용자 결정 항목

| # | 결정 | 기본값(가정) | 왜 사용자가 정하나 |
|---|---|---|---|
| D1 | **예산 안** | 권장(예비) — Anthropic 상한 $750 + GLM Pro 4–8주기 | 돈 |
| D2 | **모델 · effort** | Opus 5.5 · high (두 팔 동일) | Fable 5.1 은 2.5배 단가, Opus 5.5 medium(기본)은 더 싸지만 리더보드와 거리가 멀다 |
| D3 | **Anthropic 인증** | API 키(`ANTHROPIC_API_KEY`, 종량 — `total_cost_usd` 가 실제 과금과 같은 가격표) | 구독 토큰(`claude setup-token`)은 비용이 보이지 않고 한도가 실험을 끊는다 |
| D4 | **GLM 토큰 주입** | env-file 하나(`~/eval-513/glm.env`, 저장소 밖 · 0600). 컨테이너 직접 실행은 `docker run --env-file`, Pier 실행은 `pier run --env-file`(dotenv → 호스트 env → 에이전트 컨테이너; 인자에 남지 않고 `config.json` 에는 마스킹 — 실측). `--ae ANTHROPIC_AUTH_TOKEN=` 은 `ps` 에 보이므로 쓰지 않는다 | 키 소유자가 경로와 보관 방식을 정한다 |
| D5 | **GLM 약관 해석** | 자동화된 `claude -p` 실행이 "지원 도구 안"인지 **불명확** — 저위험 가정(Claude Code 는 지원 도구, 계정 공유 없음, 동시 1–2) | 위반 시 계정 제한은 사용자의 손실 |
| D6 | **공개 여부** | 설계·스크립트는 이 리포에 공개(이미 공개 리포) · 결과는 본실험까지 비공개 | 예비 결과는 효과 주장이 아니다(§6) |
| D7 | **QnA 를 본실험에 넣는가** | 넣되 Modal — 라이선스 미표기는 Scale 에 확인 뒤 | 비용 + 라이선스 |
| D8 | **실사용 과제 채점자** | 사용자 본인(팔 가림은 레인이 한다) | 수용 기준의 최종 판정자 |

---

## 12. 가정 (문서에 흩어진 기본값을 모았다)

- 이 머신의 Docker Desktop 자원(6 CPU / 8 GB)이 2단계에도 그대로 — 더 주면 동시성 2→3.
- Opus 5.5 가 2단계 시점에도 `opus` 별칭의 대상이다 — 바뀌면 전체 ID(`claude-opus-5-5`)로 핀(이미 그렇게 썼다).
- Pier 0.3.1 의 claude-code 에이전트가 2.1.302 를 npm 으로 설치할 수 있다(설치 명령은 소스에서 확인, 실설치는 2단계 첫 실행에서 확인).
- Z.ai 가 Claude Code 의 `usage` 필드를 Anthropic 형식으로 돌려준다(curl 대조는 오류 본문만 봤다 — 2단계 2번에서 확인).
- 실사용 과제 6개의 시작 커밋에서 `npm run ci` 가 재현 가능하게 돈다(Node 20+, 네트워크 허용).
- "하네스 설치본이 로드된다"의 증거는 `system/init` 의 hooks·skills 목록과 `hook_response` 이벤트로 충분하다(Claude Code 가 CLAUDE.md 를 읽었다는 직접 이벤트는 없다 — 첫 턴 입력 토큰 수 차이(A 대비 +5k 안팎)를 보조 증거로).

---

## 13. 1단계에서 하지 않은 것 (Non-Goals 확인)

유료 실행 0회(진짜 GLM 토큰 포함) · 본실험 미착수 · 다른 CLI 비교 없음 · `src/` 무수정 · 하네스 기능 변경 없음 · QnA 환경 미기동(16 CPU 요구 + 유료 채점 — 이유 §1.3). 레인 전용 이미지 `eval-513-glm` · Pier 가 만든 과제·프록시 이미지 · 내려받은 DeepSWE 과제 이미지(2.76 GB)는 작업 끝에 `docker rmi` 로 지웠다(T-Bench 과제 이미지는 Harbor 가 실행 뒤 스스로 지운다). 호스트에 남긴 것 = `uv tool` 로 설치한 `datacurve-pier 0.3.1` · `harbor 0.24.0`(2단계에서 다시 쓴다 · `uv tool uninstall` 로 제거 가능) · 스크래치패드의 벤치마크 저장소 클론(날짜가 바뀌면 비워진다).
