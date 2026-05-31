# uzys-claude-harness

**Track-based agent harness for Claude Code, Codex, OpenCode, and Antigravity.**

Pick a stack track. Get a curated set of **vetted** skills, plugins, and rules — you review and choose what installs — wired into your project. Project scope by default; no global pollution unless you ask.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/github/v/tag/uzysjung/uzys-claude-harness?label=version)](https://github.com/uzysjung/uzys-claude-harness/releases)
[![CI](https://github.com/uzysjung/uzys-claude-harness/actions/workflows/test.yml/badge.svg)](https://github.com/uzysjung/uzys-claude-harness/actions)

🇰🇷 [한국어](./README.ko.md)

---

## Install

```bash
npx -y @uzysjung/claude-harness
```

A 6-step interactive wizard guides everything. No flags needed.

```
Step 1/6  Tracks            ← pick your stack
Step 2/6  CLI               ← claude / codex / opencode / antigravity
Step 3/6  Install items     ← review pre-checked recommendations
Step 4/6  Scope             ← Project (default) or Global
Step 5/6  Confirm
Step 6/6  Installing
```

After install:

```bash
claude
> /uzys:spec    # only if you checked "uzys-harness 6-Gate workflow" in step 3
```

---

## Tracks

Pick one or more at step 1. Each track determines which skills/plugins/rules are pre-checked in step 3.

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
| `react-best-practices` | React patterns and component guidelines | LokeshSakthivel |
| `shadcn-ui` | Radix-based component copy + Tailwind theme | shadcn (official) |
| `web-design-guidelines` | UX/UI best practices | LokeshSakthivel |
| `impeccable` | UI design, critique, and visual review skills | pbakaus |
| `next-skills` (ssr-nextjs only) | Next.js App Router patterns | vercel-labs |

### Backend (csr-* / ssr-* / full)

| Asset | What | Source |
|---|---|---|
| `railway-skills` | Railway deploy + project/service/env management | Railway official |
| `supabase-agent-skills` (csr-supabase) | Supabase agent skills | Supabase official |
| `postgres-best-practices` (csr-supabase) | Postgres patterns | Supabase official |
| `supabase-cli` (csr-supabase) | Supabase CLI (`supabase login` for OAuth) | npm |
| `vercel-cli` (csr-supabase) | Vercel CLI | npm |
| `netlify-cli` (csr-supabase) | Netlify CLI | npm |

### Data (data / full)

| Asset | What | Source |
|---|---|---|
| `polars-K-Dense` | Polars — fast Rust DataFrame (pandas alternative) | K-Dense-AI |
| `dask-K-Dense` | Dask — distributed processing | K-Dense-AI |
| `python-resource-management` | Memory / CPU management patterns | wshobson |
| `python-performance-optimization` | Profiling + vectorization | wshobson |
| `anthropic-data-plugin` | Visualization + SQL exploration | Anthropic official |

### Business (executive / project-management / growth-marketing)

| Asset | What | Source | Tracks |
|---|---|---|---|
| `anthropic-document-skills` | pptx / docx / xlsx / pdf authoring | Anthropic | executive · full |
| `c-level-skills` | 28 advisory skills (CEO/CFO/COO) | claude-code-skills | executive · full |
| `business-growth-skills` | Growth, finance, marketing playbooks | claude-code-skills | executive · full · growth-marketing |
| `finance-skills` | Financial models | claude-code-skills | executive · full |
| `pm-skills` | PM workflows | claude-code-skills | project-management |
| `product-skills` | Product discovery + delivery | claude-code-skills | dev + PM |
| `marketing-skills` / `content-creator` / `demand-gen` / `research-summarizer` | Marketing playbooks | claude-code-skills | growth-marketing |

### Dev Tools (all dev tracks)

| Asset | What | Source |
|---|---|---|
| `playwright-skill` | E2E test authoring with Playwright | testdino-hq |
| `find-skills` | Search and rank installed skills | vercel-labs |
| `agent-browser` | Browser automation CLI for agents | npm |
| `architecture-decision-record` | ADR authoring | yonatangross |
| `karpathy-coder` | Pre-commit quality gate hook | claude-code-skills |
| `product-skills` | Product engineering | claude-code-skills |

### Workflow (opt-in — pick one or more at step 3)

| Asset | What | Activates |
|---|---|---|
| `uzys-harness 6-Gate workflow` | `/uzys:spec` → `/uzys:plan` → `/uzys:build` → `/uzys:test` → `/uzys:review` → `/uzys:ship` with hook-enforced gates | The 6-gate flow described below |
| `addy-agent-skills` | `/spec` `/plan` `/build` `/test` `/review` `/ship` `/code-simplify` skills | addyosmani's workflow |
| `superpowers` | Agentic skills framework, Anthropic official marketplace | obra/superpowers |
| `gsd-orchestrator` | Orchestration for large projects | get-shit-done-cc |

### Security & ECC (opt-in)

| Asset | What | Source |
|---|---|---|
| `trailofbits-skills` | Differential security review | Trail of Bits |
| `ecc-plugin` | ECC plugin (project-scoped via `prune-ecc.sh`) | affaan-m |
| `ecc-prune` | Trim ECC down to a curated set (4 agents + 8 skills + 3 commands) | this project |

---

## Trust tiers

Every external asset carries a **trust tier**, shown as a badge in step 3:

- **★ official** — Anthropic-official marketplaces + this harness's own assets.
- **vetted** — community assets with ≥ 1000 GitHub stars and active maintenance. Pre-checked when they match your track.
- **⚠ experimental** — under 1000 stars. Opt-in only (not pre-checked), listed at the bottom of each category.

Tiers **inform, never block** — you always review and choose what installs. Recommended assets (official/vetted matching your track) sort to the top.

---

## 6-Gate workflow (only if you opt in)

The 6-gate workflow is **off by default**. To enable it, check `uzys-harness 6-Gate workflow` at step 3 (or pass `--with-uzys-harness` for non-interactive install).

```
/uzys:spec → /uzys:plan → /uzys:build → /uzys:test → /uzys:review → /uzys:ship
```

| Gate | Purpose |
|---|---|
| `/uzys:spec` | Define what you're building before code |
| `/uzys:plan` | Decompose the spec into small, verifiable tasks |
| `/uzys:build` | Implement incrementally |
| `/uzys:test` | Prove it works |
| `/uzys:review` | Multi-perspective code/security review |
| `/uzys:ship` | Pre-launch checklist + deploy |

Gates are enforced by hooks installed under `.claude/hooks/`. Skipping a gate fails the next one (exit code 2). If you didn't opt in, `/uzys:*` commands aren't installed and the hooks aren't active — you get the rest of the track's assets without the gating.

---

## Scope

Step 4 asks where the install writes.

| | Project (default) | Global (opt-in) |
|---|---|---|
| `claude plugin` | `--scope project` (entries isolated by `projectPath` in `installed_plugins.json`) | `--scope user` |
| `npx skills` | project `node_modules` | `-g` (user-level) |
| `npm` | `--save-dev` (devDependency) | `-g` |
| Codex (prompts / skills / config) | `.codex/` in your project | `~/.codex/` |
| Antigravity (skills / workflows) | `.agents/` in your project | `~/.gemini/antigravity/` |
| `~/.claude/skills/` · `~/.codex/` · `~/.opencode/` · `~/.gemini/` · `npm root -g` | **not touched** | written per asset |

Project scope keeps the install confined to your repo. Other projects on the same machine are unaffected.

Claude CLI itself writes plugin cache under `~/.claude/plugins/cache/` regardless of scope — but the metadata in `installed_plugins.json` isolates entries by `projectPath`, so other projects don't see them.

---

## Uninstall

```bash
npx -y @uzysjung/claude-harness uninstall
```

Reads `.claude/.harness-install.json` (created during install) and reverses what was installed.

- Project-scope assets: removed automatically (`claude plugin uninstall --scope project`, `npm uninstall --save-dev`, `.codex/` cleanup, etc.).
- Project root `CLAUDE.md`: removed only if it still matches the installed version (sha256); kept with a notice if you've edited it since install.
- Global-scope assets: listed as advisory only — you remove them yourself. Uninstall never touches another project or your global config without explicit action.

Flags:

| Flag | What |
|---|---|
| `--dry-run` | List reverse steps, change nothing |
| `--keep-templates` | Remove external assets but keep `.claude/`, `.codex/`, `.opencode/` |

---

## How it works

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
│  │  Honors the scope chosen at step 4               │    │
│  └──────────────────┬───────────────────────────────┘    │
│                     ▼                                    │
│  ┌─ Phase 3: install log ───────────────────────────┐    │
│  │  .claude/.harness-install.json                   │    │
│  │  (drives `uninstall`)                            │    │
│  └──────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

---

## CLI support

| CLI | Status |
|---|---|
| Claude Code | First class — all assets and hooks |
| Codex (OpenAI) | Skills + slash commands; project-scope writes go to `.codex/` |
| OpenCode | Skills + AGENTS.md integration |
| Antigravity (Google) | Project: `.agents/rules/` (context, always) + `.agents/skills/` + `.agents/workflows/` (6-Gate opt-in). Global (opt-in via `--with-antigravity-global` + `--scope global`): `~/.gemini/antigravity/{skills,global_workflows}/uzys-*` (v26.66.0+) |

Pick one or more at step 2.

---

## Advanced

- [docs/USAGE.md](./docs/USAGE.md) — workflow detail, install internals, CI flags, ECC integration, Codex/OpenCode setup
- [docs/NORTH_STAR.md](./docs/NORTH_STAR.md) — design principles
- [docs/decisions/](./docs/decisions/) — ADRs (architecture decisions)
- [docs/REFERENCE.md](./docs/REFERENCE.md) — per-track asset matrix in detail

---

## License

MIT.
