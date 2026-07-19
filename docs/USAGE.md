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
| Antigravity (skills / workflows) | `.agents/` (project) | `~/.gemini/antigravity/` |
| `~/.claude/skills/` · `~/.codex/` · `~/.opencode/` · `~/.gemini/` · `npm root -g` | **not touched** | written per asset |

`~/.claude/plugins/{cache,marketplaces,installed_plugins.json}` is written by claude CLI itself in both modes — the `installed_plugins.json` metadata isolates entries by `projectPath` so other projects aren't affected.

At step 4 of the wizard, pick Project (pre-selected) or Global. Non-interactive: `--scope <project|global>`.

---

## What's installed (v26.123.0+)

```bash
npx -y @uzysjung/agent-harness list
```

Reads `.claude/.harness-install.json` and prints the assets, their scope and version, the template
dirs, and whether your root `CLAUDE.md` has been edited since install. Read-only. The asset ids it
shows are the input to `uninstall --only`.

Installing again is additive: `install --with <id>` appends to the log, so a later `uninstall`
still knows about everything from the earlier run. The exception is the interactive **Reinstall**
action (the wizard's "Reinstall (backs up current `.claude/` first)"), which moves `.claude/` aside
and rebuilds it: assets whose files lived inside `.claude/` are genuinely gone, so they're dropped
from the record too. Assets that live outside the project (`plugin`, `npm`) are kept.

## Uninstall (v26.64.0+)

```bash
npx -y @uzysjung/agent-harness uninstall [--dry-run] [--keep-templates] [--only <ids>]
```

Reverses the install based on `.claude/.harness-install.json`.

- **Project-scope assets**: removed automatically (`claude plugin uninstall --scope project`, `npm uninstall --save-dev`, `.codex/` cleanup, etc.).
- **Project root `CLAUDE.md`**: removed only if unchanged since install (sha256 match); kept with a notice if you edited it.
- **Global-scope assets**: listed as advisory only. You run the removal yourself.
- **Assets with no automated reverse** (`npx-run`, `shell-script`): reported as such and left in the record — a full uninstall removes `.claude/` around them, but `--only` cannot undo them.

| Flag | What |
|---|---|
| `--dry-run` | List the reverse steps, change nothing |
| `--keep-templates` | Remove external assets but keep `.claude/`, `.codex/`, `.opencode/` |
| `--only <ids>` | Remove just these assets (comma-separated, from `list`). Templates untouched; the log is rewritten with what remains, so the rest stays removable |

Only assets whose reverse actually succeeded are dropped from the log — a failed removal stays
listed rather than being recorded as gone. If nothing could be removed automatically, the command
says so and exits non-zero rather than reporting success.

When `--only` leaves `.claude/` in place, a hook registration in `.claude/settings.json` that
referenced the removed asset is **printed for you to delete** rather than edited automatically
(currently implemented for `karpathy-coder`). Other root-level files the installer touches —
`.mcp.json`, `.gitignore`, `.env.example`, `.mcp-allowlist`, `.github/workflows/` — get no advisory
yet and are never removed.

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
3/6  Install items     5 pages of category-grouped multiselects (v26.99.0):
                       Dev Core (Frontend·Backend·Data) / Dev Tools (Security·Quality·Understanding)
                       / Business / Visual & Media / Workflow & ECC.
                       The 8 dev-method skills fold into a single "methodology bundle" row.
4/6  Scope             Project (default) / Global
5/6  Confirm           summary review (+ session-start context cost of your selection)
6/6  Installing        pipeline
```

ESC at step 1 = exit with cancel. ESC at later steps = silent back.

---

## Trust tiers (v26.71.0)

External assets carry a trust tier, shown as a badge in step 3:

- **★ official** — Anthropic-official marketplaces + this harness's own assets.
- **vetted** — community assets with ≥ 1000 GitHub stars + active maintenance. Pre-checked on track match.
- **⚠ experimental** — under 1000 stars. Opt-in only (not pre-checked), sorted to the bottom of each category.

Tiers inform; they never block — you choose what installs. Labels are static in the catalog but **auto-monitored monthly** for star-drift by CI (`trust-tier-drift.yml`); install-method availability is re-verified monthly too (`catalog-verify.yml`).

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

Skills are **copied per CLI format, not symlinked** — each CLI needs its own variant (slash-command namespace and env-var renames differ), and Codex + Antigravity share one `.agents/skills/` file. All variants render from the same bundled source at install time, so there is no drift between them.

---

## Installing into an existing project

`agent-harness` never silently overwrites your config. Before replacing an **editable** file whose contents differ, it writes a timestamped backup next to it — and every backup path is printed in the install summary (`backup` rows). Nothing is deleted.

| You already have… | What happens |
|---|---|
| `.claude/settings.json` with your own hooks / statusLine | Backed up to `settings.json.backup-<ts>` before update |
| Root `CLAUDE.md` (yours differs from the generated one) | Backed up to `CLAUDE.md.backup-<ts>` before the merge write |
| `.claude/` on `--reinstall` / `update` mode | The whole directory is renamed to `.claude.backup-<ts>` first |
| `.mcp.json` | Your existing MCP servers are preserved and merged, not replaced |

> Fresh project? None of this triggers — backups only protect pre-existing files.

---

## How it works

```
┌──────────────────────────────────────────────────────────┐
│  npx -y @uzysjung/agent-harness                         │
│         │                                                │
│         ▼                                                │
│  ┌─ 6-step wizard ──────────────────────────────────┐    │
│  │  Track(s) → CLI(s) → Items → Scope → Confirm    │    │
│  └──────────────────┬───────────────────────────────┘    │
│                     ▼                                    │
│  ┌─ Phase 1: Templates ─────────────────────────────┐    │
│  │  .claude/{rules,agents,hooks,commands,skills}    │    │
│  │  CLAUDE.md (scaffold) · .mcp.json                │    │
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

After install, a `tooling` + Claude project looks like:

```
your-project/
├── .claude/
│   ├── rules/          # coding conventions for your stack
│   ├── agents/         # subagent definitions
│   ├── hooks/          # lifecycle / pre-commit hooks
│   └── settings.json   # your existing one is backed up first
├── CLAUDE.md           # fill-in scaffold (yours backed up if it differed)
└── .mcp.json           # MCP servers, merged with yours
```

---

## CLI support

| CLI | Status |
|---|---|
| Claude Code | First class — all assets and hooks |
| Codex (OpenAI) | Skills + `AGENTS.md` rules for your stack |
| OpenCode | Skills + AGENTS.md integration |
| Antigravity (Google) | Project: `.agents/rules/` (context, always) + `.agents/skills/` (dev-method skills) |

Pick one or more at step 2.

---

---

## Project files (what the harness writes)

| Path | Purpose |
|---|---|
| `.claude/rules/*.md` | LLM-facing rules — lifecycle discipline (git-policy, doc-governance, test-policy; UI tracks add playwright-launch + benchmark-parity) plus stack rules (code-style, nextjs, …) |
| `.claude/agents/*.md` | Agent definitions (reviewer, code-reviewer, etc.) |
| `.claude/hooks/*.sh` | Programmatic guards (protect-files, spec-drift, etc.) |
| `.claude/skills/*` | Anthropic skills (north-star, etc.) |
| `.claude/settings.json` | Statusline + hooks registration |
| `.claude/.harness-install.json` | Install log — accumulates across installs; drives `list` and `uninstall` |
| `CLAUDE.md` | Project context — fill-in scaffold |
| `.mcp.json` | MCP server config (chrome-devtools, context7, github, railway) |
| `.codex/` | Codex project-scope dispatcher (if `--cli codex`) |
| `.opencode/` | OpenCode dispatcher (if `--cli opencode`) |
| `.agents/` | Codex + Antigravity shared skills/rules (if either CLI selected) |
| `.github/workflows/` | CI fill-in templates — **only with `--with ci-scaffold`**; never overwrites existing files |

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
| `karpathy-gate.sh` | PreToolUse Write/Edit | Quality gate (only when `--with-karpathy-hook` + plugin install succeeded) |

---

## Codex integration

The `AGENTS.md` file at project root is the Codex equivalent of `CLAUDE.md` — a fill-in scaffold, same as `CLAUDE.md`. Project `.agents/skills/` are dev-method skills shared with Antigravity (one file serves both CLIs).

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

- `csr-supabase` includes Supabase + Vercel CLI (Netlify CLI is **opt-in** since v26.106.0 — deploy-CLI dedup). First `supabase login` requires OAuth (manual).
- `ssr-nextjs` adds the `nextjs` rule template (App Router patterns).
- `ssr-htmx` keeps it server-side — no React assets.

### Data

- Polars + Dask via `K-Dense-AI/scientific-agent-skills`.
- Python performance + resource management (`wshobson`) is **opt-in** since v26.106.0.
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
