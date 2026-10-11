# #711 · #712 · #713 · #714 판정 근거 — 원격 MCP · Railway MCP · Vercel CLI 핀

조사일 2026-10-11 · 조사 레인(읽기 전용, 저장소 무수정). 판정 기준 = **설치 사용자가 이걸로 개발을 더 잘하게 되는가.**
표기: **[확인]** 원문·실측으로 확인 · **[벤더]** 벤더 자기 주장(원문 확인했지만 동작 미실측) · **[미검증]** 원문을 못 열었거나 추론.

## 요약 — 이슈별 추천

| 이슈 | 추천(1줄) |
|---|---|
| **#711** | **진행.** 조립에 "원격 URL 서버" 한 종류를 더하면 Claude Code·Codex·OpenCode 세 CLI 모두 공식 형식으로 Vercel MCP 를 받는다(설치 시 네트워크·`package.json` 변경 없음, 핀 썩음 없음). Antigravity 는 우리 변환에 MCP 자체가 없고 Vercel 승인 목록에도 없어 제외. ssr-nextjs 미리 체크 여부는 사용자 결정(아래 근거 참조). |
| **#712** | **#711 의 원격 경로로 Railway 행을 `https://mcp.railway.com`(OAuth)로 바꾼다.** 패키지는 npm 에서 공식 deprecated 확인. `railway mcp`(stdio)는 Railway CLI ≥ 5.44 가 PATH 에 있어야 해서 설치자 전제가 늘어난다. #711 착지 전까지는 현 행 유지(오늘도 기동은 됨). |
| **#713** | **범위 확장은 보류, 화면≠결과 어긋남만 먼저.** 원격+OAuth 는 4개 CLI 모두 지원하지만(표) 우리 Antigravity 변환은 MCP 를 아예 안 내므로 "전부 카탈로그로"는 Antigravity 축에서 이미 비대칭이다. Non-Goals(#262 G) 결정이 선행. |
| **#714** | **63.1.2(오늘 최신)로 핀 갱신 — 설치·실행을 깨는 변경 없음.** 단 Node 18 지원 종료(61.0.0)와 비대화형 `vercel link` 팀 지정 필수(55.0.0)는 설치자 행동에 닿는다. 이슈 본문의 "ssr-nextjs 에서 미리 체크"는 ADR-102 로 이미 opt-in 복귀 — 긴급도 낮음. |

## 사실표 — CLI × 원격(Streamable HTTP) / OAuth

| CLI | 원격 지원 | OAuth(DCR/CIMD 자동) | 프로젝트 범위 설정 형식 | 첫 사용 인증 | Vercel 승인 목록 | 우리 조립 현황 | 출처 · 확인일 |
|---|---|---|---|---|---|---|---|
| **Claude Code** | ✅ [확인] (`type: "http"`, SSE 는 deprecated) | ✅ DCR · CIMD 자동 [확인] | `.mcp.json` → `{"mcpServers":{"vercel":{"type":"http","url":"https://mcp.vercel.com"}}}` | ① 프로젝트 `.mcp.json` 서버는 대화형 세션에서 **사용 승인 프롬프트**가 먼저 뜬다(`claude -p`·SDK 는 묻지 않고 로드) ② 서버가 401/403 을 내면 `/mcp` 에 인증 필요로 표시 → 브라우저 OAuth. 셸에서 `claude mcp login <name>` / 해제 `claude mcp logout <name>` | ✅ | stdio 만 (`McpServerConfig` 에 command·args 필수) | code.claude.com/docs/en/mcp · 2026-10-11 |
| **Codex CLI** | ✅ [확인] | ✅ OAuth 기본, CIMD·DCR 지원 [확인] | `.codex/config.toml` → `[mcp_servers.vercel]` + `url = "https://mcp.vercel.com"` (**trusted 프로젝트만** 로드) | `codex mcp add vercel --url …` 는 추가 시 OAuth 를 감지해 브라우저를 연다 [벤더: Vercel 문서]. **설정 파일로 넣으면** 자동 시작 여부는 문서에 없음 — 공식 문서 문구는 "Run `codex mcp login <server-name>` separately" [확인]. 기능 플래그 언급 없음 | ✅ ("Codex CLI") | stdio 만 (`command`/`args` 두 줄) | learn.chatgpt.com/docs/extend/mcp?surface=cli (developers.openai.com/codex/mcp 308 리다이렉트) · context7 `/openai/codex` (`codex-rs/config/src/mcp_types.rs` StreamableHttp{url, bearer_token_env_var, …}) · 2026-10-11 |
| **OpenCode** | ✅ [확인] | ✅ 401 감지 → OAuth, DCR(RFC 7591) 사용 [확인] | `opencode.json` → `{"mcp":{"vercel":{"type":"remote","url":"https://mcp.vercel.com"}}}` (옵션 `enabled`·`headers`·`oauth`·`timeout`) | 필요 시 자동으로 OAuth 시작, 수동 `opencode mcp auth vercel`. 토큰 = `~/.local/share/opencode/mcp-auth.json` | ✅ | stdio 만 (`toLocal`) | opencode.ai/docs/mcp-servers (context7 `/websites/opencode_ai`) · vercel.com/docs/agent-resources/vercel-mcp §OpenCode · 2026-10-11 |
| **Antigravity** | ✅ [확인] (`serverUrl`; `url`·`httpUrl` 는 **미지원**) | ✅ DCR 지원 서버는 자동, 아니면 `oauth{clientId,clientSecret}` + redirect `https://antigravity.google/oauth-callback` [확인] | 워크스페이스 `.agents/mcp_config.json` · 전역 `~/.gemini/config/mcp_config.json` → `{"mcpServers":{"x":{"serverUrl":"https://…"}}}` | 설정 → Customizations → Authenticate → 브라우저 로그인 → **인가 코드를 복사해 붙여넣기** → Submit | ❌ **목록에 없음** (Vercel: "only supports AI clients that have been reviewed and approved") | **MCP 변환 자체가 없음** (`src/antigravity/` 에 mcp 0건 · 대조군 `src/codex/` 는 2파일 검출) | antigravity.google/docs/mcp · 2026-10-11 |

> Antigravity 로 Vercel MCP 에 붙으면 실제로 거절되는지는 **[미검증]** — Vercel 이 "승인 클라이언트만"이라고 말할 뿐 거절 메커니즘(리다이렉트 URI 화이트리스트 등)은 공개하지 않는다. 계정 없이 실측 불가.

## #711 근거 — Vercel 공식 원격 MCP

**서버 사실** [확인, vercel.com/docs/agent-resources/vercel-mcp, last_updated 2026-09-15]
- "Vercel MCP is Vercel's official MCP server. It's a remote MCP with OAuth … `https://mcp.vercel.com`" · MCP Authorization + Streamable HTTP 사양 구현.
- 승인 클라이언트 목록(원문 순서): Claude Code · Claude.ai/Claude Desktop · ChatGPT · **Codex CLI** · Cursor · VS Code with Copilot · Devin · Raycast · Goose · Windsurf · Gemini Code Assist · Gemini CLI · **OpenCode** · Pi. **Antigravity 없음.** 문서는 `add-mcp` 가 Cline·Zed 등 다른 HTTP 클라이언트도 설정한다고 덧붙인다.
- Gemini CLI/Code Assist 만 `npx mcp-remote https://mcp.vercel.com` stdio 브리지를 안내한다 — **로컬 stdio 공식 패키지는 없다.**
- 프로젝트 한정 URL `https://mcp.vercel.com/<org>/<project>` 가 있다(`vercel mcp --project` 가 씀).
- 도구는 인증 없는 **public tools**(문서 검색 등)와 인증 필요 도구로 나뉜다 [벤더 — 도구 레퍼런스 페이지 본문은 미열람, 개요 문장만 확인].
- 공식 퀵셋업 = `npx -y add-mcp https://mcp.vercel.com -g` (감지된 모든 에이전트, `-g` 전역 / `-y` 무확인·프로젝트 디렉터리).

**`vercel mcp` 명령** [확인, vercel.com/docs/cli/mcp (2026-05-29) + 소스 `packages/cli/src/commands/mcp/{constants,mcp}.ts`]
- `--clients` 값은 **4개뿐**: `Claude Code` · `Claude.ai and Claude for desktop` · `Cursor` · `VS Code with Copilot`. **Codex·OpenCode·Antigravity 미지원.** 비대화형에서 `--clients` 없으면 `missing_clients` 에러.
- Claude Code 분기는 내부적으로 `claude mcp add --transport http vercel https://mcp.vercel.com` 을 **셸 실행**한다 → `--scope` 없음 = **local 스코프**(`~/.claude.json` 의 그 프로젝트 경로 아래, 본인 전용). 즉 `.mcp.json` 에 들어가지 않고 팀과 공유되지 않으며, `claude` 가 PATH 에 없으면 실패 후 수동 명령을 출력한다.
- 54.17.3 → 63.1.2 릴리스 노트에 `vercel mcp` 변경 없음(전문 검색 0건, 대조로 같은 페이지에서 `vercel mcp` 사이드바 항목은 검출).
- 신규 `vercel setup`(docs 2026-10-01): Claude Code·Codex 에 **Vercel 플러그인** 설치 + AI Gateway 연결. MCP 설정 명령이 아니다.

**설치자에게 무엇이 달라지나**
- 지금: vercel-cli(opt-in)를 고른 Claude Code 사용자만 `npx vercel mcp --clients "Claude Code"` 로 붙일 수 있고, 결과는 본인 로컬 스코프. Codex·OpenCode 사용자는 공식 한 줄 경로가 없다(`codex mcp add` / 손편집).
- #711 후: 세 CLI 모두 프로젝트 설정에 Vercel MCP 가 들어가 팀이 같은 도구를 받는다. 설치 시 네트워크·의존성·핀이 없다. 첫 사용에 **Claude Code 는 승인 프롬프트 + `/mcp` OAuth 1회**, Codex 는 `codex mcp login vercel` 1회(자동 여부 미확인), OpenCode 는 자동 OAuth.
- ADR-102 가 vercel-cli 를 opt-in 으로 되돌린 사유(① `package.json` 의존성 추가 ② login 없으면 쓸 것 없음 ③ 핀 낡음) 중 ①③은 원격 MCP 에 해당 없고 ②는 public tools 로 일부 완화된다 [벤더]. → **ssr-nextjs 미리 체크는 근거상 성립하지만, 승인 프롬프트·OAuth 한 번이 추가되는 화면 변화라 사용자 결정 사안**으로 올린다.

**구현 표면(설계 §8-1 재확인, 새 사실만)**: 렌더 3곳 형식은 위 표 그대로. Codex 는 trusted 프로젝트만 `.codex/config.toml` 을 읽는다는 점, Claude Code 는 프로젝트 서버 승인 프롬프트가 있다는 점을 첫 사용 안내에 넣어야 한다.

## #712 근거 — Railway MCP

- **상류 archived 재실측** [확인] `gh api repos/railwayapp/railway-mcp-server` → `archived: true` · 191★ · 마지막 push 2026-05-23.
- **npm deprecated** [확인, 신규 사실] `npm view @railway/mcp-server deprecated` = *"Deprecated: Railway MCP is now bundled into the Railway CLI. Use 'railway mcp'. See https://docs.railway.com/cli/mcp."* · 최신 0.1.12 · 마지막 수정 2026-05-23. → 설치자가 `npx -y @railway/mcp-server` 를 돌리면 npm deprecation 경고를 본다.
- **오늘도 기동은 된다** [확인, 관측] 이 세션의 Claude Code 가 local 스코프의 `npx -y @railway/mcp-server` 로 연결해 도구 약 50개를 나열했다. 도구 호출 성공 여부는 미실측. 동결된 클라이언트라 Railway API 변경 시 깨질 위험은 남는다.
- **현행 공식 경로** [확인, docs.railway.com/ai/mcp-server · docs.railway.com/cli/mcp · context7 `/railwayapp/docs`]
  - 서버 본체는 `mcp.railway.com`. 연결 2가지:
    1. **CLI 경유(기본)**: `railway mcp` (서브명령 없음) = stdio 로 `mcp.railway.com` 에 프록시. `railway login` 자격을 재사용(편집기 설정에 자격 없음, 토큰 자동 갱신). **CLI ≥ 5.44.0 필요** — 이전 버전은 같은 명령이 in-process 로컬 서버를 띄운다. 미인증이면 도구 호출이 "not authenticated" → `railway login` 후 재시작 없이 복구.
    2. **OAuth 직결**: `https://mcp.railway.com` 을 편집기에 직접 — 클라이언트가 OAuth 를 관리, CLI 불필요.
  - 서브명령: `install`(`--agent` 반복 · `--oauth` · `--local` · `--remote`=기본 호환 별칭) · `local`(오프라인 in-process) · `proxy`(= 무인자와 동일, 옛 설정 호환).
  - `railway setup agent [--oauth]` 도 같은 설정을 쓴다.
- **Railway 자체 설치기가 쓰는 형식** [확인, `railwayapp/cli` `src/commands/mcp/install.rs`] — 지원 에이전트 `claude-code · cursor · opencode · codex · copilot · factory-droid · pi` (**Antigravity 없음**), 전부 **사용자 전역 파일**(`~/.claude.json` · `~/.codex/config.toml` · `~/.config/opencode/opencode.json`):
  - Claude Code: OAuth `{"type":"http","url":"https://mcp.railway.com"}` / CLI `{"command":"railway","args":["mcp"]}`
  - OpenCode: OAuth `{"type":"remote","url":"https://mcp.railway.com","enabled":true}` / CLI `{"type":"local","command":["railway","mcp"],"enabled":true}`
  - Codex: `[mcp_servers.<name>]` 에 `url = …` 또는 `command`/`args`.
  → #711 의 원격 형식과 **바이트 수준으로 같은 모양**이다. Railway 행을 원격으로 바꾸면 #711 코드 경로를 그대로 쓴다.
- **최소 CLI · 배포** [확인] `@railway/cli` npm 최신 5.64.2(2026-10-09) · 5.44.0 게시 2026-08-25 · bin `railway` · **postinstall 이 바이너리를 내려받는다**. `npx -y @railway/cli mcp` 로 CLI 선설치 없이 stdio 를 띄우는 안은 **[미검증]**(설치 금지 범위라 실행 안 함; postinstall 네트워크·ignore-scripts 환경 실패 위험).
- **선택지 비교 (설치자 자리)**

| 안 | 설치자 전제 | 첫 사용 | 위험 |
|---|---|---|---|
| A. 현행 유지 `npx -y @railway/mcp-server` | Node | 기존과 같음 | deprecated 경고 · 동결 클라이언트 |
| B. `railway` + `["mcp"]` | Railway CLI ≥ 5.44 가 PATH 에 + `railway login` | 로그인돼 있으면 즉시 | CLI 없으면 서버 기동 실패 — 5개 트랙 기본값이라 다수에게 "빨간 MCP" |
| **C. 원격 `https://mcp.railway.com`** | 없음 | 클라이언트 OAuth 1회 | #711 의 원격 지원이 선행돼야 함 |

  → **C 추천.** 5개 트랙 기본 행이라 전제를 늘리지 않는 쪽이 낫다. railway-skills 플러그인 사용자는 이미 CLI 를 갖고 있겠지만 그건 opt-in 이다.

## #714 근거 — Vercel CLI 54.17.3 → 최신

- **최신** [확인] `npm view vercel version` = **63.1.2** (마지막 수정 2026-10-09). 이슈 본문의 62.2.0 은 이미 낡음. 54.17.3 게시 2026-06-25.
- **engines** [확인] 54.17.3 `node >= 18` → 63.1.2 `node >= 20`. 우리 하네스는 Node 20+ 라 설치는 영향 없음.
- **변경 이력의 SSOT 가 옮겨갔다** [확인] GitHub `vercel/vercel` 의 `packages/cli/CHANGELOG.md`·`package.json` 은 **59.11.7 에서 멈춤**(2026-09-08 "chore: sync from internal" 이후), GitHub release 태그는 58.4.4 까지, npm 에 `gitHead` 없음. 59.12 이후 내용은 **vercel.com/docs/cli/release-notes** 에만 있다(웹 렌더는 본문이 비어 HTML 원문에서 추출). catalog-verify 가 GitHub CHANGELOG 를 읽는다면 60 이후를 놓친다.
- **사이 Major 9개 — 우리 사용(`npm install --save-dev vercel@<핀>` + CLI 실행) 기준 판정**

| 버전 | Major 내용(원문 요지) | 설치 | CLI 실행 | 설치자 행동 영향 |
|---|---|---|---|---|
| 55.0.0 | 비대화형/TTY 없을 때 `vercel link`(및 deploy·pull·dev·git connect)가 기본 팀을 추측하지 않음 — `--scope`/`--team`·`vercel.json` scope·`VERCEL_ORG_ID`·단일 팀이 아니면 `action_required: missing_scope` 로 실패 | 무관 | 영향 | **있음** — 에이전트는 대개 TTY 없이 돌므로 팀이 여럿인 계정은 `--scope` 필요 |
| 56.0.0 | `vercel routes export --format` → `--output` | 무관 | 해당 명령만 | 낮음 |
| 57.0.0 | (Major 항목 없음 — 의존성 major) | 무관 | 무관 | 없음 |
| 58.0.0 | (Major 항목 없음) `vercel.toml` 상시 활성 | 무관 | 무관 | 없음 |
| 59.0.0 | SIEM add-on 구매 지원 제거 | 무관 | 해당 명령만 | 없음 |
| 60.0.0 | `vercel usage --json` 출력 형식 변경(필드 제거) | 무관 | 해당 명령만 | 낮음 |
| 61.0.0 | **Node.js 20 이상 필수**, Node 18 지원 종료 | Node 18 환경에서 실패 | — | 우리 하한이 Node 20 이라 없음 |
| 62.0.0 | `vc traces search` 가 프로젝트 미지정 시 팀 전체 검색 | 무관 | 해당 명령만 | 없음 |
| 63.0.0 | 패키지매니저 설치본의 자기 업그레이드가 항상 `vercel` 패키지를 대상(레거시 `@vercel/vc-native` 래퍼 대상 중단). 동판 minor: Password Protection 첫 활성화는 대화형 확인 필수 | 무관 | `vercel upgrade` 경로만 | 낮음 |

  출처: 55~59 = GitHub CHANGELOG 원문 · 60~63 = vercel.com/docs/cli/release-notes HTML(커밋 해시 1cfef7b · 1efc1ae · 4b90488 · 17637ac) · 2026-10-11.
- **결론**: 핀 갱신이 설치·기본 실행을 깨는 변경은 없다. Docker catalog-verify 로 `npm install --save-dev vercel@63.1.2` + `npx vercel --version` 만 확인하면 된다. 55.0.0 의 비대화형 팀 지정은 오히려 **에이전트가 엉뚱한 팀에 link 하던 사고를 막는 쪽**이라 갱신 이득이다.
- 긴급도: 이슈 본문의 "ssr-nextjs 미리 체크로 새 설치마다 54.17.3 설치"는 **ADR-102(Accepted)로 opt-in 복귀** 후 사실이 아니다 → 고른 사람에게만 닿는다.

## #713 근거 — 카탈로그화 판정용 사실

- 원격+OAuth 는 **4개 CLI 모두 지원**(위 표). 형식만 다르다: Claude `type:"http"+url` · Codex `url=` · OpenCode `type:"remote"+url` · Antigravity `serverUrl`.
- 그러나 **우리 Antigravity 변환은 MCP 를 하나도 내지 않는다**(stdio 포함) — `railway-mcp-server` 의 `cliSupportOverride: ["claude","codex","opencode"]` 가 이를 반영. 카탈로그화 범위를 "4 CLI"로 잡으면 Antigravity MCP 렌더러(`.agents/mcp_config.json`) 신설이 딸려 온다 — 이건 별도 축.
- 서버별 원격 가능성(오늘 기준): context7 · github · chrome-devtools · supabase 의 원격 엔드포인트 유무는 **이번 조사 범위 밖 [미검증]**. chrome-devtools 는 로컬 브라우저를 구동하므로 원격화 대상이 아니다(성질상).
- 이슈가 지목한 실제 사용자 문제 = **"csr-*·ssr-htmx·full 에서 railway 항목이 미체크로 보이는데 트랙 표가 깐다"** — 화면과 결과가 다르다. 이건 범위 결정과 무관하게 고칠 수 있는 단독 결함이다.

## Research Ledger — 12 confirmed · 4 killed

**Confirmed**
1. Vercel MCP = 원격 Streamable HTTP + OAuth, 승인 목록에 Claude Code·Codex CLI·OpenCode 포함, Antigravity 불포함 (vercel docs 원문).
2. `vercel mcp --clients` 값 4개, Codex·OpenCode 없음 (docs + 소스 constants.ts).
3. `vercel mcp` 의 Claude Code 분기 = `claude mcp add --transport http …` → local 스코프(`~/.claude.json`) (소스 + Claude Code docs 기본 스코프).
4. Claude Code `.mcp.json` `type:"http"` · `/mcp`·`claude mcp login` · 프로젝트 서버 승인 프롬프트 · DCR/CIMD (code.claude.com).
5. Codex `[mcp_servers.x] url=` · `codex mcp login` · `.codex/config.toml` trusted 전용 (learn.chatgpt.com + codex-rs 소스).
6. OpenCode `type:"remote"` · 자동 OAuth(DCR) · `opencode mcp auth` (opencode.ai docs via context7).
7. Antigravity `serverUrl`(url 미지원) · DCR 자동 · `.agents/mcp_config.json` (antigravity.google/docs/mcp).
8. `railwayapp/railway-mcp-server` archived (gh api 2026-10-11).
9. `@railway/mcp-server` npm deprecated, 메시지가 `railway mcp` 를 지목 (npm view).
10. `railway mcp` CLI ≥ 5.44.0, OAuth `https://mcp.railway.com`, install 서브명령 형식·대상 에이전트 (docs + install.rs).
11. vercel 최신 63.1.2, engines node>=20, 55~63 Major 내용 (npm view + CHANGELOG + release-notes HTML).
12. 우리 Antigravity 변환에 MCP 없음 (grep 0건, 대조군 src/codex 검출).

**Killed (전제가 틀렸거나 낡음)**
1. "vercel 최신 = 62.2.0"(이슈 #714 · 설계 §2.2) → 63.1.2.
2. "#714: ssr-nextjs 에서 미리 체크돼 새 설치마다 설치" → ADR-102 로 opt-in 복귀.
3. "`npx vercel mcp` 가 Vercel MCP 를 설치자의 `.mcp.json` 에 넣는다"(암묵 전제) → local 스코프에 쓰고 Claude Code 외 우리 CLI 2종은 미지원.
4. "Vercel CLI 변경 이력은 GitHub CHANGELOG 로 본다" → 59.11.7 에서 멈춤, 이후는 vercel.com release notes 전용.

## Caveats

- **실계정 OAuth 실측 없음.** 각 CLI 에서 Vercel·Railway OAuth 가 끝까지 통과하는지는 문서 기반이다. 특히 ① Codex 에서 설정 파일로 넣은 서버가 첫 실행 때 자동으로 OAuth 를 띄우는지(문서상 `codex mcp login` 별도 실행 안내) ② Antigravity 가 Vercel 에 거절되는지 ③ Railway OAuth 가 Antigravity 로 되는지는 **[미검증]**.
- Vercel MCP "public tools(인증 없이)" 범위는 도구 레퍼런스 하위 페이지를 열지 않아 **[벤더 개요 문장만]**.
- vercel release notes 60~63 은 웹 렌더가 비어 HTML 원문에서 해시로 추출했다 — 본문은 원문 그대로지만 해시→버전 귀속은 페이지 구조(역순 나열)로 판단.
- `npx -y @railway/cli mcp` 안은 실행하지 않았다(패키지 설치 금지 범위).
- context7·github·supabase 원격 엔드포인트 존재 여부는 조사 범위 밖.
