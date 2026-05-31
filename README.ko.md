# uzys-claude-harness

**Claude Code · Codex · OpenCode 용 트랙 기반 에이전트 하네스.**

스택 트랙 하나 고르면 스킬 · 플러그인 · 룰이 프로젝트에 자동 세팅된다. 디폴트 install 은 **project scope** — 명시적으로 선택하지 않는 한 글로벌 영역 미수정.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/github/v/tag/uzysjung/uzys-claude-harness?label=version)](https://github.com/uzysjung/uzys-claude-harness/releases)
[![CI](https://github.com/uzysjung/uzys-claude-harness/actions/workflows/test.yml/badge.svg)](https://github.com/uzysjung/uzys-claude-harness/actions)

🇺🇸 [English](./README.md)

---

## 설치

```bash
npx -y github:uzysjung/uzys-claude-harness
```

6-step interactive wizard 가 안내. flag 필요 없음.

```
Step 1/6  Tracks            ← 스택 선택
Step 2/6  CLI               ← claude / codex / opencode
Step 3/6  Install items     ← 추천 항목 (pre-checked) 확인
Step 4/6  Scope             ← Project (default) 또는 Global
Step 5/6  Confirm
Step 6/6  Installing
```

설치 후:

```bash
claude
> /uzys:spec    # step 3 에서 "uzys-harness 6-Gate workflow" 체크한 경우에만
```

---

## Tracks

Step 1 에서 1개 또는 multi 선택. 트랙 선택 결과로 Step 3 의 추천 항목이 결정됨.

### Dev tracks

| Track | Stack |
|---|---|
| `csr-supabase` | Vite + React + Supabase |
| `csr-fastify` | Vite + React + Fastify |
| `csr-fastapi` | Vite + React + FastAPI |
| `ssr-nextjs` | Next.js (App Router) |
| `ssr-htmx` | HTMX + server-side |
| `data` | DuckDB + Polars + PySide6 |
| `full` | dev 트랙 전체 union |

### Business tracks

| Track | 용도 |
|---|---|
| `executive` | 제안서, DD, 발표자료, 재무모델 |
| `project-management` | PM 워크플로우 + 리뷰 |
| `growth-marketing` | Growth + 콘텐츠 마케팅 |

### Meta

| Track | 용도 |
|---|---|
| `tooling` | Bash + Markdown 메타프로젝트 (앱 스택 없음) |

---

## 트랙별 설치 항목

트랙 선택 결과로 자동 추천. Step 3 에서 pre-checked 상태로 표시 — 설치 전 자유롭게 토글.

### Frontend (csr-* / ssr-nextjs / full)

| Asset | What | Source |
|---|---|---|
| `react-best-practices` | React 패턴 + 컴포넌트 가이드 | LokeshSakthivel |
| `shadcn-ui` | Radix 기반 컴포넌트 카피 + Tailwind 테마 | shadcn (official) |
| `web-design-guidelines` | UX/UI best practice | LokeshSakthivel |
| `impeccable` | UI 디자인, critique, visual review | pbakaus |
| `next-skills` (ssr-nextjs only) | Next.js App Router 패턴 | vercel-labs |

### Backend (csr-* / ssr-* / full)

| Asset | What | Source |
|---|---|---|
| `railway-skills` | Railway 배포 + project/service/env 관리 | Railway 공식 |
| `supabase-agent-skills` (csr-supabase) | Supabase agent skills | Supabase 공식 |
| `postgres-best-practices` (csr-supabase) | Postgres 패턴 | Supabase 공식 |
| `supabase-cli` (csr-supabase) | Supabase CLI (`supabase login` OAuth 필요) | npm |
| `vercel-cli` (csr-supabase) | Vercel CLI | npm |
| `netlify-cli` (csr-supabase) | Netlify CLI | npm |

### Data (data / full)

| Asset | What | Source |
|---|---|---|
| `polars-K-Dense` | Polars — Rust 기반 fast DataFrame (pandas 대안) | K-Dense-AI |
| `dask-K-Dense` | Dask — 분산 처리 | K-Dense-AI |
| `python-resource-management` | 메모리 / CPU 관리 패턴 | wshobson |
| `python-performance-optimization` | 프로파일링 + vectorize | wshobson |
| `anthropic-data-plugin` | 시각화 + SQL exploration | Anthropic 공식 |

### Business (executive / project-management / growth-marketing)

| Asset | What | Source | Tracks |
|---|---|---|---|
| `anthropic-document-skills` | pptx / docx / xlsx / pdf 작성 | Anthropic | executive · full |
| `c-level-skills` | 28 advisory skills (CEO/CFO/COO) | claude-code-skills | executive · full |
| `business-growth-skills` | Growth · finance · marketing 플레이북 | claude-code-skills | executive · full · growth-marketing |
| `finance-skills` | 재무 모델 | claude-code-skills | executive · full |
| `pm-skills` | PM 워크플로우 | claude-code-skills | project-management |
| `product-skills` | Product discovery + delivery | claude-code-skills | dev + PM |
| `marketing-skills` / `content-creator` / `demand-gen` / `research-summarizer` | 마케팅 플레이북 | claude-code-skills | growth-marketing |

### Dev Tools (모든 dev tracks)

| Asset | What | Source |
|---|---|---|
| `playwright-skill` | Playwright E2E 테스트 작성 | testdino-hq |
| `find-skills` | 설치된 skills 검색 · ranking | vercel-labs |
| `agent-browser` | 에이전트용 브라우저 자동화 CLI | npm |
| `architecture-decision-record` | ADR 작성 | yonatangross |
| `karpathy-coder` | Pre-commit quality gate hook | claude-code-skills |
| `product-skills` | Product engineering | claude-code-skills |

### Workflow (opt-in — step 3 에서 선택)

| Asset | What | 활성 시 |
|---|---|---|
| `uzys-harness 6-Gate workflow` | `/uzys:spec` → `/uzys:plan` → `/uzys:build` → `/uzys:test` → `/uzys:review` → `/uzys:ship` (hook 으로 게이트 강제) | 6-gate workflow (아래 참조) |
| `addy-agent-skills` | `/spec` `/plan` `/build` `/test` `/review` `/ship` `/code-simplify` | addyosmani 워크플로우 |
| `superpowers` | Agentic skills 프레임워크 (Anthropic 공식 marketplace) | obra/superpowers |
| `gsd-orchestrator` | 대형 프로젝트 오케스트레이션 | get-shit-done-cc |

### Security & ECC (opt-in)

| Asset | What | Source |
|---|---|---|
| `trailofbits-skills` | Differential 보안 리뷰 | Trail of Bits |
| `ecc-plugin` | ECC plugin (`prune-ecc.sh` 로 project-scoped) | affaan-m |
| `ecc-prune` | ECC 를 curated 셋 (4 agents + 8 skills + 3 commands) 으로 trim | 본 프로젝트 |

---

## 6-Gate workflow (opt-in 시에만)

6-gate workflow 는 **default OFF**. Step 3 에서 `uzys-harness 6-Gate workflow` 체크 시 활성 (또는 비대화형 `--with-uzys-harness`).

```
/uzys:spec → /uzys:plan → /uzys:build → /uzys:test → /uzys:review → /uzys:ship
```

| Gate | 목적 |
|---|---|
| `/uzys:spec` | 코드 이전 build 대상 정의 |
| `/uzys:plan` | spec → 작고 검증 가능한 task 분해 |
| `/uzys:build` | 점진적 구현 |
| `/uzys:test` | 동작 증명 |
| `/uzys:review` | 다중 관점 코드/보안 리뷰 |
| `/uzys:ship` | 프리런치 체크리스트 + 배포 |

각 게이트는 `.claude/hooks/` 의 hook 으로 강제. 이전 게이트 미완료 시 다음 게이트 fail (exit code 2). opt-in 안 했으면 `/uzys:*` 커맨드 미설치, hook 비활성 — 트랙의 다른 자산은 그대로 사용 가능.

---

## Scope

Step 4 에서 install write 위치 선택.

| | Project (default) | Global (opt-in) |
|---|---|---|
| `claude plugin` | `--scope project` (`installed_plugins.json` 의 `projectPath` 로 격리) | `--scope user` |
| `npx skills` | project `node_modules` | `-g` (user-level) |
| `npm` | `--save-dev` (devDependency) | `-g` |
| Codex (prompts / skills / config) | 프로젝트 `.codex/` | `~/.codex/` |
| `~/.claude/skills/` · `~/.codex/` · `~/.opencode/` · `npm root -g` | **미수정** | 자산별 write |

Project scope 는 install 을 본 레포에 가둠. 동일 머신의 다른 프로젝트는 영향 받지 않음.

Claude CLI 자체는 scope 와 무관하게 `~/.claude/plugins/cache/` 에 plugin 파일을 write — 단 `installed_plugins.json` 메타데이터가 `projectPath` 로 격리하므로 다른 프로젝트에서 안 보임.

---

## Uninstall

```bash
npx -y github:uzysjung/uzys-claude-harness uninstall
```

`.claude/.harness-install.json` (install 시 생성) 을 읽어 자동 reverse.

- Project-scope 자산: 자동 제거 (`claude plugin uninstall --scope project`, `npm uninstall --save-dev`, `.codex/` cleanup 등).
- 프로젝트 루트 `CLAUDE.md`: install 시점과 내용이 동일할 때만 제거 (sha256). 설치 후 직접 수정했다면 안내와 함께 보존.
- Global-scope 자산: advisory 만 출력 — 사용자가 직접 제거. uninstall 이 명시적 동의 없이 다른 프로젝트나 글로벌 설정을 절대 안 건드림.

Flag:

| Flag | What |
|---|---|
| `--dry-run` | reverse list 만 출력, 변경 없음 |
| `--keep-templates` | external 자산만 제거, `.claude/`, `.codex/`, `.opencode/` 보존 |

---

## 동작 방식

```
┌──────────────────────────────────────────────────────────┐
│  npx claude-harness                                      │
│         │                                                │
│         ▼                                                │
│  ┌─ 6-step wizard ──────────────────────────────────┐    │
│  │  Track(s) → CLI(s) → Items → Scope → Confirm    │    │
│  └──────────────────┬───────────────────────────────┘    │
│                     ▼                                    │
│  ┌─ Phase 1: Templates ─────────────────────────────┐    │
│  │  .claude/{rules,agents,hooks,commands,skills}    │    │
│  │  CLAUDE.md (merged) · .mcp.json                  │    │
│  └──────────────────┬───────────────────────────────┘    │
│                     ▼                                    │
│  ┌─ Phase 2: External assets ───────────────────────┐    │
│  │  claude plugin / npx skills / npm / shell-script │    │
│  │  Step 4 에서 선택한 scope 따름                    │    │
│  └──────────────────┬───────────────────────────────┘    │
│                     ▼                                    │
│  ┌─ Phase 3: install log ───────────────────────────┐    │
│  │  .claude/.harness-install.json                   │    │
│  │  (uninstall 의 source)                           │    │
│  └──────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

---

## CLI 지원

| CLI | 지원 |
|---|---|
| Claude Code | First class — 모든 자산 + hook |
| Codex (OpenAI) | Skills + slash commands; project-scope 시 `.codex/` 에 write |
| OpenCode | Skills + AGENTS.md 통합 |
| Antigravity (Google) | Project: `.agents/rules/` (context, 항상) + `.agents/skills/` + `.agents/workflows/` (6-Gate opt-in). Global (opt-in `--with-antigravity-global` + `--scope global`): `~/.gemini/antigravity/{skills,global_workflows}/uzys-*` (v26.66.0+) |

Step 2 에서 1개 또는 multi 선택.

---

## 심화

- [docs/USAGE.md](./docs/USAGE.md) — 워크플로우 상세, install 내부, CI flag, ECC 통합, Codex/OpenCode 설정
- [docs/NORTH_STAR.md](./docs/NORTH_STAR.md) — 디자인 원칙
- [docs/decisions/](./docs/decisions/) — ADR (아키텍처 결정)
- [docs/REFERENCE.md](./docs/REFERENCE.md) — 트랙별 자산 매트릭스 상세

---

## License

MIT.
