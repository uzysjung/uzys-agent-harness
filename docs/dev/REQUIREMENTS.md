# Claude Code Agent Harness — 구현 명세

> **Owner**: Jay | **Date**: 2026-04-12
> **실행 환경**: Claude Code (Opus)
> **참조 리포**: `<YOUR_BOILERPLATE_REPO>`, `<YOUR_REFERENCE_REPO>` (private, 사용자 본인 리포로 교체)

---

## 1. 개요

Jay의 멀티 역할(CEO/CTO/CISO/CPO/CSO/데이터 사이언티스트)과 멀티 트랙 기술 스택을 위한 Claude Code 하네스.

**뼈대**: addyosmani/agent-skills (Define→Plan→Build→Verify→Review→Ship)
**도구**: ECC cherry-pick 6개 + Anthropic 공식 스킬 + Railway + Impeccable
**원칙**: 11개 행동 원칙 (AGENT-GUIDELINES-reference.md)
**자기 개선**: HyperAgents 사상 — 메타 개선 편집 가능, 인간 게이트 필수, 주기적 scaffold 제거

---

## 2. Track 정의

| Track | 스택 | 역할 |
|-------|------|------|
| `csr-supabase` | Supabase + Edge Functions + React + shadcn/ui + Tauri | 개발자 |
| `csr-fastify` | Railway + Fastify + React + shadcn/ui + Tauri | 개발자 |
| `csr-fastapi` | Railway + FastAPI + React + shadcn/ui + Tauri | 개발자 |
| `ssr-htmx` | Railway + FastAPI + Jinja2 + HTMX + Tailwind/daisyUI | 개발자 |
| `ssr-nextjs` | Railway + Next.js + React + shadcn/ui | 개발자 |
| `data` | Python + DuckDB + Trino + ML/DL + PySide6 | 데이터 사이언티스트 |
| `executive` | PPT/Excel/Word/PDF/제안서/DD | CPO/CSO/CTO |
| `full` | 전체 합집합 | 전 역할 |

---

## 3. 설치 매핑

### 3.1 공통 (모든 Track)

| 구분 | 항목 | 설치 |
|------|------|------|
| MCP | Context7 | `claude mcp add context7 -- npx -y @upstash/context7-mcp@latest` |
| MCP | GitHub | `claude mcp add github -- npx -y @modelcontextprotocol/server-github` |
| 스킬 | postgres-best-practices | `npx skills add supabase/postgres-best-practices` |
| **상태표시줄** | **claude-code-statusline** | **`git clone https://github.com/kcchien/claude-code-statusline.git && cd claude-code-statusline && ./install.sh`** (jq 필요) |
| 에이전트 | reviewer.md | 자체 작성 (context: fork, model: opus) |
| 글로벌 | ~/.claude/CLAUDE.md | 자체 작성 |
| Rules | git-policy.md, test-policy.md, change-management.md | 자체 작성 |

### 3.1.1 글로벌 settings.json 설정

`~/.claude/settings.json`에 아래 설정을 포함한다:

```json
{
  "defaultMode": "bypassPermissions",
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  },
  "teammateMode": "tmux"
}
```

| 설정 | 용도 |
|------|------|
| `bypassPermissions` | 파일 읽기/쓰기/실행 시 매번 허가 묻지 않음. 자율 실행 |
| `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` | Agent Teams 기능 활성화. 여러 에이전트 병렬 실행 |
| `teammateMode: tmux` | Agent Teams가 tmux 세션에서 병렬 실행 |

### 3.2 개발 Track 공통 (csr-*, ssr-*, data)

| 구분 | 항목 | 설치 |
|------|------|------|
| **플러그인** | **agent-skills** (뼈대) | `/plugin marketplace add addyosmani/agent-skills` → `/plugin install agent-skills@addy-agent-skills` |
| 플러그인 | Railway | `/plugin marketplace add railwayapp/railway-plugin` → `/plugin install railway-plugin@railway-plugin` |
| MCP | Railway MCP | `claude mcp add railway-mcp-server -- npx -y @railway/mcp-server` |
| 스킬 | Impeccable | `npx skills add pbakaus/impeccable` |
| 스킬 | playwright-skill | `npx skills add testdino-hq/playwright-skill` |
| ECC | continuous-learning-v2 | ECC 리포에서 `skills/continuous-learning-v2/` 복사 |
| ECC | code-reviewer agent | ECC 리포에서 `agents/code-reviewer.md` 복사 |
| ECC | security-reviewer agent | ECC 리포에서 `agents/security-reviewer.md` 복사 |
| ECC | git-workflow rule | ECC 리포에서 `rules/common/git-workflow/` 복사 |
| ECC | testing rule | ECC 리포에서 `rules/common/testing/` 복사 |
| ECC | security-scan | `npx ecc-agentshield scan` (Ship 단계) |
| Rules | design-workflow.md | 자체 작성 |
| 선택 | GSD | `npx get-shit-done-cc@latest` (대형 프로젝트) |

### 3.3 Track별 추가

**CSR (csr-supabase / csr-fastify / csr-fastapi)**

| 항목 | 설치 | 출처 |
|------|------|------|
| react-best-practices | `npx skills add vercel-labs/agent-skills --skill react-best-practices` | Vercel |
| shadcn-ui | `npx skills add shadcn/ui` | shadcn |
| MCP: Supabase (csr-supabase만) | `claude mcp add supabase -- npx -y @supabase/mcp-server` | Supabase 공식 |
| Rules: shadcn.md, api-contract.md, tauri.md | 자체 작성 | std-dev-boilerplate 참조 |
| Rules: database.md (csr-fastify, csr-fastapi) | 자체 작성 | std-dev-boilerplate 참조 |

**SSR-HTMX (ssr-htmx)**

| 항목 | 설치 | 출처 |
|------|------|------|
| Rules: htmx.md, seo.md | 자체 작성 | dyld-vantage 참조 |

**SSR-Next.js (ssr-nextjs)**

| 항목 | 설치 | 출처 |
|------|------|------|
| next-best-practices | `npx skills add vercel-labs/next-skills` | Vercel |
| react-best-practices | `npx skills add vercel-labs/agent-skills --skill react-best-practices` | Vercel |
| shadcn-ui | `npx skills add shadcn/ui` | shadcn |
| Rules: nextjs.md, seo.md, shadcn.md | 자체 작성 | — |

**Data (data)**

| 항목 | 설치 |
|------|------|
| 에이전트: data-analyst.md | 자체 작성 (Python/DuckDB/Trino/ML/PySide6) |
| Rules: pyside6.md, data-analysis.md | 자체 작성 |

**Executive (executive)**

| 항목 | 설치 |
|------|------|
| Anthropic document-skills | `/plugin marketplace add anthropics/skills` → `/plugin install document-skills@anthropic-agent-skills` |
| 에이전트: strategist.md | 자체 작성 (제안서/DD/PPT/경쟁분석/재무모델) |
| agent-skills | **미설치** (개발 워크플로우 불필요) |

---

## 4. 워크플로우

### 4.1 뼈대: agent-skills 6단계 게이트

```
Define(/uzys:spec) → Plan(/uzys:plan) → Build(/uzys:build) → Verify(/uzys:test) → Review(/uzys:review) → Ship(/uzys:ship)
```

각 단계 완료 없이 다음 진행 금지 (CLAUDE.md에 선언).
단축: hotfix는 Build→Verify→Ship 허용.

### 4.2 Define 단계와 PRD

- agent-skills의 `/spec`이 진입점
- agent-skills spec 템플릿(Objective, Commands, Project Structure, Code Style, Testing, Boundaries)을 기본으로 사용
- 우리 PRD 템플릿(Section 1-13)은 **레퍼런스**로 제공 — 대형 프로젝트에서 비즈니스 맥락이 필요할 때 참조
- PRD-Lifecycle 스킬은 제거. 고유 가치 3가지를 다른 레이어로 분해:

| PRD-Lifecycle 고유 가치 | 이동 위치 |
|------------------------|-----------|
| 변경관리 (CR 유형 분류: Clarification/Minor/Major) | `.claude/rules/change-management.md` |
| DO NOT CHANGE 패턴 | 글로벌 CLAUDE.md 원칙 3 (이미 포함) |
| 세션 시작 프로토콜 (PRD 재읽기) | SessionStart Hook |

### 4.3 게이트별 도구

| Phase | 도구 |
|-------|------|
| Define | agent-skills `/spec`. 대형 프로젝트: PRD 템플릿 참조 |
| Plan | agent-skills `/plan` + Sprint Contract |
| Build | Impeccable + DESIGN.md + CLAUDE.md 원칙 |
| Verify | playwright-skill + test-policy.md 커버리지 기준 |
| Review | **reviewer subagent (context: fork)** + ECC code-reviewer + security-reviewer |
| Ship | Railway 배포 + `npx ecc-agentshield scan` + ADR |

### 4.4 DESIGN.md 활용

- awesome-design-md (66개 사이트 DESIGN.md)에서 원하는 톤 선택, 또는 `/impeccable extract` 사용
- 프로젝트 루트에 `DESIGN.md` 배치 → AI가 일관된 UI 생성
- Impeccable: `/impeccable teach` → `.impeccable.md` → `/polish`, `/critique`, `/audit`

---

## 5. 자체 작성 파일

### 5.1 글로벌 CLAUDE.md

기존 11개 원칙 + 추가:

- 필수 게이트: Define→Plan→Build→Verify→Review→Ship
- Git Policy (What): "변경 시 반드시 commit→push→PR. How는 오케스트레이터 위임"
- 자기 개선: 메타 개선 편집 가능(인간 승인 필수), 주기적 scaffold 제거
- 경험 축적: auto memory + CL-v2, 검증된 learning만 Rules 승격

**200줄 이하 엄수.**

### 5.2 프로젝트 CLAUDE.md 템플릿 (8종)

각 Track에 맞는 Rules/Skills/Agents 참조. executive는 개발 참조 없음.

### 5.3 Subagent

| 파일 | frontmatter | 역할 |
|------|-------------|------|
| reviewer.md | context: fork, model: opus | 코드/문서/UI/QA 관점 전환. **구현과 검증 분리** |
| data-analyst.md | model: opus | Python/DuckDB/Trino/ML/DL/PySide6 |
| strategist.md | model: opus | 제안서/DD/PPT/경쟁분석/재무모델 |

### 5.4 Rules

| 파일 | Track | 핵심 |
|------|-------|------|
| git-policy.md | 전체 | commit/push/PR 의무, main 금지 |
| test-policy.md | 개발 | Track별 차등 (UI 60%, API 80%, 로직 90%) |
| change-management.md | 전체 | CR 유형(Clarification/Minor/Major), Decision Log |
| design-workflow.md | UI Track | Impeccable + DESIGN.md |
| tauri.md | CSR | Tauri v2, IPC, 빌드 (std-dev-boilerplate 참조) |
| pyside6.md | data | Qt, 시그널/슬롯, QThread |
| shadcn.md | CSR, ssr-nextjs | shadcn@latest add, 테마, 폼 (std-dev-boilerplate 참조) |
| api-contract.md | CSR | OpenAPI → TS 타입 (std-dev-boilerplate 참조) |
| htmx.md | ssr-htmx | hx-swap/trigger, partial (dyld-vantage 참조) |
| seo.md | SSR | 메타태그, OG, CWV (dyld-vantage 참조) |
| nextjs.md | ssr-nextjs | App Router, RSC/Client |
| data-analysis.md | data | DuckDB/Trino 패턴 |
| database.md | CSR (fastify/fastapi) | SQLModel, Alembic (std-dev-boilerplate 참조) |
| code-style.md | 개발 전체 | ruff/black(Python), prettier/eslint(TS), strict mode (std-dev-boilerplate 기존) |
| error-handling.md | 개발 전체 | FastAPI 예외 핸들러, React ErrorBoundary, 구조화 에러 (std-dev-boilerplate 기존) |
| **ship-checklist.md** | **개발 전체** | **Ship 단계 필수 게이트: E2E 테스트 통과 확인, test-policy 커버리지 기준 충족 확인, security-scan 통과, SPEC.md/PRD 대비 배포 항목 일치 확인. 불일치 시 PRD/SPEC 업데이트 후 커밋** |
| **commit-policy.md** | **개발 전체** | **코드/문서 변경 시 무조건 즉시 commit. Conventional Commits (feat/fix/refactor). "나중에 한꺼번에" 금지** |

### 5.4.1 PRD/SPEC 스케일링 (스킬)

PRD 또는 SPEC.md가 300줄을 초과하면 기능별로 분리하고 마스터 라우트 문서를 만든다.

```
docs/
├── SPEC.md                    # 마스터 — 공통 규칙 + 각 기능 파일 라우트
├── specs/
│   ├── auth.md                # 인증/인가 기능 스펙
│   ├── dashboard.md           # 대시보드 기능 스펙
│   └── payment.md             # 결제 기능 스펙
```

마스터 SPEC.md 구조:
```markdown
# SPEC: [프로젝트명]

## 공통 규칙
[전체 적용 Boundaries, Tech Stack, DO NOT CHANGE]

## 기능별 스펙
- [인증/인가](specs/auth.md)
- [대시보드](specs/dashboard.md)
- [결제](specs/payment.md)
```

**트리거**: SPEC.md 또는 PRD.md가 300줄 초과 시 에이전트가 분리를 제안. 인간 승인 후 실행.
**구현**: `.claude/skills/spec-scaling/SKILL.md`로 작성 — "SPEC.md가 300줄을 초과하면 기능별로 분리하고 마스터 라우트를 생성하라"

### 5.5 Hooks

| Hook | 동작 |
|------|------|
| SessionStart | git pull + 스펙 재읽기 + 최근 learning 로드 |
| PreToolUse (Write/Edit) | 보호 파일(.env, lock 등) 차단 |

### 5.6 setup-harness.sh / .ps1

대화형 스크립트:
1. 글로벌 설정 (최초 1회)
2. Track 선택 (8개)
3. GSD 추가? [y/N]
4. §3 매핑표대로 자동 설치

### 5.7 커맨드 설계

**원칙: 커맨드는 최소화하고, 워크플로우 단계에 맞춰 실행하면 관련 스킬/에이전트/Rules가 알아서 활성화된다.**

**네임스페이스 규칙:**

| prefix | 출처 | 예시 |
|--------|------|------|
| `uzys:` | 자체 워크플로우 (필수 6개) | `/uzys:spec`, `/uzys:plan`, `/uzys:build`, `/uzys:test`, `/uzys:review`, `/uzys:ship` |
| `ecc:` | ECC cherry-pick | `/ecc:security-scan`, `/ecc:instinct-status`, `/ecc:instinct-export` |
| `imm:` | Impeccable | `/imm:teach`, `/imm:polish`, `/imm:critique`, `/imm:audit` |
| `gsd:` | GSD (선택 설치 시) | `/gsd:new-project`, `/gsd:execute` 등 (GSD 내장) |

agent-skills의 기본 커맨드(`/spec`, `/plan` 등)를 `uzys:` 네임스페이스로 래핑한다. 이유: agent-skills, ECC, GSD, Impeccable 커맨드가 섞이면 출처가 불분명해진다. 네임스페이스로 구분하면 어디서 온 커맨드인지 즉시 파악 가능.

에이전트가 스킬을 알아서 판단해서 쓰게 하되, 사용자가 워크플로우 단계를 명시적으로 전환할 수 있는 필수 커맨드만 제공한다.

**필수 커맨드 (6개 — uzys: 네임스페이스)**

| 커맨드 | 워크플로우 단계 | 자동 활성화되는 것 |
|--------|---------------|-------------------|
| `/uzys:spec` | Define | spec-driven-development 스킬 → 스펙 작성. 대형 프로젝트 시 PRD 템플릿 참조 |
| `/uzys:plan` | Plan | planning-and-task-breakdown 스킬 → Sprint Contract + Phase 분해 |
| `/uzys:build` | Build | incremental-implementation + context-engineering + frontend-ui-engineering 스킬. Impeccable, DESIGN.md 자동 참조 |
| `/uzys:test` | Verify | test-driven-development + browser-testing 스킬 + playwright-skill. test-policy.md 커버리지 기준 자동 참조 |
| `/uzys:review` | Review | code-review-and-quality + security-and-hardening 스킬. **reviewer subagent (context: fork) 자동 호출** + ECC code-reviewer + security-reviewer |
| `/uzys:ship` | Ship | git-workflow + shipping-and-launch 스킬. `npx ecc-agentshield scan` 실행. Railway 배포 |

**보조 커맨드 (Impeccable 등)**

Impeccable 커맨드(`/imm:teach`, `/imm:polish`, `/imm:critique`, `/imm:audit` 등)는 설치되어 있으므로 자유롭게 사용 가능하지만, **별도로 관리하거나 워크플로우에 강제하지 않는다.** 필요할 때 쓰면 되고, 안 써도 무방.

기타 보조 커맨드:

| 커맨드 | 용도 | 빈도 |
|--------|------|------|
| `/ecc:instinct-status` | 축적된 경험 확인 | 수시 |
| `/ecc:instinct-export` | 경험을 knowledge-base로 이관 | 프로젝트 완료 시 |

**사용자가 기억할 것은 6개 필수 커맨드뿐.** 나머지는 상황에 따라 에이전트가 알아서 제안하거나, 사용자가 필요할 때만 사용.

**커맨드 자동 연계 설계 원칙:**

- `/uzys:spec` 실행 시 → 에이전트가 자동으로 idea-refine이 필요한지 판단. 필요하면 먼저 실행.
- `/uzys:build` 실행 시 → 현재 파일 컨텍스트에 따라 frontend-ui-engineering, api-and-interface-design 등 적절한 스킬 자동 선택.
- `/uzys:test` 실행 시 → test-policy.md의 Track별 커버리지 기준 자동 참조. browser-testing이 필요한지 판단.
- `/uzys:review` 실행 시 → reviewer subagent가 context: fork로 자동 호출. 코드/문서/UI 중 무엇을 리뷰할지 산출물 유형에 따라 자동 판단.
- `/uzys:ship` 실행 시 → security-scan 자동 실행. Railway 배포 가능 상태인지 확인. ADR 기록 필요 여부 판단.
- 단계 건너뛰기 시도 시 → 에이전트가 "이전 단계(Verify)가 완료되지 않았습니다" 경고 (CLAUDE.md 게이트)

### 5.8 산출물: README.md + USAGE.md

**README.md** — 시스템 전체 설명. 포함 사항:

- 이 하네스가 무엇인지 (한 단락)
- 아키텍처 다이어그램 (agent-skills 뼈대 + ECC cherry-pick + 자체 에이전트/Rules)
- Track별 스택 요약 (§2 테이블)
- 핵심 사상과 근거 (11개 원칙 + HyperAgents + gitagent SOD — 왜 이렇게 만들어졌는지)
- 설치 방법 (setup-harness.sh 사용법)
- 레퍼런스 출처 (§10 테이블)
- 기여/수정 가이드 (Rules 추가/수정 방법)
- 라이선스

**USAGE.md** — 사용법 가이드. 포함 사항:

- 워크플로우 퀵스타트: `/uzys:spec` → `/uzys:plan` → `/uzys:build` → `/uzys:test` → `/uzys:review` → `/uzys:ship`
- 각 커맨드 실행 시 무슨 일이 일어나는지 (어떤 스킬/에이전트/Rules가 활성화되는지)
- 네임스페이스 설명: `uzys:` (자체), `ecc:` (ECC), `imm:` (Impeccable), `gsd:` (GSD)
- Track별 사용 시나리오 (CSR 프로젝트 시작~배포 예시, executive PPT 작성 예시)
- 보조 커맨드 설명 (Impeccable, instinct 관련)
- Rules 설명: 각 Rule 파일이 무엇을 강제하고, 어떤 Track에서 활성화되는지
- 변경관리: CR 유형(Clarification/Minor/Major) 분류 기준, Decision Log 작성법
- 동시 세션 사용법: feature branch 규칙
- 경험 축적 사용법: auto memory 확인, instinct export, knowledge-base 이관
- FAQ / 트러블슈팅

---

## 6. 핵심 원칙 요약

### 6.1 행동 원칙 (11개, AGENT-GUIDELINES-reference.md 상세)

1. Think Before Acting — 가정 금지, 확인 우선
2. Simplicity First — 미언급 = 범위 밖
3. Surgical Changes — DO NOT CHANGE 준수
4. Goal-Driven Execution — 검증 가능한 목표
5. Separate Eval from Gen — 구현 ≠ 검증 (reviewer subagent)
6. Long-Running Management — Phase + 인간 게이트
7. Fact vs Opinion — 출처 필수
8. Sprint Contract — 작업 전 "완료" 합의
9. Circuit Breakers — 3회 실패 → 멈추고 보고
10. Harness Maintenance — 단순 시작, 필요 시만 추가, 주기적 제거
11. Perimeter Not Blueprint — what+why+경계, how는 에이전트

### 6.1.1 gitagent 사상 흡수 (D6)

| gitagent 사상 | 구현 위치 |
|---------------|-----------|
| 에이전트 정의의 Git 버전관리 | `.claude/agents/*.md`를 Git 추적 |
| SOUL.md (정체성) | subagent frontmatter (name, description, model, context) |
| SOD (Segregation of Duties) | reviewer subagent ≠ 구현 에이전트. context: fork 격리 |
| memory/ (Git 추적 상태) | auto memory + `.claude/memory/` |
| hooks (bootstrap/teardown) | SessionStart Hook, PreToolUse Hook |
| validate (에이전트 품질 검증) | `npx ecc-agentshield scan` |

### 6.2 HyperAgents 사상 — 구현 수준

**현재 구현 가능한 것 (이번 스코프):**

| 사상 | 구현 | 자동화 수준 |
|------|------|------------|
| **경험 축적** | auto memory + CL-v2 instinct | 자동. 세션 종료 시 에이전트가 learning 기록, instinct 추출 |
| **검증된 learning → Rules 승격 제안** | CL-v2의 confidence score 기반. high-confidence instinct를 에이전트가 "이 패턴을 Rule로 승격할까요?" 제안 | 반자동. 에이전트가 제안, **인간이 승인** |
| **주기적 scaffold 검토** | 글로벌 CLAUDE.md에 "분기 1회: 각 Rule을 비활성화하고 영향 확인" 지시 | 수동. 인간이 트리거 |
| **DO NOT CHANGE 보호** | 원칙 3 + change-management.md rule | 자동. 에이전트가 보호 영역 자동 인식 |
| **구현/검증 분리 (SOD)** | reviewer subagent (context: fork) | 자동. Build→Review 전환 시 자동 격리 |

**향후 로드맵 (이번 스코프 아님):**

| 단계 | 내용 | 전제 조건 |
|------|------|-----------|
| **R1** | instinct → Rule 자동 PR 생성 | CL-v2 confidence ≥ 0.9인 instinct를 `.claude/rules/learned/`에 자동 추가 → Git PR → 인간 리뷰 | CL-v2 독립 동작 확인 (Q3) |
| **R2** | 크로스 프로젝트 learning 전이 | knowledge-base/ 리포에서 다른 프로젝트의 `~/.claude/CLAUDE.md`로 자동 주입 | knowledge-base/ 리포 구조 확정 |
| **R3** | Rule 효과 측정 자동화 | Rule 비활성화 전후의 에이전트 성능(토큰 사용량, 실패율) 비교 | Claude Code `/stats` API 활용 |
| **R4** | 메타 에이전트 | 프로젝트 전체 learnings/instincts를 분석해서 CLAUDE.md 개선안을 제안하는 별도 subagent | R1-R3 데이터 축적 후 |

> R1-R4는 HyperAgents 논문의 "메타 개선 메커니즘을 편집 가능하게"를 단계적으로 구현하는 경로.
> 핵심 제약: **자동 반영은 어떤 단계에서도 금지. 인간 게이트 필수.**

### 6.3 경험 축적

| 시스템 | 역할 | 이관 |
|--------|------|------|
| Claude Code auto memory | 세션 중 자동 교정 축적 | 마크다운, 복사로 이관 |
| ECC continuous-learning-v2 | instinct 추출, confidence scoring | `/instinct-export` |

```
프로젝트별 memory/ → 주기적으로 → knowledge-base/ 리포
  ├── learnings/    # 검증된 것만
  ├── instincts/    # high-confidence만
  ├── decisions/    # ADR 아카이브
  └── patterns/     # 반복 패턴
```

---

## 7. 동시 세션 & Git

- 같은 프로젝트에서 Claude Code 터미널 여러 개 → **세션별 feature branch**
- SessionStart Hook에서 `git pull` 강제
- main 직접 커밋 금지
- Git How(커밋 방식, PR 템플릿)는 ECC git-workflow rule에 위임

---

## 7.1 운영 사항

**컨텍스트 관리**: Claude Code autocompact 기능 활용. CLAUDE.md에 "autocompact 활성화, 수동 /compact at 50%" 지시.

**비용/토큰**: `/stats`로 세션별 토큰 확인. 프로젝트별 예산 설정은 향후 로드맵 (R3과 연계).

**롤백/복구**: ECC savepoint 활용 (ECC cherry-pick에 포함). Major CR 전 savepoint는 change-management.md rule에서 지시.

**executive Track 워크플로우**: agent-skills 미설치이므로 6단계 게이트 적용 안 됨. 대신:

```
executive 워크플로우: 요청 → strategist subagent + document-skills → 산출물 → 인간 검토
```

별도 커맨드 없이 자연어로 요청. strategist subagent와 Anthropic document-skills(pptx/docx/xlsx/pdf)가 자동 활성화.

---

## 8. 검증 기준

| # | 항목 |
|---|------|
| V1 | setup-harness.sh로 각 Track 초기화 → §3 매핑표 항목 전부 설치 확인 |
| V2 | executive Track → agent-skills 미설치, document-skills만 설치 |
| V3 | `/uzys:spec`→`/uzys:plan`→`/uzys:build`→`/uzys:test`→`/uzys:review`→`/uzys:ship` 동작 |
| V4 | reviewer가 context: fork로 격리 실행 |
| V5 | Railway MCP/플러그인 동작 (배포, 로그) |
| V6 | Anthropic document-skills (pptx/docx/xlsx/pdf) 동작 |
| V7 | GSD 선택 설치 시 agent-skills와 병행 |
| V8 | 글로벌 CLAUDE.md 200줄 이하 |
| V9 | ECC cherry-pick 6개 로드 |
| V10 | auto memory + CL-v2 동작 |
| V11 | README.md에 아키텍처, 사상, 설치법, 레퍼런스 포함 |
| V12 | USAGE.md에 6개 필수 커맨드 + Track별 시나리오 + Rules 설명 포함 |
| V13 | `/build` 실행 시 UI 파일 편집이면 frontend-ui-engineering + Impeccable 자동 활성화 확인 |
| V14 | 단계 건너뛰기 시도 시 게이트 경고 동작 확인 |
| V15 | `/ship` 실행 시 E2E 미통과면 배포 차단 확인 |
| V16 | 배포 후 SPEC/PRD 불일치 감지 → 업데이트 제안 확인 |
| V17 | 코드 변경 후 커밋 없이 다음 작업 진행 시 경고 동작 확인 |
| V18 | SPEC.md 300줄 초과 시 분리 제안 확인 |

---

## 9. 열린 질문

| # | 질문 | 확인 시점 |
|---|------|-----------|
| Q1 | agent-skills + ECC cherry-pick 스킬 이름 충돌 | 설치 후 |
| Q2 | ECC 개별 파일이 플러그인 없이 동작하는지 | 설치 후 |
| Q3 | CL-v2 독립 동작 여부 | 설치 후 |
| Q4 | GSD + agent-skills 명령 충돌 | 설치 후 |
| Q5 | Railway 플러그인과 MCP 동시 설치 시 중복 | 설치 후 |
| Q6 | Supabase MCP와 postgres-best-practices 스킬 간 역할 중복 | 설치 후 |

---

## 10. References

### 필수 소스 (구현 시 fetch)

| 소스 | URL | 용도 |
|------|-----|------|
| **agent-skills** | github.com/addyosmani/agent-skills | 워크플로우 뼈대. 향후 업데이트: `/plugin update` 또는 marketplace refresh → reinstall. 주기적으로 리포의 skills/ 변경 확인 |
| **ECC** | github.com/affaan-m/everything-claude-code | cherry-pick 소스 (6개) |
| **Anthropic skills** | github.com/anthropics/skills | pptx/docx/xlsx/pdf 공식 |
| **Railway plugin** | docs.railway.com/ai/claude-code-plugin | 배포/로그 |
| **Railway MCP** | github.com/railwayapp/railway-mcp-server | Railway API |
| **Supabase MCP** | github.com/supabase-community/supabase-mcp | Supabase DB/Auth/Storage (csr-supabase Track) |
| **Impeccable** | github.com/pbakaus/impeccable | 디자인 품질 |
| **awesome-design-md** | github.com/VoltAgent/awesome-design-md | DESIGN.md 66개 |
| **GSD** | github.com/gsd-build/get-shit-done | 선택적 오케스트레이터 |
| **claude-code-statusline** | github.com/kcchien/claude-code-statusline | 상태표시줄 (모델, 컨텍스트, 비용, git, rate limit) |

### 참조 리포 (구현 시 반드시 fetch)

| 리포 | 참조 대상 | 구현 시 지시 |
|------|-----------|-------------|
| **`<YOUR_BOILERPLATE_REPO>`** | .claude/rules/, CLAUDE.md, 스킬/플러그인 구성 전체 | **GitHub MCP로 리포 구조 확인 → 기존 Rules 내용을 기반으로 새 Rules 작성. 기존 것과 중복/충돌 방지** |
| **`<YOUR_REFERENCE_REPO>`** | .claude/rules/ (htmx.md, seo.md 등), CLAUDE.md | **GitHub MCP로 리포 구조 확인 → SSR/HTMX Track Rules의 실제 참조 원본** |

> ⚠️ 두 리포는 private. 본인의 private boilerplate/reference 리포로 교체 후 Claude Code의 GitHub MCP를 통해 접근. 반드시 기존 파일 내용을 읽고, 이미 작성된 Rules/설정과 일관성을 유지하라.

### 원칙 & 사상

| 소스 | URL | 기여 |
|------|-----|------|
| Karpathy LLM 관찰 | github.com/forrestchang/andrej-karpathy-skills | 원칙 1-4 |
| Anthropic Harness Design | anthropic.com/engineering/harness-design-long-running-apps | 원칙 5-6, 8, 10 |
| HyperAgents | arxiv.org/abs/2603.19461 | 자기 개선, 수렴 아키텍처 |
| Osmani spec 가이드 | addyosmani.com/blog/good-spec/ | PRD+SRS 병합, living document |
| gitagent | github.com/open-gitagent/gitagent | SOD, SOUL.md, Git-native (사상 흡수) |

### 기존 산출물 (레퍼런스)

| 파일 | 용도 |
|------|------|
| AGENT-GUIDELINES-reference.md | 11개 원칙 상세 + 도메인별 적용 예시 |
| PRD-TEMPLATE-standalone.md | 대형 프로젝트 PRD 양식 (비즈니스 맥락 필요 시) |
| PRD-LIFECYCLE.md | 변경관리 워크플로우 레퍼런스 (change-management.md rule의 근거) |
| Claude Code Docs | code.claude.com/docs | 공식 스킬/에이전트/훅/메모리 |

---

## 11. 산출물 구조

```
~/.claude/
├── CLAUDE.md                          # 글로벌 (11원칙 + 게이트 + Git Policy)
├── agents/
│   ├── reviewer.md                    # 검증 에이전트
│   ├── data-analyst.md                # 데이터 분석
│   └── strategist.md                  # 비즈니스/전략

project-root/
├── README.md                          # 시스템 설명, 아키텍처, 사상, 설치법
├── USAGE.md                           # 워크플로우, 커맨드, Rules 설명, 사용 시나리오
├── CLAUDE.md                          # 프로젝트 (Track별)
├── DESIGN.md                          # (UI Track — 선택/작성)
├── .impeccable.md                     # (/impeccable teach)
├── .claude/
│   ├── rules/
│   │   ├── git-policy.md
│   │   ├── test-policy.md
│   │   ├── change-management.md       # CR 유형 분류, Decision Log
│   │   ├── design-workflow.md         # (UI Track)
│   │   ├── code-style.md              # (std-dev-boilerplate 기반)
│   │   ├── error-handling.md          # (std-dev-boilerplate 기반)
│   │   ├── ship-checklist.md          # Ship 게이트: E2E/커버리지/보안/PRD 일치
│   │   ├── commit-policy.md           # 코드/문서 변경 시 무조건 즉시 커밋
│   │   └── [Track별 Rules...]
│   ├── skills/
│   │   ├── continuous-learning-v2/    # (ECC cherry-pick)
│   │   └── spec-scaling/SKILL.md      # SPEC 300줄 초과 시 기능별 분리
│   ├── agents/
│   │   ├── code-reviewer.md           # (ECC cherry-pick)
│   │   └── security-reviewer.md       # (ECC cherry-pick)
│   └── hooks/
│       ├── session-start.sh
│       └── protect-files.sh
├── docs/
│   ├── SPEC.md                        # agent-skills /spec으로 생성
│   └── decisions/                     # ADR
└── setup-harness.sh                   # 초기화 스크립트
```
