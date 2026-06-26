# Usage Guide

Quick reference for using `uzys-agent-harness` after install.

For install instructions, see [README.md](../README.md).

---

## Commands

### `ecc:` namespace (ECC plugin opt-in)

Activate via `--with ecc-plugin` or by checking ECC items at step 3.

| Command | Purpose |
|---|---|
| `/ecc:security-scan` | AgentShield scan on `.claude/` |
| `/ecc:e2e` | Generate + run Playwright E2E |
| `/ecc:eval` | Evaluate against acceptance criteria |
| `/ecc:checkpoint` | Snapshot current state |
| `/ecc:harness-audit` | Audit harness setup |
| `/ecc:instinct-status` | List learned instincts (CL-v2) |
| `/ecc:evolve` | Promote instincts → skills |
| `/ecc:promote` | Promote project instinct to global |

### Other namespaces

- **Impeccable** (`/polish`, `/critique`, `/audit`, `/clarify`, etc.) — UI design skills from `pbakaus/impeccable`. Direct call.
- **addy** (`/spec`, `/plan`, `/build`, `/test`, `/review`, `/ship`, `/code-simplify`) — spec-driven workflow skills from `addyosmani/agent-skills`. Direct call.

---

## Scope (v26.64.0+, ADR-020)

Default = **Project**. Global write only when you explicitly opt in.

| Method | Project (default) | Global (opt-in) |
|---|---|---|
| `claude plugin` | `--scope project` | `--scope user` |
| `npx skills` | project `node_modules` | `-g` |
| `npm` | `--save-dev` | `-g` |
| Codex (skills / config) | `.codex/` (project) | `~/.codex/` |

`~/.claude/plugins/{cache,marketplaces,installed_plugins.json}` is written by claude CLI itself in both modes — the `installed_plugins.json` metadata isolates entries by `projectPath` so other projects aren't affected.

At step 4 of the wizard, pick Project (pre-selected) or Global. Non-interactive: `--scope <project|global>`.

---

## Uninstall (v26.64.0+)

```bash
npx -y @uzysjung/agent-harness uninstall [--dry-run] [--keep-templates]
```

Reverses the install based on `.claude/.harness-install.json`.

- **Project-scope assets**: removed automatically (`claude plugin uninstall --scope project`, `npm uninstall --save-dev`, `.codex/` cleanup, etc.).
- **Project root `CLAUDE.md`**: removed only if unchanged since install (sha256 match); kept with a notice if you edited it.
- **Global-scope assets**: listed as advisory only. You run the removal yourself.

---

## Non-interactive install

For CI or scripted use:

```bash
npx -y @uzysjung/agent-harness install --track <name>
```

Common flags:

| Flag | Effect |
|---|---|
| `--track <name>` (repeatable) | Required. Pick a track |
| `--cli <claude\|codex\|opencode\|antigravity>` (repeatable) | Target CLI. Default `claude` |
| `--scope <project\|global>` | Default `project` |
| `--with <asset-id>` (repeatable) | Force-include an external asset |
| `--without <asset-id>` (repeatable) | Force-exclude from preset |
| `--with ecc-plugin` | Install ECC plugin + cherry-pick |

Full flag list: `npx -y @uzysjung/agent-harness install --help` (or `agent-harness install --help` after a global install).

### Interactive wizard (6-step)

```
1/6  Tracks            preset by stack
2/6  CLI               claude / codex / opencode / antigravity (multi-select)
3/6  Install items     category-grouped multiselect (Frontend / Backend / Data / Business / Dev Tools / Understanding / Visual & Media / Workflow / ECC)
4/6  Scope             Project (default) / Global
5/6  Confirm           summary review
6/6  Installing        pipeline
```

ESC at step 1 = exit with cancel. ESC at later steps = silent back.

---

## Trust tiers (v26.71.0)

External assets carry a trust tier, shown as a badge in step 3:

- **★ official** — Anthropic-official marketplaces + this harness's own assets.
- **vetted** — community assets with ≥ 1000 GitHub stars + active maintenance. Pre-checked on track match.
- **⚠ experimental** — under 1000 stars. Opt-in only (not pre-checked), sorted to the bottom of each category.

Tiers inform; they never block — you choose what installs. Static labels (PRD v26-71), re-reviewed quarterly.

---

## Multi-CLI install

Pick more than one at step 2 (or pass `--cli` multiple times):

```bash
npx -y @uzysjung/agent-harness install --track tooling --cli claude --cli codex --cli opencode
```

Each CLI gets its own dispatcher file:

| CLI | Dispatcher | Notes |
|---|---|---|
| Claude Code | `.claude/` | First class. All hooks active |
| Codex | `.codex/` + project `AGENTS.md` + `.agents/skills/` | Skills + `AGENTS.md` rules for your stack |
| OpenCode | `.opencode/` + project `AGENTS.md` | Skills + commands |
| Antigravity | `.agents/rules/` + `.agents/skills/` | Shares `.agents/skills/` (dev-method skills) with Codex (v26.66.0+) |

Multi-CLI dispatchers reference the same content via symlinks where possible — no duplication.

---

## Project files (what the harness writes)

| Path | Purpose |
|---|---|
| `.claude/rules/*.md` | LLM-facing rules (code-style, git, tests) |
| `.claude/agents/*.md` | Agent definitions (reviewer, code-reviewer, etc.) |
| `.claude/hooks/*.sh` | Programmatic guards (protect-files, spec-drift, etc.) |
| `.claude/skills/*` | Anthropic skills (north-star, etc.) |
| `.claude/settings.json` | Statusline + hooks registration |
| `.claude/.harness-install.json` | Install log (drives `uninstall`) |
| `CLAUDE.md` | Project context, merged from track |
| `.mcp.json` | MCP server config (chrome-devtools, context7, github, railway) |
| `.codex/` | Codex project-scope dispatcher (if `--cli codex`) |
| `.opencode/` | OpenCode dispatcher (if `--cli opencode`) |

---

## Hooks

`.claude/hooks/` scripts that run automatically on tool calls or session events.

| Hook | When | Purpose |
|---|---|---|
| `session-start.sh` | session start | Load SPEC / Change Log context |
| `protect-files.sh` | PreToolUse Write/Edit | Block edits to protected paths |
| `spec-drift-check.sh` | post-edit | Detect SPEC vs code drift |
| `mcp-pre-exec.sh` | MCP exec | Allowlist gate (D35) |
| `checkpoint-snapshot.sh` | PostToolUse (tool-count threshold) | Checkpoint savepoint + `/compact` nudge (D25) |
| `hito-counter.sh` | session events | NSM telemetry (HITO baseline) |
| `karpathy-gate.sh` | PreToolUse Write/Edit | Quality gate (only when `--with-karpathy-hook` + plugin install succeeded) |

---

## Codex integration

The `AGENTS.md` file at project root is the Codex equivalent of `CLAUDE.md` — merged from your track. Project `.agents/skills/` are dev-method skills shared with Antigravity (one file serves both CLIs).

---

## OpenCode integration

`.opencode/` carries:

- `commands/` — dev-method skill command fallbacks (OpenCode has no native skill concept)
- `opencode.json` — config
- `AGENTS.md` — shared with Codex

3 hooks map to OpenCode lifecycle events (session start / pre-edit / post-edit).

---

## Antigravity integration (v26.66.0+)

Google Antigravity 2.0 (I/O 2026-05-19) — `agy` CLI + desktop IDE. uzys-agent-harness writes:

- `.agents/rules/` — project context (full CLAUDE.md embedded). **Always written** when `--cli antigravity` (the Antigravity equivalent of CLAUDE.md / AGENTS.md). v26.69.0+.
- `.agents/skills/<id>/SKILL.md` — dev-method skills in Anthropic format (shared with Codex; one file serves both CLIs).

Rules are written regardless (foundational context); dev-method skills are core on dev tracks.

> **Verification status (2026-05-31)**: file layout is **structurally verified** against real `agy 1.0.3` in Docker (`test/docker/run-realcli.sh antigravity`) — `.agents/rules` + `.agents/skills/<id>/SKILL.md` written correctly per Antigravity's documented workspace spec. **Runtime recognition** in a logged-in `agy` session (does a skill load) is **not yet automated** — `agy --print` is Google-OAuth-gated and TUI commands require a TTY. Manual confirmation in a logged-in session is recommended.

---

## ECC integration

ECC plugin lives in `affaan-m/everything-claude-code`. Two modes:

- **Cherry-pick fallback** (default when no ECC opt-in): up to 4 agents + 8 skills + 3 commands copied into `.claude/`.
- **Full plugin install** (`--with ecc-plugin`): `claude plugin install ecc-plugin`. Optionally `--with-prune` to trim down to a curated set.

See [decisions/ADR-019-cherry-pick-plugin-gating.md](./decisions/ADR-019-cherry-pick-plugin-gating.md).

---

## Track-specific notes

### CSR / SSR

- `csr-supabase` includes Supabase + Vercel + Netlify CLI. First `supabase login` requires OAuth (manual).
- `ssr-nextjs` adds `next-skills` (App Router patterns).
- `ssr-htmx` keeps it server-side — no React assets.

### Data

- Polars + Dask via `K-Dense-AI/scientific-agent-skills`.
- Python performance + resource management via `wshobson`.
- `anthropic-data-plugin` for visualization + SQL.

### Executive

- `anthropic-document-skills` (pptx / docx / xlsx / pdf).
- `c-level-skills` (28 advisory skills).
- `strategist` agent for proposals / DD / financial models.

### Tooling

Bash + Markdown meta-projects. No app stack. The same dev-method skills work for CLI tools.

---

## Migration notes

### v26.64.0 — Project-scope default (BREAKING)

- All install assets now default to project scope. `~/.claude/skills/`, `~/.codex/`, `~/.opencode/`, `npm -g` untouched unless you opt in.
- `npm-global` assets (vercel / supabase / netlify-cli / agent-browser) now install as `--save-dev` by default.

### v26.42.0 — addy-agent-skills opt-in (BREAKING)

`addyosmani/agent-skills` is no longer auto-installed. Use `--with addy-agent-skills` or check at step 3.

---

## Troubleshooting

### `npm warn Unknown project config` during install

Harmless. Your `.npmrc` has pnpm-specific keys (`auto-install-peers`, etc.) that npm doesn't recognize. Install behavior is unaffected.

Suppress with `--loglevel=error` if needed.

### `Invalid agents: claude`

skills CLI ≥ 1.5.7 requires repeatable `--agent` (not comma-separated). The harness already does this correctly; if you see it, you may be on a pre-v26.55.1 install. Re-run the latest harness.

### Plugin install fails (`marketplace not found`)

Usually means the marketplace was already added and skipping silently. Plugin install retries regardless. If the plugin itself fails, check `~/.claude/plugins/installed_plugins.json` for stale entries.

---

## Advanced

- [docs/NORTH_STAR.md](./NORTH_STAR.md) — design principles
- [docs/REFERENCE.md](./REFERENCE.md) — per-track asset matrix in detail
- [docs/decisions/](./decisions/) — architecture decision records (ADRs)
- [scripts/sync-cherrypicks.sh](../scripts/sync-cherrypicks.sh) — internal sync tool for upstream cherry-picks (maintainers only)
