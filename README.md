# uzys-agent-harness

Give your AI coding tool the few rules, hooks, and skills it actually needs — and nothing it doesn't. One wizard installs a vetted set for your stack into Claude Code, Codex, OpenCode, or Antigravity, scoped to your project.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/github/v/tag/uzysjung/uzys-agent-harness?label=version)](https://github.com/uzysjung/uzys-agent-harness/tags)
[![CI](https://github.com/uzysjung/uzys-agent-harness/actions/workflows/test.yml/badge.svg)](https://github.com/uzysjung/uzys-agent-harness/actions)

![agent-harness demo — one-command install of vetted AI-coding skills & plugins](https://raw.githubusercontent.com/uzysjung/uzys-agent-harness/main/docs/assets/agent-harness-demo.gif)

🇰🇷 [한국어](./README.ko.md)

---

## Install

You need Node 20 or newer. If you plan to use Claude Code plugins, the `claude` command must be on your PATH; otherwise plugin assets are skipped with a warning.

```bash
npx -y @uzysjung/agent-harness
```

The wizard walks you through six steps:

```
1/6  Tracks          pick what you are building
2/6  CLI             claude / codex / opencode / antigravity — one or more
3/6  Install items   everything is pre-checked for your track; uncheck what you don't want
4/6  Scope           Project (default) or Global
5/6  Confirm         summary, plus how much context your selection adds to each session
6/6  Installing
```

Then open your CLI in the project — the rules and skills are live, and on Claude Code the hooks too:

```bash
claude    # or codex / opencode / agy
```

**Your first session.** The install leaves a `CLAUDE.md` (or `AGENTS.md`) with fill-in sections about *your* project. Ask your agent to run the `audit-harness-fit` skill once. It reads the repository and fills those sections from evidence, and you run it again later to check whether the harness still fits the project. There is no "interview me about my stack" step — you already chose the stack at step 1, and the audit fills the rest from the code.

The wizard needs a terminal. For CI, containers, or onboarding scripts, use the flag form: `install --track <name>` is the only required flag — see [non-interactive install](docs/USAGE.md#non-interactive-install).

### Two ways to install

| You want… | Do this |
|---|---|
| The harness — rules, hooks, agents, and the skills your stack calls for, curated by track | The wizard above |
| One skill, nothing else — no harness, no track | `npx skills add uzysjung/uzys-agent-harness --skill <id> -a claude-code` |

Every skill this repo ships is installable on its own with the [skills CLI](https://github.com/vercel-labs/skills); `npx skills add uzysjung/uzys-agent-harness --list` shows the ids. You get the same files the installer copies, `references/` included. Re-run the command to refresh ([details](docs/USAGE.md#one-skill-without-the-harness)). They are listed on [skills.sh/uzysjung/uzys-agent-harness](https://skills.sh/uzysjung/uzys-agent-harness) as well.

## Philosophy — keep only the frame the model needs

Piling rules and skills onto an AI coding tool does not make it better. Every instruction that is always loaded costs context in every session, and telling a frontier model how to do something it already does well only slows it down. This harness starts from the opposite end: **keep a principle only where the model is likely to slip, and take it back out as models improve.**

- **"Don't do X" and "always do Y" degrade today's models.** A pile of prohibitions and mandates removes the model's room to judge. The moment a situation differs slightly from the rule, the model gets stuck or works around it. Once guards start guarding other guards, development slows down while quality stays flat. So the harness writes guidance as *what must be true* — the outcome, the invariant, the boundary — and leaves *how* to the model. Prohibitions are kept for irreversible damage — secrets and shared history — and even those are enforced by a mechanism rather than a sentence: a hook blocks edits to `.env` and key files, and a GitHub ruleset the harness helps you apply protects the default branch. This direction came from measurement, not taste: of the 44 sentences in our own rules, the number observed to change an agent's behaviour was zero. What actually caught incidents was gates, tests, and an independent reviewer.

- **Skills improve as models improve.** Each asset is kept only when there is an observation behind it: "without this, the agent is measurably slower or wrong." Guidance without that evidence is removed from the always-loaded set — it becomes a skill that loads only when needed, or it is retired. So `update` brings you the current judgement — what was added, and what was cut — not just more.

- **`audit-harness-fit` keeps checking.** Run once after install and it fills your project context from the repository. Run later and it finds needless questions, repeated checks, decisions that contradict each other, and procedures that a better model no longer needs — then proposes the edit. Whether the harness fits your project is a question you keep asking, not one you settle at install time.

- **Speed and quality are not a trade-off.** Irreversible damage is blocked by a hook, repeated mistakes are caught by a short rule, and everything else is left to the model. Verification is not "everything, every time": it runs when a user-facing scene is complete, by a separate agent that did not write the code and actually executes it. The goal is the lightest protection that reliably keeps what matters, not more guards.

- **Think and explain from the customer's side of the service you are building.** The agent describes a problem, a change, or a choice first as what the user does and sees, not as file names and functions (`user-centered-explanation`). When a decision needs your approval, it arrives as context → problem → options → recommendation, so you can decide without re-reading the conversation.

Those five are the direction, and the first question for any asset — in or out — is *does this help a person build better with an AI coding tool?* The long form is [docs/NORTH_STAR.md](docs/NORTH_STAR.md).

## What you get

- **Rules** — six short files on git policy, change management, documentation, testing, shipping, and CLI development. Dev tracks get five; `tooling` and `full` add the sixth; business tracks get the three that apply to any project.
- **Hooks** — two, on Claude Code: one loads your spec and change log at session start, one blocks edits to `.env`, lock files, and certificates. That second hook is the only thing in the harness that says "no", and it writes one line to a log every time it does. Codex gets the session-start hook only; its hook API cannot intercept file edits.
- **Skills** — the harness's own method skills, written and maintained in this repo, plus the stack skills your track calls for. Four go to every track (`north-star`, `objective-brief`, `gh-issue-workflow`, `audit-harness-fit`); dev tracks add five method skills and an incident runbook; stack tracks add `frontend-design` and whatever your stack needs (React, shadcn, Supabase, Postgres on `csr-supabase`, for example). Thirteen of the bundled skills can be named directly with `--with` / `--without`.
- **Agents** — an independent `reviewer` on every track; `implementer` on dev tracks; `data-analyst` and `strategist` only on the tracks that use them.
- **A working-principles anchor** — one file your CLI reads every session. Your own `CLAUDE.md` stays yours; the harness adds one import line and never touches the rest. Which file is whose: [docs/CONTEXT-FILES.md](docs/CONTEXT-FILES.md).

What reaches which CLI:

| CLI | Rules | Skills | Hooks | Plugins |
|---|---|---|---|---|
| Claude Code | ✓ | ✓ | ✓ | ✓ |
| Codex | ✓ (in `AGENTS.md`) | ✓ | session start only | — |
| OpenCode | ✓ (in `AGENTS.md`) | ✓ | — | — |
| Antigravity | ✓ | ✓ | — | — |

Plugins are Claude Code's own mechanism, so they are Claude-only; skills and rules render for all four from the same source, so they stay consistent across tools.

## Tracks

Twelve tracks, grouped by what you are building:

- **No stack yet** — `base`: principles, method skills, and testing rules; nothing stack-specific
- **Frontend + backend** — `csr-supabase` · `csr-fastify` · `csr-fastapi` · `ssr-nextjs` · `ssr-htmx`
- **Data** — `data`
- **Business** — `executive` · `project-management` · `growth-marketing`
- **Meta** — `tooling`: Bash and Markdown projects with no app stack
- **Everything** — `full`

A track is a starting point, not a lock-in: everything it pre-checks can be unchecked at step 3, and you can pick more than one. [What each track installs →](docs/TRACKS.md)

## Day to day

```bash
npx -y @uzysjung/agent-harness list        # what this project got
npx -y @uzysjung/agent-harness update      # bring it to the current release
npx -y @uzysjung/agent-harness uninstall   # pick what to remove, or remove everything
```

`update` refreshes the files the harness installed, adds skills a newer release introduced, and tells you when something (a new hook) needs a reinstall instead. It never installs a CLI you did not choose. `update --only skills` limits it to one group. `uninstall` asks item by item in a terminal; `--dry-run` shows the plan first.

**Safe on an existing project.** Before replacing a file you edited, the harness writes a timestamped backup next to it and prints the path. Nothing you wrote or edited is deleted without a backup beside it. Your existing `.mcp.json` servers are merged, not replaced. Details: [installing into an existing project](docs/USAGE.md#installing-into-an-existing-project).

**Project scope is the default.** Nothing goes to `~/.codex/`, `~/.opencode/`, `~/.gemini/`, or global npm unless you choose Global at step 4. Claude Code plugins are the one exception: the `claude` CLI keeps its plugin cache under `~/.claude/plugins/` in either scope and isolates projects by metadata. Besides `.claude/`, install writes `.mcp.json`, a few `.gitignore` lines (when that file exists), an `.env.example` on Supabase tracks, and its own record at `.uzys-agent-harness/` — the full list is in [what the harness writes](docs/USAGE.md#what-the-harness-writes).

## Vetting

An external asset is **vetted** when it has at least 1,000 GitHub stars, is not archived, and its install command has been run and checked in an isolated environment. Two monthly CI jobs re-check the stars and the install path. Vetting is **not** a line-by-line security audit and does not scan asset contents for prompt injection. npm and npx assets are pinned to a version; plugin and skill assets resolve to upstream HEAD.

At step 3, `★ official` marks Anthropic-official marketplaces and this harness's own assets, `⚠ experimental` marks assets under 1,000 stars — never pre-checked, added only by you. Vetted assets carry no badge. Tiers inform; they never block. Treat installed assets like any other third-party dependency: [SECURITY.md](SECURITY.md).

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
