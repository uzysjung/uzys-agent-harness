# Reference — 외부/내부 자산 카탈로그

이 프로젝트가 **참조하거나 설치하는** 모든 외부/내부 자산의 단일 카탈로그.
출처(공식/검증/community), 적용 Track, 설치 명령, 신뢰 등급을 정리.

> 자동 설치는 `setup-harness.sh --track <track>` 시점에 일어난다.
> 옵션 항목은 대화형 `[y/N]` 프롬프트로 별도 확인.

## 신뢰 등급

| Tier | 의미 | 예 |
|------|------|---|
| ✅ **공식** | Anthropic 또는 stack vendor 공식 | Anthropic skills, Railway, Supabase, MCP servers |
| 🟢 **검증된 third-party** | 알려진 기여자/조직, 활발히 maintained | vercel-labs, addyosmani, K-Dense, wshobson, trailofbits |
| 🟡 **Community** | 개인/소규모, 사용 전 내용 검토 권장 | pbakaus, testdino-hq, alirezarezvani, yonatangross |

## Track 약어

`csr-*` (csr-supabase, csr-fastify, csr-fastapi) / `ssr-*` (ssr-htmx, ssr-nextjs) / `data` / `executive` / `tooling` / `full` (= 모든 dev track union) / `project-management` (v0.5.0) / `growth-marketing` (v0.5.0)

**dev tracks** = csr-* + ssr-* + data + tooling + full (executive + project-management + growth-marketing 제외).

---

## 1. Plugins (`claude plugin install`)

| 이름 | 출처 | Tier | Track | 설치 명령 | 용도 |
|------|------|:-:|------|---------|------|
| **agent-skills** | [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) | 🟢 | dev tracks | `claude plugin install agent-skills@addy-agent-skills` | spec-driven development 8단계 워크플로우 |
| **railway-skills** | [railwayapp/railway-skills](https://github.com/railwayapp/railway-skills) | ✅ | csr-fastify, csr-fastapi, ssr-*, full | `claude plugin marketplace add railwayapp/railway-skills` + `claude plugin install railway@railway-skills` | Railway 배포/프로젝트/서비스/환경변수 관리 ([공식 docs](https://docs.railway.com/ai/claude-code-plugin)). v0.6.3에서 `railway-plugin` 잘못된 entry 제거 (repo 부재) — 본 entry로 단일화 |
| **Vercel CLI** | [vercel/vercel](https://github.com/vercel/vercel) | ✅ | csr-supabase, full | `npm install -g vercel` | 프론트엔드 배포 (JAMstack) |
| **Netlify CLI** | [netlify/cli](https://github.com/netlify/cli) | ✅ | csr-supabase, full | `npm install -g netlify-cli` | 프론트엔드 배포 (JAMstack) |
| **supabase agent-skills** | [supabase/agent-skills](https://github.com/supabase/agent-skills) | ✅ | csr-supabase, full | `claude plugin install supabase@supabase-agent-skills` | Auth/Realtime/Storage/RLS |
| **postgres-best-practices** | supabase/agent-skills | ✅ | csr-supabase, full | `claude plugin install postgres-best-practices@supabase-agent-skills` | Postgres 쿼리 최적화 |
| **document-skills** | [anthropics/skills](https://github.com/anthropics/skills) | ✅ | executive, full | `claude plugin install document-skills@anthropic-agent-skills` | docx/pptx/xlsx/pdf/canvas-design 등 |
| **c-level-skills** | [alirezarezvani/claude-skills](https://github.com/alirezarezvani/claude-skills) | 🟡 | executive, full | `claude plugin install c-level-skills@claude-code-skills` | 28 C-level advisory: virtual board (CEO/CTO/COO/CPO/CMO/CFO/CRO/CISO/CHRO), executive mentor, board deck builder, scenario war room, M&A playbook |
| **business-growth-skills** | [alirezarezvani/claude-skills](https://github.com/alirezarezvani/claude-skills) | 🟡 | executive, full, **growth-marketing** (v0.5.0) | `claude plugin install business-growth-skills@claude-code-skills` | 4 customer success / sales engineer / revenue operations / contract & proposal writer |
| **finance-skills** | [alirezarezvani/claude-skills](https://github.com/alirezarezvani/claude-skills) | 🟡 | executive, full | `claude plugin install finance-skills@claude-code-skills` | 3 financial analyst (DCF/ratio), SaaS metrics coach (ARR/MRR/CAC/LTV), business investment advisor |
| **pm-skills** (v0.5.0) | alirezarezvani/claude-skills | 🟡 | project-management | `claude plugin install pm-skills@claude-code-skills` | 6 — senior PM, scrum master, Jira expert, Confluence expert, Atlassian admin, template creator |
| **product-skills** (v0.5.0) | alirezarezvani/claude-skills | 🟡 | dev tracks + project-management | `claude plugin install product-skills@claude-code-skills` | 15 — RICE, PRD, agile PO, UX research, UI design system, competitive teardown, landing page, SaaS scaffolder, product analytics, experiment, product discovery, roadmap communicator, code-to-prd, research summarizer, apple-hig-expert |
| **marketing-skills** (v0.5.0) | alirezarezvani/claude-skills | 🟡 | growth-marketing | `claude plugin install marketing-skills@claude-code-skills` | 44 — content/SEO/CRO/channels/growth/intelligence/sales/twitter |
| **content-creator** (v0.5.0) | alirezarezvani/claude-skills | 🟡 | growth-marketing | `claude plugin install content-creator@claude-code-skills` | SEO content + brand voice + frameworks |
| **demand-gen** (v0.5.0) | alirezarezvani/claude-skills | 🟡 | growth-marketing | `claude plugin install demand-gen@claude-code-skills` | multi-channel demand gen + paid media + partnership |
| **research-summarizer** (v0.5.0) | alirezarezvani/claude-skills | 🟡 | growth-marketing | `claude plugin install research-summarizer@claude-code-skills` | 시장 조사 요약 |
| **karpathy-coder** (v0.5.0) | alirezarezvani/claude-skills | 🟡 | dev tracks (has-dev-track) | `claude plugin install karpathy-coder@claude-code-skills` | 4 Python tool (`complexity_checker`, `diff_surgeon`, `assumption_linter`, `goal_verifier`) + reviewer agent + `/karpathy-check` slash + pre-commit hook — CLAUDE.md P1-P4 enforcement layer |
| **data plugin** | [anthropics/knowledge-work-plugins](https://github.com/anthropics/knowledge-work-plugins) | ✅ | data, full | `claude plugin install data@knowledge-work-plugins` | SQL 탐색 + matplotlib/seaborn/plotly visualization |

### Optional Plugins (대화형 프롬프트)

| 이름 | 출처 | Tier | 트리거 | 용도 |
|------|------|:-:|------|------|
| **everything-claude-code (ECC)** | [affaan-m/everything-claude-code](https://github.com/affaan-m/everything-claude-code) | 🟢 | 설치 후 `[y/N]` 프롬프트 | 전체 ECC 번들 (글로벌). 이후 `scripts/prune-ecc.sh`로 project-local 정제 |
| **trailofbits-skills** | [trailofbits/skills](https://github.com/trailofbits/skills) | 🟢 | dev track 인터랙티브 `[y/N]` | CodeQL + Semgrep 보안 정적 분석 |
| **GSD (Get Shit Done)** | [npm get-shit-done-cc](https://www.npmjs.com/package/get-shit-done-cc) | 🟡 | `--gsd` 플래그 | 대형 프로젝트 오케스트레이션 |

---

## 2. Skills (`npx skills add`)

| 이름 | 출처 | Tier | Track | 설치 명령 | 용도 |
|------|------|:-:|------|---------|------|
| **impeccable** | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) | 🟡 | csr-*, ssr-*, full | `npx skills add pbakaus/impeccable --yes` | 디자인 워크플로우 (`/teach`, `/shape`, `/polish` 등) |
| **playwright-skill** | [testdino-hq/playwright-skill](https://github.com/testdino-hq/playwright-skill) | 🟡 | dev tracks | `npx skills add testdino-hq/playwright-skill --yes` | Playwright E2E 테스트 |
| **find-skills** | [vercel-labs/skills](https://github.com/vercel-labs/skills) | 🟢 | dev tracks | `npx skills add vercel-labs/skills --skill find-skills --yes` | 적합한 스킬 검색/추천 |
| **architecture-decision-record** | [yonatangross/orchestkit](https://github.com/yonatangross/orchestkit) | 🟡 | dev tracks | `npx skills add yonatangross/orchestkit --skill architecture-decision-record --yes` | ADR 템플릿/작성 |
| **react-best-practices** | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | 🟢 | csr-*, ssr-nextjs, full | `npx skills add https://github.com/vercel-labs/agent-skills --skill vercel-react-best-practices --yes` | React 패턴. v0.6.5 — skills.sh registry name `vercel-react-best-practices` (GitHub dir 이름과 다름, prefix 있음) |
| **shadcn/ui** | [shadcn/ui](https://github.com/shadcn-ui/ui) | ✅ | csr-*, ssr-nextjs, full | `npx skills add shadcn/ui --yes` | shadcn 컴포넌트 |
| **web-design-guidelines** | vercel-labs/agent-skills | 🟢 | csr-*, ssr-*, full | `npx skills add https://github.com/vercel-labs/agent-skills --skill web-design-guidelines --yes` | 웹 UI 가이드라인. v0.6.3 — source URL을 full HTTPS로 수정 |
| **next-skills** | [vercel-labs/next-skills](https://github.com/vercel-labs/next-skills) | 🟢 | ssr-nextjs, full | `npx skills add vercel-labs/next-skills --yes` | Next.js 패턴 |
| **polars** | [K-Dense-AI/scientific-agent-skills](https://github.com/K-Dense-AI/scientific-agent-skills) | 🟢 | data, full | `npx skills add K-Dense-AI/scientific-agent-skills --skill polars --yes` | polars lazy/expression deep guide |
| **dask** | K-Dense-AI/scientific-agent-skills | 🟢 | data, full | `npx skills add K-Dense-AI/scientific-agent-skills --skill dask --yes` | larger-than-RAM 분산 (선택) |
| **python-resource-management** | [wshobson/agents](https://github.com/wshobson/agents) | 🟢 | data, full | `npx skills add https://github.com/wshobson/agents --skill python-resource-management --yes` | context manager / ExitStack / async cleanup |
| **python-performance-optimization** | wshobson/agents | 🟢 | data, full | `npx skills add https://github.com/wshobson/agents --skill python-performance-optimization --yes` | cProfile / line_profiler / memory_profiler / py-spy |

---

## 3. MCP Servers (`.mcp.json`)

`.mcp.json`은 프로젝트 스코프로 자동 생성되며, `templates/track-mcp-map.tsv` 기반으로 Track별 조건부 추가.

### 모든 dev track 공통

| MCP | 출처 | Tier | 명령 |
|-----|------|:-:|------|
| **context7** | [Upstash](https://github.com/upstash/context7-mcp) | ✅ | `npx -y @upstash/context7-mcp@latest` |
| **github** | [modelcontextprotocol](https://github.com/modelcontextprotocol/servers/tree/main/src/github) | ✅ | `npx -y @modelcontextprotocol/server-github` |
| **chrome-devtools** | [chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp) | ✅ | `npx -y chrome-devtools-mcp@latest` |

### Track 조건부 (track-mcp-map.tsv 데이터-driven)

| MCP | Track | 명령 |
|-----|------|------|
| **railway-mcp-server** | csr-supabase, csr-fastify, csr-fastapi, ssr-htmx, ssr-nextjs, full | `npx -y @railway/mcp-server` |
| **supabase** | csr-supabase, full | `npx -y @supabase/mcp-server` |

> **신규 MCP 추가**: `templates/track-mcp-map.tsv`에 1줄 추가 → setup-harness.sh 수정 불필요.

---

## 4. Agents (자체 + ECC cherry-pick)

> **v26.55.0 BREAKING (ADR-016)**: ECC cherry-pick agents 는 `--with-ecc` 또는 Step 3 의 `ecc-plugin` 토글 시에만 설치. Default install 시 본 프로젝트 자산만.

| 에이전트 | 모델 | 출처 | gating | 용도 |
|---------|:-:|------|:-:|------|
| **reviewer** | opus | 자체 | always | SOD 검증 (5축 리뷰). context fork |
| **data-analyst** | opus | 자체 | always | Python/DuckDB/Trino/ML/PySide6 |
| **strategist** | opus | 자체 | always | 제안서/DD/PPT/경쟁분석 |
| **plan-checker** | sonnet | 자체 | dev track | docs/plan.md ↔ todo.md ↔ SPEC.md 정합성 |
| **code-reviewer** | sonnet | ECC | `--with-ecc` | 일상 코드 리뷰 (CRITICAL→LOW) |
| **security-reviewer** | sonnet | ECC | `--with-ecc` | OWASP Top 10 + 시크릿 탐지 |
| **silent-failure-hunter** | sonnet | ECC | `--with-ecc` + dev track | swallowed error / bad fallback 탐지 |
| **build-error-resolver** | sonnet | ECC | `--with-ecc` + dev track | TS/build 에러 fix |

---

## 5. Cherry-picked Sources

`.dev-references/cherrypicks.lock` (21건). ECC + GSD에서 발췌해 `templates/`에 복사.
`scripts/sync-cherrypicks.sh`로 upstream drift 감지.

| 카테고리 | 항목 |
|---------|------|
| Skills (templates/skills/) | continuous-learning-v2, strategic-compact, deep-research, market-research, eval-harness, verification-loop, e2e-testing, agent-introspection-debugging, python-patterns, python-testing, nextjs-turbopack, investor-materials, investor-outreach |
| Agents (templates/agents/) | code-reviewer, security-reviewer, silent-failure-hunter, build-error-resolver |
| Commands (templates/commands/ecc/) | e2e, eval, harness-audit |
| Rules (templates/rules/) | gates-taxonomy (← GSD) |

---

## 6. 자체 작성 자산

### Skills (templates/skills/)

| Skill | Track | 용도 | 버전 |
|-------|------|------|------|
| **spec-scaling** | 전 dev track | SPEC.md/PRD.md 300줄 초과 시 기능별 or 영역별 분리 제안 (docs/specs/ or docs/PRD/) | v26.30.0 확장 |
| **north-star** | 전 track | 4-gate decision heuristic (Trend/Persona/Capability/Lean) + NORTH_STAR.md template. Plan 전 scope 필터 | v26.28.0 신규 |
| **ui-visual-review** | csr-*/ssr-*/full | Playwright/chrome-devtools 스크린샷 캡처 → baseline diff → 에이전트 REGRESSION 분류 → Review Gate 차단 | v26.29.0 신규 |

### Templates (templates/docs/)

- **PLAN.template.md** (v26.30.0) — Sprint Contract / Phase Overview / **Milestone × Dependency Graph** (직렬/병렬/강한 의존 표기) + **Critical Path** / Per-Milestone AC / Risk / Open Questions / Changelog 8섹션
- **skills/north-star/NORTH_STAR.template.md** (v26.28.0) — NSM / Will-Won't / Phase Roadmap / Decision Heuristics 7섹션

### Commands (templates/commands/uzys/)
spec, plan, build, test, review, ship, auto — 6-gate 워크플로우 + Ralph 루프 진입.
- **spec**에 D 블록(NORTH_STAR 작성 권유 — 6개월+ 프로젝트)
- **plan** Process step 4에 4-gate 체크 (Complex 복잡도 + NORTH_STAR.md 존재 시)
- **test**에 UI Track visual-review 호출 섹션
- **review** Process step 5에 visual-review 결과 흡수 + **REGRESSION 1건이라도 있으면 Review Gate 차단** (CRITICAL 동급)

### Rules (templates/rules/)
17 파일. CLAUDE.md와 짝. `docs/SPEC.md`에서 트랙별 적용 조건 정의.
- **change-management.md** (v26.30.0 확장) — ADR Status 흐름 `Proposed → Accepted → Superseded/Deprecated` + 채택 프로세스 + 대상/비대상

### Hooks (templates/hooks/)
8 파일. 자동 등록 5 (session-start/protect-files/gate-check/agentshield-gate/mcp-pre-exec) + on-demand 3 (spec-drift-check/checkpoint-snapshot/codebase-map).
*v26.16.1 기준. codebase-map은 v26.14.1에서 자동 등록 해제.*

### Scripts (자체 작성)
- `scripts/prune-ecc.sh` — ECC plugin 프로젝트 스코프 복사 + 89 KEEP 외 제거
- `scripts/setup-harness.sh` — 모든 설치 orchestrator. v26.26.0에서 `curl|bash` 설치 UX 버그 fix (stdin/stdout/stderr 격리, fd 3 TTY 재부착)
- `scripts/test-harness.sh` — 147 assertion (T1~T19). JSON validity / hook unit / 9-track install 병렬 / multi-track / update mode / install.sh file:// E2E / 신규 skill 자산 검증 (5초 quick / 8분 full)
- `scripts/sync-cherrypicks.sh` — cherry-pick 출처 drift 감지
- `install.sh` — `curl | bash` 원격 설치 entry. `UZYS_HARNESS_REPO` env로 fork URL 오버라이드 가능

### eval-harness 확장 (v26.30.0)
ECC cherry-pick skill이지만 본 harness에서 확장:
- `.md` (설계) + `.log` (실행 결과) **쌍 의무화**
- `.md` 3섹션: **Capability / Regression / Test** 필수
- `.log` append 포맷 예시 포함

---

## 7. 설치 결정 흐름

```
$ bash scripts/setup-harness.sh --track <track> --project-dir .
  ↓
[Prerequisites] Node 22+ / git / claude / jq
  ↓
[Track 선택] (또는 --track으로 명시)
  ↓
[필수 설치] addy agent-skills + Impeccable + Playwright + find-skills + agent-browser + ADR
  ↓
[Track 조건부]
  - csr-*: react-best-practices + shadcn + tauri-aware rule + supabase(csr-supabase만)
  - ssr-htmx: htmx rule
  - ssr-nextjs: next-skills + nextjs rule
  - data: polars + dask + python-resource/performance + Anthropic data plugin
  - executive: c-level + business-growth + finance + document-skills (모두 alirezarezvani/claude-skills marketplace + Anthropic)
  - tooling: cli-development rule
  ↓
[Optional 프롬프트]
  - ECC plugin 프로젝트 스코프 설치? [y/N]
    → y면 prune-ecc.sh 호출 → DELETED/KEPT 목록 표시
  - Trail of Bits security? [y/N] (dev track만)
  ↓
[.mcp.json 생성] track-mcp-map.tsv 기반 조건부 union
  ↓
[Installation Report] ✅/❌ 카운트 표
```

---

## 8. 보안 / 신뢰 정책

- **MCP allowlist**: `.mcp-allowlist` 파일에 화이트리스트 작성 시 `mcp-pre-exec.sh` 훅이 차단 강제. 미작성 시 모든 MCP 호출 통과.
- **글로벌 ~/.claude/ 보호**: `setup-harness.sh --project-dir`이 `~/.claude/*`/`/etc/*` 등 시스템 경로 차단 (D16).
- **`.env` / credentials 수정 차단**: `protect-files.sh` 훅이 `.env`, lock 파일, 인증서 경로 차단.
- **`--no-verify` 차단**: gate-check.sh가 `--no-verify`/`--force` 플래그 사용 시 경고 (`git-policy.md`).

---

## 9. 라이선스 / 책임

각 외부 출처의 라이선스를 따른다 (대부분 MIT/Apache 2.0). 본 카탈로그는 통합 가이드일 뿐 외부 자산의 동작/보안에 대한 보증을 제공하지 않는다. `scripts/setup-harness.sh` 실행 전 신뢰 등급(특히 🟡 Community) 검토 권장.
