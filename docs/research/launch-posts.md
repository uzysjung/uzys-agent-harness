# 게시 글 초안 (M2 — 반자동 게시, 사용자 제출)

> 작성 2026-06-13 · 1인칭 동기 = 사용자 실제 경험 입력 · SSOT: `docs/plans/service-audit-roadmap.md` M2
> 정직성 원칙(전부 본문 명시): vetted ≠ 보안 감사 / 단일 메인테이너 / 4-CLI 비대칭(Claude first-class) / npm pin·plugin·skill HEAD 한계.
> star 수치 = 2026-06-13 실측(`docs/WORKFLOWS.md` 동기화).

## 포지셔닝 한 문장 (차별점)

> **검증된 AI 코딩 스킬·플러그인 중, 내 기술 스택에 꼭 필요한 것만 한 명령으로.**
> "무엇이든 설치"도 "거대한 awesome 디렉토리"도 아닌 — **스택 기반 최소 큐레이션**.

동기(사용자 1인칭): ① 스킬·플러그인 발견 자체가 어려움 ② 순정 에이전트는 강해지는데 불필요한 skill·MCP 과설치 = 컨텍스트만 무거움 ③ awesome-list는 선택 과부하(디렉토리지 큐레이션 아님) ④ 진짜 큐레이션 = 스택 기준 꼭 필요한 것만.

---

## Show HN

**제목**: `Show HN: agent-harness – curate skills/plugins by stack, install what you need`

**제출 폼 입력** (`https://news.ycombinator.com/submit`):

| 필드 | 값 |
|------|-----|
| title | `Show HN: agent-harness – curate skills/plugins by stack, install what you need` |
| url | `https://github.com/uzysjung/uzys-agent-harness` |
| text | (비움 — url 입력 시 link post, text 칸은 무시됨) |

> **HN Show HN 메커니즘**: url=repo 로 link post 제출 → **제출 직후 작성자가 아래 본문을 첫 댓글로** 게시(헤드라인 링크는 이미 repo 이므로 본문에서 링크 중복 불필요). 규칙(showhn.html 확인): 친구 upvote/댓글 요청 금지 · 가입·이메일 장벽 없어야 함(`npx` 한 줄이라 충족) · 초기 단계 OK · 첫 게시이므로 "버전 업데이트 재게시" 제한 무관.

**↓ 제출 직후 첫 댓글 본문** (작성자 자기소개 — 1인칭):

```
I couldn't even tell what coding-agent workflows were out there, let alone which were
worth using. The awesome-lists have hundreds of entries — a directory you scroll, not curation.

Meanwhile Claude Code and Codex keep getting stronger out of the box. I didn't want to bury
that under skills and MCP servers (the extra tools an agent can call) I'd never use — each
one just eats context and makes the agent slower and less focused.

What I wanted: pick my stack and have the *vetted* options for it pre-selected — install only
what this project needs instead of browsing a list. I couldn't find it, so I built it.

Concretely: pick "Next.js + Supabase" and it pre-checks Vercel's React/Next skills, a Supabase
RLS guide, and shadcn — and nothing else. Uncheck anything you don't want.

agent-harness:
- A "track" is a preset for your stack; it pre-checks a vetted set, you review and uncheck.
- "Vetted" = >=1000 stars + active maintenance + a one-off Docker run that actually installs the
  assets (45/48 so far) with the real CLI and confirms they resolve (not just that the package
  exists), re-checked monthly by a CI cron. It is NOT a security audit or a content scan — I say so in the README.
- Beyond frontend/backend/data, there's a Visual & Media set — code-first slides, diagrams,
  motion, video. All opt-in; nothing installs that you didn't pick.
- Claude Code is first-class; Codex, OpenCode, and Antigravity get the rules/skills layer, not the
  full plugin set — I'd rather say so up front than oversell parity. Project scope by default —
  no global pollution unless you ask.
- npm/npx assets are version-pinned; plugin/skill assets resolve to upstream HEAD (can't be
  commit-pinned yet — documented). It backs up your existing .claude/settings.json and
  CLAUDE.md before touching them.

One command:  npx -y @uzysjung/agent-harness

It's early and I'm a solo maintainer — the COMPATIBILITY matrix is honest about what's
verified vs not. Feedback welcome, especially on the curation calls.
```

---

## r/ClaudeCode

**제목**: `A tech-stack-based curator for AI-coding skills/plugins — install only what you need, not a kitchen sink`

본문(페르소나 P0+5 반영, Show HN 압축판) + 아래 비교표 **직접 게재**(링크 유도형 광고 회피):

```
I built agent-harness because I couldn't find curation by tech stack. The awesome-lists are
directories you scroll (hundreds of entries), not curation — and piling on skills/MCP servers
(extra tools the agent calls) I'll never use just eats my agent's context. I wanted: pick my
stack, get only the vetted options for it.

Concretely: pick "Next.js + Supabase" and it pre-checks Vercel's React/Next skills, a Supabase
RLS guide, and shadcn — nothing else; uncheck what you don't want. A "track" is just a preset.

"Vetted" = >=1000 stars + active maintenance + a one-off Docker run that actually installs the
assets (45/48 so far) with the real CLI and confirms they resolve (not just that the package exists),
re-checked monthly by a CI cron — NOT a security audit. Categories span frontend/backend/data plus a Visual & Media set (slides,
diagrams, motion, video). Installs across Claude Code (first-class), Codex, OpenCode, Antigravity.

  npx -y @uzysjung/agent-harness

Solo project — if it saves you setup time, a star helps it reach more people. Feedback very
welcome, especially on the curation calls.

How it compares (★ 2026-06-13):
```

| 프로젝트 | ★ (2026-06-13) | 한 줄 정체 |
|---|---|---|
| Superpowers | 226k | agentic skills 프레임워크 |
| ECC | 214k | 60 agents·230 skills 종합(kitchen-sink) |
| GSD | 64k | get-shit-done 오케스트레이터 |
| addy agent-skills | 57k | 경량 general dev |
| OpenSpec | 55k | spec-driven brownfield delta |
| BMAD-METHOD | 49k | 멀티-에이전트 애자일 |
| wshobson agents | 37k | 멀티-에이전트 오케스트레이션 |
| uzys-harness | (내장) | 6-Gate `/uzys:spec…ship` |

> Claude Code first-class; Codex/OpenCode/Antigravity 는 skills+rules 수준. vetted ≠ 보안 감사. 단일 메인테이너. 피드백 환영.

---

## dev.to 롱폼 글

**제출**: dev.to API `POST /api/articles` (header `api-key`) 또는 웹에디터 → `canonical_url` = repo README. **태그**: `ai` · `claudecode` · `opensource` · `devtools`
**제목**: `I built agent-harness: curate AI-coding skills/plugins by tech stack, install only what you need`

**↓ 본문 (dev.to 붙여넣기 — 마크다운):**

```
## The problem

I couldn't tell which coding-agent skills and plugins were worth using. The awesome-lists have hundreds of entries — a directory you scroll, not curation. Meanwhile Claude Code and Codex keep getting stronger out of the box, and piling on skills and MCP servers (the extra tools an agent can call) I'd never use just eats the agent's context and makes it slower and less focused.

## What I wanted

Pick my stack, get only the *vetted* options for it pre-selected — install what the project needs instead of browsing a list. I couldn't find it, so I built it.

## How it works

- A **track** is a preset for your stack. Pick "Next.js + Supabase" and it pre-checks Vercel's React/Next skills, a Supabase RLS guide, and shadcn — and nothing else. Review and uncheck anything you don't want.
- **"Vetted"** = ≥1000 stars + active maintenance + a one-off Docker run that actually installs the assets (45/48 so far) with the real CLI and confirms they resolve (not just that the package exists), re-checked monthly by a CI cron. It is **not** a security audit or a content scan.
- Beyond frontend/backend/data, there's a **Visual & Media** set — code-first slides, diagrams, motion, video. All opt-in; nothing installs that you didn't pick.
- **Claude Code is first-class.** Codex, OpenCode, and Antigravity get the rules/skills layer, not the full plugin set — I'd rather say so up front than oversell parity.
- Project scope by default — no global pollution unless you ask. npm/npx assets are version-pinned; plugin/skill assets resolve to upstream HEAD (not commit-pinned yet — documented). It backs up your existing `.claude/settings.json` and `CLAUDE.md` before touching them.

## Try it

Run `npx -y @uzysjung/agent-harness`, pick your stack, review the pre-checked set, install.

## Why I'm sharing

It's early and I'm a solo maintainer; the COMPATIBILITY matrix is honest about what's verified vs not. If it saves you setup time, a star helps it reach more people. Feedback very welcome — especially on the curation calls: what's missing, and what shouldn't be there.
```

---

## 게시 순서 (M2)
1. 데모 GIF README 반영 확인 (신 브랜드 ✓)
2. Show HN + r/ClaudeCode (반자동: 폼 채움=에이전트 / 제출 클릭=사용자)
3. 첫 24~48h 댓글 모니터링 + 응답 초안 → 사용자 승인 후 게시
4. star 두 자리 후 awesome-list (bradAGI README PR + hesreallyhim issue form)

---

# 게시 채널 카탈로그 (조사 결과)

> 분류 기준: `agentCanSelfRegister` — **PR/공개 API 경로 = true**, 사람 로그인·captcha·웹폼·에디터 필요 = false.
> 적합도 = `audienceFit`. 미확인 채널은 **(미검증)** 명시. 중복 채널은 dedupe 후 1행.

## A. 에이전트 자동 등록 가능 (사용자 제출 불필요)

PR(`gh`) 또는 공개 API로 사람 개입 없이 완료 가능. 적합도 → 최소노력 순.

| 채널 | URL | 등록방법 | 에이전트가 할 일 | 주의 |
|------|-----|---------|----------------|------|
| awesome-ai-coding (wsxiaoys) | github.com/wsxiaoys/awesome-ai-coding | github-pr | fork → README Projects 섹션에 `- [Name](url): desc.` 1줄 → PR | 최저 마찰(기준·게이트 없음). 단 reach 작음(769★, 유지보수 느림 2026-03) |
| awesome-claude (webfuse-com) | github.com/webfuse-com/awesome-claude | github-pr | fork → Developer Tools/Extensions 섹션 `- [Name](url) - Desc.` 1 PR | OSS+docs 기준 충족. "community engagement(★/fork)" soft bar 일부 미달 가능. 대문자 시작/마침표/trailing ws 금지 |
| jamesmurdza/awesome-ai-devtools | github.com/jamesmurdza/awesome-ai-devtools | github-pr | fork → Terminal>CLI Utilities/Terminal Agents 또는 Agent Infra>Configuration Mgmt 에 1줄 → PR | dev-tool 전용(범용 agent/framework 거부). agent-harness 매핑 깔끔. ~3.8k★ |
| awesome-cli-apps (agarrharr) | github.com/agarrharr/awesome-cli-apps | github-pr | fork → 해당 카테고리 하단 `[APP](LINK) - Desc.`, PR 제목 `Add APP_NAME` | **HARD GATE: repo >90일 + >20★** 선확인 필수(미달 시 자동 거부). OSS 라이선스/쉬운 설치/문서. 'CLI'/'terminal' 단어 금지. default branch=`master`. 1 PR/앱 |
| travisvn/awesome-claude-skills | github.com/travisvn/awesome-claude-skills | github-pr | fork → Tools/Resources 섹션에 1줄 → PR | no-SaaS-wrapper 규칙은 통과(OSS/free). 단 단일 skill 아닌 installer라 fit 부분적. 신규 'social proof' 요구가 초기 솔로에 불리 |
| cursor.directory (joshuaevan) | github.com/joshuaevan/cursor.directory | github-pr | fork → `packages/data/rules/` rule 파일 추가 + `index.ts` 등록 → PR | Cursor rules/MCP 디렉토리라 fit 부분적(코어는 Claude/Codex/OpenCode/Antigravity). MCP listing 경로 미확인 |
| awesome-devtools (devtoolsd) | github.com/devtoolsd/awesome-devtools | github-pr | fork → 'AI Coding Tools' 또는 'CLIs & Terminal Tools' 에 1줄 → PR | reach 작음(666★) + **머지 백로그**(#257~264 대부분 open, push 2025-10). 동명 repo 다수 — 이것만 사용 |
| DEV Community (dev.to) | dev.to | api | `POST /api/articles` (header `api-key`), `{article:{title, body_markdown, published:true, canonical_url, tags}}` | 발행 자체는 완전 자동·에디터 리뷰 없음. **단 계정 생성=사람 1회(OAuth/email)**. api-key 는 설정에서 self-generate. canonical_url 로 repo README 지정 |
| Official MCP Registry | github.com/modelcontextprotocol/registry | api | `mcp-publisher` CLI + GitHub OIDC(Actions)로 `io.github.uzysjung/<server>` 게시 | **MCP 서버 전용** — agent-harness 가 서버 컴포넌트를 게시할 때만 해당. OAuth 경로는 사람 로그인 필요(OIDC 경로만 무인) |
| awesome-mcp-servers (punkpeye) | github.com/punkpeye/awesome-mcp-servers | github-pr | (해당 시) fork → 알파벳 순 README 1줄 → PR | **fit mismatch(low)** — MCP 서버 목록. installer CLI 직접 등록은 off-topic 거부 likely. 실제 MCP 서버 출하 시에만 |
| awesome-ai-agents (e2b-dev) | github.com/e2b-dev/awesome-ai-agents | github-pr | (해당 시) fork → 카테고리 알파벳 순 1줄 → PR | **fit mismatch(low) + STALE**(push 2025-02). 자율 agent 목록 — installer 는 off-scope. 권장: skip |

## B. 사용자 수동 게시 필요

사람 로그인·captcha·웹폼·에디터 리뷰가 필요 → 에이전트는 초안/폼 채움까지, **제출 클릭은 사용자**.

| 채널 | URL | 형식 | self-promo 규칙 | 적합도 | 우선순위 |
|------|-----|------|----------------|--------|---------|
| hesreallyhim/awesome-claude-code | github.com/hesreallyhim/awesome-claude-code | issue form (recommend-resource.yml) | 작성자 자기제출 환영. **gh CLI/프로그래매틱 금지(자동 close)** · 1주+ 경과 · 설치/제거 문서 · 비-Anthropic 네트워크콜 공개 · Claude 보안리뷰 | high | **1** (Claude Code 정전 목록 ~46k★) |
| r/ClaudeCode | reddit.com/r/ClaudeCode | account-post (Showcase flair) | 'Showcase' flair 직접 게시 OK. 순수 링크 광고 지양. 전용 promo-thread gate 없음 | high | **2** (가장 타이트한 토픽 fit) |
| r/ClaudeAI | reddit.com/r/ClaudeAI | account-post (megathread) | 'Built with Claude' Showcase **Megathread 댓글**이 정규 경로. 단독 promo 글은 제거 위험. (게시 시 핀 URL 재확인) | high | 3 (933k, 최대 청중) |
| Show HN (Hacker News) | news.ycombinator.com/submit | account-post (link post) | 친구 upvote/댓글 요청 금지 · 가입장벽 없어야(npx 충족) · 제출 직후 작성자 첫 댓글 | high | 4 (고신호, 본문 위 준비됨) |
| Product Hunt | producthunt.com/products/new | account-post (web form) | 메이커 셀프런칭 정규. **직접 upvote 요청 금지**(방문·댓글 유도만). Tue~Thu 12:01am PT | high | 5 (자산·런치데이 고비용) |
| Peerlist Launchpad | peerlist.io/launchpad | account-post | 개인 프로필만 런치(회사 X). 스팸/DM upvote 금지. Mon/Tue 제출, 주간 한정석 | high | 6 (가격 미명시→무료 추정, **미검증**) |
| Terminal Trove | terminaltrove.com/post/ | web-form (큐레이션) | 메이커 제출 환영. **이미지/GIF/MP4 프리뷰 필수** · 중복 불가 · cross-platform 선호 | high | 7 (CLI 도구 최적 fit. Node CLI라 데모 GIF가 핵심 자산) |
| Uneed | uneed.best/submit-a-tool | web-form | 메이커 셀프제출. 무료=대기열 / 유료=날짜선택+백링크. Tue~Thu | high | 8 |
| Lobsters (lobste.rs) | lobste.rs/stories/new | account-post (invite-only) | self-promo <1/4 · 참여 필수. **초대제(공개가입 없음)** · 신규<70일 새 도메인/show·announce tag 금지 · AI 생성 제출 반대 정서 | high | 9 (초대 필요, 진입장벽 큼) |
| r/opensource | reddit.com/r/opensource | account-post ('Promotional' flair) | self-promo <10% · **'Promotional' flair 필수** · drive-by/karma-farm 금지 · 토론 참여 | high | 10 |
| r/coolgithubprojects | reddit.com/r/coolgithubprojects | account-post | GitHub 호스팅만 · 제목 `[Desc] - Title` · 언어 flair 자동 · 6개월 내 재게시 금지 | high | 11 (GitHub 프로젝트 전용, 자기제출 환영) |
| r/ChatGPTCoding | reddit.com/r/ChatGPTCoding | account-post ('Project' flair) | 'Project' flair, 빌드 내용+피드백 요청 우선. 주간 self-promo thread 있으면 사용 | high | 12 (384k, AI 코딩 광범위) |
| Hashnode | hashnode.com/draft | api (**Pro 유료**) | 작성자 self-publish 코어. **2026 변경: GraphQL 발행 API가 유료 Pro 전용**(무료는 웹에디터만) | high | 13 (무료는 자동화 불가, 사람 결제 필요) |
| daily.dev | app.daily.dev/sources/new | web-form / Squad | 개인·기업 블로그 source 부적격 → **Squad 생성** 경로. 무인 API 없음 | high | 14 (dev.to/Hashnode cross-post → RSS 유입이 현실 경로) |
| agent-skills.md | agent-skills.md | web-form | 자기 skill 제출 환영(GitHub URL 붙여넣기 → 자동 파싱). 로그인 불필요지만 JS 웹 UI 액션 | high | 15 (skills 폴더 노출 시. headless 자동화 불가) |
| skills.sh (vercel-labs) | skills.sh | unknown | 게이트 없음 — `npx skills add <owner/repo>`로 URL 설치. **명시적 등록 경로 없음**(자동 인덱싱 추정) | high | 16 (디렉토리 노출 방법 미확인, **미검증**) |
| r/SideProject | reddit.com/r/SideProject | account-post | 단독 프로젝트 글 허용. 빌드스토리+피드백 요청(맨링크=스팸) · 참여 · affiliate 금지 | medium | 17 (구독자수 **미검증**) |
| r/commandline | reddit.com/r/commandline | account-post (CLI flair) | **1회 ReadTheRules 앱 동의 선행 필수**(미동의=자동제거) · CLI 도구 on-topic | medium | 18 (installer라 fit 중간) |
| HackerNoon | hackernoon.com/login | account-post (web editor) | vested interest 공개. **모든 글 사람 에디터 리뷰**(median 3-5영업일) · 이미지/TL;DR/태그 필수 | medium | 19 (canonical cross-post 지원) |
| BetaList | betalist.com/submit | web-form (큐레이션) | 메이커 셀프제출. 무료=수주 대기 / 유료(~$129)=빠른 리뷰. pre-launch 대상(npm 게시됨이라 'recently launched' 해당) | medium | 20 |
| AlternativeTo | alternativeto.net/manage/new-app/ | web-form | 메이커 제출 가능. 커뮤니티 vote 기반. 인기 AI 코딩 CLI 의 'alternative'로 등재가 핵심 가치 | medium | 21 (submitUrl **미검증**) |
| SaaSHub | saashub.com/submit | web-form | 제출+verify 후 promotion. 백링크 제공. `/submit/list`=추가 107개 디렉토리 체크리스트 | medium | 22 |
| glama.ai/mcp | glama.ai/mcp/servers | web-form | GitHub repo 제출 자동 인덱싱, claim=계정 필요. **MCP 서버 전용** | medium | 23 (MCP 서버 출하 시) |
| PulseMCP | pulsemcp.com/submit | web-form | 수동 서버 제출 폼. **MCP 서버 전용** | medium | 24 (server /submit 폼 **미검증**) |
| smithery.ai | smithery.ai/new | account-post | smithery.yaml push + GitHub 연결 Deploy. **MCP 서버 전용 + GitHub OAuth 필수** | medium | 25 (MCP 서버 출하 시) |
| Medium | medium.com/new-story | web-form (web editor) | 발행 API 폐기(~2017). 웹에디터만. canonical=Import 툴/Advanced Settings | low | 26 (canonical 재게시 SEO용) |
| There's An AI For That | theresanaiforthat.com/get-featured/ | web-form | 무료=느림/제한 · 유료 런치 $347. **end-user AI 앱 대상**(dev CLI off-fit) | low | 27 |
| Futurepedia | futurepedia.io/submit-tool | web-form | 무료 basic 있음 · Verified $497. **end-user AI 앱 대상** | low | 28 |
| Future Tools | futuretools.io/submit-a-tool | web-form | 무료. **aggregator/bot 명시 거부**(curator라 제외 위험), >75% 거부 | low | 29 |
| Toolify.ai | toolify.ai/submit | web-form | 무료(2-4주) / 유료 ~$99. end-user AI 디렉토리 | low | 30 (공식폼 anti-bot, 가격 **미검증**) |
| mcp.so | mcp.so/submit | unknown | 커뮤니티 MCP 서버 디렉토리. **MCP 서버 전용** | low | 31 (제출 경로 **미검증** — 403) |
| aitools.fyi | aitools.fyi/submit-a-tool | web-form | 자기제출. **제출 폼 현재 비활성 보고** | low | 32 (폼 상태 **미검증**) |
| There's An AI For That / r/devtools | reddit.com/r/devtools | account-post | 룰셋 없음. ~1.2k 구독자(사실상 휴면). r/devtoolsbuilders 가 활성 대안 | low | 33 (skip 권장) |

## 점검 결과 (현 계획 갭)

현 `launch-posts.md` 본문 대비 발견 사항. **상위 2건은 제출 전 필수 수정**(no-false-ship 게이트).

> **이 PR 반영 상태** (2026-06-14): ✅ P0 거짓출하 2건(`re-checked by CI`→monthly cron / `each asset`→45/48 본문·dev.to 전부) · ✅ 제목 skills/plugins 재포지셔닝(이름 유지) + 비교표 컬럼 · ✅ 포지셔닝 용어 동기화 · ✅ 채널 갭(A·B표로 awesome-list·서브레딧 확장) · ✅ star CTA(Reddit·dev.to, HN·PH 제외) · ✅ dev.to 롱폼 추가.
> **잔여(게시 운영 시점 처리)**: ⏳ 비교표 ★ 8개 제출 직전 재확인(C-1) · ⏳ Reddit self-promo 9:1 비율(계정 사전활동) · ⏳ step3는 batch 초안 아닌 **즉석 ad hoc 응답** 유지 · ⏳ 본문 명사 완전 단일화(`vetted options`/`assets`/`track` 혼용 잔존) · ⏳ 비-Claude(Codex/OpenCode/Antigravity) 아웃리치 부재.
> 아래 개별 항목은 발견 근거 기록(원문 보존).

- **[거짓출하 P0] "re-checked by CI"** (Show HN line 50 + r/ClaudeCode line 85) — 오도. Docker per-asset 설치 체크는 `catalog-verify.yml`로 **월 1회 cron + 수동 dispatch만** 실행(`docs/COMPATIBILITY.md:7,155` 명시). PR/push마다 안 돌아 upstream breakage 최대 ~30일 미검출. 로드맵 SCALE-2(M3 deferred)와 동일 갭. → **"re-checked monthly by CI cron"**으로 수정.
- **[거짓출하 P0] "installs each asset" / "actually installs each asset"** (line 48, 83) — 과대주장. `docs/COMPATIBILITY.md:38` = **45/48 verified**(3건 미green: ecc-prune 🟡 + 2). "each asset"는 48/48로 읽힘(PROMO-3 로드맵 기지적). → **"45/48 (documented)"** 또는 실분수로 수정.
- **[메시징 P1] 제목이 아직 "workflows"** — 양 제목("curate AI-coding **workflows**", "a tech-stack-based curator for AI-coding **workflows**")이 사용자가 이탈 중인 옛 framing. skills/plugins 재포지셔닝과 충돌. 가장 중요한 자산(HN 제목)이 stale.
- **[메시징 P1] 용어 불일치** — 본문이 "vetted options / assets / skills and MCP servers / skills/plugins / track" 혼용. 설치 단위(workflow? skill? plugin? asset?)가 독자에게 불명확 → 명사 단일화 필요.
- **[채널 갭] Codex/OpenCode/Antigravity 커뮤니티 0** — 4-CLI 가치제안인데 모든 채널이 Claude 중심. 비-Claude CLI 아웃리치 전무(본문이 "rules/skills layer"로 정직히 downscope하므로 light-touch는 방어가능하나 완전 부재는 갭).
- **[채널 갭] 단일 서브레딧 의존 리스크** — Reddit이 r/ClaudeCode 1곳뿐(현 계획). mod 1회 제거 = 전 채널 손실. 위 B표에 r/ClaudeAI·r/opensource·r/coolgithubprojects 추가 권장.
- **[채널 갭] awesome-list 협소** — 현 계획 2개(bradAGI, hesreallyhim). A표의 자동등록 가능 리스트(awesome-ai-coding, awesome-claude webfuse, jamesmurdza, awesome-cli-apps) 다수 미열거.
- **[스팸 리스크] step 3 "응답 초안 일괄 생성 → 게시"** — 런치 스레드 agent-draft 대량 댓글 = 전형적 astroturf 패턴(HN showhn + Reddit self-promo 규칙 페널티). 사람 제출 게이트가 완화하나 batch 초안은 부자연 — **즉석 ad hoc 응답** 유지.
- **[스팸 리스크] Reddit self-promo 비율** — 계정 사전 활동 없이 신규 "I built X" + 비교표 단독 글은 9:1/self-promo 규칙 제거 위험. 현 계획 미반영.
- **[검증 권장] 비교표 ★ 수치** — 226k/214k/64k/57k/55k/49k/37k 가 균일·권위적 제시. 1개라도 틀리면 HN/Reddit 첫 반례. 제출 전 8개 재확인(로드맵 C-1 star-drift 패스 연장).
- **[클린] 데모 GIF·★ 날짜 = 거짓출하 아님** — step1 "신 브랜드 ✓"는 실 산출물(`docs/assets/agent-harness-demo.cast/.gif`, #167 2026-06-13, 구브랜드 문자열 없음) 근거. ★=2026-06-13 실측. 양호.
