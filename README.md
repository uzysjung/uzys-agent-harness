# uzys-agent-harness

**One command sets up an AI coding agent that works better as models get smarter.**

If you have kept adding rules to Claude Code or Codex, you have probably seen this. The instruction file keeps growing, and the agent skips half of it. When a new model ships, the rules you wrote to stop the old model's mistakes start getting in the way.

uzys-agent-harness doesn't pile up rules. It tells the agent what to base its judgment on, what result to deliver, and which lines it must not cross and why, then leaves the rest to the model. Because the model isn't boxed in by rules, a better model can put its full ability to work.

One command installs rules and skills for your stack, plus third-party skills that come from official repositories or passed this project's vetting. On Claude Code you also get hooks that stop costly mistakes and a reviewer agent kept separate from the one that writes the code. Works with Claude Code, Codex, OpenCode, and Antigravity.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/github/v/tag/uzysjung/uzys-agent-harness?label=version)](https://github.com/uzysjung/uzys-agent-harness/tags)
[![CI](https://github.com/uzysjung/uzys-agent-harness/actions/workflows/test.yml/badge.svg)](https://github.com/uzysjung/uzys-agent-harness/actions)

![agent-harness demo — one-command install of vetted AI-coding skills & plugins](https://raw.githubusercontent.com/uzysjung/uzys-agent-harness/main/docs/assets/agent-harness-demo.gif)

🇰🇷 [한국어](./README.ko.md)

---

## Philosophy and direction

Give an agent a list of dos and don'ts and it stays inside that list however good the model gets. So this harness doesn't spell out each step. It gives judgment criteria, a goal, and limits, and lets the model find its own way inside them. It follows five principles.

### Judgment criteria, not checklists

If you fix a procedure, the model follows it even where it doesn't fit. So the harness doesn't set procedures. It says what to weigh when deciding.

A typical rule:

> Add unit tests for every change and get a review before every commit.

This harness's working principles:

> Choose the depth, timing, and combination of testing, review, and release checks according to actual impact, uncertainty, recovery cost, and existing evidence.

Under the first rule, fixing a typo takes the same steps as changing billing logic. The second gives the model a reason to treat them differently. It doesn't mean testing less. It lets the model judge how much is needed.

### Goal and finish line first

Instead of prescribing a method, the harness first says what done looks like. The `north-star` skill records what the project is for and what it won't do. The `objective-brief` skill does the same for each task: its goal, completion criteria, and boundaries. Methods are not fixed. If there is a better path to the same result, the model can take it.

### Limits come with reasons, and very few are enforced

Hard limits are written down plainly. Destructive actions, deployments, and writes to anything other people share, such as a repository or a database, need your approval when they go beyond the work you handed over. Routine work inside that scope is meant to go ahead without repeated check-ins. Only two things are enforced mechanically: on Claude Code, a hook blocks edits to `.env`, lock files, and certificates, and a bundled script puts protection rules on your GitHub default branch.

### What the model now does well comes out of the instructions

Every instruction read each session takes up context, and instructions written for an older model's weak spots can get in a newer model's way. So before you install, the wizard shows how many tokens your selection adds to every session. After you install, the `audit-harness-fit` skill finds instructions your project no longer needs, and procedures that make the agent check the same thing over and over, then suggests what to change.

### The agent that builds is not the one that checks

An agent checking its own work tends to miss things. On Claude Code, a `reviewer` subagent that didn't write the code runs your tests or the app and checks the result. With the optional `model-orchestration` skill, the agent also picks the model and reasoning effort for each task: fast and cheap for light work, stronger where more judgment is needed. That is how speed, cost, and quality get balanced.

The full working principles are in [templates/CLAUDE.md](templates/CLAUDE.md). They are installed as `CLAUDE-uzys-harness.md` and pulled in by one line in your `CLAUDE.md`. The project's direction is in [docs/NORTH_STAR.md](docs/NORTH_STAR.md).

## Why use it

- **Your instruction files stop growing.** Only a few short rules are read every session, and longer procedures open only when needed. You see the per-session token cost before you install.
- **You don't have to direct every step.** With a goal, a finish line, and limits in place, you can hand the agent bigger pieces of work.
- **A few hard-to-undo mistakes are blocked by mechanisms.** On Claude Code a hook blocks edits to `.env`, and running the bundled script once puts protection rules on your GitHub default branch.
- **Review goes to a separate agent.** On Claude Code, an agent other than the one that wrote the code checks the result.
- **Switching or mixing tools keeps the same rules and skills.** All four tools get them generated from one source.
- **It goes in and comes out cleanly.** Every installed file is recorded, so `update` and `uninstall` touch only what the harness added. Uninstalling removes only the harness's block from your `CLAUDE.md`.

If you want to trust your AI coding agent with more, and spend less time rewriting instruction files every time the model changes, start here.

## Quick start

You need Node.js 20.12 or newer. Run this in your project folder:

```bash
npx -y @uzysjung/agent-harness
```

The wizard asks five things:

```
1/5  Tracks          what you are building (your stack). Items that fit it are pre-checked
2/5  CLI             one or more of claude / codex / opencode / antigravity
3/5  Install items   review the pre-checked items; drop or add anything
4/5  Confirm         a summary, and how many tokens your selection adds per session
5/5  Installing
```

Picking a stack pre-checks the rules, skills, and external tools that fit it. That is only a recommendation. At step 3 you decide everything that goes in or stays out, and you can pick more than one stack. Without the wizard, `--with <id>` and `--without <id>` make the same choices.

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

Every track gets four skills for setting and keeping direction: `north-star` (what the project is for and what it won't do), `objective-brief` (one task's goal, definition of done, and limits), `gh-issue-workflow` (decisions kept in GitHub issues, not in chat), and `audit-harness-fit` (checks whether the setup fits your project). Your track adds stack skills on top (see [supported stacks](#supported-stacks-and-the-skills-that-come-with-them)). The full file list is in [what the harness writes](docs/USAGE.md#what-the-harness-writes).

What each tool gets:

| Tool | Rules | Skills | Hooks | Subagents | Plugins |
|---|---|---|---|---|---|
| Claude Code | ✓ | ✓ | ✓ | ✓ | ✓ |
| Codex | ✓ (in `AGENTS.md`) | ✓ | session start only | — | — |
| OpenCode | ✓ (in `AGENTS.md`) | ✓ | — | — | — |
| Antigravity | ✓ | ✓ | — | — | — |

Plugins are a Claude Code feature, so only Claude Code gets them. Rules and skills come from the same source, so they say the same thing in every tool. What a tool can block on its own differs.

## Supported stacks and the skills that come with them

Picking a stack (track) pre-checks the external skills and tools below. Everything pre-checked comes from an official repository or one that passed this project's vetting ([SECURITY.md](SECURITY.md)).

| Track | Stack | Pre-checked external skills and tools |
|---|---|---|
| `base` | No stack yet | None (common rules and method skills only) |
| `csr-supabase` | Vite + React + Supabase | `frontend-design`, `react-best-practices`, `shadcn-ui`, `supabase-agent-skills`, `postgres-best-practices` |
| `csr-fastify` | Vite + React + Fastify | `frontend-design`, `react-best-practices`, `shadcn-ui` |
| `csr-fastapi` | Vite + React + FastAPI | `frontend-design`, `react-best-practices`, `shadcn-ui` |
| `ssr-nextjs` | Next.js (App Router) | `frontend-design`, `react-best-practices`, `shadcn-ui` |
| `ssr-htmx` | htmx + FastAPI | `frontend-design` |
| `data` | Python data work (DuckDB, PySide6) | `frontend-design`, `anthropic-data-plugin` |
| `tooling` | Bash and Markdown projects with no app stack | `frontend-design` |
| `full` | Every dev track | All of the above, plus `anthropic-document-skills` |
| `executive` | Proposals, due diligence, decks, financial models | `anthropic-document-skills` |
| `project-management` | PM work | None (`product-skills` available) |
| `growth-marketing` | Growth and content marketing | None (`marketingskills` available) |

MCP servers come too. Every track gets `context7` (current library docs), `github`, and `chrome-devtools`. Web app tracks (`csr-*`, `ssr-*`) add `railway-mcp-server`, and `csr-supabase` adds `supabase`. `full` gets both.

More external assets are never pre-checked but can be added at step 3 or with `--with <id>`:

- Frontend and design: `web-design-guidelines`, `taste-skill`, `jakubkrehel-skills`, `preline`, `scroll-world`
- Deployment: `vercel-cli`, `netlify-cli`, `supabase-cli`, `railway-skills`
- Security review: `security-guidance`, `trailofbits-skills`
- Product, marketing, finance: `product-skills`, `marketingskills`, `finance-skills`
- Slides and video: `frontend-slides`, `marp-slide`, `revealjs`, `remotion`, `gsap-skills`, and more
- Teams that want a fixed development process: `openspec`, `bmad-method` (compared in [WORKFLOWS.md](docs/WORKFLOWS.md))

Each track's full set is in [docs/TRACKS.md](docs/TRACKS.md). Every asset's source, install method, and supported tools are in [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md).

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
