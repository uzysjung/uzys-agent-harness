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
| **railway-skills** | [railwayapp/railway-skills](https://github.com/railwayapp/railway-skills) | ✅ | opt-in (`--with railway-skills`) | `claude plugin marketplace add railwayapp/railway-skills` + `claude plugin install railway@railway-skills` | Railway 배포/프로젝트/서비스/환경변수 관리 ([공식 docs](https://docs.railway.com/ai/claude-code-plugin)). v0.6.3에서 `railway-plugin` 잘못된 entry 제거 (repo 부재) — 본 entry로 단일화 |
| **Vercel CLI** | [vercel/vercel](https://github.com/vercel/vercel) | ✅ | opt-in (`--with vercel-cli`) | `npm install -g vercel` | 프론트엔드 배포 (JAMstack) |
| **Netlify CLI** | [netlify/cli](https://github.com/netlify/cli) | ✅ | csr-supabase, full | `npm install -g netlify-cli` | 프론트엔드 배포 (JAMstack) |
| **supabase agent-skills** | [supabase/agent-skills](https://github.com/supabase/agent-skills) | ✅ | csr-supabase, full | `claude plugin install supabase@supabase-agent-skills` | Auth/Realtime/Storage/RLS |
| **postgres-best-practices** | supabase/agent-skills | ✅ | csr-supabase, full | `claude plugin install postgres-best-practices@supabase-agent-skills` | Postgres 쿼리 최적화 |
| **document-skills** | [anthropics/skills](https://github.com/anthropics/skills) | ✅ | executive, full | `claude plugin install document-skills@anthropic-agent-skills` | docx/pptx/xlsx/pdf/canvas-design 등 |
| **finance-skills** | [alirezarezvani/claude-skills](https://github.com/alirezarezvani/claude-skills) | 🟡 | opt-in (`--with finance-skills`) | `claude plugin install finance-skills@claude-code-skills` | 3 financial analyst (DCF/ratio), SaaS metrics coach (ARR/MRR/CAC/LTV), business investment advisor |
| **product-skills** (v0.5.0) | alirezarezvani/claude-skills | 🟡 | opt-in (`--with product-skills`) | `claude plugin install product-skills@claude-code-skills` | 15 — RICE, PRD, agile PO, UX research, UI design system, competitive teardown, landing page, SaaS scaffolder, product analytics, experiment, product discovery, roadmap communicator, code-to-prd, research summarizer, apple-hig-expert |
| **data plugin** | [anthropics/knowledge-work-plugins](https://github.com/anthropics/knowledge-work-plugins) | ✅ | data, full | `claude plugin install data@knowledge-work-plugins` | SQL 탐색 + matplotlib/seaborn/plotly visualization |

### Optional Plugins (대화형 프롬프트)

| 이름 | 출처 | Tier | 트리거 | 용도 |
|------|------|:-:|------|------|
| **everything-claude-code (ECC)** | [affaan-m/everything-claude-code](https://github.com/affaan-m/everything-claude-code) | 🟢 | 설치 후 `[y/N]` 프롬프트 | 전체 ECC 번들 (글로벌). 이후 `scripts/prune-ecc.sh`로 project-local 정제 |
| **trailofbits-skills** | [trailofbits/skills](https://github.com/trailofbits/skills) | 🟢 | dev track 인터랙티브 `[y/N]` | CodeQL + Semgrep 보안 정적 분석 |

---

## 2. Skills (`npx skills add`)

| 이름 | 출처 | Tier | Track | 설치 명령 | 용도 |
|------|------|:-:|------|---------|------|
| **find-skills** | [vercel-labs/skills](https://github.com/vercel-labs/skills) | 🟢 | dev tracks | `npx skills add vercel-labs/skills --skill find-skills --yes` | 적합한 스킬 검색/추천 |
| **react-best-practices** | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | 🟢 | csr-*, ssr-nextjs, full | `npx skills add https://github.com/vercel-labs/agent-skills --skill vercel-react-best-practices --yes` | React 패턴. v0.6.5 — skills.sh registry name `vercel-react-best-practices` (GitHub dir 이름과 다름, prefix 있음) |
| **shadcn/ui** | [shadcn/ui](https://github.com/shadcn-ui/ui) | ✅ | csr-*, ssr-nextjs, full | `npx skills add shadcn/ui --yes` | shadcn 컴포넌트 |
| **web-design-guidelines** | vercel-labs/agent-skills | 🟢 | csr-*, ssr-*, full | `npx skills add https://github.com/vercel-labs/agent-skills --skill web-design-guidelines --yes` | 웹 UI 가이드라인. v0.6.3 — source URL을 full HTTPS로 수정 |

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

`.dev-references/cherrypicks.lock` (19건 — 2026-08-02 ADR-060 에서 verification-loop·karpathy-gate,
ADR-061 에서 gates-taxonomy 행 해체). ECC에서 발췌해 `templates/`에 복사.
`scripts/sync-cherrypicks.sh`로 upstream drift 감지.

| 카테고리 | 항목 |
|---------|------|
| Skills (templates/skills/) | continuous-learning-v2, strategic-compact, deep-research, market-research, eval-harness, e2e-testing, agent-introspection-debugging, python-patterns, python-testing, nextjs-turbopack, investor-materials, investor-outreach |
| Agents (templates/agents/) | code-reviewer, security-reviewer, silent-failure-hunter, build-error-resolver |
| Commands (templates/commands/ecc/) | e2e, eval, harness-audit |

**`verification-loop` 은 이 목록에 없다** — ECC 파생이지만 lock 밖이다(ADR-060 이 행을 해체했고
ADR-062 복원은 재등재하지 않았다). 우리 판본으로 유지·배포하며 출처는 SKILL.md 본문의 MIT 귀속
1줄이 진다. lock 에 되돌리면 `sync-cherrypicks.sh --apply` 의 rsync 가 우리 본문을 덮어쓴다.

---

## 6. 자체 작성 자산

### Skills (templates/skills/)

번들 = 13종. 아래 9종은 2026-08-02 **ADR-062 로 이 리포에 복원**됐다(ADR-060 이 `npx skills add
uzysjung/uzys-agent-skills` 로 이관했던 것). 되돌린 이유는 본문 보존이다 — 이관본이 판정 기준·수치·
워크드 예시를 잃었고(감사 실측 104건), 그 본문을 무는 게이트는 이 리포에만 있다.
설치 조건의 SSOT 는 `src/external-assets.ts` 의 각 엔트리 `condition` 이다.

| Skill | 설치 조건 | 용도 | 비고 |
|-------|----------|------|------|
| **north-star** | 전 track | NSM(metric-as-proxy)·Pillars·Will/Won't·4-gate + 우선순위 순서 게이트. `NORTH_STAR.template.md` 동반 | ADR-062 복원 (구 north-star + northstar-roadmap 통합) |
| **gh-issue-workflow** | 전 track | 이슈를 비동기 백로그·결정 채널로. 5섹션 body 템플릿(`ISSUE.template.md`) + 읽기/초안/원격쓰기 단계 분리 | ADR-062 복원 |
| **task-brief** | 전 track | 요청·위임 프롬프트를 canonical 브리프(objective·invariants·success_criteria·boundaries·autonomy·verification…)로 정규화. `task-brief-nudge.sh` 훅과 한 벌 | ADR-062 AC9 신설 (복원 아님) |
| **clear-korean-communication** | 전 dev track | 독자 위치에서 시작하는 설명 + 승인 요청 4요소(맥락→추천→UI/UX→ASIS/TOBE) | ADR-062 복원 (구 asis-tobe-decision + explain-plainly 통합) |
| **audit-service-gaps** | 전 dev track | 북극성·결함·사용자관점 3렌즈로 갭 열거 → 레퍼런스가 어떻게 닫았는지 확인 후 제안 | ADR-062 복원 (구 gap-analysis-e2e) |
| **multi-persona-review** | 전 dev track | 산출물 1개를 독립 페르소나 3~5인 병렬 리뷰 → P0/P1/P2 종합 | ADR-062 복원 |
| **recurrence-prevention** | 전 dev track | 재발 검증 → 단순/복합 분류 → 대책 사다리 1단 상향(기록→룰→구조 게이트) | ADR-062 복원 |
| **verification-loop** | 전 dev track | 표면별 검증 트랙 + 고정 verdict(PASS/PASS_WITH_NITS/FAIL) + severity 4단 | ADR-062 복원 · ECC 파생(MIT, lock 밖 — §5 참조) |
| **model-orchestration** | opt-in | 역할·effort 라우팅 정책, 위임 브리프 규격, 워커 수거·종료 계약 | ADR-062 복원 |
| **external-model-consult** | opt-in | 외부 모델 자문(한국어 표현·2차 의견·구조화·이미지). 래퍼 스크립트 2종 동반 | ADR-062 복원 (구 gemini-consult + codex-consult 통합) |
| **compaction-handoff** | 전 dev track | /compact 직전 재개 앵커 1개로 상태 고정 | 이관 대상이 아니었다 |
| **spec-scaling** | 전 dev track | SPEC.md/PRD.md 300줄 초과 시 기능별 or 영역별 분리 제안 (docs/specs/ or docs/PRD/) | v26.30.0 확장 |
| **ui-visual-review** | csr-*/ssr-*/full | Playwright/chrome-devtools 스크린샷 캡처 → baseline diff → 에이전트 REGRESSION 분류 → Review Gate 차단 | v26.29.0 신규 |

### Templates (templates/docs/)

- **PLAN.template.md** (v26.30.0) — Sprint Contract / Phase Overview / **Milestone × Dependency Graph** (직렬/병렬/강한 의존 표기) + **Critical Path** / Per-Milestone AC / Risk / Open Questions / Changelog 8섹션
- **skills/north-star/NORTH_STAR.template.md** — NSM / Pillars / Will-Won't / Decision Heuristics 6섹션. **로드맵(시간축)과 이력은 담지 않는다** — 각각 로드맵 문서와 버전 관리 이력 소관이고, 템플릿 §5·§8 은 그 사실을 적은 스텁이다

### Commands (templates/commands/uzys/)
spec, plan, build, test, review, ship, auto — 6-gate 워크플로우 + Ralph 루프 진입.
- **spec**에 D 블록(NORTH_STAR 작성 권유 — 6개월+ 프로젝트)
- **plan** Process step 4에 4-gate 체크 (Complex 복잡도 + NORTH_STAR.md 존재 시)
- **test**에 UI Track visual-review 호출 섹션
- **review** Process step 5에 visual-review 결과 흡수 + **REGRESSION 1건이라도 있으면 Review Gate 차단** (CRITICAL 동급)

### Rules (templates/rules/)
8 파일(실측 2026-08-02 — ADR-060 정비로 기술스택 상세 룰 12종, ADR-061 로 `gates-taxonomy` 삭제).
CLAUDE.md와 짝.
**트랙별 적용 조건의 SSOT 는 `src/manifest.ts`**
(`COMMON_RULES`·`DEV_RULES`·`UI_RULES`·`TRACK_RULES` → `resolveRules()`)다 — SPEC 이 아니다.
- **change-management.md** (v26.30.0 확장) — ADR Status 흐름 `Proposed → Accepted → Superseded/Deprecated` + 채택 프로세스 + 대상/비대상

### Hooks (templates/hooks/)
4 파일 (실측 2026-08-02): session-start · protect-files · mcp-pre-exec · task-brief-nudge.
차단하는 둘(protect-files · mcp-pre-exec)은 exit 2 마다 `.uzys-agent-harness/hook-blocks.log` 에
`날짜 · 훅 · 대상 · 사유` 1줄을 남긴다 (ADR-061). 로그 실패는 차단 판정을 바꾸지 않는다.
**task-brief-nudge 는 차단하지 않는다** — UserPromptSubmit 에서 "400자 이상 && `<objective>` 부재"
라는 결정적 두 조건만 보고 stdout 1줄을 덧붙인다(그 밖엔 무출력 exit 0). 차단 경로가 없어
차단 로그도 남기지 않는다. 브리프 변환 자체는 판단이 필요하므로 `task-brief` 스킬 몫이다.
*구 6-Gate 훅(gate-check/agentshield-gate)·codebase-map 은 ADR-023, karpathy-gate·spec-drift-check
는 ADR-060, checkpoint-snapshot 은 ADR-061 에서 삭제됨(검증 스캐폴딩·무동작 실측 — 마지막 것은
`settings.json` 의 `"PostToolUse": []` 로 설치만 되고 실행 0이었다).*

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
  - ssr-nextjs: nextjs rule
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
- **`--no-verify` / `--force` 금지**: `git-policy.md` §Safety 의 **프로즈 규약**이다 — 강제하는 훅은
  없다. (v26.122.0 정정: 이 줄은 `gate-check.sh` 가 차단한다고 적고 있었으나 그 훅은 ADR-023 에서
  삭제됐다. 같은 문서 §7 이 이미 "삭제됨"이라 적고 있어 자기모순이었다.)

---

## 9. 라이선스 / 책임

각 외부 출처의 라이선스를 따른다 (대부분 MIT/Apache 2.0). 본 카탈로그는 통합 가이드일 뿐 외부 자산의 동작/보안에 대한 보증을 제공하지 않는다. `scripts/setup-harness.sh` 실행 전 신뢰 등급(특히 🟡 Community) 검토 권장.
