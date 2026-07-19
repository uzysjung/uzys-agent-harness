# Tracks & per-track assets

A **track** is a preset bundle for your stack. Pick one or more at step 1 of the wizard; each
track determines which skills, plugins, and rules are pre-checked at step 3. Everything is
toggleable before install — a track is a starting point, not a lock-in.

Back to the [README](../README.md) · install detail in the [usage guide](USAGE.md) · per-asset
verification status in the [compatibility matrix](COMPATIBILITY.md).

---

## Track list

### Dev tracks

| Track | Stack |
|---|---|
| `csr-supabase` | Vite + React + Supabase |
| `csr-fastify` | Vite + React + Fastify |
| `csr-fastapi` | Vite + React + FastAPI |
| `ssr-nextjs` | Next.js (App Router) |
| `ssr-htmx` | HTMX + server-side |
| `data` | DuckDB + Polars + PySide6 |
| `full` | union of all dev tracks |

### Business tracks

| Track | Use |
|---|---|
| `executive` | proposals, due diligence, decks, financial models |
| `project-management` | PM workflow + reviews |
| `growth-marketing` | growth + content marketing |

### Meta

| Track | Use |
|---|---|
| `tooling` | Bash + Markdown meta-projects (no app stack) |

---

## What gets installed per track

External assets are recommended automatically based on your track selection. Step 3 shows them pre-checked; you can toggle anything before install.

### Frontend (csr-* / ssr-nextjs / full)

| Asset | What | Source |
|---|---|---|
| `frontend-design` | Distinctive production-grade UI generation — **default on all dev tracks** | Anthropic official |
| `react-best-practices` | React patterns and component guidelines | vercel-labs |
| `shadcn-ui` | Radix-based component copy + Tailwind theme | shadcn (official) |
| `web-design-guidelines` | UX/UI best practices — **opt-in** since v26.106.0 (`frontend-design` covers the default) | vercel-labs |
| `impeccable` | UI design, critique, and visual review skills — **opt-in** since v26.106.0 | pbakaus |

### Backend (csr-* / ssr-* / full)

| Asset | What | Source |
|---|---|---|
| `railway-skills` | Railway deploy + project/service/env management | Railway official |
| `supabase-agent-skills` (csr-supabase) | Supabase agent skills | Supabase official |
| `postgres-best-practices` (csr-supabase) | Postgres patterns | Supabase official |
| `supabase-cli` (csr-supabase) | Supabase CLI (`supabase login` for OAuth) | npm |
| `vercel-cli` (csr-supabase) | Vercel CLI | npm |
| `netlify-cli` | Netlify CLI — **opt-in** since v26.106.0 (deploy-CLI dedup; `vercel-cli` stays default at 10:1 weekly downloads) | npm |

### Data (data / full)

| Asset | What | Source |
|---|---|---|
| `polars-K-Dense` | Polars — fast Rust DataFrame (pandas alternative) | K-Dense-AI |
| `dask-K-Dense` | Dask — distributed processing | K-Dense-AI |
| `python-resource-management` | Memory / CPU management patterns — **opt-in** since v26.106.0 | wshobson |
| `python-performance-optimization` | Profiling + vectorization — **opt-in** since v26.106.0 | wshobson |
| `anthropic-data-plugin` | Visualization + SQL exploration | Anthropic official |

### Business (executive / project-management / growth-marketing)

| Asset | What | Source | Tracks |
|---|---|---|---|
| `anthropic-document-skills` | pptx / docx / xlsx / pdf authoring | Anthropic | executive · full |
| `c-level-skills` | 28 advisory skills (CEO/CFO/COO) | claude-code-skills | executive · full |
| `business-growth-skills` | Growth, finance, marketing playbooks | claude-code-skills | executive · full · growth-marketing |
| `finance-skills` | Financial models | claude-code-skills | executive · full |
| `pm-skills` | PM workflows | claude-code-skills | project-management |
| `product-skills` | Product discovery + delivery | claude-code-skills | project-management (dev tracks: opt-in since v26.106.0) |
| `marketing-skills` / `research-summarizer` | Marketing playbooks | claude-code-skills | growth-marketing |

### Dev Tools (all dev tracks)

| Asset | What | Source |
|---|---|---|
| `playwright-skill` | E2E test authoring with Playwright | testdino-hq |
| `find-skills` | Search and rank installed skills | vercel-labs |
| `agent-browser` | Browser automation CLI for agents | npm |
| `karpathy-coder` | Pre-commit quality gate hook | claude-code-skills |
| `code-review` | Multi-agent PR review with confidence scoring — **opt-in** (overlaps the default review agents) | Anthropic official |
| `multi-persona-review` ★ | Critique one artifact via 3-5 parallel personas → P0/P1/P2 fixes | this project (core) |
| `gap-analysis-e2e` ★ | Detect north-star / correctness / UX gaps, then benchmark how reference services solved each | this project (core) |
| `ultracode-service-audit` ★ | Multi-agent, adversarially-verified full-service audit (7 dimensions) → milestone roadmap | this project (core) |

> ★ **dev-method skills** — first-party (`official`) workflow methodology bundled with the harness. **Core on every dev track** (installed by default; uncheck at step 3 or `--without <id>` to skip). Repo-bundled templates — no external download. **Installs across all 4 CLIs**: Claude (`.claude/skills/`) and Codex / Antigravity as native skills (`.agents/skills/<id>/SKILL.md`), plus OpenCode as a command fallback (`.opencode/commands/<id>.md`, since OpenCode has no native skill concept).

### Workflow (opt-in — pick one or more at step 3)

> **Which one?** See the [Workflow curation guide](docs/WORKFLOWS.md) — a vetted comparison of all 7 installable workflows (plus honest pointers to Spec Kit / Kiro, which we recommend but don't auto-install).

| Asset | What | Activates |
|---|---|---|
| `superpowers` | Agentic skills framework, Anthropic official marketplace | obra/superpowers |
| `ecc-plugin` | 60 agents · 230 skills · 75 commands | affaan-m |
| `openspec` | Spec-driven brownfield delta workflow (propose → apply → archive) | Fission-AI |
| `bmad-method` | Multi-agent agile workflow (PM/Architect/Dev, 12+ agents) | bmad-code-org |
| `addy-agent-skills` | `/spec` `/plan` `/build` `/test` `/review` `/ship` `/code-simplify` skills | addyosmani's workflow |
| `wshobson-agents` | Multi-agent orchestration workflows (full-stack/tdd/review), cross-CLI | wshobson |
| `feature-dev` | Guided feature workflow — explore/architect/review agents | Anthropic official marketplace |

**First-party dev-method skills** — `official`, **core on every dev track** (installed by default; uncheck at step 3 or `--without <id>` to skip). Repo-bundled templates that install across all 4 CLIs: Claude, Codex/Antigravity native skills, OpenCode command fallback.

| Asset | What | Source |
|---|---|---|
| `asis-tobe-decision` ★ | Present an A-or-B / approval moment as context → recommendation → option table → AS-IS/TO-BE contrast | this project (core) |
| `compaction-handoff` ★ | Persist durable state + git snapshot + resume anchor before a context `/compact` | this project (core) |
| `northstar-roadmap` ★ | Measure current state vs the vision doc → ranked feature backlog persisted to docs/plans + memory | this project (core) |
| `harness-health-audit` ★ | Audit your CLAUDE.md/rules/skills/hooks on 4 questions a linter can't answer: TRUE · USED · AFFORDABLE · SAFE | this project (core) |
| `recurrence-prevention` ★ | When the same defect happens again: verify the count with evidence, classify simple slip vs complex problem, escalate record → forced rule → structural gate | this project (core) |

**First-party recommended means** (`official`, **opt-in** — the methodology above is core; these are *means* the maintainer recommends, not requirements. `--with model-orchestration` / `--with gemini-consult` / `--with codex-consult`; repo-bundled, install across all 4 CLIs; the two advisors need their external CLI at runtime — Antigravity [`agy`](https://antigravity.google/cli) or OpenAI `codex`):

| Asset | What | Source |
|---|---|---|
| `model-orchestration` | Model orchestration policy — role split (orchestrator directs/reviews · strong model authors core/V&V · mid model does repetitive impl/E2E) + effort floors + quota handoff | this project |
| `gemini-consult` | Consult Gemini (via `agy`) for natural **Korean** phrasing + **multi-persona** second-opinion review + image generation — an idiomatic, independent second model | this project |
| `codex-consult` | Consult OpenAI Codex (`codex exec`) for **concise / structured** rewriting + **image generation** (real PNG on disk) — division of labor: nuance/persona → gemini, concision/structure/images → codex | this project |

**First-party CI scaffold** (`official`, **opt-in** — `--with ci-scaffold`): `.github/workflows/` fill-in templates — tag-triggered CI + real-DB service container block + coverage gate + Playwright E2E — variant-matched to your tracks (node / python / both; E2E on UI tracks). The only asset that writes outside `.claude/`, so it **never overwrites existing workflow files** (they're reported as preserved), and uninstall leaves `.github/` untouched.

### Security & ECC (opt-in)

| Asset | What | Source |
|---|---|---|
| `security-guidance` | Pattern-based security warnings on every edit + LLM diff review (needs Python + Agent SDK at runtime) | Anthropic official |
| `trailofbits-skills` | Differential security review | Trail of Bits |
| `ecc-plugin` | ECC plugin (project-scoped via `prune-ecc.sh`) | affaan-m |
| `ecc-prune` | Trim ECC down to a curated set (4 agents + 8 skills + 3 commands) | this project |

---
