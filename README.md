# uzys-agent-harness

A CLI that installs a harness for AI coding agents (Claude Code, Codex, OpenCode, Antigravity) into your project. A harness is the set of files an agent works from: working principles (one file of judgment criteria) and a few short rules for areas like git, testing, and shipping, all read every session; skills (task guides) it opens only when needed; hooks the tool runs on its own; and subagents such as a reviewer.

This harness has almost no lists of dos and don'ts. It explains how to make judgment calls, what a good result looks like, and where the limits are and why. Decisions inside those limits are left to the model. The aim is that the same rules and skills give better results as models get smarter.

Installing, updating, and removing it is one command each.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/github/v/tag/uzysjung/uzys-agent-harness?label=version)](https://github.com/uzysjung/uzys-agent-harness/tags)
[![CI](https://github.com/uzysjung/uzys-agent-harness/actions/workflows/test.yml/badge.svg)](https://github.com/uzysjung/uzys-agent-harness/actions)

![agent-harness demo — one-command install of vetted AI-coding skills & plugins](https://raw.githubusercontent.com/uzysjung/uzys-agent-harness/main/docs/assets/agent-harness-demo.gif)

🇰🇷 [한국어](./README.ko.md)

---

## How it's built

### Judgment criteria, not checklists

If you fix a procedure, the model follows it even on work where it doesn't fit. So the harness doesn't set procedures. It says what to weigh when deciding. The working-principles file opens with: "These are shared decision principles, not a fixed workflow."

A typical rule:

> Add unit tests for every change and get a review before every commit.

This harness:

> Choose the depth, timing, and combination of testing, review, and release checks according to actual impact, uncertainty, recovery cost, and existing evidence.

Under the first rule, fixing a typo takes the same steps as changing billing logic. The second gives the model a reason to treat them differently. It doesn't mean testing less. It lets the model judge how much is needed.

### The goal and the finish line come first

Instead of prescribing a method, the harness tells the model what done looks like. The `north-star` skill records what the project is for and what it won't do. The `objective-brief` skill does the same for a single task: its goal, completion criteria, and boundaries. Methods are not fixed. If there is a better path to the same result, the model can take it.

### Limits come with reasons, and very few are enforced

Hard limits are written down plainly. Destructive actions, deployments, and writes to anything other people share, such as a repository or a database, need your approval when the work you handed over doesn't cover them. Routine progress inside that work is meant to go ahead without repeated check-ins. Only two things are enforced mechanically: on Claude Code, a hook blocks edits to `.env`, lock files, and certificates, and a bundled script puts protection rules on your GitHub default branch.

### Instructions the model no longer needs come out

Every instruction read each session takes up context, and instructions written for an older model's weak spots can get in a newer model's way. So the wizard shows how many tokens your selection adds to every session before you install, and the `audit-harness-fit` skill looks for instructions your project no longer needs and for procedures that make the agent check the same thing over and over, then suggests what to change.

### The agent that builds is not the one that checks

An agent checking its own work tends to miss things. On Claude Code, a `reviewer` subagent that didn't write the code runs your tests or the app and checks the result. With the optional `model-orchestration` skill, the agent also picks the model and reasoning effort per task: fast and cheap for light work, stronger where more judgment is needed. That is how speed, cost, and quality get balanced.

The full working principles are in [templates/CLAUDE.md](templates/CLAUDE.md) (installed as `CLAUDE-uzys-harness.md` and pulled in by one line in your `CLAUDE.md`), and the project's direction is in [docs/NORTH_STAR.md](docs/NORTH_STAR.md).

## Quick start

You need Node 20.12 or newer. Run this in your project folder:

```bash
npx -y @uzysjung/agent-harness
```

The wizard asks five things:

```
1/5  Tracks          what you are building (a stack). This only pre-checks items
2/5  CLI             one or more of claude / codex / opencode / antigravity
3/5  Install items   items for your track are pre-checked. Uncheck what you don't want
4/5  Confirm         a summary, and how many tokens your selection adds per session
5/5  Installing
```

Then open your AI coding tool in the same folder. The rules and skills apply from the first session:

```bash
claude    # or codex / opencode / agy
```

**First thing to do.** The install adds blank sections about your project to `CLAUDE.md` (or `AGENTS.md`). Tell your agent once:

```
Use the audit-harness-fit skill to read the code and fill in the project sections.
```

It reads the repository and fills them in. Say the same thing later to check whether the setup still fits your project.

No terminal for the wizard (CI, containers, scripts)? Use flags. The only required one is `install --track <name>` ([non-interactive install](docs/USAGE.md#non-interactive-install)). Claude Code plugins need the `claude` command on your PATH. Without it they are skipped with a warning.

## What gets installed

With Claude Code on a dev track, your project gets:

```
your-project/
├── CLAUDE.md                 yours. One harness block is added at the end (created if missing)
├── CLAUDE-uzys-harness.md    working principles the agent reads every session
├── .claude/
│   ├── rules/                short rule files, read every session
│   ├── skills/               guides. Only a one-line description is read until one is used
│   ├── agents/               reviewer, implementer: subagents the main agent hands work to
│   ├── hooks/                session start, file protection. Claude Code runs them itself
│   └── settings.json         registers the hooks (merged with yours)
├── .mcp.json                 MCP servers: context7 (current library docs), github, and more (merged with yours)
└── .uzys-agent-harness/      the install record and helper scripts
```

All of it stays inside your project. Commit it like any other file, and teammates who clone the repo get the same setup.

Every track gets four skills for setting and keeping direction: `north-star` (what the project is for and what it won't do), `objective-brief` (one task's goal, definition of done, and limits), `gh-issue-workflow` (decisions kept in GitHub issues, not in chat), and `audit-harness-fit` (checks whether the setup fits your project). Your track adds stack skills. `csr-supabase`, for example, gets React, shadcn, Supabase, and Postgres skills. Add or drop any bundled skill by name with `--with` / `--without`. The full file list is in [what the harness writes](docs/USAGE.md#what-the-harness-writes).

What each tool gets:

| Tool | Rules | Skills | Hooks | Subagents | Plugins |
|---|---|---|---|---|---|
| Claude Code | ✓ | ✓ | ✓ | ✓ | ✓ |
| Codex | ✓ (in `AGENTS.md`) | ✓ | session start only | — | — |
| OpenCode | ✓ (in `AGENTS.md`) | ✓ | — | — | — |
| Antigravity | ✓ | ✓ | — | — | — |

Plugins are a Claude Code feature, so only Claude Code gets them. Rules and skills come from the same source, so they say the same thing in every tool. What a tool can block on its own differs.

## Pick a track

A **track** is a starting set for what you are building. It only pre-checks items at step 3 — you can uncheck anything, and pick more than one track.

- **No stack yet** — `base`: principles, method skills, and testing rules; nothing stack-specific (every dev track already includes it)
- **Frontend + backend** — `csr-supabase` · `csr-fastify` · `csr-fastapi` · `ssr-nextjs` · `ssr-htmx`
- **Data** — `data`
- **Business** — `executive` · `project-management` · `growth-marketing`
- **Meta** — `tooling`: Bash and Markdown projects with no app stack
- **Everything** — `full`

[What each track installs →](docs/TRACKS.md)

## Day to day

| You want to… | Run |
|---|---|
| See what this project got | `npx -y @uzysjung/agent-harness list` |
| Bring it to the current release | `npx -y @uzysjung/agent-harness update` |
| Add another tool later | `npx -y @uzysjung/agent-harness install --track <your track> --cli <new cli>` |
| Remove everything, one tool, or single assets | `npx -y @uzysjung/agent-harness uninstall` (`--cli <name>` · `--only <id>` · `--dry-run` to preview) |
| Cloned a repo a teammate set up with the harness | Nothing — the install record is committed with the files. `list` shows it; `update` and `uninstall` work as on their machine ([teammates and fresh clones](docs/USAGE.md#teammates-and-fresh-clones)) |

`update` refreshes what the harness installed, adds what a newer release introduced, and puts back harness files that went missing — a hook script, a server in `.mcp.json`, a section of `AGENTS.md`. What you dropped on purpose with `--without` stays out. It never installs a tool you did not choose. `update --only skills` limits it to one group.

In a terminal, `uninstall` offers three choices — one tool, selected assets, or everything — and `--dry-run` shows the plan first. It never deletes `.claude/`, `.codex/`, or `.opencode/`: each is moved aside as `<dir>.backup-<ts>`, so files you put there yourself stay in the backup.

**Safe on an existing project.** Before replacing a file you edited, the harness writes a timestamped backup next to it and prints the path. Nothing you wrote or edited is deleted without a backup beside it, and your existing `.mcp.json` servers are merged, not replaced ([installing into an existing project](docs/USAGE.md#installing-into-an-existing-project)).

**Your project only.** Nothing goes to `~/.opencode/`, `~/.gemini/`, or global npm. Two opt-in exceptions write outside the project: Claude Code plugins (the `claude` CLI keeps its plugin cache under `~/.claude/plugins/`), and `--with-codex-trust`, which adds one trust entry to `~/.codex/config.toml` so Codex reads its project config ([details](docs/USAGE.md#scope)).

## Already using something else?

| If you currently… | How this is different |
|---|---|
| Write your own `CLAUDE.md` or `AGENTS.md` | Keep it. The harness adds one marked block and leaves the rest alone. It adds what a single file can't: a hook that actually blocks, a reviewer separate from the agent that builds, and an install record so `update` and `uninstall` touch only what the harness put there. |
| Pick skills from a marketplace | If you only need one skill, take just that one: `npx skills add uzysjung/uzys-agent-harness --skill <id> -a claude-code` (see ids with `--list`, or on [skills.sh](https://skills.sh/uzysjung/uzys-agent-harness)). The wizard is for what a skill list doesn't cover: standing rules, hooks, subagents, and the record that keeps them current. |
| Use another harness with many rules | Fewer standing instructions, and you see their per-session token cost before you install. If you want a fixed, step-by-step process, add the third-party workflow kits `openspec` or `bmad-method`. Both are optional and compared in [WORKFLOWS.md](docs/WORKFLOWS.md). |

## Docs

- [Usage guide](docs/USAGE.md) — install flags, scope, update, uninstall, per-CLI details, what gets written where
- [Tracks](docs/TRACKS.md) — what each track pre-checks
- [Compatibility matrix](docs/COMPATIBILITY.md) — every asset, its install method, which CLIs it reaches, and how it was verified
- [Which file is whose](docs/CONTEXT-FILES.md) — `CLAUDE.md`, the anchor, `AGENTS.md`, and the other context files
- [Workflow guide](docs/WORKFLOWS.md) — the opt-in workflow bundles compared, and when you don't need one
- [Security](SECURITY.md) — what vetting covers, what it doesn't, how to report
- [North Star](docs/NORTH_STAR.md) · [decisions](docs/decisions/) — why the harness is shaped this way

## License

MIT.
