# Usage Guide

Everything after `npx -y @uzysjung/agent-harness`: the flags, what lands where, how to keep it current, and how to take it out again. The [README](../README.md) covers the first install; this page is the reference for the rest.

Version markers are omitted on purpose — this page describes the release you are currently using. Older behaviour is in the [CHANGELOG](../CHANGELOG.md).

---

## Install

### Interactive wizard (5-step)

```
1/5  Tracks            one or more — see docs/TRACKS.md
2/5  CLI               claude / codex / opencode / antigravity (multi-select)
3/5  Install items     7 pages of checklists:
                       Track baseline — Rules & Hooks / Track baseline — Agents & Skills
                       (everything your track installs, pre-checked; uncheck to drop it)
                       then Dev Core (Frontend · Backend · Data) / Dev Tools (Security ·
                       Quality · Understanding) / Business / Visual & Media / Workflow & ECC
4/5  Confirm           summary + the session-start context cost of your selection
5/5  Installing
```

ESC at step 1 exits; ESC at any later step goes back one step.

Assets already in this project show `● installed` at step 3 and start checked. **Unchecking never removes anything** — removal only happens in `uninstall` — so a misclick in the installer cannot delete an asset.

Run the wizard again on an installed project and it shows what is installed — tracks, CLIs, scope, and where the record lives — and three choices: **Update**, **Uninstall**, **Exit**.

**Update** walks tracks → CLIs → install items → confirm (an install made with the retired Global option keeps the scope its record says — see [Scope](#scope)). What is already installed starts checked and marked `● installed`; you only add:

- **Add nothing** and it does exactly what [`update`](#update) does.
- **Add a track, a CLI, or an asset** and it does exactly what `install --track … --cli …` does with the combined set — new files arrive, installed ones are refreshed, edited ones are backed up. The confirm screen prints that command on a `RUNS AS` line.
- **A checked box means the asset is there after the run.** A recommended asset that is not installed — dropped at install time, failed to install, or new in this release — starts unchecked; check it and the run becomes the `install …` above.
- **An installed CLI cannot be dropped here** (projects with an install record). Even if its box gets cleared, it stays in the run. To take one out, use **Uninstall** (or `uninstall --cli`). Nothing is removed on this path — unchecking means "don't install this time", never "delete".

**Uninstall** opens the same screen as [`uninstall`](#uninstall). If the record says Claude Code is installed but `.claude/` is gone, the menu shows a one-line repair command (`install --reinstall --track … --cli claude --scope …`) and Update stays disabled until you run it.

### Non-interactive install

For CI, containers, and scripts:

```bash
npx -y @uzysjung/agent-harness install --track <name> [--cli <cli>]... [--with <id>]... [--without <id>]...
```

| Flag | Effect |
|---|---|
| `--track <name>` (repeatable) | **Required.** One of the [tracks](TRACKS.md) |
| `--cli <claude\|codex\|opencode\|antigravity>` (repeatable) | Target CLI. Default `claude` |
| `--scope project` | The only choice, and the default. `global` is refused on a new install — see [Scope](#scope) |
| `--with <asset-id>` (repeatable) | Add an asset the track did not pre-check. Ids are the first column of the [compatibility matrix](COMPATIBILITY.md). Also accepts a `baseline:<kind>/<name>` or a key id (below) — those are installed by default, so it just means "not dropped this time" |
| `--without <asset-id>` (repeatable) | Drop a pre-checked asset |
| `--without baseline:<kind>/<name>` (repeatable) | Drop a track baseline item — `rules` / `agents` / `hooks` (e.g. `--without baseline:rules/git-policy`). Same items as the first two wizard pages |
| `--without <key id>` (repeatable) | Drop one harness part from a file you share with the harness — e.g. `mcp:github` (a server in `.mcp.json`), `settings:statusLine`, `settings:hooks.SessionStart#session-start.sh`, `opencode:mcp.github`, `codex:top`, `agents-md:agents`, `gitignore:.env`. Only ids the harness would write for your tracks and CLIs are accepted; a typo is reported and skipped. A part you edited is left in place and the summary says so |

**What you drop stays dropped until your next `install`.** Each `install` records what it was told to drop — its `--without` flags, or what you left unchecked in the wizard — and that replaces the previous choice. `update` and `uninstall` only read it, so `update` keeps to it. A later `install` without that `--without` brings the item back and says so (`↺ <id> — dropped earlier, installed again …`); pass the same `--without` on every `install` you want it kept out of, or use `update` to refresh. The wizard starts from your last choice and its `RUNS AS` line repeats the `--without` flags for what is still unchecked. `list` shows what is dropped now and a dated history of each change (`Selections`). Dropping a file, skill or asset that an earlier install already put there does not delete it, and the harness stops updating it: the `install` and `update` summaries name it as `excluded (still on disk …)` / `excluded, so the harness no longer updates it (still installed)`, with how to manage it again and how to remove it. A dropped harness part inside a shared file is taken out and the summary says `removed the harness part: <id>` — unless you edited it, in which case it stays and the summary says so (a hook entry is taken out even if edited, since it calls a harness script). A key id for a file this run does not touch (e.g. `--without codex:top` on a `--cli claude` run) is recorded and taken out on the next run that touches that file; the summary says it is not applied yet. Giving the same id to both `--with` and `--without` is refused before anything is written.
| `--project-dir <path>` | Where to install. Default: the current directory |
| `--reinstall` | Rewrites the harness files in place — the same writes as running `install` again without it (a harness file you edited is saved as `<file>.backup-<ts>` first; your own files stay where they are); only the screen heading differs. Use when `.claude/` is damaged or missing. A `settings.json` that cannot be read is left untouched and the command stops with an error — fix or delete that file, then run it again. `--track` is still required |
| `--verbose` | Print every file per category instead of counts |

One flag selects *behaviour* rather than an asset:

| Flag | Effect |
|---|---|
| `--with-codex-trust` | Codex only: register this folder as trusted in `~/.codex/config.toml`, so Codex reads the project's `.codex/config.toml` (MCP · hooks · sandbox · approval) without first asking. Without it, Codex asks once on first launch — choose **Trust and continue** |

Everything else is `--with` / `--without` by catalog id; there are no per-asset flags. `npx -y @uzysjung/agent-harness install --help` prints the full list. If you install the package globally with npm, the same commands are available as `agent-harness …`.

### One skill, without the harness

Every skill this repo ships can also be installed on its own with the [skills CLI](https://github.com/vercel-labs/skills) — no harness, no track, nothing else written:

```bash
npx skills add uzysjung/uzys-agent-harness --skill user-centered-explanation -a claude-code
npx skills add uzysjung/uzys-agent-harness --list        # every id you can pass to --skill
```

You get the same directory the installer would copy (`SKILL.md` and `references/`), placed where your CLI reads skills (`-a claude-code` → `.claude/skills/<id>/`; other agents by name). Re-run the same command to refresh it. Use this when you want one method skill in a project that does not need the rules, hooks, or track assets — for example `user-centered-explanation` or `recurrence-prevention` on its own. Moving to the full harness later is just running the wizard; it will find and refresh the skill you already have.

### Scope

Everything the harness installs goes into this project. There is no Global option: it only ever changed the flags passed to the external-asset tools — never where the harness files went — while the screen said it wrote to `~/.claude/`. `install --scope global` on a new install is refused and prints the commands below instead.

| Delivery method | Where it goes |
|---|---|
| `claude plugin` | `--scope project` |
| `npx skills` (skill packs) | copied into `.claude/skills/` and, for other CLIs, `.agents/skills/` |
| `npm` (CLI packages) | `devDependency` in `package.json` |

To make one external asset available in every project, install it with its own tool: `claude plugin install --scope user <plugin>` · `npx skills add -g <source>` · `npm i -g <pkg>`.

**An install made with Global before it was retired keeps working.** Its record says `global`, so `update` refreshes its assets with the global flags and `uninstall` lists them for you to remove by hand, as before — and `install --scope global` is still accepted in that project, so the repair and `RUNS AS` commands the screens print for it run as shown.

`~/.codex/`, `~/.opencode/`, `~/.gemini/`, and `npm root -g` are not touched. Two exceptions: the `claude` CLI writes its plugin cache and marketplaces under `~/.claude/plugins/` and isolates projects through the `projectPath` field of `installed_plugins.json`, and `--with-codex-trust` adds one trust entry for this folder to `~/.codex/config.toml`. *This project only* means *no other project is affected*, not *nothing outside this project is written*. That includes links: if `.claude/`, a rules folder, or a harness file is a link that resolves outside this project (a shared dotfiles folder, for example), `install`, `update`, and `uninstall` leave what it points to — and the link itself — untouched and name the link and its target on screen — the harness files are not written there.

### Multi-CLI install

Pick more than one CLI at step 2, or repeat `--cli`:

```bash
npx -y @uzysjung/agent-harness install --track tooling --cli claude --cli codex --cli opencode
```

| CLI | What is written | Notes |
|---|---|---|
| Claude Code | `.claude/` (rules, agents, hooks, skills, `settings.json`) + `CLAUDE.md` import line + `CLAUDE-uzys-harness.md` | First class — all assets, hooks, and plugins |
| Codex | `AGENTS.md` (principles + rules inline) · `.codex/config.toml` · `.codex/hooks/session-start.sh` · `.agents/skills/<id>/` · `.mcp.json` (shared — same source as Claude, #568) | Session-start hook only; plugins are Claude-only |
| OpenCode | `AGENTS.md` (shared with Codex) · `opencode.json` (harness MCP servers plus a small scaffold — `$schema`·`instructions`·theme are yours to edit) · `.agents/skills/<id>/` | No hooks. No `.opencode/` directory |
| Antigravity | `.agents/rules/uzys-harness.md` + `.agents/rules/<rule>.md` · `.agents/skills/<id>/` | No hooks |

Codex, OpenCode, and Antigravity read the **same** `.agents/skills/<id>/` directories, so one copy serves all three. All variants are generated from the same bundled source at install time, so they cannot drift out of sync between CLIs. To see which files belong to you and which to the harness, per CLI, read [CONTEXT-FILES.md](CONTEXT-FILES.md).

---

## After install

### Your first session

The install leaves `CLAUDE.md` (Claude Code) or `AGENTS.md` (Codex / OpenCode) with fill-in sections about your project, each carrying a `<!-- FILL: … -->` prompt. Ask your agent to run the `audit-harness-fit` skill once: its populate mode reads your repository and fills those sections with what it finds there. You can also paste each prompt to your agent, or write the sections by hand. The harness never fills them itself — it does not write unverified facts about your project into your repository.

### What the harness writes

| Path | Purpose |
|---|---|
| `.claude/rules/*.md` | Rules: git policy, change management, doc governance on every track; test policy and ship checklist on dev tracks; CLI development on `tooling` and `full`. The same rules reach the other CLIs in their own locations |
| `.claude/agents/*.md` | `reviewer` always; `implementer` on dev tracks; `data-analyst` on `data`/`full`; `strategist` on `executive`/`full` |
| `.claude/hooks/*.sh` | Two hooks: `session-start.sh`, `protect-files.sh` — see [Hooks](#hooks) |
| `.claude/skills/<id>/` | The harness's own skills plus the ones your track pre-checked — whole directories, `references/` included |
| `.claude/settings.json` | Hook registration, plus a status line that runs the third-party [`@owloops/claude-powerline`](https://www.npmjs.com/package/@owloops/claude-powerline) through `npx`, pinned to a version we checked (a newer release reaches you through a harness release, not on its own). A status line you already have is kept. Merged in place — see *Files you already have* below |
| `CLAUDE.md` | **Yours.** A fill-in scaffold if it did not exist; otherwise untouched except for one import block at the end |
| `CLAUDE-uzys-harness.md` | The harness's working-principles anchor. Owned by the harness, rewritten on `update` — keep your notes in `CLAUDE.md` |
| `.uzys-agent-harness/` | CLI-neutral slot: the install record (`.harness-install.json`), three helper scripts the rules call by name (`protect-branch.sh`, `spec-drift-check.sh`, `check-absence.sh`), and the hook block log written at runtime. Added to `.gitignore` when that file exists |
| `.mcp.json` | MCP servers — `context7`, `github`, `chrome-devtools` on every track; `railway-mcp-server` on `csr-*`/`ssr-*`/`full`; `supabase` on `csr-supabase`/`full`. Merged with yours |
| `.gitignore` · `.env.example` | Ignore lines for agent artifacts and `.env` appended when `.gitignore` exists; an example env file on `csr-supabase` / `full` |
| `AGENTS.md` · `.codex/` · `opencode.json` · `.agents/` | Only for the CLIs you selected (table above) |
| `.github/workflows/` | Only with `--with ci-scaffold`. Never overwrites an existing workflow file |
| `skills-lock.json` | Written by `npx skills` (not by the harness) when a skill pack is installed. The harness never edits it; `uninstall` leaves it and names it |

`list` shows the root files it created or merged, so you can tell which ones were yours before the install.

### Hooks

| Hook | When | What it does |
|---|---|---|
| `session-start.sh` | session start | Points the agent at your spec and change log |
| `protect-files.sh` | before Write/Edit | Blocks edits to `.env*` (except `.example`/`.sample`/`.template`), lock files, and certificate/key files |

`protect-files.sh` is the only hook that blocks anything. Each time it blocks an edit, it appends one tab-separated line — date, hook, target — to `.uzys-agent-harness/hook-blocks.log`. If that log line cannot be written, the edit is still blocked. These hooks are Claude Code's. Codex receives `session-start.sh` ported into `.codex/hooks/`; the file-protection hook does not reach it, because Codex's hook API cannot intercept file edits ([ADR-002](decisions/ADR-002-codex-hook-gap.md)) — on Codex the `.env` protection is a rule, not a block. OpenCode and Antigravity have no hook mechanism the harness writes to.

Install and update both remove any `settings.json` hook entry whose script file is missing, and note it in the summary. A hook pointing at a missing file would otherwise fail on every edit.

### Slash commands

The harness writes no slash commands. It installs rules, agents, hooks, and skills, and your CLI decides when to load a skill from its description, so for most of it there is nothing to type. Slash commands come from the plugins and skill packs you pick at step 3. Run `/help` in Claude Code for an up-to-date list of the commands your plugins added — that list cannot go stale.

### Trust tiers

Every external asset carries a tier. Step 3 shows two of the three as a badge:

- **`★ official`** — Anthropic-official marketplaces and this harness's own assets.
- **vetted** — 1,000+ GitHub stars, not archived, install path verified. **No badge.** Whether it is pre-checked depends on the asset's condition, not its tier — most vetted assets are opt-in.
- **`⚠ experimental (opt-in)`** — under 1,000 stars. Never pre-checked, sorted to the bottom of its category; you add it deliberately with a check or `--with`.

Tiers inform; they never block. A monthly CI job re-reads star counts and archive status and fails if a label no longer matches; another re-runs every install command.

---

## Keeping it current

### `update`

```bash
npx -y @uzysjung/agent-harness update [--only <group>]... [--project-dir <path>]
```

Brings what is installed to the release you invoke:

- **Refreshes** every policy file the harness installed — rules, agents, hooks, skills, the anchor, and the Codex / OpenCode / Antigravity output.
- **Adds** skills and other file assets that a newer release introduced, and restores harness files that went missing. The summary lists both separately.
- **Reports** what it cannot add on its own. A new hook, for example, needs an entry in `settings.json`, which `update` does not rewrite — so it is listed as *needs reinstall* rather than installed half-way.
- **Names** renamed or retired skills still sitting in `.claude/skills/`, and says which ones are safe to delete. It never deletes a skill directory for you.

It never installs a CLI you did not choose, and it runs without prompting, so it is safe to run from CI. A bundled skill you dropped at install time — `--without <id>` or unchecked in the wizard — stays dropped: the install log records it and `update` leaves it out. Deleting something by hand is not the same signal — a skill directory, a rule, or the harness part inside a file you share with it (a block, a section, a server). The harness puts it back and says `was missing — restored`, with the `install … --without <id>` that drops it — kept out by `update`; a later `install` without that flag brings it back. `update` does this for harness files and for the harness part of `AGENTS.md`, `.codex/config.toml` and `opencode.json`; the harness part of `.claude/settings.json`, `.mcp.json` and `.gitignore` comes back on your next `install`. `update` copies `.claude/` to `.claude.backup-<ts>` first. Without an install record (`.uzys-agent-harness/.harness-install.json`), or with one it cannot read, `update` writes nothing and exits `1` with the same message as `list` and `uninstall` — harness files on disk do not count as an install ([Troubleshooting](#troubleshooting)).

`--only` limits it to a group, repeatable: `skills` · `new-skills` · `rules` · `anchor` · `hooks` · `external`. The wizard's **Update** offers the same groups as a checklist when you add nothing.

### What happens to files you edited

The harness keeps a checksum of every file it writes, so `install` and `update` can tell an untouched file from one you changed:

- **Untouched** → replaced with the newer version, silently.
- **Edited by you** → your version is saved as `<file>.backup-<ts>` and the newer version takes its place. The summary shows the count and writes the list to `.uzys-agent-harness/update-backups.json`. To carry your edits onto the new version, ask the `audit-harness-fit` skill to re-apply them from the backup.
- **No checksum on record** (installed before checksums existed) → anything that differs is backed up once; later runs are precise.

`update` is more careful about deleting than about replacing: it deletes a policy file only when the record proves the harness installed it. That is how a retired rule is cleaned up without touching a rule *you* wrote. Inside a skill directory, files that are not part of the current bundle are removed; they are backed up first unless they are exactly what the harness originally wrote. This keeps old, unused files from piling up in a skill.

### Installing into an existing project

The harness never silently overwrites your config. Before replacing an editable file whose contents differ, it writes a timestamped backup next to it and prints the path in the summary. Nothing you wrote or edited is deleted without a backup beside it.

| You already have… | What happens |
|---|---|
| `.claude/settings.json` with your own hooks or statusLine | Merged in place — your keys and hooks win, the harness adds only its own part (#563). A settings file that cannot be read is left byte-for-byte untouched (#574) |
| Root `CLAUDE.md` | Kept. One import block is appended; `update` and `uninstall` touch only that block |
| An `AGENTS.md` you already wrote before installing | Kept byte for byte. The harness adds one `<!-- uzys-harness:agents -->` block at the end; `install` and `update` refresh only that block, and `uninstall` removes it. If you edit inside the block, it is left as it is and the summary says so; if you delete the block, it is added back on the next `install` or `update` — drop it with `install … --without agents-md:agents` (kept out by `update`; a later `install` without that flag brings it back) |
| `opencode.json` | Your keys and servers stay. The harness adds only its MCP servers (`mcp.<name>`); a server of yours with the same name wins. `uninstall` removes the servers it added — ones you changed are left, and the summary says so. If the harness created the file, `uninstall` deletes it unless you changed it |
| `.codex/config.toml` | Your keys, tables, and MCP servers stay. The harness adds two marked regions (`# uzys-harness:top` and `# uzys-harness:tables`); where you already set the same key or table, yours wins and the summary says `kept yours` |
| An `AGENTS.md` the harness created, with your `## Project Context` / `## Project Rules` filled in | Kept. `update` rewrites only the harness sections and the `<!-- uzys-harness:… -->` blocks inside yours; `uninstall` removes exactly those and leaves your two sections in the file (the file is deleted only if you never filled it in; a file you edited after the last `update` is kept whole, as before). One exception: a project installed before those markers existed (v26.159.0 or earlier) loses its `## Project Rules` additions to the backup on the first `update` only — `## Project Context` survives even that one |
| `.claude/` on `update` | Copied to `.claude.backup-<ts>`; the original is updated in place |
| `.claude/` on `install --reinstall` | Harness files are rewritten in place; one you edited is saved as `<file>.backup-<ts>` first. Your own files there stay |
| `.claude/`, `.codex/`, `.opencode/` on `uninstall` (everything, or `--cli` for that CLI) | Renamed to `<dir>.backup-<ts>` — your own files there (`settings.local.json`, your commands, MCP servers you added to `.codex/config.toml`) stay in the backup. A link to outside the project stays as it is |
| `.mcp.json` | Your servers are preserved and merged. `uninstall` removes only the servers the harness added — one you changed is left and named; a file the harness created is deleted once nothing else is in it |
| A harness rule, agent, hook, or skill file **you edited** | `<file>.backup-<ts>`, then the newer version |
| A rule or hook **you wrote yourself** | Left alone |
| `.opencode/commands/<id>.md` from an old OpenCode install | Backed up, then retired — OpenCode now reads `.agents/skills/` directly |

---

## Seeing and removing what was installed

### `list`

```bash
npx -y @uzysjung/agent-harness list [--project-dir <path>]
```

Read-only. Shows when the project was set up, the chosen tracks and CLIs, the installed assets with their scope, the folders and files the install record says the harness wrote (a folder it never created is not listed), and the root files the install created or merged. The asset ids it prints are what `uninstall --only` takes. Without an install record, or with one it cannot read, it says what to run instead and exits `1`.

### `uninstall`

```bash
npx -y @uzysjung/agent-harness uninstall [--dry-run] [--keep-templates] [--only <ids>] [--cli <name>] [--yes] [--project-dir <path>]
```

Run it with no flags in a terminal — or choose **Uninstall** in the wizard's menu — and it opens one screen with three choices, each the same as a flag:

- **Remove one CLI** = `--cli <name>`. Disabled when only one CLI is installed.
- **Remove selected assets** = `--only <ids>`. A checklist follows where each row says exactly what removing it will do; templates stay. Disabled when no external assets are recorded.
- **Remove everything** = `--yes`.

The confirm step names the equivalent command. Nothing happens until you confirm, and selecting nothing exits without changes. The same checks as the flags apply — the last CLI, an unknown id, or an empty list is refused. The screen is skipped when a flag already says what you want — `--only`, `--cli`, `--dry-run`, `--yes`. Without a terminal **and** without one of those flags, `uninstall` refuses and removes nothing — a pipe or CI run can no longer remove everything by default. Without an install record, or with one it cannot read, it removes nothing and exits `1` with the same message as `list` and `update`.

| Flag | What |
|---|---|
| `--dry-run` | Print the reverse steps, change nothing |
| `--keep-templates` | Remove external assets but keep `.claude/`, `.codex/`, `.opencode/`. A folder linked to outside the project is named with its target, not listed as safe to delete |
| `--only <ids>` | Remove just these assets (comma-separated, ids from `list`). Templates untouched; the record keeps the rest |
| `--cli <name>` | Remove one CLI only (`claude` / `codex` / `opencode` / `antigravity`). Shared files stay until the last CLI using them leaves |
| `--yes` | Skip the picker and remove everything |

What it can and cannot reverse:

- **Project-scope assets** — removed (`claude plugin uninstall --scope project`, `npm uninstall`). For skill packs the harness records which files `npx skills` put down and removes exactly those itself — a copy of the same skill that was already there (yours, or another agent's folder) stays; a file you changed is saved as `<file>.backup-<ts>` first; a file reached through a link to outside the project is left and named. Installs recorded before that file list existed are not removed — the screen names the folders left behind.
- **Harness files** — `.claude/`, `.codex/` and `.opencode/` are not deleted: each is moved aside as `<dir>.backup-<ts>` with everything in it, so files you put there yourself (`settings.local.json`, your own commands, MCP servers added to `.codex/config.toml`) are in the backup. A folder that is a link to outside the project is not moved: the link stays in place and the screen names it with its target. In `.agents/` only the files the harness wrote are removed, because that directory is shared with skills you installed yourself. `CLAUDE-uzys-harness.md` is removed; in your `CLAUDE.md` only the import block is cut out, so a file that was yours before the install is byte-identical afterwards.
- **Global-scope assets** — listed for you to remove by hand.
- **The Codex trust entry** that `--with-codex-trust` added to `~/.codex/config.toml` — listed with its path for you to remove by hand (a full `uninstall` and `--dry-run` print it; an entry that was already there before the install is yours and is not listed).
- **Assets with no automated reverse** (the `npx-run` kind) — reported as such. Delete anything they wrote outside `.claude/` yourself (BMAD's `_bmad/`, for example).
- **Root files** — in `.mcp.json` and `.gitignore` only the servers and lines the harness added are removed (your servers and lines stay — `.gitignore` byte for byte; one you changed is left and named; a `.mcp.json` the harness created goes once only its part was in it). `.env.example` and `.github/workflows/` are yours from the moment they are written and are left in place, as is `skills-lock.json` (`npx skills`'s file).
- **Before removing anything** it checks that it can write every place it will change; if it cannot, it stops with nothing removed and names the place. If it still stops partway, it lists what was already done and keeps the install record, so the same command can be run again.

Only assets that were actually removed leave the record; a failed removal stays listed. If nothing could be removed, the command says so and exits with an error code.

### Adding and removing a CLI

Installing adds a CLI; it never drops one.

- **Add** — in the wizard, **Update** → step 2, check the CLI. Or run `install --track <your tracks> --cli <each installed CLI> --cli <new>` — the command the wizard's confirm screen shows. Installed CLIs stay installed either way. The finish screen points at the `audit-harness-fit` skill for adapting CLI-specific wording.
- **Remove** — in the wizard, **Uninstall** → **Remove one CLI**. Or run `uninstall --cli <name>`. It takes exactly the files that CLI owns:

```bash
npx -y @uzysjung/agent-harness uninstall --cli codex     # add --dry-run to see it first
```

| File | Used by | Goes when |
|---|---|---|
| `.claude/` | Claude Code | Claude Code is removed — moved aside as `.claude.backup-<ts>`, so your own files there stay in the backup; a link to outside the project stays as it is |
| `CLAUDE-uzys-harness.md` | Claude Code | Claude Code is removed (kept if you edited it) |
| `CLAUDE.md` | Claude Code | Claude Code is removed — only the import block is cut; your text stays |
| `.codex/` | Codex | Codex is removed — moved aside as `.codex.backup-<ts>`, so MCP servers you added to `config.toml` stay in the backup; a link to outside the project stays as it is |
| `opencode.json` | OpenCode | OpenCode is removed (kept if you edited it) |
| `.opencode/` | OpenCode | OpenCode is removed — moved aside as `.opencode.backup-<ts>`. The harness no longer writes there, so what is in it is yours; a link to outside the project stays as it is |
| `.agents/rules/uzys-harness.md` | Antigravity | Antigravity is removed |
| `AGENTS.md` | Codex, OpenCode | The last of them is removed — only the harness sections; your `## Project Context` / `## Project Rules` stay |
| `.agents/skills/` (harness skills only) | Codex, OpenCode, Antigravity | The last of them is removed — skills you installed yourself stay |
| `.mcp.json`, `.uzys-agent-harness/` | Every CLI | Never by `--cli` |

- **Nothing you put there is deleted.** A harness file outside those directories that you edited since the install is kept in place and named on screen; the CLI directories themselves go to a backup, whole. Run `--dry-run` first to see the list.
- **Installed assets (`list`) are not touched** — they are not owned by a CLI. Use `--only <ids>` for those.
- **The last CLI is refused.** Removing everything is `uninstall` with no `--cli`, so there is only one path that deletes the install record. `--cli` also cannot be combined with `--only` or `--keep-templates`.

The record (`clis` in `.uzys-agent-harness/.harness-install.json`) is what every command reads to know which CLIs this project has — `list` prints it, and `update` refreshes exactly that set, including assets a new release adds.

---

## Workflow bundles

Two opt-in workflow packs remain in the catalog, `openspec` and `bmad-method` — pick them at step 3 or with `--with`. [WORKFLOWS.md](WORKFLOWS.md) says what each is for and when you don't need one. Earlier releases also offered a set of fixed-procedure workflow plugins and an ECC plugin bundle; they were retired in v26.159.0 because they replaced the model's judgement with fixed steps ([ADR-093](decisions/ADR-093-retire-unneeded-choices-and-ecc-axis.md)). A project that installed them keeps them until you run `uninstall`.

---

## Track notes

Asset-by-asset detail per track is in [TRACKS.md](TRACKS.md). Only the surprises here:

- **No deploy CLI is pre-checked on any track.** `supabase-cli`, `vercel-cli`, and `netlify-cli` each install a CLI package as a `devDependency`, so pick the one your project deploys to. `csr-supabase` still pre-checks the Supabase *skills*.
- **`data`** pre-checks one data-specific asset, `anthropic-data-plugin`; the rest is the dev-track set (method skills, `frontend-design`).
- **`executive`** pre-checks `anthropic-document-skills` and brings the `strategist` agent, which carries the evidence and consistency standards for research, decks, and models. `finance-skills` and `product-skills` are opt-in on any track.
- **`base`** and **`tooling`** carry no stack assets; the method skills work the same for a CLI tool or a Markdown project as for an app.
- `ssr-htmx` stays server-side — no React assets.

---

## Troubleshooting

**`npm warn Unknown project config` during install** — harmless. Your `.npmrc` has pnpm-specific keys that npm ignores. Add `--loglevel=error` to hide the warning.

**Plugin assets skipped with a warning** — the `claude` command was not found on your PATH. Install Claude Code first, then run the installer again with `--with <id>` for each plugin you wanted.

**Plugin install fails with `marketplace not found`** — usually the marketplace was already added earlier; the installer retries the plugin step anyway. If the plugin itself still fails, remove old or broken entries from `~/.claude/plugins/installed_plugins.json` and try again.

**`list`, `update` or `uninstall` says there is no install record, but harness files are here** — the harness decides what it installed from its record, `.uzys-agent-harness/.harness-install.json`, not from the files it finds. A copy set up before the record existed, a fresh clone (that folder is in `.gitignore`), or a deleted record all land here; the three commands change nothing and exit `1`. Run the `install --track <t>` line the message prints (the track comes from `.claude/.installed-tracks` when that file is there): a file identical to the harness's is left alone, a harness file that differs is saved as `<file>.backup-<ts>` first, shared files only get the harness's part, and the record is written — `update` and `uninstall` work from then on. If the message says the record is **corrupted** (often a merge conflict), take one side of the conflict whole; `install --reinstall` rebuilds it but forgets what you had dropped with `--without` and the external assets it recorded.

**`update` says a hook needs reinstall** — run `install --track <your track> --cli <each installed CLI>` again. It wires the hook into `settings.json` (your own keys and hooks stay) and rewrites every harness file in place — a harness file you edited is saved as `<file>.backup-<ts>` first, so re-apply your edit from there if you still want it; files that are not the harness's are not touched. `install --reinstall` does the same writes. A `settings.json` that is not valid JSON is not rewritten: the command stops, you fix or delete it and run again. `update` does not rewrite `settings.json`, so it cannot wire a new hook by itself.

---

## Further reading

- [CONTEXT-FILES.md](CONTEXT-FILES.md) — which context file is yours and which is the harness's
- [REFERENCE.md](REFERENCE.md) — maintainer catalog: install methods, MCP servers, agents, scripts
- [NORTH_STAR.md](NORTH_STAR.md) — why the harness is shaped this way
- [decisions/](decisions/) — architecture decision records
