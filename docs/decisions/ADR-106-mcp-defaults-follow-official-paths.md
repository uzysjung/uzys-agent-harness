# ADR-106: MCP 기본은 현행 공식 경로가 정한다 — 원격(HTTP) 서버 지원 · github 기본 제거와 공식 서버 opt-in · chrome-devtools 웹 트랙 한정 · Railway 원격 교체 · Vercel opt-in

- Status: Proposed
- Date: 2026-10-11
- PR: (머지 때 채운다)
- Issue: #722 · #711 · #712 · #713 · #714
- Amends: ADR-101 결정 2(Vercel MCP 를 넣지 않는다 — stdio 전용 조립) · 결정 3(railway 행의 정의와 tier 근거 repo) · 결정 6(배지
  문구) · Consequences 의 "몫 기록이 없는 옛 기록 … 설치자 것으로 분류돼 그대로 남는다(관리 밖)" 한 문장. ADR-102 의 "Next.js 의
  Vercel 기본은 공식 MCP(#711)로 채운다" 한 구절. ADR-063 은 그대로다.
- 설계 문서: `docs/plans/v26.167.0-mcp-design.md`(설계 검증 BLOCKER 3 반영 절 포함) · 검증 `docs/plans/v26.167.0-mcp-design-verify.md`
- 조사 근거: `docs/research/mcp-skills-freshness-2026-10-11/722-default-mcp.md` · `711-714-remote-mcp.md`

## Context

사용자 결정(이슈 #722 댓글 2026-10-11, 재론 없음): ① 기본 `github` 서버(`@modelcontextprotocol/server-github`)를 뺀다 — 상류
deprecated 이고 토큰 없이 깔려 있었다. GitHub 공식 원격 서버는 원하는 사람만 고른다 ② `chrome-devtools` 는 웹 트랙(csr-* · ssr-* ·
full)의 기본이고 Google 사용 통계를 끈다(`--no-usage-statistics`), 나머지 트랙은 고르면 들어간다 ③ context7 유지 · 기본 추가
없음 ④ Vercel 공식 원격 MCP 를 opt-in 으로(#711, Antigravity 제외) ⑤ Railway 행을 공식 원격 서버(`https://mcp.railway.com`)로
(#712) ⑥ `vercel-cli` 핀 63.1.2(#714). ⑦ railway 의 trust tier 는 ★ 규칙대로 experimental 유지(메인 결정).

걸림돌은 전제 하나였다 — 하네스의 MCP 조립은 stdio 서버만 표현했다(`McpServerConfig = { command, args }`). 원격 서버를 쓰려면 세
렌더러(`.mcp.json` · Codex · OpenCode)가 각자 형식으로 원격 정의를 내야 하고, 기존 설치본은 update 에서 무엇이 바뀌었는지와 무엇을
해야 하는지(로그인 · 빼는 명령)를 화면에서 받아야 한다.

## Decision

1. **원격 서버는 트랙 표의 행 하나다.** `templates/track-mcp-map.tsv` 3열이 리터럴 `url` 이면 원격 행이고 4열은
   `{"url":"https://…","bearerEnv"?:"NAME"}`. 기본 트랙이 없는 서버는 패턴 `-`(어떤 트랙과도 맞지 않는다 — 카탈로그 `internal`
   자산으로만 고른다). 내부 모델은 stdio/http 유니온이고 Claude 형식으로 바꾸는 함수(`toClaudeServer`)를 `.mcp.json` 에 쓰는
   자리 · 그 값과 대조하는 자리만 거친다. 서버 정의의 원천은 여전히 한 곳(ADR-101 결정 3).
2. **토큰은 파일에 쓰지 않는다.** `bearerEnv` 는 환경변수 **이름**만 — Claude `headers.Authorization: "Bearer ${NAME}"` · Codex
   `bearer_token_env_var = "NAME"` · OpenCode `headers.Authorization: "Bearer {env:NAME}"` + `oauth: false`.
3. **GitHub 공식 서버는 다른 이름 `github-mcp`**(`https://api.githubcopilot.com/mcp/`, `GITHUB_PAT`). 같은 이름 `github` 를 쓰면
   ADR-101 결정 4ⓑ 가 기록된 옛 몫을 "선택" 으로 읽어 PAT 없는 설치자 모두에게 매 세션 실패하는 서버를 조용히 깐다.
4. **`templates/mcp.json` 은 context7 하나.** chrome-devtools 는 트랙 표 행(`csr-*|ssr-*|full`, `--no-usage-statistics`) + 카탈로그
   `internal` 항목(vetted · opt-in · understanding)으로, vercel · github-mcp 는 패턴 `-` 행 + 카탈로그 항목(vetted · opt-in)으로.
   네 항목 모두 `cliSupportOverride: claude · codex · opencode`(Antigravity 변환에는 MCP 가 없다).
5. **옛 값 표(`PRIOR_MCP_SERVERS`)** — 하네스가 전에 `.mcp.json` 에 쓴 값(github · 옛 railway · 옛 chrome). 쓰는 곳은 옛 로그(몫 기록
   전)의 내용 식별 · uninstall 잔존 안내(알리기만) · 화면의 까닭. **지우는 근거는 은퇴한 이름(github)에만** 쓴다. 트랙 표에 살아 있는
   이름은 옛 로그에서 값으로 알아봐도 **선택 근거로만** 넘긴다(`legacyMcpServers` — 하네스가 만든 파일이라는 기록 + 하네스가 쓴 값과
   같음). 그래서 같은 디스크는 이전 판(기록 있음/옛 로그)과 무관하게 같은 결과를 받는다(설계 검증 B1 ⓐ).
6. **화면이 실제로 한 일을 말한다.** `.mcp.json` 줄에 `updated: <name> (<까닭>)` · `retired: github — <까닭과 대안>`. 기록으로 남은
   서버가 그 트랙의 기본이 아니면 같은 자리에 "not a default on <tracks> — kept because your install record has it; drop it: …
   --without <id>"(설계 검증 B3). 원격 서버의 첫 사용 로그인 · 토큰 안내는 install 요약 NEXT 와 **update 요약 NEXT**(이번에 더했거나
   갈아 끼운 원격 서버가 있을 때만) 두 자리에 같은 문장으로(설계 검증 B2).
7. 위저드 3단계 배지 — 트랙 기본으로 체크된(설치 전) experimental 은 `⚠ experimental (default on your tracks)`, 그 밖은
   `⚠ experimental (opt-in)`(#713).

## Alternatives (기각)

- 카탈로그 `method: mcp-remote` — 서버 정의의 원천이 둘로 갈린다(ADR-101 Alternatives ⓑ 와 같은 사유).
- 같은 이름 `github` + "기록 sha 가 옛 정의면 선택 근거가 아니다" 예외 — `selectedMcpServers` 에 경우별 예외가 생기고, 설치자가 옛
  항목을 고친 경우 `.mcp.json` 은 kept 인데 Codex · OpenCode 에는 새 서버가 들어가 세 자리가 갈린다.
- railway 를 `railway mcp` stdio 로 — Railway CLI ≥ 5.44 설치를 전제한다.
- chrome-devtools 를 CLI/스킬로 — experimental · 전역 설치.
- GitHub 를 OAuth 로 — 호스트마다 GitHub App 등록이 필요하고 세 CLI 의 등록 여부가 확인되지 않았다(공식 Claude 가이드는 PAT).
- 옛 로그의 살아 있는 이름(railway · chrome)을 PRIOR 값으로 seed 해 걷기(설계 초안 §7.2 C) — 옛 로그 ssr-nextjs 의 railway 처럼 행이
  살아 있는 서버가 사라지고, 같은 디스크가 기록 유무로 다른 결과를 받는다(설계 검증 B1).

## Consequences

- 세 CLI(Claude · Codex · OpenCode)가 원격 MCP 를 같은 렌더에서 받는다. Antigravity 는 여전히 MCP 를 받지 않는다(`.mcp.json` 은 CLI
  무관하게 쓰이지만 Antigravity 는 읽지 않는다).
- 새 설치에는 github 가 없다. 기존 설치본의 옛 github 는 하네스가 쓴 값 그대로면 update · 플래그 없는 install 이 세 자리에서 걷고
  화면이 까닭과 `--with github-mcp` 를 말한다. 설치자가 고친 항목은 `kept yours` 로 남는다(이후 하네스 관리 밖).
- 비웹 트랙 새 설치에는 chrome-devtools 가 없다. **기록된 chrome-devtools 는 모든 트랙에서 남고** 인자만 갱신되며, 비웹 트랙에서는
  화면이 "이 트랙의 기본이 아니다 · 빼는 명령" 을 말한다(B3).
- **ADR-101 Consequences 개정**: 몫 기록이 없는 옛 기록(v26.161 이하)에서 하네스가 만든 `.mcp.json` 에 하네스가 쓴 값 그대로 남은
  고를 수 있는 서버(예: #710 전 ssr-nextjs 기본이던 railway)는 **여전히 남는다** — 다만 "관리 밖" 이 아니라 기록된 몫과 같이 다뤄
  새 값(원격)으로 갈아 끼우고 그 뒤로는 기록이 이어진다. 값이 다르면(설치자가 고침) 종전대로 건드리지 않는다.
- 옛 로그에서는 남길 서버를 **기록이 아니라 하네스가 썼던 값과의 대조**로 알아본다 — 그래서 첫 update 의 "kept because your install
  record has it" 은 옛 로그에선 문자 그대로가 아니고(기록된 것은 "하네스가 만든 파일" 까지), 위저드 3단계는 그 서버를 한 번 미체크로
  보인다. 그 실행부터 몫이 기록돼 이후엔 맞다. 이 대조(만든 기록 · 바이트 동일)는 `tests/mcp-migration-167.test.ts` C 절이 문다.
- 기록에 `excluded: mcp:chrome-devtools`(키 id) 가 있는 설치본은 이 판의 update 뒤 Codex · OpenCode 에서도 chrome-devtools 가 빠진다
  (ADR-101 결정 5 — 고를 수 있는 서버의 키 id 빼기는 세 자리에 닿는다. 종전엔 `.mcp.json` 에서만 뺐다).
- `--without mcp:github` 은 이제 모르는 키 id 다(렌더 집합 밖).
- 원격 서버는 첫 사용 때 로그인(OAuth)이 필요하다 — 실계정 통과는 이 판에서 검증하지 않았다(조사 Caveats).
- 카탈로그 총계 **+3**(github-mcp · vercel · chrome-devtools). 절대값은 `npm run gen:compat` 이 정한다(병행 레인 #726 과 머지 순서
  무관).
- `vercel-cli` 핀 63.1.2 — `update` 는 기존 설치자의 `package.json` 을 바꾸지 않는다(자산 재설치 없음).
- trust-tier-drift 감시 repo: railway-mcp-server → `railwayapp/cli`(621★, experimental 유지) · chrome-devtools →
  `ChromeDevTools/chrome-devtools-mcp` · github-mcp → `github/github-mcp-server` · vercel → `vercel/vercel`(원격 서버에 공개 저장소가 따로
  없으면 같은 벤더 저장소).
