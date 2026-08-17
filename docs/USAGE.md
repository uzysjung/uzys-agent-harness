# Usage Guide

Quick reference for using `uzys-agent-harness` after install.

For install instructions, see [README.md](../README.md).

---

## Slash commands

**The harness writes no slash commands into `.claude/`.** What it puts there is rules, agents,
hooks, and skills — commands come from the plugins and skill packs you pick at step 3, and each one
names its own. Skills are also not commands: your CLI decides when to load them from their
description, so most of what you install has nothing to type. (One exception, by necessity: OpenCode
has no native skill concept, so each selected method skill is written as
`.opencode/commands/<id>.md` — see [OpenCode integration](#opencode-integration).)

To see what is actually registered in your project, ask the CLI rather than a table here — `/help`
in Claude Code lists the commands your installed plugins contributed. That is the only listing that
cannot go stale.

Two things worth knowing about the ones you are most likely to install:

- **ECC** (`--with ecc-plugin`) installs as the plugin named `ecc`, so its commands appear under
  `/ecc:…`. The set is upstream's, not ours.
- **addy** (`--with addy-agent-skills`) is a spec-driven workflow pack — opt-in since v26.42.0.

> Until v26.146.1 the harness shipped eight `/ecc:` command files of its own as a fallback for
> people who had not installed the plugin. They were removed because a fallback that needs the thing
> it substitutes for is not a fallback: two of the eight (`e2e`, `eval`) invoked ECC plugin agents <!-- ref:removed -->
> directly. The other six ran without the plugin, and were dropped for the ordinary reason (ADR-073)
> — the harness stopped shipping surface that the plugin already carries.

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

## What's installed (v26.125.0+)

```bash
npx -y @uzysjung/agent-harness list
```

Reads `.uzys-agent-harness/.harness-install.json` and prints the assets, their scope and version, the template
dirs, and whether your root `CLAUDE.md` has been edited since install. Read-only. The asset ids it
shows are the input to `uninstall --only`.

The install wizard reads the same record (v26.125.0+): assets already installed are marked
`● installed` at step 3, and project-scope ones start checked. The marker is display only —
**unchecking never removes anything.** Removal happens only in `uninstall`, so a misclick in the
installer cannot delete your assets.

Installing again is additive: `install --with <id>` appends to the log, so a later `uninstall`
still knows about everything from the earlier run. The exception is the interactive **Reinstall**
action (the wizard's "Reinstall (backs up current `.claude/` first)"), which moves `.claude/` aside
and rebuilds it: assets whose files lived inside `.claude/` are genuinely gone, so they're dropped
from the record too. Assets that live outside the project (`plugin`, `npm`) are kept.

## Uninstall (v26.64.0+)

```bash
npx -y @uzysjung/agent-harness uninstall [--dry-run] [--keep-templates] [--only <ids>] [--yes]
```

Reverses the install based on `.uzys-agent-harness/.harness-install.json`.

**Run it with no flags in a terminal and it asks what to remove (v26.125.0+).** First a mode —
*pick items* (templates stay) or *remove everything* (assets **and** `.claude/`) — then, for the
first mode, a checklist of the installed assets. Each row states what removing it will actually do,
including the ones that have no automated reverse. Nothing happens until you confirm, and selecting
nothing is not a full uninstall — it exits without changes.

The picker is skipped when you have already said what you want: `--only`, `--dry-run`, `--yes`, or
no TTY (CI, pipes). Those paths behave exactly as before, so scripts are unaffected.

- **Project-scope assets**: removed automatically (`claude plugin uninstall --scope project`, `npm uninstall --save-dev`, `.codex/` cleanup, etc.).
- **Project root `CLAUDE.md`**: removed only if unchanged since install (sha256 match); kept with a notice if you edited it.
- **Global-scope assets**: listed as advisory only. You run the removal yourself.
- **Assets with no automated reverse** (`npx-run`, `shell-script`): reported as such and left in the record — a full uninstall removes `.claude/` around them, but `--only` cannot undo them. Anything they wrote outside `.claude/` (e.g. BMAD's `_bmad/`, `_bmad-output/`) stays and is yours to delete.

| Flag | What |
|---|---|
| `--dry-run` | List the reverse steps, change nothing |
| `--keep-templates` | Remove external assets but keep `.claude/`, `.codex/`, `.opencode/` |
| `--only <ids>` | Remove just these assets (comma-separated, from `list`). Templates untouched; the log is rewritten with what remains, so the rest stays removable |
| `--yes` | Skip the picker and remove everything (for scripts on a TTY) |

Only assets whose reverse actually succeeded are dropped from the log — a failed removal stays
listed rather than being recorded as gone. If nothing could be removed automatically, the command
says so and exits non-zero rather than reporting success.

`--only` never leaves a dangling hook entry in `.claude/settings.json`, because no asset in the
catalog wires a hook of its own and `--only` does not touch the baseline. (Before v26.141.0 one
asset did, and `uninstall` printed the registration for you to delete by hand rather than editing a
file that holds your own settings.)

> A detail you may notice in the template: `settings.json` carries **four** hook commands, not the
> three under [Hooks](#hooks). The fourth points into a *skill* directory —
> `.claude/skills/strategic-compact/suggest-compact.sh` — and that skill only installs when you have
> **not** opted into ECC. Install and update both run a healing pass that **removes any hook command
> whose script isn't on disk**, and the summary reports it (`settings.json stale hook refs · N
> removed`). So an `--with ecc-plugin` project ends up with three, not a dangling reference.

### Files outside `.claude/` (v26.125.0+)

> **Which file is yours and which is the harness's?** `CLAUDE.md`, `CLAUDE-uzys-harness.md`,
> `AGENTS.md`, and `.agents/rules/` all hold context, and they have different owners and different
> update rules. [CONTEXT-FILES.md](CONTEXT-FILES.md) explains the split — read it before editing any
> of them, so your project notes don't land in a file that `update` overwrites.

Install also writes to the project root: `.mcp.json` (merged), `.gitignore` (appended lines),
`.env.example`, and `.github/workflows/` when `ci-scaffold` is selected. A full
uninstall **lists these and removes none of them** — your own content is mixed into `.mcp.json` and
`.gitignore`, and the workflow files are yours once installed. Each is labelled by how it got there:

- **created** — the harness made the file; if you haven't edited it, deleting it is safe.
- **merged** — it already existed and the harness added to it; check it by hand.

Only files still present on disk are listed, and `list` shows the same set under **Root files**.
`--only` doesn't print this section: it targets specific assets, not the install as a whole.
Logs written before v26.125.0 have no record of these files, so an older install shows nothing here.

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
| `--without <asset-id>` (repeatable) | Force-exclude an external asset from the preset |
| `--without baseline:<kind>/<name>` (repeatable) | Drop a track baseline asset — `rules` / `agents` / `hooks` / `skills` (e.g. `--without baseline:rules/git-policy`). Same items the wizard shows on its first two pages |
| `--project-dir <path>` | Where to install. Default: the current directory |
| `--verbose` | Print the file list per category instead of counts only |

Behavior flags, as opposed to asset selection:

| Flag | Effect |
|---|---|
| `--with-codex-trust` | Codex only: register a trust entry in `~/.codex/config.toml`. Takes effect **only together with `--scope global`** |
| `--with-prune` | Use with `--with ecc-plugin` — trims ECC down to a curated subset |

Assets are opted in and out through `--with` / `--without` with the catalog id, not through
per-asset flags (the 13 asset-specific flags were removed in v26.81.0); `--with ecc-plugin` is that
same generic form, not a special case. The two flags above are the exception, and they select
*behavior* rather than an asset — though `--with-prune` does gate one catalog entry (`ecc-prune`).
Ids come from `list`, or from the [compatibility matrix](COMPATIBILITY.md).

Full flag list: `npx -y @uzysjung/agent-harness install --help` (or `agent-harness install --help` after a global install).

### Interactive wizard (6-step)

```
1/6  Tracks            preset by stack
2/6  CLI               claude / codex / opencode / antigravity (multi-select)
3/6  Install items     7 pages of grouped multiselects:
                       Track baseline — Rules & Hooks / Track baseline — Agents & Skills
                       (everything your track installs, pre-checked; uncheck to drop it)
                       then Dev Core (Frontend·Backend·Data) / Dev Tools (Security·Quality·
                       Understanding) / Business / Visual & Media / Workflow & ECC.
                       The 6 dev-method skills fold into a single "methodology bundle" row.
4/6  Scope             Project (default) / Global
5/6  Confirm           summary review (+ session-start context cost of your selection)
6/6  Installing        pipeline
```

ESC at step 1 = exit with cancel. ESC at later steps = silent back.

---

## Trust tiers (v26.71.0)

External assets carry a trust tier, shown as a badge in step 3:

- **★ official** — Anthropic-official marketplaces + this harness's own assets.
- **vetted** — community assets with ≥ 1000 GitHub stars + active maintenance. Carries no badge of its own. Whether it is pre-checked is decided by the asset's `condition`, not by its tier — most vetted assets are opt-in.
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
| `.claude/` on `update` | The whole directory is **copied** to `.claude.backup-<ts>`; the original stays and is updated in place |
| `.claude/` on the wizard's **Reinstall** action | The whole directory is **renamed** to `.claude.backup-<ts>`, then rebuilt from scratch |
| `.mcp.json` | Your existing MCP servers are preserved and merged, not replaced |
| A skill under `.claude/skills/` **you edited** | Your version is copied to `<file>.backup-<ts>`, the newer one takes its place (v26.126.0+) |
| A rule / agent / command / hook **you edited** | Same treatment — `<file>.backup-<ts>`, newer version takes its place (v26.132.0+) |
| A rule or hook **you wrote yourself** | Left alone. `update` only removes files the harness installed (v26.132.0+) |

> Fresh project? None of this triggers — backups only protect pre-existing files.

### Updating an install

```bash
npx -y @uzysjung/agent-harness update [--project-dir <path>]
```

Refreshes the files already installed — rules, agents, commands, hooks, and skills under `.claude/`,
plus everything written for Codex, OpenCode, and Antigravity (`AGENTS.md`, `.codex/`,
`opencode.json`, `.opencode/commands/`, `.agents/`) — to the versions in the release you invoke
(v26.134.0+). It does not add tracks, install assets, or ask anything, so it is safe to run from CI
or a script. The whole `.claude/` directory is copied to `.claude.backup-<ts>` first. Run it with no
install present and it exits `1` rather than doing nothing quietly.

The same thing is reachable from the wizard (run with no arguments → **Update policy files**);
both entry points build the identical spec. Adding a track is a different operation — that is
`install --track <name>` on top of the existing install.

> Scope: `update` only refreshes files that are **already there**. It never installs a CLI you did
> not choose or a skill you did not select, so a Claude-only project stays Claude-only. The flip
> side: artifacts a newer release *adds* arrive on `install`, not on `update`.

### What happens to files you edited

The harness records a checksum of every file it writes, so it can tell an untouched file from one
you changed. That check runs on `install` **and** `update`, and covers rules, agents, commands,
hooks, and skills alike — plus everything written for Codex, OpenCode, and Antigravity
(`AGENTS.md`, `.codex/`, `opencode.json`, `.opencode/commands/`, `.agents/`):

- **You never touched it** → replaced with the newer version, silently. No backup noise just because
  the harness improved the file.
- **You edited it** → your version is saved as `<file>.backup-<ts>` and the newer version takes its
  place. The summary shows the count.
- **No checksum on record** (installed before the feature landed) → anything that differs is backed
  up to be safe. This happens once; later runs are precise.

Deletion is narrower than replacement. `update` removes a policy file only when the checksum record
proves the harness installed it — that is how a retired rule gets cleaned up without touching the
rule *you* wrote. If there is no record to prove ownership, nothing is deleted.

Two things `update` will *not* do: install a skill you never chose, and delete a file you added
inside a skill directory.

> History: skills were not refreshed at all before v26.126.0; rules and hooks were overwritten with
> no backup — and user-written rules deleted — before v26.132.0; Codex/OpenCode/Antigravity output
> was overwritten with no backup before v26.133.0.

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
│  │  .uzys-agent-harness/.harness-install.json       │    │
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

## Project files (what the harness writes)

| Path | Purpose |
|---|---|
| `.claude/rules/*.md` | LLM-facing rules — lifecycle discipline (git-policy, doc-governance, change-management; dev tracks add test-policy + ship-checklist; tooling/full add cli-development). The same rules reach Codex, OpenCode, and Antigravity in each CLI's native location |
| `.claude/agents/*.md` | Agent definitions (reviewer, code-reviewer, etc.) |
| `.claude/hooks/*.sh` | Programmatic guards (session-start, protect-files, task-brief-nudge) |
| `.claude/skills/*` | Skills — the harness's own method skills (`north-star`, `task-brief`, …) plus the ones your track pre-checked |
| `.claude/settings.json` | Statusline + hooks registration |
| `.uzys-agent-harness/.harness-install.json` | Install log — accumulates across installs; drives `list` and `uninstall`. Lives outside `.claude/` because it is CLI-neutral (v26.135.0) |
| `.uzys-agent-harness/hook-blocks.log` | Written at runtime, not at install: one line per hook block. The installer adds `.uzys-agent-harness/` to `.gitignore`, so it never enters your history |
| `CLAUDE.md` | **Yours.** Project context — fill-in scaffold, plus one `@CLAUDE-uzys-harness.md` line that pulls in the anchor |
| `CLAUDE-uzys-harness.md` | The harness's own anchor — working principles. Owned by the harness, so `update` rewrites it. Keep your notes in `CLAUDE.md` ([which file is whose](CONTEXT-FILES.md)) |
| `.mcp.json` | MCP servers. Always `context7`, `github`, `chrome-devtools`; plus `railway-mcp-server` on `csr-*`/`ssr-*`/`full` and `supabase` on `csr-supabase`/`full` |
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
| `task-brief-nudge.sh` | UserPromptSubmit | Suggest structuring a long, unstructured request — never blocks |

`protect-files.sh` is the only hook that blocks, and it appends one tab-separated line —
`date · hook · target` — to `.uzys-agent-harness/hook-blocks.log` every time it exits 2. A failed
write never changes the block itself. `uninstall` removes that directory, so the log goes with it.

An MCP allowlist hook shipped until v26.146.1 and was removed in ADR-072: gating every MCP call
works against the point of the harness, which is to help you build with these tools rather than
to stand between you and them. If you had one, `update` backs up and retires `.mcp-allowlist`.

---

## Codex integration

The `AGENTS.md` file at project root is the Codex equivalent of `CLAUDE.md` — a fill-in scaffold, same as `CLAUDE.md`. Project `.agents/skills/` are dev-method skills shared with Antigravity (one file serves both CLIs).

---

## OpenCode integration

`.opencode/` carries:

- `commands/` — one command per method skill, because OpenCode has no native skill concept
- `opencode.json` — config. The harness only injects MCP servers here; the `instructions` globs stay
  as shipped and point at your own `docs/`, not at anything the harness wrote
- `AGENTS.md` — shared with Codex. **This is what carries the rules** for OpenCode

**No hooks.** The three baseline hooks are Claude Code's lifecycle events, and nothing is written
for OpenCode in their place — so an OpenCode-only project gets the rules and the method skills, but
none of the programmatic guards.

---

## Antigravity integration (v26.66.0+)

Google Antigravity 2.0 (I/O 2026-05-19) — `agy` CLI + desktop IDE. uzys-agent-harness writes:

- `.agents/rules/` — project context (full CLAUDE.md embedded). **Always written** when `--cli antigravity` (the Antigravity equivalent of CLAUDE.md / AGENTS.md). v26.69.0+.
- `.agents/skills/<id>/SKILL.md` — dev-method skills in Anthropic format (shared with Codex; one file serves both CLIs).

Rules are written regardless (foundational context); dev-method skills are core on dev tracks.

> **Verification status (2026-05-31)**: file layout is **structurally verified** against real `agy 1.0.3` in Docker (`test/docker/run-realcli.sh antigravity`) — `.agents/rules` + `.agents/skills/<id>/SKILL.md` written correctly per Antigravity's documented workspace spec. **Runtime recognition** in a logged-in `agy` session (does a skill load) is **not yet automated** — `agy --print` is Google-OAuth-gated and TUI commands require a TTY. Manual confirmation in a logged-in session is recommended.

---

## ECC integration

ECC lives in `affaan-m/everything-claude-code`. There are two ways it reaches your project, and
they are mutually exclusive by design:

- **Cherry-picked copies** (what you get when you do *not* opt into ECC): up to 4 agents and
  6 skills are copied into `.claude/` as ordinary files. "Up to" because most are gated on track —
  a `tooling` project sees fewer than a `full` one.
- **The plugin itself** (`--with ecc-plugin`): 60 agents · 230 skills · 75 commands, installed by
  `claude plugin install ecc@ecc`. Those 4 agents and 6 skills then step aside, so you don't carry
  two versions of the same agent. Add `--with-prune` to trim the plugin to a curated subset.

Six other ECC-derived skills install **either way**, and only two of them do so deliberately:
`deep-research` and `eval-harness` are modified here, and the plugin's versions don't carry the
changes. The other four — `market-research`, `investor-materials`, `investor-outreach`
(on `executive` / `full`) and `nextjs-turbopack` (on `ssr-nextjs` / `full`) — were simply never
given the ECC gate, so on those tracks `--with ecc-plugin` leaves you with two copies. That is a
defect in this repo, tracked separately; it is recorded here because the alternative is a document
that promises something the code does not do.

See [decisions/ADR-019-cherry-pick-plugin-gating.md](./decisions/ADR-019-cherry-pick-plugin-gating.md).

---

## Track-specific notes

Asset-by-asset, per track, is [TRACKS.md](TRACKS.md)'s job. Here are only the things that surprise
people.

### CSR / SSR

- **No deploy CLI is pre-checked**, on any track. `supabase-cli`, `vercel-cli`, and `netlify-cli`
  each pull in a CLI package — a project `devDependency` by default, or a global binary under
  `--scope global` — so you pick the one your project actually deploys to, at step 3 or with
  `--with <id>`. `csr-supabase` still pre-checks the Supabase *skills*
  (`supabase-agent-skills`, `postgres-best-practices`).
- Those two are plugins, and **`claude plugin install` writes to `~/.claude/plugins/` in either
  scope** — the cache and marketplace directories are the CLI's own design. `--scope project` isolates
  by metadata (`projectPath`), not by staying out of your home directory. Project scope means *no
  other project is affected*, not *nothing outside this project is written*.
- The first `supabase login` is an OAuth browser flow. Nothing automates that for you.
- `ssr-htmx` keeps it server-side — no React assets.

### Data

`anthropic-data-plugin` (visualization + SQL) is the only **data-specific** asset the `data` track
pre-checks — the rest of what arrives is the all-track set (method skills, `find-skills`,
`agent-browser`, `frontend-design`). The dataframe and Python skill packs the track used to pull in
were dropped in ADR-060, where the harness stopped shipping guidance the model already carries.
`wshobson-agents` covers the orchestration side and is opt-in on any track.

### Executive

`anthropic-document-skills` (pptx / docx / xlsx / pdf) is the only **business-specific** pre-check,
and the `strategist` agent handles proposals, due diligence, and financial models. `finance-skills`
and `product-skills` are opt-in — on any track, not just this one.

### Tooling

Bash + Markdown meta-projects. No app stack, and the method skills work the same for a CLI tool as
for an app.

---

## Migration notes

### v26.135.0 — Install log moved out of `.claude/`

The install log now lives at `.uzys-agent-harness/.harness-install.json`. It records what the
harness installed for **every** CLI, so keeping it under `.claude/` meant an OpenCode-only or
Codex-only install created a `.claude/` directory containing nothing but that one file ([#253]).

Nothing to do on your side: the old location is still read, and the next `install` / `update` /
`uninstall --only` moves the file and removes the old copy. `uninstall` removes the new directory
too. If you had a `.claude/` that existed *only* because of the log, it disappears on the next
install — that directory was the bug.

[#253]: https://github.com/uzysjung/uzys-agent-harness/issues/253

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
