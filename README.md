# uzys-agent-harness

One command starts a short wizard that sets up your AI coding agent for this project: a few short working rules, safety hooks, and step-by-step playbooks it opens only when a task needs them — picked for your stack, and recorded so you can update or remove them later.

Works with **Claude Code** · **Codex** · **OpenCode** · **Antigravity**.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/github/v/tag/uzysjung/uzys-agent-harness?label=version)](https://github.com/uzysjung/uzys-agent-harness/tags)
[![CI](https://github.com/uzysjung/uzys-agent-harness/actions/workflows/test.yml/badge.svg)](https://github.com/uzysjung/uzys-agent-harness/actions)

![agent-harness demo — one-command install of vetted AI-coding skills & plugins](https://raw.githubusercontent.com/uzysjung/uzys-agent-harness/main/docs/assets/agent-harness-demo.gif)

🇰🇷 [한국어](./README.ko.md)

---

## Why you might want it

If you build with an AI coding agent, some of this will sound familiar:

| What happens today | What this sets up |
|---|---|
| Your `CLAUDE.md` or `AGENTS.md` grows after every mistake, the agent still skips half of it, and nobody dares to delete a line. | Three to six short rule files (git, change control, docs, testing, shipping) that the agent reads every session. Longer know-how goes into **skills** — step-by-step playbooks the agent opens only when a task calls for one. Before you confirm, the installer shows how many tokens your selection adds to every session. |
| You steer every step, or the agent wanders off and builds the wrong thing. | Skills that have the agent write down, before it starts, what the project is for, what "done" means for this task, and what it must not touch. With those written down, the agent has something to check its own work against, and it can carry a task further before it needs you. |
| The agent edits a `.env` or lock file, or deploys and deletes without asking. | On Claude Code, a **hook** — a script the tool runs by itself — stops the agent's file-edit tool from changing `.env`, lock files, and certificates (installing packages still updates lock files as usual). A bundled script turns on GitHub branch protection for your main branch when you run it. On every tool, the installed instructions tell the agent to ask before deploying, deleting, or anything else hard to undo — that part is an instruction, not a block. |
| The agent says "done", and it isn't. | On Claude Code, a separate `reviewer` subagent — one that did not write the code — checks finished work by running your tests or the app instead of taking the builder's word for it. The main agent hands work to it, or you ask for it by name. |
| You use more than one AI tool, or might switch. | The same rules and skills are generated for all four tools from one source. Hooks and subagents depend on what each tool supports ([what reaches which tool](#what-you-get)). |
| Setup files pile up and you can't tell what came from where. | Every file the installer writes is recorded. `update` brings in new versions and removes what a release dropped. `uninstall` takes it back out: shared files like `.mcp.json` lose only the installer's lines, your own `CLAUDE.md` comes back byte for byte, and nothing you wrote or edited is deleted without a backup. |

## Quick start

You need Node 20.12 or newer. Run this in your project folder:

```bash
npx -y @uzysjung/agent-harness
```

The wizard asks five things:

```
1/5  Tracks          what you are building (a stack) — this only pre-checks items
2/5  CLI             claude / codex / opencode / antigravity — one or more
3/5  Install items   everything is pre-checked for your track; uncheck what you don't want
4/5  Confirm         summary, plus how many tokens your selection adds to each session
5/5  Installing
```

Then open your AI coding tool in the same folder. The rules and skills are live from the first session:

```bash
claude    # or codex / opencode / agy
```

**First thing to do.** The install leaves a `CLAUDE.md` (or `AGENTS.md`) with blank sections about *your* project. Type this to your agent once:

```
Run the audit-harness-fit skill and fill in the project sections from the code.
```

It reads the repository and fills those sections in. Ask again later to check whether the setup still fits your project.

No terminal for the wizard (CI, containers, scripts)? Use flags: `install --track <name>` is the only required one — see [non-interactive install](docs/USAGE.md#non-interactive-install). Claude Code plugins need the `claude` command on your PATH; without it they are skipped with a warning.

## What you get

With Claude Code on a dev track, your project gains:

```
your-project/
├── CLAUDE.md                 yours — one marked import block added at the end (created if missing)
├── CLAUDE-uzys-harness.md    working principles the agent reads every session
├── .claude/
│   ├── rules/                the short rule files — read every session
│   ├── skills/               playbooks — only a one-line description is loaded until one is used
│   ├── agents/               reviewer, implementer — subagents the main agent hands work to
│   ├── hooks/                session start · file protection — run by Claude Code itself
│   └── settings.json         registers the hooks (merged with yours)
├── .mcp.json                 MCP servers — context7 (current library docs), github (merged with yours)
└── .uzys-agent-harness/      the install record and helper scripts
```

Everything stays inside your project. Commit it like any other file, and teammates who clone get the same setup.

Every track gets four skills that set direction and keep it: `north-star` (what the project is for and what it won't do), `objective-brief` (goal, definition of done, and limits for one task), `gh-issue-workflow` (decisions kept in GitHub issues instead of a chat log), and `audit-harness-fit`. Your track adds stack skills — React, shadcn, Supabase, and Postgres on `csr-supabase`, for example — and you can add or drop any bundled skill by name with `--with` / `--without`. Every file and path: [what the harness writes](docs/USAGE.md#what-the-harness-writes).

What reaches which tool:

| Tool | Rules | Skills | Hooks | Subagents | Plugins |
|---|---|---|---|---|---|
| Claude Code | ✓ | ✓ | ✓ | ✓ | ✓ |
| Codex | ✓ (in `AGENTS.md`) | ✓ | session start only | — | — |
| OpenCode | ✓ (in `AGENTS.md`) | ✓ | — | — | — |
| Antigravity | ✓ | ✓ | — | — | — |

Plugins are Claude Code's own mechanism, so they are Claude-only. Rules and skills are generated for all four from the same source, so the instructions say the same thing in every tool; what a tool can enforce on its own differs.

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

| If you would otherwise… | What is different here |
|---|---|
| Write your own `CLAUDE.md` or `AGENTS.md` | Keep it — one marked block is added and the rest is never touched. What a file alone can't give you comes with it: a hook that actually blocks, a reviewer separate from the agent that builds, and an install record so `update` and `uninstall` touch only what the installer put there |
| Pick skills from a marketplace | If one skill is all you need, take just that one: `npx skills add uzysjung/uzys-agent-harness --skill <id> -a claude-code` (`--list` shows the ids; also on [skills.sh](https://skills.sh/uzysjung/uzys-agent-harness)). The installer is for what a skill list doesn't carry — standing rules, hooks, subagents, and the record that keeps them current |
| Use a setup with many rules | Fewer standing instructions, and you see their per-session cost before you confirm. If you want a fixed, spec-first process on top, add `openspec` or `bmad-method` (third-party workflow kits) — both optional, compared in [WORKFLOWS.md](docs/WORKFLOWS.md) |

## The thinking behind it

Every piece is judged by one question: *does it help you build better with your AI coding tool?* Four design choices follow from it.

1. **Get lighter as models improve.** Instructions written to cover an older model's weak spots go stale. A rule stays only while it still changes what the agent does; the rest becomes an on-demand skill or is removed in a release. `audit-harness-fit` runs the same check on your project and proposes the edit.
2. **Give a destination and limits, not step-by-step prompts.** With a goal, a definition of done, and hard limits written down, the agent can work in a try → check → fix loop instead of waiting on you for every step.
3. **Keep cleaning up.** Whatever loads every session costs context in every session, so each release removes what no longer earns its place, and `update` carries the removal into your project.
4. **Use different viewpoints and different agents.** The agent that builds is not the one that checks. Optional skills help choose the model and reasoning effort per task, or ask a non-Claude model for a second opinion — so speed, cost, and quality are traded on purpose, not by default.

The long form is the project's direction document, [docs/NORTH_STAR.md](docs/NORTH_STAR.md).

### Evidence so far

What is measured so far comes from this repository, which uses the harness on itself. In the last audit, none of the 44 sentences in our own rules was observed to change an agent's behaviour — tests, CI gates, and the independent reviewer caught the recorded incidents — so protection against irreversible damage now lives in hooks and branch rules, not sentences, and four skills and three agents with no observation behind them were retired ([ADR-090](docs/decisions/ADR-090-retire-unobserved-assets-and-demote-domain-agents.md)). This is one project's evidence, not a benchmark: it does not yet show faster development, lower model cost, or better results in other projects.

## Vetting

An external asset is **vetted** when it has at least 1,000 GitHub stars, is not archived, and its install command has been run and checked in an isolated environment. Two monthly CI jobs re-check the stars and the install path. Vetting is **not** a line-by-line security audit and does not scan asset contents for prompt injection. npm and npx assets are pinned to a version; plugin and skill assets resolve to upstream HEAD.

At step 3, `★ official` marks Anthropic-official marketplaces and this harness's own assets, and `⚠ experimental` marks assets under 1,000 stars — never pre-checked, added only by you. Vetted assets carry no badge. Tiers inform; they never block. Treat installed assets like any other third-party dependency: [SECURITY.md](SECURITY.md).

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
