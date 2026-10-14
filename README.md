# uzys-agent-harness

**A harness that helps your AI coding agent work smarter, and work better as models improve.**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/github/v/tag/uzysjung/uzys-agent-harness?label=version)](https://github.com/uzysjung/uzys-agent-harness/tags)
[![CI](https://github.com/uzysjung/uzys-agent-harness/actions/workflows/test.yml/badge.svg)](https://github.com/uzysjung/uzys-agent-harness/actions)

🇰🇷 [한국어](./README.ko.md)

---

If you have kept adding rules to Claude Code or Codex, you have probably run into this. The instruction file keeps growing, and the agent misses more and more of it. Even when a new model ships, the rules you wrote to stop the old model's mistakes get in its way.

uzys-agent-harness doesn't tie the agent down with a list of rules. It builds the agent's working environment on four ideas.

### 1. Built so better models aren't held back

Instead of piling up dos and don'ts, it tells the agent what to base its judgment on and which lines it must not cross. For example, instead of "add tests to every change," it says "decide how deeply to verify based on the change's impact and the cost of undoing it." Instructions for things the model now does well on its own come out. The aim is that when a new model arrives, old rules don't stand in the way of what it can do, and a skill is included that finds stale instructions in your own project so you can trim them.

### 2. With a direction and limits, the agent goes further on its own

Before work is handed over, the project's direction, the task's definition of done, and the lines not to cross are set first. With those to check against, the agent tries, checks its work, and fixes it, again and again, on its own. The aim is to cut down on step-by-step direction and to have the agent ask you only about the decisions that are yours.

### 3. The harness stays light

Every instruction the agent reads each session takes up context, and as they pile up the important ones get buried. So only short rules are read every session, and longer procedures are opened only when needed. Each release drops what is no longer useful, and you can find and drop stale instructions in your own project too. The point is to keep the agent focused on the instructions it actually needs.

### 4. Several viewpoints and several agents balance speed, cost, and quality

Self-checks and independent review are kept apart. Important changes are reviewed by an agent that didn't build them, and dev tracks also get a skill that examines the work from several user perspectives (personas). Dev tracks also get skills that give each task a fitting model and reasoning effort, light work fast and cheap and important work done carefully, and, if you have that vendor's CLI, let a model from another vendor give a second opinion.

One command installs the rules and skills that carry these four ideas, plus third-party skills for your stack (from official repositories, or picked after checking their source, popularity, and install path). Your `CLAUDE.md` gets one block marked with comments and nothing else is touched. On uninstall, shared files such as `CLAUDE.md` and `.mcp.json` lose only the harness's part. Works with Claude Code, Codex, OpenCode, and Antigravity; the hook that blocks file edits and the reviewer agent run on Claude Code.

## Install it now

![agent-harness demo — one-command install of vetted AI-coding skills & plugins](https://raw.githubusercontent.com/uzysjung/uzys-agent-harness/main/docs/assets/agent-harness-demo.gif)

You need Node.js 20.12 or newer. Run this in your project folder:

```bash
npx -y @uzysjung/agent-harness
```

The wizard has five steps:

```
1/5  Tracks          what you are building (a dev stack or a kind of work). Items that fit are pre-checked
2/5  CLI             one or more of claude / codex / opencode / antigravity
3/5  Install items   review the pre-checked items; drop or add anything
4/5  Confirm         a summary, and an estimate of the tokens the harness adds per session
5/5  Installing
```

Picking a track pre-checks the rules, skills, and external tools that fit it. That is only a recommendation. At step 3 you decide everything that goes in or stays out, and you can pick more than one track. Without the wizard, `--with <id>` and `--without <id>` make the same choices.

Then open your AI coding tool in the same folder. The rules and skills are read from the first session. On Codex, the project settings (MCP and hooks) turn on only after you trust the folder ("Trust and continue"):

```bash
claude    # or codex / opencode / agy (Antigravity)
```

**First thing to do.** If your project had no `CLAUDE.md` (or `AGENTS.md`), the install creates one with blank sections about your project. Tell your agent once, and it reads the code and fills them in:

```
Use the audit-harness-fit skill to read the code and fill in the project sections.
```

Later, to check whether the setup still fits your project, use the same skill:

```
Use the audit-harness-fit skill to check whether the current setup fits this project.
```

No terminal for the wizard (CI, containers, scripts)? Run `install` with just `--track <name>` ([installing without the wizard](docs/USAGE.md#non-interactive-install)). Claude Code plugins need the `claude` command on your PATH. Without it they are skipped with a warning.

---

## In detail

From here on: how the four ideas above are put into practice, what gets installed, and which stacks are supported.

## How the ideas are built in

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

Hard limits are written down plainly. Destructive actions, deployments, and writes to anything other people share, such as a repository or a database, need your approval when they go beyond the work you handed over. Routine work inside that scope is meant to go ahead without repeated check-ins. Only two things are enforced mechanically: on Claude Code, a hook stops the file-edit tools from changing `.env`, lock files, and certificates (it does not stop shell commands from changing them, or anything from reading them), and a bundled script, when you run it once, puts protection rules on your GitHub default branch.

### What the model now does well comes out of the instructions

Every instruction read each session takes up context, and instructions written for an older model's weak spots can get in a newer model's way. So before you install, the wizard shows an estimate of how many tokens the harness's instructions add to every session. Third-party skills are not counted in that number. After you install, the `audit-harness-fit` skill finds instructions your project no longer needs, and procedures that make the agent check the same thing over and over, then suggests what to change.

### The agent that builds is not the one that checks

An agent checking its own work tends to miss things. On Claude Code, a `reviewer` subagent that didn't write the code runs your tests or the app and checks the result. On dev tracks, the `model-orchestration` skill also has the agent pick the model and reasoning effort for each task: fast and cheap for light work, stronger where more judgment is needed. That is how speed, cost, and quality get balanced.

The full working principles are in [templates/CLAUDE.md](templates/CLAUDE.md). They are installed as `CLAUDE-uzys-harness.md` and pulled in by one line in your `CLAUDE.md`. The project's direction is in [docs/NORTH_STAR.md](docs/NORTH_STAR.md).

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
├── .mcp.json                 MCP servers: context7 (current library docs) and more by track (merged with yours)
└── .uzys-agent-harness/      the install record and helper scripts
```

All of these files live inside your project. Commit it like any other file, and teammates who clone the repo get the same setup.

Every track gets four skills for setting and keeping direction: `north-star` (what the project is for and what it won't do), `objective-brief` (one task's goal, definition of done, and limits), `gh-issue-workflow` (decisions kept in GitHub issues, not in chat), and `audit-harness-fit` (checks whether the setup fits your project). Your track adds stack skills on top (see [supported stacks](#supported-stacks-and-the-skills-that-come-with-them)). The full file list is in [files the harness creates](docs/USAGE.md#what-the-harness-writes).

What each tool gets:

| Tool | Rules | Skills | Hooks | Subagents | Plugins |
|---|---|---|---|---|---|
| Claude Code | ✓ | ✓ | ✓ | ✓ | ✓ |
| Codex | ✓ (in `AGENTS.md`) | ✓ | session start only | — | — |
| OpenCode | ✓ (in `AGENTS.md`) | ✓ | — | — | — |
| Antigravity | ✓ | ✓ | — | — | — |

Plugins are a Claude Code feature, so only Claude Code gets them. Rules and skills come from the same source, so they say the same thing in every tool. What a tool can block on its own differs.

## Supported stacks and the skills that come with them

A track is a starting setup for a dev stack or a kind of work: the top ten rows are dev tracks, the bottom three are work tracks. Picking a track pre-checks the external skills and tools below. Everything pre-checked comes from an official repository, or from one picked after checking its source, popularity, and install path. That does not vouch for the safety of its contents or the quality of what it produces ([SECURITY.md](SECURITY.md)).

| Track | Stack | Pre-checked external skills and tools |
|---|---|---|
| `base` | No stack yet | None (common rules and the core skills only) |
| `csr-supabase` | Vite + React + Supabase | `frontend-design`, `react-best-practices`, `shadcn-ui`, `supabase-agent-skills`, `postgres-best-practices` |
| `csr-fastify` | Vite + React + Fastify | `frontend-design`, `react-best-practices`, `shadcn-ui` |
| `csr-fastapi` | Vite + React + FastAPI | `frontend-design`, `react-best-practices`, `shadcn-ui` |
| `ssr-nextjs` | Next.js (App Router) | `frontend-design`, `react-best-practices`, `shadcn-ui` |
| `ssr-htmx` | htmx + FastAPI (Python) + daisyUI | `frontend-design` |
| `ssr-htmx-fastify` | htmx + Fastify (Node) + daisyUI | `frontend-design` |
| `data` | Python data work (DuckDB, PySide6) | `anthropic-data-plugin` |
| `tooling` | Bash and Markdown projects with no app stack | None |
| `full` | Every dev track, plus documents | All of the above, plus `anthropic-document-skills` |
| `executive` | Proposals, due diligence, decks, financial models | `anthropic-document-skills` |
| `project-management` | PM work | None |
| `growth-marketing` | Growth and content marketing | None (`marketingskills` available) |

MCP servers come too. Every track gets `context7` (current library docs). Web tracks (`csr-*`, `ssr-*`, `full`) add `chrome-devtools`, with Google's usage statistics turned off. The `csr-*`, `ssr-htmx` and `ssr-htmx-fastify` tracks add `railway-mcp-server` (Railway's remote server — you sign in on first use), and `csr-supabase` adds `supabase` (Supabase's remote server — you sign in on first use). `full` gets both. On `ssr-nextjs`, Railway MCP is not a default; pick it if you want it. Vercel's and GitHub's official remote servers (`vercel`, `github-mcp`) are never pre-checked — add them with `--with`. Each server is a row in step 3 of the wizard: uncheck it or pass `--without <name>` (e.g. `--without context7`) to leave it out of `.mcp.json`, Codex and OpenCode.

More external assets are never pre-checked but can be added at step 3 or with `--with <id>`:

- Frontend and design: `web-design-guidelines`, `taste-skill`, `jakubkrehel-skills`, `preline`, `scroll-world`
- Deployment: `vercel-cli`, `netlify-cli`, `supabase-cli`, `railway-mcp-server`, `vercel`, `railway-skills`
- Security review: `security-guidance`, `claude-security`
- Structural code search and lint rules: `ast-grep` (needs the ast-grep CLI installed)
- Marketing and finance: `marketingskills`, `finance-skills`
- Slides and video: `frontend-slides`, `marp-slide`, `hyperframes`, `remotion`, `gsap-skills`, and more
- Teams that want a fixed development process: `openspec`, `bmad-method` (compared in [WORKFLOWS.md](docs/WORKFLOWS.md))

Each track's full set is in [docs/TRACKS.md](docs/TRACKS.md). Every asset's source, install method, and supported tools are in [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md).

## Main commands

| You want to… | Run |
|---|---|
| See what this project got | `npx -y @uzysjung/agent-harness list` |
| Bring it to the current release | `npx -y @uzysjung/agent-harness update` |
| Add another tool later | `npx -y @uzysjung/agent-harness install --track <your track> --cli <new cli>` |
| Remove everything, one tool, or single assets | `npx -y @uzysjung/agent-harness uninstall` (`--cli <name>` · `--only <id>` · `--dry-run` to preview) |
| Cloned a repo a teammate set up with the harness | Nothing on the harness side. The install record is committed with the files, so `list` shows it and `update` and `uninstall` work as on their machine. The Claude Code plugin cache and the Codex trust entry live outside the project, so they don't come with the clone ([what cloning teammates should know](docs/USAGE.md#teammates-and-fresh-clones)) |

`update` refreshes what the harness installed, adds what a newer release introduced, and puts back harness files that went missing — a hook script, a server in `.mcp.json`, a section of `AGENTS.md`. What you dropped on purpose with `--without` stays out. It never installs a tool you did not choose. `update --only skills` limits it to one group.

In a terminal, `uninstall` offers three choices (one tool, selected assets, or everything), and `--dry-run` shows the plan first. When you remove everything, only the files the harness wrote are removed, one by one; your own files in `.claude/`, `.codex/` and `.opencode/` stay where they are, and a file of yours the harness had replaced is put back.

**Safe on an existing project.** Before replacing a file you edited, the harness writes a timestamped backup next to it and prints the path. Nothing you wrote or edited is deleted without a backup beside it, and your existing `.mcp.json` servers are merged, not replaced ([installing into an existing project](docs/USAGE.md#installing-into-an-existing-project)).

**Your project only.** Nothing goes to `~/.opencode/`, `~/.gemini/`, or global npm. There are two exceptions: Claude Code plugins (the `claude` CLI keeps its plugin cache under `~/.claude/plugins/`), and `--with-codex-trust`, which adds one trust entry to `~/.codex/config.toml` so Codex reads its project config ([when it writes outside the project](docs/USAGE.md#scope)).

## Already using something else?

| If you currently… | How this is different |
|---|---|
| Write your own `CLAUDE.md` or `AGENTS.md` | Keep it. The harness adds one marked block and leaves the rest alone. It adds what a single file can't: on Claude Code, a hook that blocks edits to protected files and a reviewer separate from the agent that builds; and an install record so `update` changes only what the harness put there. |
| Pick skills from a marketplace | If you only need one skill, take just that one: `npx skills add uzysjung/uzys-agent-harness --skill <id> -a claude-code` (see ids with `--list`, or on [skills.sh](https://skills.sh/uzysjung/uzys-agent-harness)). The wizard is for what a skill list doesn't cover: standing rules, hooks, subagents, and the record that keeps them current. |
| Use another harness with many rules | Only a few short rules are read every session; longer procedures are read when needed. You see an estimate of their per-session token cost before you install. If you want a fixed, step-by-step process, add the third-party workflow kits `openspec` or `bmad-method`. Both are optional and compared in [WORKFLOWS.md](docs/WORKFLOWS.md). |

## When this harness is not a fit

- **You need a fixed procedure followed step by step.** This harness gives judgment criteria instead of procedures and leaves the decisions to the model. If an audit or regulation requires fixed steps, add a workflow kit such as `openspec` or `bmad-method`, or write those steps as your own rules.
- **You use a small model you can't trust with judgment calls.** Instructions that give criteria rather than steps pay off when the model can make the call itself.
- **You want numbers on the benefit before you adopt it.** This project's tests check that installing and file handling work as intended. There are no measurements yet comparing development results with and without the harness.

## Docs

- [Usage guide](docs/USAGE.md) — install flags, scope, update, uninstall, per-CLI details, what gets written where
- [Tracks](docs/TRACKS.md) — what each track pre-checks
- [Compatibility matrix](docs/COMPATIBILITY.md) — every asset, its install method, which CLIs it reaches, and how it was verified
- [Which file is whose](docs/CONTEXT-FILES.md) — `CLAUDE.md`, `CLAUDE-uzys-harness.md`, `AGENTS.md`, and the other instruction files
- [Workflow guide](docs/WORKFLOWS.md) — the opt-in workflow bundles compared, and when you don't need one
- [Security](SECURITY.md) — what vetting covers, what it doesn't, how to report
- [North Star](docs/NORTH_STAR.md) · [decisions](docs/decisions/) — why the harness is shaped this way

## License

MIT.
