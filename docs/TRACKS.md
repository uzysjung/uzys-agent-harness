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
| `ssr-htmx` | htmx + FastAPI |
| `data` | Python data + DuckDB + PySide6 |
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

External assets are recommended automatically based on your track selection. Step 3 shows them pre-checked; you can toggle anything before install. Rows marked **opt-in** are never pre-checked — you add them at step 3 or with `--with <id>`. That includes every ⚠ experimental asset, whatever track it matches.

Per-asset install method and verification status live in the [compatibility matrix](COMPATIBILITY.md). That page is generated from the catalog; this one is written by hand, so the matrix wins if the two ever disagree.

### Frontend (csr-* / ssr-nextjs / full)

| Asset | What | Source |
|---|---|---|
| `frontend-design` | Distinctive production-grade UI generation — **default on all dev tracks** | Anthropic official |
| `react-best-practices` | React hook, perf, and component patterns | vercel-labs |
| `shadcn-ui` | Radix-based component copy + Tailwind theme | shadcn (official) |
| `web-design-guidelines` | Visual hierarchy, color, spacing — **opt-in** since v26.106.0 (`frontend-design` covers the default) | vercel-labs |
| `taste-skill` | Anti-slop frontend design — infers a design language, then tunes variance / motion / density — **opt-in** | Leonxlnx |
| `jakubkrehel-skills` | Better-* interface suite — typography, OKLCH color, accessibility, layout, UX writing, one concern per skill — **opt-in** | jakubkrehel |
| `scroll-world` | Scroll-driven 3D world landing pages — **opt-in** | oso95 |
| `tauri-desktop` | Tauri desktop rule template — **opt-in** | this project |

### Backend (csr-* / ssr-* / full)

| Asset | What | Source |
|---|---|---|
| `railway-skills` | Railway deploy + project/service/env management — **opt-in** (also ⚠ experimental tier, which alone already keeps it out of every pre-check) | Railway official |
| `supabase-agent-skills` (csr-supabase · full) | RLS, auth, edge function, and realtime guidance | Supabase official |
| `postgres-best-practices` (csr-supabase · full) | Schema, index, and query patterns | Supabase official |
| `supabase-cli` | Supabase CLI (`supabase login` for OAuth) — **opt-in** | npm |
| `vercel-cli` | Vercel CLI — **opt-in** | npm |
| `netlify-cli` | Netlify CLI — **opt-in** | npm |

The three CLIs above install a CLI package — a project `devDependency` by default, or a global binary under `--scope global` — so none of them is pre-checked by a track any more. Pick the one your project deploys to at step 3 or with `--with <id>`.

### Data (data / full)

| Asset | What | Source |
|---|---|---|
| `anthropic-data-plugin` | Visualization + SQL exploration | Anthropic official |

### Business (executive / project-management / growth-marketing)

| Asset | What | Source | Tracks |
|---|---|---|---|
| `anthropic-document-skills` | pptx / docx / xlsx / pdf authoring | Anthropic official | executive · full |
| `finance-skills` | Financial analyst, SaaS metrics, investment advisor (3 skills) — **opt-in** | alirezarezvani | any track |
| `product-skills` | RICE, PRD, agile PO, UX research, SaaS scaffolder (15 skills) — **opt-in** | alirezarezvani | any track |
| `marketingskills` | CRO, copywriting, SEO / AI-SEO, ads, growth (45 skills) — **opt-in** | coreyhaines31 | any track |

Only `executive` pre-checks a business asset of its own (`anthropic-document-skills`). `project-management` and `growth-marketing` pre-check none — they get the all-track first-party skills below, and `product-skills` / `marketingskills` are the opt-ins to add at step 3.

### Dev Tools (all dev tracks)

| Asset | What | Source |
|---|---|---|
| `find-skills` | Search and rank installed skills | vercel-labs |
| `agent-browser` | Agent-friendly Playwright wrapper — screenshot and DOM-search CLI | vercel-labs (npm) |
| `code-review` | Multi-agent PR review with confidence scoring — **opt-in** (overlaps the default review agents) | Anthropic official |

### First-party method skills

Written and maintained in this repo (`official` tier) and bundled as templates — no external download. **Installs across all 4 CLIs** as native skills: Claude reads `.claude/skills/`; Codex, OpenCode, and Antigravity all read the same `.agents/skills/<id>/SKILL.md`.

**Core on every dev track** — installed by default; uncheck at step 3 or `--without <id>` to skip.

| Asset | What |
|---|---|
| `clear-korean-communication` | Explain from the reader's position, and put an approval moment in context → recommendation → option table → AS-IS/TO-BE form |
| `audit-service-gaps` | Enumerate gaps against the north-star baseline through three lenses, then check how a reference service closed each one before proposing a fix |
| `multi-persona-review` | Review one artifact through independent personas in parallel → deduped, severity-ranked findings |
| `recurrence-prevention` | When the same defect returns: verify the count against prior evidence, classify slip vs harness problem, escalate record → rule → structural gate |
| `verification-loop` | Proportional verification tracks per surface, ending in a fixed verdict (PASS / PASS_WITH_NITS / FAIL) plus the evidence each finding rests on |
| `compaction-handoff` | Persist durable state, a git snapshot, and one resume anchor before a context `/compact` |

**On every track**, dev or not.

| Asset | What |
|---|---|
| `north-star` | Direction baseline — NSM as metric-proxy, pillars, Will/Won't, decision gates — and the ranked roadmap derived from it |
| `gh-issue-workflow` | GitHub Issues as the async backlog and decision channel, with read-only / draft / remote-write stages kept distinct |
| `task-brief` | Normalize a request — and every delegation prompt — into the canonical brief: objective · inputs · invariants · success criteria · boundaries · autonomy · verification. Ships with the `task-brief-nudge` hook, which adds one line of stdout when a long prompt arrives without a brief |
| `audit-harness-fit` | Audit whether the resident steering layer (anchor · rules · hooks · permissions · skill descriptors) still earns its context — measured, judged against published criteria and block logs, then relocated: procedures to skills, must-hold guarantees to hooks and permission rules, derivable facts back to code |

**Recommended means** (`official`, **opt-in** — the methodology above is core; these are *means* the maintainer recommends, not requirements. `--with model-orchestration` / `--with external-model-consult`; the second needs its provider's CLI at runtime — Antigravity [`agy`](https://antigravity.google/cli) or OpenAI `codex`):

| Asset | What |
|---|---|
| `model-orchestration` | Role split and effort floors for delegation — who authors, who verifies, which model and effort each lane gets |
| `external-model-consult` | Ask a non-Claude model for natural Korean phrasing, a second opinion, concise restructuring, or image generation |

> Nine of these twelve were bundled here, moved out to a separate skills repo in 2026-08, then **moved back in ADR-062** — the migrated copies had lost the decision rules, measured precedents, and worked examples that made them worth loading. `compaction-handoff` never left; `task-brief` is new in the same cycle, and `audit-harness-fit` (ADR-064) is new after it.

### Not driven by track selection (opt-in on any track)

Understanding — `claude-video` · `understand-anything` · `agentmemory`. Visual & media — `frontend-slides` · `marp-slide` · `mermaid-diagrams` · `gsap-skills` · `remotion` · `ppt-master` · `ppt-generation` · `web-video-presentation` · `revealjs`. Pick them at step 3 or pass `--with <id>`; the full catalog is in the [compatibility matrix](COMPATIBILITY.md).

### Workflow (opt-in — pick one or more at step 3)

> **Which one?** See the [Workflow curation guide](WORKFLOWS.md) — a vetted comparison of all 7 installable workflows (plus honest pointers to Spec Kit / Kiro, which we recommend but don't auto-install).

| Asset | What | Activates |
|---|---|---|
| `superpowers` | Agentic skills framework, Anthropic official marketplace | obra/superpowers |
| `ecc-plugin` | 60 agents · 230 skills · 75 commands | affaan-m |
| `openspec` | Spec-driven brownfield delta workflow (propose → apply → archive) | Fission-AI |
| `bmad-method` | Multi-agent agile workflow (PM/Architect/Dev, 12+ agents) | bmad-code-org |
| `addy-agent-skills` | `/spec` `/plan` `/build` `/test` `/review` `/ship` `/code-simplify` skills | addyosmani's workflow |
| `wshobson-agents` | Multi-agent orchestration workflows (full-stack/tdd/review), cross-CLI | wshobson |
| `feature-dev` | Guided feature workflow — explore/architect/review agents | Anthropic official marketplace |

**First-party CI scaffold** (`official`, **opt-in** — `--with ci-scaffold`): `.github/workflows/` fill-in templates — tag-triggered CI + real-DB service container block + coverage gate + Playwright E2E — variant-matched to your tracks (node / python / both; E2E on UI tracks). The only asset that writes outside `.claude/`, so it **never overwrites existing workflow files** (they're reported as preserved), and uninstall leaves `.github/` untouched.

### Security & ECC (opt-in)

| Asset | What | Source |
|---|---|---|
| `security-guidance` | Pattern-based security warnings on every edit + LLM diff review (needs Python + Agent SDK at runtime) | Anthropic official |
| `trailofbits-skills` | Differential security review | Trail of Bits |
| `ecc-plugin` | ECC plugin (project-scoped via `prune-ecc.sh`) | affaan-m |
| `ecc-prune` | Trim ECC down to the curated KEEP set (`prune-ecc.sh` derives the count — no second copy of it here) | this project |

---
