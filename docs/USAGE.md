# Usage Guide

Quick reference for using `uzys-claude-harness` after install.

For install instructions, see [README.md](../README.md).

---

## Workflow (6-Gate, opt-in)

Activate at step 3 of the wizard by checking `uzys-harness 6-Gate workflow`. Without it, the `/uzys:*` commands aren't installed and the gates aren't enforced — the rest of the track's assets still install.

```
/uzys:spec → /uzys:plan → /uzys:build → /uzys:test → /uzys:review → /uzys:ship
```

Each gate is enforced by a hook in `.claude/hooks/gate-check.sh`. Skipping a gate fails the next one (exit code 2). Run `/uzys:auto` to chain all six gates in one shot.

---

## Commands

### `uzys:` namespace (6-Gate workflow)

| Command | Purpose | Reads | Writes |
|---|---|---|---|
| `/uzys:spec` | Define what you're building before code | conversation | `docs/SPEC.md` |
| `/uzys:plan` | Decompose spec into verifiable tasks | `docs/SPEC.md` | `docs/plan.md`, `docs/todo.md` |
| `/uzys:build` | TDD implementation, one slice at a time | `docs/todo.md` | code + tests |
| `/uzys:test` | Run tests, enforce coverage gate | tests | report |
| `/uzys:review` | Multi-perspective review (code / security / UI / QA) | diff | review notes |
| `/uzys:ship` | Pre-launch checklist + deploy | green review | release tag |
| `/uzys:auto` | Chain all six gates end-to-end | `docs/SPEC.md` | full release |

### `ecc:` namespace (ECC plugin opt-in)

Activate via `--with-ecc` or by checking ECC items at step 3.

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
- **addy** (`/spec`, `/plan`, `/build`, `/test`, `/review`, `/ship`, `/code-simplify`) — alternative workflow from `addyosmani/agent-skills`. Use either `uzys:*` or `addy:*` (not both).

---

## Scope (v26.64.0+, ADR-020)

Default = **Project**. Global write only when you explicitly opt in.

| Method | Project (default) | Global (opt-in) |
|---|---|---|
| `claude plugin` | `--scope project` | `--scope user` |
| `npx skills` | project `node_modules` | `-g` |
| `npm` | `--save-dev` | `-g` |
| Codex (prompts / skills / config) | `.codex/` (project) | `~/.codex/` |

`~/.claude/plugins/{cache,marketplaces,installed_plugins.json}` is written by claude CLI itself in both modes — the `installed_plugins.json` metadata isolates entries by `projectPath` so other projects aren't affected.

At step 4 of the wizard, pick Project (pre-selected) or Global. Non-interactive: `--scope <project|global>`.

---

## Uninstall (v26.64.0+)

```bash
npx -y @uzysjung/claude-harness uninstall [--dry-run] [--keep-templates]
```

Reverses the install based on `.claude/.harness-install.json`.

- **Project-scope assets**: removed automatically (`claude plugin uninstall --scope project`, `npm uninstall --save-dev`, `.codex/` cleanup, etc.).
- **Project root `CLAUDE.md`**: removed only if unchanged since install (sha256 match); kept with a notice if you edited it.
- **Global-scope assets**: listed as advisory only. You run the removal yourself.

---

## Non-interactive install

For CI or scripted use:

```bash
npx -y @uzysjung/claude-harness install --track <name>
```

Common flags:

| Flag | Effect |
|---|---|
| `--track <name>` (repeatable) | Required. Pick a track |
| `--cli <claude\|codex\|opencode\|antigravity>` (repeatable) | Target CLI. Default `claude` |
| `--scope <project\|global>` | Default `project` |
| `--with <asset-id>` (repeatable) | Force-include an external asset |
| `--without <asset-id>` (repeatable) | Force-exclude from preset |
| `--with-uzys-harness` | Activate 6-Gate workflow |
| `--with-ecc` | Install ECC plugin + cherry-pick |
| `--with-codex-prompts` | Install Codex slash globally (requires `--cli codex`) |

Full flag list: `claude-harness install --help`.

### Interactive wizard (6-step)

```
1/6  Tracks            preset by stack
2/6  CLI               claude / codex / opencode / antigravity (multi-select)
3/6  Install items     category-grouped multiselect (Frontend / Backend / Data / Business / Dev Tools / Workflow / ECC)
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
npx claude-harness install --track tooling --cli claude --cli codex --cli opencode
```

Each CLI gets its own dispatcher file:

| CLI | Dispatcher | Notes |
|---|---|---|
| Claude Code | `.claude/` | First class. All hooks active |
| Codex | `.codex/` + project `AGENTS.md` + `.agents/skills/` | `.codex/prompts/uzys-*` if `--with-codex-prompts` |
| OpenCode | `.opencode/` + project `AGENTS.md` | Skills + commands |
| Antigravity | `.agents/skills/` + `.agents/workflows/` | Shares `.agents/skills/` with Codex. `/uzys:*` workflows via Antigravity native slash (v26.66.0+) |

Multi-CLI dispatchers reference the same content via symlinks where possible — no duplication.

---

## Project files (what the harness writes)

| Path | Purpose |
|---|---|
| `.claude/rules/*.md` | LLM-facing rules (code-style, git, tests) |
| `.claude/agents/*.md` | Agent definitions (reviewer, code-reviewer, etc.) |
| `.claude/hooks/*.sh` | Programmatic guards (gate-check, agentshield, etc.) |
| `.claude/commands/uzys/*.md` | `/uzys:*` slash commands (if uzys-harness opted in) |
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
| `gate-check.sh` | gate transitions | Enforce 6-Gate order |
| `spec-drift-check.sh` | post-edit | Detect SPEC vs code drift |
| `agentshield-gate.sh` | session start | Security pattern scan |
| `mcp-pre-exec.sh` | MCP exec | Allowlist gate (D35) |
| `checkpoint-snapshot.sh` | gate completion | git tag savepoint (D25) |
| `hito-counter.sh` | session events | NSM telemetry (HITO baseline) |
| `karpathy-gate.sh` | PreToolUse Write/Edit | Quality gate (only when `--with-karpathy-hook` + plugin install succeeded) |

---

## Codex integration

Codex slash commands live in two places:

- **Global** (opt-in — **active now**): `~/.codex/prompts/uzys-*.md` — written only when `--with-codex-prompts` is set (or Global at step 4). Codex reads custom prompts from `$CODEX_HOME/prompts/` (`~/.codex/prompts/`), so `/uzys-spec` … `/uzys-ship` work here.
- **Project** (pre-positioned — **not active yet**): `.codex/prompts/uzys-{spec,plan,build,test,review,ship}.md` — always written when `--cli codex` and `--with-uzys-harness`. Codex currently loads custom prompts **only** from `$CODEX_HOME/prompts/`, so these project files are inert until upstream [openai/codex#9848](https://github.com/openai/codex/issues/9848) ships project-scoped prompts. They are pre-positioned so `/uzys-*` auto-activates the day it lands (no re-install needed).

> **Verified 2026-05-31** against real `codex-cli 0.125.0` in Docker (`test/docker/run-realcli.sh codex`): the project `.codex/prompts/` files are written correctly (Tier A) but **not discovered** by Codex (Tier B). Confirmed via OpenAI docs, source `codex-rs/core/src/custom_prompts.rs` (`default_prompts_dir()` returns only `$CODEX_HOME/prompts`), and open issues [#9848](https://github.com/openai/codex/issues/9848) / [#4734](https://github.com/openai/codex/issues/4734).

The `AGENTS.md` file at project root is the Codex equivalent of `CLAUDE.md` — merged from your track. Project `.agents/skills/uzys-*/` are repo-level skills (shared with Antigravity).

> v26.64.0 (ADR-020) BREAKING: `cli=codex` no longer auto-enables global prompt copy. Pass `--with-codex-prompts` explicitly, or choose Global at step 4.

---

## OpenCode integration

`.opencode/` carries:

- `commands/` — `/uzys:*` slash bodies (if uzys-harness opted in)
- `opencode.json` — config
- `AGENTS.md` — shared with Codex

3 hooks map to OpenCode lifecycle events (session start / pre-edit / post-edit).

---

## Antigravity integration (v26.66.0+)

Google Antigravity 2.0 (I/O 2026-05-19) — `agy` CLI + desktop IDE. uzys-claude-harness writes:

- `.agents/rules/uzys-harness.md` — project context (full CLAUDE.md embedded, `/uzys:` → `/uzys-` renamed). **Always written** when `--cli antigravity` (the Antigravity equivalent of CLAUDE.md / AGENTS.md). v26.69.0+.
- `.agents/skills/uzys-{phase}/SKILL.md` — Anthropic-format skills (shared with Codex; one file serves both CLIs).
- `.agents/workflows/uzys-{phase}.md` — Antigravity-native workflow files. Invoke as `/uzys-spec`, `/uzys-plan`, …, `/uzys-ship` (filename-based slash).

Skills + workflows are written only when **`uzys-harness 6-Gate workflow`** is checked at step 3 (or `--with-uzys-harness` on the CLI). Rules are written regardless (foundational context).

> **Verification status (2026-05-31)**: file layout is **structurally verified** against real `agy 1.0.3` in Docker (`test/docker/run-realcli.sh antigravity`) — `.agents/rules` + `.agents/skills/uzys-*/SKILL.md` (6) + `.agents/workflows/uzys-*.md` (6) all written correctly per Antigravity's documented workspace spec. **Runtime recognition** in a logged-in `agy` session (does `/uzys-spec` resolve, does a skill load) is **not yet automated** — `agy --print` is Google-OAuth-gated and TUI commands require a TTY. Manual confirmation in a logged-in session is recommended before relying on the slash workflows.

### Global opt-in (v26.67.0+)

With `--with-antigravity-global` + `--scope global`:

- `~/.gemini/antigravity/skills/uzys-{phase}/SKILL.md` — global skills visible across all projects
- `~/.gemini/antigravity/global_workflows/uzys-{phase}.md` — Antigravity global `/uzys-*` workflows

D16: `~/.gemini/` is untouched unless scope=global with `--with-antigravity-global`. On uninstall, global assets are advisory only (never auto-removed).

---

## ECC integration

ECC plugin lives in `affaan-m/everything-claude-code`. Two modes:

- **Cherry-pick fallback** (default when no ECC opt-in): up to 4 agents + 8 skills + 3 commands copied into `.claude/`.
- **Full plugin install** (`--with-ecc`): `claude plugin install ecc-plugin`. Optionally `--with-prune` to trim down to a curated set.

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

Bash + Markdown meta-projects. No app stack. Same 6-Gate workflow works for CLI tools.

---

## Migration notes

### v26.64.0 — Project-scope default (BREAKING)

- All install assets now default to project scope. `~/.claude/skills/`, `~/.codex/`, `~/.opencode/`, `npm -g` untouched unless you opt in.
- `cli=codex` no longer auto-enables `withCodexPrompts`. Pass `--with-codex-prompts` explicitly or pick Global at step 4.
- `npm-global` assets (vercel / supabase / netlify-cli / agent-browser) now install as `--save-dev` by default.

### v26.44.0 — uzys-harness opt-in (BREAKING)

6-Gate workflow is no longer installed automatically on dev tracks. Check `uzys-harness 6-Gate workflow` at step 3 or pass `--with-uzys-harness`.

### v26.42.0 — addy-agent-skills opt-in (BREAKING)

`addyosmani/agent-skills` is no longer auto-installed. Use `--with-addy-agent-skills` or check at step 3.

---

## Troubleshooting

### `npm warn Unknown project config` during install

Harmless. Your `.npmrc` has pnpm-specific keys (`auto-install-peers`, etc.) that npm doesn't recognize. Install behavior is unaffected.

Suppress with `--loglevel=error` if needed.

### `Invalid agents: claude`

skills CLI ≥ 1.5.7 requires repeatable `--agent` (not comma-separated). The harness already does this correctly; if you see it, you may be on a pre-v26.55.1 install. Re-run the latest harness.

### Plugin install fails (`marketplace not found`)

Usually means the marketplace was already added and skipping silently. Plugin install retries regardless. If the plugin itself fails, check `~/.claude/plugins/installed_plugins.json` for stale entries.

### Empty `/uzys:*` commands after install

You didn't opt in to `uzys-harness 6-Gate workflow`. Re-run install and check the item at step 3, or pass `--with-uzys-harness`.

---

## Advanced

- [docs/NORTH_STAR.md](./NORTH_STAR.md) — design principles
- [docs/REFERENCE.md](./REFERENCE.md) — per-track asset matrix in detail
- [docs/decisions/](./decisions/) — architecture decision records (ADRs)
- [scripts/sync-cherrypicks.sh](../scripts/sync-cherrypicks.sh) — internal sync tool for upstream cherry-picks (maintainers only)
