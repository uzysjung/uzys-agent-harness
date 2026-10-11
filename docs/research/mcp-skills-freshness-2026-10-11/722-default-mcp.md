# #722 MCP 기본 3종 재판정 — 조사 보고서

- 조사일: 2026-10-11 · 조사 범위: 읽기 전용 (저장소 수정 없음, npm install 없음)
- 판정 기준: **"이게 설치 사용자가 AI 코딩 도구로 개발을 잘하게 만드는가"** → 그다음에 기술적 타당성

## 요약 — 질문별 추천

| # | 질문 | 추천 | 한 줄 근거 |
|---|---|---|---|
| ① | gh CLI 를 쓰면 github MCP 가 필요한가 | **기본에서 제거** (원하는 사람은 공식 서버를 opt-in) | 지금 까는 패키지는 **deprecated·보관(archived)된 옛 서버**이고 토큰이 연결되지 않아 비인증 상태(공개 저장소만, 시간당 60회)로 돈다. Anthropic 공식 문서는 GitHub 작업에 `gh` CLI 를 권한다 |
| ② | chrome-devtools 는 MCP 가 나은가 CLI 가 나은가 | **MCP 는 유지하되 웹 트랙 기본으로 범위 축소** (tooling·data·executive 는 opt-in) + `--no-usage-statistics` 추가 | 4개 CLI 에 같은 설정 하나로 닿는 건 MCP 뿐이다(자체 CLI 는 아직 experimental, 전역 설치 필요). 비웹 트랙에는 쓸 곳이 없고, Google 사용 통계 수집이 기본으로 켜져 있다 |
| ③ | context7 은 MCP 가 나은가 CLI 가 나은가 | **유지 (MCP 그대로)** | 도구 2개라 상주 비용이 작다. 키 없이 4개 CLI 에서 바로 돈다. CLI+스킬 모드(`ctx7 setup`)는 로그인이나 API 키가 필요하고, Upstash 는 둘 중 하나를 권하지 않는다 |
| ④ | 꼭 필요한데 빠진 MCP 가 있는가 | **기본으로 추가할 MCP 없음** | 벤더 목록(Codex 공식)에 더 있는 것은 서비스 전용(Figma·Sentry·OpenAI Docs)이다. 대신 **Antigravity 에는 하네스가 MCP 를 하나도 안 깐다**는 대칭 결손이 있다(별도 이슈 후보) |

---

## ① github MCP — 기본에서 제거

### 확인한 사실

**지금 까는 패키지는 지원이 끝났다.**
- 실측 `npm view @modelcontextprotocol/server-github name version deprecated --json` (2026-10-11):
  `"version": "2025.4.8"`, `"deprecated": "Package no longer supported. Contact Support at https://www.npmjs.com/support for more info."`
- 실측 `npm view @modelcontextprotocol/server-github time --json`: 마지막 판 `2025.4.8` = **2025-04-08** (약 18개월 갱신 없음). `time.modified = 2026-09-17` (deprecated 표시가 이 날 붙었다고 **추정** — npm 은 표시 날짜를 따로 주지 않는다)
- 실측 `gh api repos/modelcontextprotocol/servers-archived`: `archived: true`, 설명 "Reference MCP servers that are no longer maintained". `contents/src` 목록에 `github` 가 있다 → 원본 소스가 보관 저장소로 옮겨졌다.

**토큰 없이 돈다 → 비인증 상태다.**
- 하네스 `templates/mcp.json` 의 github 항목에 `env` 가 없다. Codex 템플릿은 토큰 줄이 **주석**이다(`templates/codex/config.toml.template:61-63`).
- 옛 서버 소스(`servers-archived/src/github/common/utils.ts:42-43`)는 `GITHUB_PERSONAL_ACCESS_TOKEN` 이 **있을 때만** `Authorization` 헤더를 붙인다 → 없으면 비인증 호출. 비인증 GitHub API 는 공개 데이터만, 시간당 60회다(GitHub REST 일반 사양 — 이번에 원문 재확인은 안 함). 쓰기 도구(PR 생성·머지 등)는 실패한다.
- 도구 수 = 26개(옛 소스 `index.ts` 의 `name:` 목록 · 이번 세션에 실제로 연결된 `mcp__github__*` 26개와 일치).

**현행 공식 대안 = `github/github-mcp-server`.**
- 실측 `gh api repos/github/github-mcp-server`: `archived: false`, `pushed_at 2026-10-08`, stars 33,504, 최신 릴리스 `v2.0.2` (2026-10-08).
- 배포 형태: **원격** `https://api.githubcopilot.com/mcp/`(Streamable HTTP, OAuth 또는 PAT 헤더) · **Docker** `ghcr.io/github/github-mcp-server` · Go 바이너리. **npm 배포는 없다** — 실측 `npm view @github/github-mcp-server` → E404.
- 인증: 원격은 OAuth 또는 `Authorization: Bearer <PAT>`. README: "Each MCP host application needs to configure a GitHub App or OAuth App to support remote access via OAuth" — Claude Code 공식 설치 가이드(`docs/installation-guides/install-claude.md`)는 원격에 **PAT 헤더**를, 로컬에 Docker(OAuth 또는 PAT)를 안내한다. 즉 **어느 경로든 설치자가 인증을 따로 해야 한다.**
- 기본 toolset = `context, repos, issues, pull_requests, users`. `--toolsets` 로 줄이면 "reduce the context size" (README).

**gh CLI 대 MCP — 벤더 권고.**
- Anthropic, Claude Code Best practices (https://code.claude.com/docs/en/best-practices, 확인 2026-10-11):
  > "CLI tools are the most context-efficient way to interact with external services. If you use GitHub, install the `gh` CLI. Claude knows how to use it for creating issues, opening pull requests, and reading comments. Without `gh`, Claude can still use the GitHub API, but unauthenticated requests often hit rate limits."
- OpenCode 공식 문서 (https://opencode.ai/docs/mcp-servers/, 확인 2026-10-11):
  > "Certain MCP servers, like the GitHub MCP server, tend to add a lot of tokens and can easily exceed the context limit."
- Codex 공식 문서 (https://learn.chatgpt.com/docs/extend/mcp?surface=cli): GitHub MCP 를 "흔한 서버" 목록에 넣는다 — "manages GitHub beyond what git supports, such as pull requests and issues". 이는 **git 대비** 설명이고, gh 대비 우위 주장은 아니다.
- gh 가 못 하는 것: `gh api` 가 REST·GraphQL 을 전부 부를 수 있어서, 기능상 MCP 만 가능한 GitHub 작업은 찾지 못했다. MCP 가 나은 경우는 **셸이 없는 호스트**(웹 채팅·IDE 원격 에이전트)이거나 OAuth 흐름을 호스트가 대신 해 주는 경우다. 하네스의 4개 CLI 는 모두 셸이 있다.

### 판정
- 첫 질문(개발을 잘하게 하나): 지금 설정은 **비인증·지원 종료 서버**라 private 저장소를 못 보고 쓰기도 안 된다. 같은 일을 에이전트가 `gh` 로 이미 더 잘 한다(Anthropic 공식 권고). 설치자에게 남는 이득이 없고, Codex·OpenCode 에서는 26개 도구 스키마가 매 세션 상주한다(아래 §4개 CLI 차이).
- → **기본에서 제거.** 원하는 설치자만 공식 서버를 opt-in 으로 받게 한다. 인증이 필요하니 "기본으로 깔고 토큰은 알아서"는 같은 실패(조용한 비인증)를 되풀이한다.

---

## ② chrome-devtools — MCP 유지, 웹 트랙 기본으로 축소 + 사용 통계 끄기

### 확인한 사실

**현행 상태.**
- 실측 `npm view chrome-devtools-mcp`: `1.10.1`, modified 2026-09-23. 실측 `gh api repos/ChromeDevTools/chrome-devtools-mcp`: `archived: false`, pushed 2026-10-11, stars 53,257, 최신 릴리스 `chrome-devtools-mcp-v1.10.1` (2026-09-23).
- 기능 (README): 성능 트레이스·인사이트, 네트워크·콘솔(source-map 스택), 스크린샷, puppeteer 기반 자동화. `docs/tool-reference.md` 는 범주별 도구를 나열(입력 10 · 내비 6 · 에뮬 2 · 성능 3 · 네트워크 2 · 디버깅 9 · 메모리 14 · 확장 5 · 서드파티 2). 일부 범주는 플래그로만 켜진다. **이번 세션에 실제로 연결된 기본 도구 = 30개**(`mcp__chrome-devtools__*` 목록 직접 셈).
- `--slim` 모드 = 기본 작업용 도구 3개(`docs/slim-tool-reference.md` 의 `###` 3개). 콘솔·네트워크가 빠지므로 디버깅 가치가 사라진다 → 권하지 않음.

**자체 CLI 모드가 생겼다 — 단 experimental.**
- `docs/cli.md`: "The `chrome-devtools-mcp` package includes an **experimental** CLI interface". `npm i chrome-devtools-mcp@latest -g` 로 전역 설치 → `chrome-devtools <tool> ...`. 백그라운드 MCP 데몬의 클라이언트로 돈다. "The CLI enables unrestricted filesystem access by default."
- 저장소에 `skills/` (a11y-debugging · chrome-devtools-cli · chrome-devtools · cookie-debugging · debug-optimize-lcp · memory-leak-debugging · troubleshooting) 와 `.claude-plugin/`·`gemini-extension.json` 이 있다.

**설치자에게 알리지 않은 데이터 전송이 기본으로 켜져 있다.**
- README "Usage statistics": "Google collects usage statistics (such as tool invocation success rates, latency, and environment information)… Data collection is **enabled by default**. You can opt-out by passing the `--no-usage-statistics` flag". `CI` 환경변수가 있으면 꺼진다.
- 하네스 `templates/mcp.json` 의 args = `["-y", "chrome-devtools-mcp@latest"]` → **설치자 PC 에서는 수집이 켜진 채로 나간다.** 성능 도구는 CrUX API 로 트레이스 URL 을 보낼 수 있다(`--no-performance-crux` 로 끔).

**CLI별 내장 대안.**
- Claude Code: Chrome 통합(https://code.claude.com/docs/en/chrome) — Claude in Chrome 확장 + **Pro/Max/Team/Enterprise 직계약** + `/login` 필요. API 키·Bedrock·Vertex·Foundry 사용자는 못 쓴다. "Enabling Chrome by default increases context usage since the browser tools and their instructions are always loaded." → 모든 설치자를 덮지 못한다.
- Codex: 공식 문서 "Browser isn't available in Codex CLI or the Codex IDE extension."(https://learn.chatgpt.com/docs/browser?surface=app) → **Codex CLI 사용자에게는 외부 브라우저 도구가 유일한 경로다.** Codex 공식 MCP 문서는 Playwright·Chrome DevTools 를 흔한 서버로 든다.
- Antigravity: 내장 browser subagent(공식 문서 `antigravity.google/docs/ide/browser` — 검색 요약으로만 확인, 원문 미열람 → **미검증**).
- OpenCode: 내장 브라우저 근거 못 찾음(미확인 — 웹검색 1회).

**CLI 대 MCP 토큰 비교 근거.**
- Microsoft `playwright-cli` README(1차 출처, `gh api repos/microsoft/playwright-cli/readme`): "Modern coding agents increasingly favor CLI–based workflows exposed as SKILLs over MCP because CLI invocations are more token-efficient: they avoid loading large tool schemas and verbose accessibility trees… MCP remains relevant for… persistent state, rich introspection…" — **벤더 주장**, 수치 없음.
- 4배(114k 대 27k 토큰) 수치는 2차 출처뿐이고 1차 출처에서 못 찾았다. 반대로 DEV Community 재측정(@playwright/mcp 0.0.78 대 @playwright/cli 0.1.17)은 "차이가 약 1% 로 좁혀졌다"고 한다(커뮤니티, 원문 미열람 → **미검증**). → 수치 판정 불가.
- Claude Code 에서는 tool search 가 기본이라 MCP 도구는 **이름과 서버 지시문만** 상주한다(아래 §2 근거) → Claude Code 에 한해 "CLI 가 상주 비용이 싸다"는 논거가 대부분 사라진다.
- 하네스는 이미 `agent-browser`(vercel-labs, Playwright 래퍼 CLI)를 **opt-in 카탈로그**로 갖고 있다(`src/external-assets.ts:644-655`, 고정 `0.31.0` · npm 최신 `0.39.0`).

### 판정
- 첫 질문: 웹 UI 를 만드는 설치자에게는 **확실히 돕는다** — Anthropic 이 "에이전트가 스스로 검증할 수단(브라우저 스크린샷 포함)"을 첫 번째 모범 사례로 든다(best-practices "Give Claude a way to verify its work"). Codex CLI 는 내장 브라우저가 없어 더 그렇다.
- 그러나 **tooling·data·executive 트랙**에는 웹 화면이 없다. 거기서는 Codex·OpenCode 에 30개 도구 스키마가 매 세션 상주하는 비용과 사용 통계 전송만 남는다.
- CLI 로 교체하지 않는 이유: chrome-devtools CLI 는 experimental + 전역 설치 + 스킬 배선이 CLI마다 따로 필요하고, 4개 CLI 에 한 설정으로 닿는 형태가 MCP 뿐이다. 토큰 우위 수치도 확정되지 않았다.
- → **MCP 유지 + 웹 트랙(csr-* · ssr-* · full) 기본으로 축소, 나머지는 opt-in + args 에 `--no-usage-statistics` 추가.** (구현 경로 참고: 트랙별 조건부 서버는 `templates/track-mcp-map.tsv` 의 track_pattern 으로 이미 표현된다 — 결정 뒤 구현 레인 몫.)

---

## ③ context7 — MCP 그대로 유지

### 확인한 사실
- 실측 `npm view @upstash/context7-mcp`: `4.3.0`, modified 2026-10-09, deprecated 없음. 실측 `gh api repos/upstash/context7`: `archived: false`, pushed 2026-10-10, stars 62,892.
- 도구 2개(`resolve-library-id`, `query-docs`) — README "MCP Tools".
- **CLI 가 생겼다**: npm `ctx7` `0.6.0`(최초 2026-01-21). README: "Works in two modes: **CLI + Skills** — installs a skill that guides your agent to fetch docs using `ctx7` CLI commands (no MCP required) · **MCP**".
- CLI 문서(https://context7.com/docs/clients/cli, 확인 2026-10-11): 두 모드 중 **권고 없음, 토큰 수치 없음**. `ctx7 library`/`ctx7 docs` 는 인증 없이 동작("Most commands work without authentication"). 단 `ctx7 setup` 은 로그인(OAuth) 또는 `--api-key` 필요. CLI+Skills 모드 대상 플래그 = `--claude --cursor --codex --opencode --antigravity`, MCP 모드 = `--claude --cursor --opencode`.
- API 키: **선택**. README "API Key Recommended: Get a free API key… for higher rate limits"; MCP 패키지 README "Context7 API Key (Optional) for higher rate limits and private repositories". 무료 계정 = 월 1,000회, 초과 시 하루 20회 보너스(https://context7.com/plans). **키 없는(익명) 사용의 한도는 공개 문서에 없다(미확인).**
- Codex 공식 MCP 문서가 Context7 을 "a free MCP server for developer documentation" 로 들고, 예시 명령이 정확히 `codex mcp add context7 -- npx -y @upstash/context7-mcp` 다.

### 판정
- 첫 질문: 라이브러리 사양을 학습 시점이 아닌 현행 문서로 확인하게 해 준다 — 이 리포의 ADR-053 이 "API 레퍼런스는 context7 으로 조회 가능하므로 상주시킬 이유가 없다"고 이 서버를 전제로 쓴다.
- CLI 로 바꿀 이득: 도구 2개분 스키마 상주를 없애는 것뿐인데 Claude Code 는 이미 지연 로드한다. 반대로 스킬을 CLI 4개에 각각 깔아야 하고 setup 이 로그인을 요구한다.
- → **유지.** (선택 개선, 근거 약함: 설치자가 키를 가졌을 때 `--api-key` 를 받는 경로 — 이번 범위 아님.)

---

## ④ 빠진 MCP — 기본 추가 권고 없음

### 확인한 사실
- Codex 공식 "흔한 MCP" 목록: OpenAI Docs · Context7 · Figma · Playwright · Chrome DevTools · Sentry · GitHub. 하네스에 없는 것은 **OpenAI Docs(OpenAI 개발 전용) · Figma · Sentry(해당 서비스 사용자 전용)** — 모든 설치자에게 기본으로 넣을 근거가 아니다.
- Claude Code best-practices 는 MCP 를 "Notion, Figma, your database" 같은 **각자 쓰는 외부 도구 연결**로 설명한다 — 특정 MCP 의 기본 탑재 권고는 없다.
- Antigravity 공식 MCP 문서(https://antigravity.google/docs/mcp)도 기본 탑재 권고 없음.
- OpenCode 공식 문서는 반대로 MCP 를 늘리면 컨텍스트가 빨리 찬다고 경고한다.

### 판정에 덧붙일 관측 2건 (MCP 추가가 아니라 별도 이슈 후보)
1. **Antigravity 에는 하네스가 MCP 를 깔지 않는다.** 실측 `bash scripts/check-absence.sh --canary 'mcp_config.json' -i 'mcp_config|serverUrl' src templates` → 매치 0 (canary 통과, 136 파일), `--canary 'MCP server' -i 'mcp' src/antigravity` → 매치 0. Antigravity 의 설정 위치는 워크스페이스 `.agents/mcp_config.json`, 원격은 `url` 이 아닌 `serverUrl` 필드(공식 문서). Claude·Codex·OpenCode 는 받는 context7 을 Antigravity 만 못 받는다 — 표면 대칭 결손.
2. **LSP(코드 인텔리전스)**: Anthropic best-practices 가 "If you work with a typed language, install a code intelligence plugin" 이라고 권한다. MCP 가 아니라 Claude Code 플러그인이고 하네스 카탈로그에 없다(실측 `check-absence --canary 'typescript-lsp' -i 'lsp|code.intelligence' src/external-assets.ts` → 0건). 이번 질문(MCP) 범위 밖이라 후보로만 적는다.

---

## Anthropic "Code execution with MCP" (2025-11-04) 요지
- 출처: https://www.anthropic.com/engineering/code-execution-with-mcp (확인 2026-10-11, 발행일 November 4, 2025)
- 문제: "Most MCP clients load all tool definitions upfront directly into context" + "Every intermediate result must pass through the model."
- 제안: MCP 서버를 **코드 API** 로 보여 주고 에이전트가 코드를 써서 호출(도구 = 파일시스템의 파일). 중간 데이터는 실행 환경에서 걸러 모델에 안 올린다. 예시 "150,000 tokens to 2,000 tokens… 98.7%".
- 대가: "Running agent-generated code requires a secure execution environment with appropriate sandboxing… operational overhead".
- 이번 판정과의 관계: 같은 방향(도구 정의 상주를 줄인다)이 Claude Code 에서는 **tool search 기본값**으로 이미 제품화돼 있다. OpenAI 측 MCP 대 CLI 공식 글은 찾지 못했다(미확인 — Codex MCP 문서·검색 1회).

---

## 4개 CLI별 차이

| CLI | 하네스가 쓰는 설정 | 형식 | MCP 도구 정의 상주 여부 | 내장 브라우저 |
|---|---|---|---|---|
| **Claude Code** | 프로젝트 `.mcp.json` | `{"mcpServers": {name: {"type":"stdio","command","args"} \| {"type":"http","url","headers"}}}` | **지연 로드가 기본** — "Only tool names and server instructions load at session start"(https://code.claude.com/docs/en/mcp §Scale with MCP tool search). Sonnet/Haiku/Opus 4.5 이상. 비 1st-party `ANTHROPIC_BASE_URL`, Foundry(Azure), Vertex 구형 모델에서는 전부 상주. 프로젝트 `.mcp.json` 서버는 대화형 세션에서 **승인 프롬프트**를 띄우고, `claude -p`·SDK·클라우드 세션에서는 묻지 않고 로드 | 있음(Claude in Chrome, 유료 직계약 + 확장 필요) |
| **Codex CLI** | `.codex/config.toml` `[mcp_servers.<name>]` | stdio `command/args/env/cwd`, HTTP `url` + `bearer_token_env_var`, `enabled`, `enabled_tools`/`disabled_tools`. 프로젝트 설정은 **trusted 프로젝트만** | 공식 문서에 지연 로드 설명 없음. 이슈 openai/codex#24536(2026-05-26, codex-cli 0.133.0)의 소스 인용: `DIRECT_MCP_TOOL_EXPOSURE_THRESHOLD = 100` 을 넘을 때만 `tool_search` 뒤로 미룬다 → **하네스 3종(2+26+30=58개)은 문턱 아래라 전부 상주로 추정** (공식 문서 아님 · 버전에 따라 바뀔 수 있음) | CLI 에는 없음(공식) |
| **OpenCode** | `opencode.json` `mcp.<name>` | local `{"type":"local","command":[...],"environment","enabled"}`, remote `{"type":"remote","url","headers","oauth"}` | 지연 로드 언급 없음 → **상주로 취급**. 공식 경고: "it adds to the context… GitHub MCP server… can easily exceed the context limit". 끄기 = `enabled: false` | 근거 못 찾음 |
| **Antigravity** | **하네스가 쓰지 않음**(위 실측) | 전역 `~/.gemini/config/mcp_config.json` · 워크스페이스 `.agents/mcp_config.json`, `mcpServers` + `command`/`serverUrl`(`url`·`httpUrl` 미지원) | 공식 MCP 문서에 언급 없음(미확인) | 있음(browser subagent — 원문 미열람) |

---

## Research Ledger — 9 confirmed · 7 killed

### Confirmed (1차 출처·실측)
1. `@modelcontextprotocol/server-github` deprecated, 마지막 판 2025-04-08, 원본이 `servers-archived`(archived: true)로 이동 — npm view · gh api.
2. 하네스 github 항목은 토큰 없이 돌고, 옛 서버는 토큰이 없으면 비인증 호출 — 템플릿 + 옛 소스 `utils.ts:42-43`.
3. 공식 GitHub MCP = `github/github-mcp-server` v2.0.2, 원격 `api.githubcopilot.com/mcp/`·Docker·바이너리, npm 배포 없음(E404), 인증 필수.
4. Anthropic 공식: "CLI tools are the most context-efficient way…install the `gh` CLI" — best-practices 원문.
5. Claude Code MCP tool search 기본 활성, 세션 시작 시 이름·서버 지시문만 로드 — mcp 문서 원문.
6. chrome-devtools-mcp 에 experimental CLI 와 skills 가 있고, Google 사용 통계가 기본 활성 — README·docs/cli.md 원문.
7. Codex CLI 에 내장 브라우저 없음 — 공식 문서 원문.
8. context7 CLI(`ctx7`)+스킬 모드 존재, 두 모드 간 권고 없음, API 키 선택, 무료 월 1,000회 — README·CLI 문서·plans 페이지.
9. 하네스는 Antigravity 에 MCP 를 쓰지 않는다 — check-absence 실측(canary 통과).

### Killed (기각한 주장과 이유)
1. **"Playwright CLI 가 MCP 보다 4배 싸다(114k 대 27k)"** — 1차 출처(Microsoft README)에 수치가 없고, 같은 방향의 재측정이 차이 ~1% 를 보고. 수치는 쓰지 않는다.
2. **"Antigravity 는 서버당 100개 도구 상한 / 50개 미만 권장"** — 서드파티 문서 2곳이 서로 다른 수를 말하고, 공식 MCP 문서에 없음.
3. **"server-github 는 토큰이 없으면 시작이 안 된다"** — 소스상 헤더만 생략하고 동작한다(그래서 더 나쁘다: 조용히 비인증).
4. **"context7 은 이제 API 키가 필수다"** — README 와 MCP 패키지 문서 모두 Optional.
5. **"공식 GitHub MCP 를 npx 로 받을 수 있다(@github/github-mcp-server)"** — npm E404.
6. **"Codex CLI 에 내장 브라우저가 있다"** — 공식 문서가 CLI·IDE 확장에서 불가라고 명시(데스크톱 앱 전용).
7. **"OpenCode 도 MCP 도구를 지연 로드한다"** — 공식 문서에 근거 없음, 오히려 컨텍스트 경고만 있음.

---

## Caveats
- **도구 스키마 토큰 크기는 실측하지 않았다.** 서버를 실제로 띄워 `tools/list` 를 재려면 npx 설치가 필요해 범위 밖. 도구 **개수**만 셌다(context7 2 · github 26 · chrome-devtools 30 — 이번 세션 연결 목록 직접 셈). Codex·OpenCode 에서의 상주 비용 주장은 "개수 × 스키마"의 정성 판단이다.
- Codex 의 100개 문턱은 이슈 작성자의 소스 인용(0.133.0)이지 공식 문서가 아니다. 현행 버전 값은 미확인(`gh search code` 가 결과를 돌려주지 않아 직접 확인 실패).
- 비인증 GitHub API 60회/시간은 GitHub 일반 사양으로 적었고 이번에 원문을 다시 열지 않았다. Anthropic 문서의 "unauthenticated requests often hit rate limits" 가 같은 방향을 뒷받침한다.
- GitHub 원격 MCP 의 OAuth 를 Claude Code·Codex·OpenCode 가 각각 그대로 받는지는 미확인 — GitHub 공식 Claude 가이드는 PAT 헤더만 안내한다.
- Antigravity 내장 브라우저와 OpenCode 내장 브라우저 여부는 원문 미열람/근거 미발견.
- context7 익명(키 없는) 사용 한도는 공개 문서에 없다.
- `server-github` 의 deprecated 표시 날짜(2026-09-17)는 `time.modified` 로부터의 추정이다.
- ② 의 "웹 트랙만"은 트랙 이름으로 웹 여부를 가른 것이다. `full` 을 웹에 넣었고, `executive` 트랙 사용자가 웹 화면을 만드는 경우는 고려하지 않았다(그 경우 opt-in 으로 받는다).
