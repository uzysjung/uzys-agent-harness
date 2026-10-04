# uzys-agent-harness

Give your AI coding tool the few rules, hooks, and skills it actually needs — and nothing it doesn't. One wizard installs a vetted set for your stack, scoped to your project.

Works with **Claude Code** · **Codex** · **OpenCode** · **Antigravity**.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/github/v/tag/uzysjung/uzys-agent-harness?label=version)](https://github.com/uzysjung/uzys-agent-harness/tags)
[![CI](https://github.com/uzysjung/uzys-agent-harness/actions/workflows/test.yml/badge.svg)](https://github.com/uzysjung/uzys-agent-harness/actions)

![agent-harness demo — one-command install of vetted AI-coding skills & plugins](https://raw.githubusercontent.com/uzysjung/uzys-agent-harness/main/docs/assets/agent-harness-demo.gif)

🇰🇷 [한국어](./README.ko.md)

---

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
4/5  Confirm         summary, plus how much context your selection adds to each session
5/5  Installing
```

Then open your AI coding tool in the same folder. The rules and skills are live from the first session:

```bash
claude    # or codex / opencode / agy
```

**First thing to do.** The install leaves a `CLAUDE.md` (or `AGENTS.md`) with blank sections about *your* project. Ask your agent to run the `audit-harness-fit` skill once — it reads the repository and fills those sections from the code. Run it again later to check whether the harness still fits.

No terminal for the wizard (CI, containers, scripts)? Use flags: `install --track <name>` is the only required one — see [non-interactive install](docs/USAGE.md#non-interactive-install). Claude Code plugins need the `claude` command on your PATH; without it they are skipped with a warning.

## Why uzys-agent-harness

**North star: keep only the structure that helps you build better with an AI coding tool.** Give the agent a direction, a definition of done, and hard limits — not a script for work it can already decide how to do. Every always-loaded instruction costs context in every session, so each one has to earn its place. Four beliefs follow from that; under each is what makes it real here.

**1. As models improve, the harness should improve with them — usually by asking for less.** Instructions written to patch an older model's weaknesses go stale. State the outcome that must hold, leave the method to the model, and re-check what is loaded when the model changes.
*Here:* an instruction stays always-loaded only while there is an observation that the agent is slower or wrong without it; otherwise it becomes an on-demand skill or is retired. `audit-harness-fit` runs that check on your project — needless questions, repeated checks, conflicting decisions, procedures a better model no longer needs — and proposes the edit.

**2. An agent needs a destination and guardrails, not a prompt for every step.** A prompt says what to do next; a north star says which way to go when the prompt is silent. With direction, acceptance criteria, and boundaries in place, the agent can work in a loop — try, check against the criteria, adjust — and bring back only the decisions that are yours.
*Here:* three skills on every track — `north-star` (direction, will / won't, decision gates), `objective-brief` (invariants, success criteria, and boundaries for a delegated or multi-step task), `gh-issue-workflow` (the backlog in issues, so decisions outlive the chat). On Claude Code and Codex a session-start hook loads your spec and change log. The guardrails are few and mechanical: on Claude Code a hook blocks edits to `.env`, lock files, and certificates; a bundled script you run once applies a GitHub ruleset to your default branch; the anchor (the principles file your CLI reads every session) requires your approval for destructive or privileged actions, deployment, and shared-state writes. Inside those lines the agent decides; when it needs you, `user-centered-explanation` (dev tracks) brings context → problem → options → recommendation.

**3. Always-loaded context is a budget, so the harness keeps cleaning itself.** A harness that only grows ends up slowing the agent it was meant to help. Don't let yesterday's useful workaround become tomorrow's permanent instruction.
*Here:* step 4 of the wizard shows how much context your selection adds per session before you confirm. `update` refreshes what the harness installed, adds what a newer release introduced, removes rules and hooks a release retired, and names retired skills and agents still on disk rather than deleting them.

**4. Different perspectives and different agents make better speed · cost · quality trade-offs.** The agent that built something should not be the one that judges it, and a large model is worth its cost only where a mistake is expensive.
*Here:* rules and skills render for Claude Code, Codex, OpenCode, and Antigravity from one source, so switching tools keeps the vocabulary. `implementer` (dev tracks) builds and `reviewer` verifies — when a user-facing scene is complete, an agent that did not write the code runs it and decides. `multi-persona-review` (dev tracks) critiques one artifact from several user perspectives in parallel. Opt-in: `model-orchestration` (which model, how much reasoning, when to delegate — `--with model-orchestration`) and `external-model-consult` (a non-Claude second opinion or Korean phrasing; needs that provider's CLI — `--with external-model-consult`).

### Compared with the alternatives

| If you would otherwise… | What is different here |
|---|---|
| Write your own `CLAUDE.md` or `AGENTS.md` | Keep it — the harness adds one marked block and never touches the rest. Around it, the harness packages what a file alone does not enforce or maintain: hooks that actually block, a `reviewer` agent separate from the one that builds, and an install record so `update` and `uninstall` touch only what the harness put there |
| Pick skills from a marketplace | If one skill is all you need, take just that one: every skill here installs on its own with `npx skills add`. The wizard is for the set a skill list does not carry — standing rules, hooks, agents, and the record that keeps them current across releases |
| Use a harness with many rules | Fewer standing instructions, and step 4 shows their per-session cost before you confirm. The hard blocks are a hook on `.env`, lock files, and certificates (Claude Code) and the branch ruleset; everything else is the agent's call inside the anchor's approval boundary. For a fixed process, add `openspec` or `bmad-method` — both opt-in, compared in [WORKFLOWS.md](docs/WORKFLOWS.md) |

### Evidence

What is measured so far comes from this repository, which is the harness's own dogfood and its only measured sample. In the last audit, none of the 44 sentences in our rules was observed to change an agent's behaviour — gates, tests, and the independent reviewer caught the recorded incidents — so protection against irreversible damage lives in hooks and rulesets, not in sentences, and the same audit retired four skills and three agents that had no observation behind them ([ADR-090](docs/decisions/ADR-090-retire-unobserved-assets-and-demote-domain-agents.md)). Treat this as dogfood evidence, not a cross-project benchmark: it does not yet show faster development, lower model cost, or better results in other projects.

The direction in full, and the maintainer's posts behind these beliefs (in Korean): [docs/NORTH_STAR.md §1](docs/NORTH_STAR.md#1-north-star-statement).

## What you get

| Piece | What it is | When your agent reads it |
|---|---|---|
| **Rules** | Six short files: git policy, change management, documentation, testing, shipping, CLI development. Dev tracks get five; `tooling` and `full` add the sixth; business tracks get the three that apply to any project | Every session |
| **Hooks** | Scripts your CLI runs on its own. Two, on Claude Code: one loads your spec and change log at session start; one blocks edits to `.env`, lock files, and certificates — the only thing in the harness that says "no", and it logs one line each time | Automatically, at session start or before an edit |
| **Skills** | Step-by-step playbooks the agent opens when a task calls for them — the method skills written in this repo, plus the stack skills your track needs (for example React, shadcn, Supabase, Postgres on `csr-supabase`) | Only when relevant — a one-line description stays loaded, the body loads on use |
| **Agents** | Helpers the main agent can hand work to: an independent `reviewer` on every track, `implementer` on dev tracks, `data-analyst` and `strategist` on the tracks that use them | When the main agent delegates |
| **Anchor** | One working-principles file your CLI reads every session. Your own `CLAUDE.md` stays yours — the harness adds one marked import block (the `@CLAUDE-uzys-harness.md` reference and the skills guidance that follows it) and never touches the rest ([which file is whose](docs/CONTEXT-FILES.md)) | Every session |

Four method skills go to every track: `north-star`, `objective-brief`, `gh-issue-workflow`, `audit-harness-fit`. Bundled skills can be added or dropped by name with `--with` / `--without`.

What reaches which CLI:

| CLI | Rules | Skills | Hooks | Plugins |
|---|---|---|---|---|
| Claude Code | ✓ | ✓ | ✓ | ✓ |
| Codex | ✓ (in `AGENTS.md`) | ✓ | session start only | — |
| OpenCode | ✓ (in `AGENTS.md`) | ✓ | — | — |
| Antigravity | ✓ | ✓ | — | — |

Plugins are Claude Code's own mechanism, so they are Claude-only. Skills and rules render for all four from the same source, so they stay consistent across tools.

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
| Add another CLI later | `npx -y @uzysjung/agent-harness install --track <your track> --cli <new cli>` |
| Remove everything, one CLI, or single assets | `npx -y @uzysjung/agent-harness uninstall` (`--cli <name>` · `--only <id>` · `--dry-run` to preview) |
| Cloned a repo a teammate set up with the harness | Nothing — the install record is committed with the files. `list` shows it; `update` and `uninstall` work as on their machine ([teammates and fresh clones](docs/USAGE.md#teammates-and-fresh-clones)) |

`update` refreshes what the harness installed, adds what a newer release introduced, and puts back harness parts that went missing — a hook script, a server in `.mcp.json`, a section of `AGENTS.md` — while what you dropped with `--without` stays out. It never installs a CLI you did not choose — installing adds a CLI, and only `uninstall` takes one away. `update --only skills` limits it to one group.

In a terminal, `uninstall` offers three choices — one CLI, selected assets, or everything — and `--dry-run` shows the plan first. It never deletes `.claude/`, `.codex/`, or `.opencode/`: each is moved aside as `<dir>.backup-<ts>`, so files you put there yourself stay in the backup.

**Safe on an existing project.** Before replacing a file you edited, the harness writes a timestamped backup next to it and prints the path. Nothing you wrote or edited is deleted without a backup beside it, and your existing `.mcp.json` servers are merged, not replaced ([installing into an existing project](docs/USAGE.md#installing-into-an-existing-project)).

**Your project only.** Nothing goes to `~/.opencode/`, `~/.gemini/`, or global npm. Two opt-in exceptions write outside the project: Claude Code plugins (the `claude` CLI keeps its plugin cache under `~/.claude/plugins/` and isolates projects by metadata), and `--with-codex-trust`, which adds one `[projects]` trust entry to `~/.codex/config.toml` so Codex reads its project config ([details](docs/USAGE.md#scope)). Besides `.claude/`, install writes `CLAUDE.md`/`AGENTS.md` scaffolds and their harness anchor, `.mcp.json`, a few `.gitignore` lines (when that file exists), an `.env.example` on `csr-supabase` (and `full`), `.github/workflows/` only with `--with ci-scaffold`, and its own record at `.uzys-agent-harness/` — [the full list](docs/USAGE.md#what-the-harness-writes).

## Already using another tool?

| You want… | Use |
|---|---|
| The whole harness — rules, hooks, agents, and the skills your stack calls for | The wizard above |
| One skill from this repo, nothing else | `npx skills add uzysjung/uzys-agent-harness --skill <id> -a claude-code` |

Every skill this repo ships is installable on its own with the [skills CLI](https://github.com/vercel-labs/skills) — the same files the installer copies, `references/` included. `npx skills add uzysjung/uzys-agent-harness --list` shows the ids ([details](docs/USAGE.md#one-skill-without-the-harness)); they are also listed on [skills.sh/uzysjung/uzys-agent-harness](https://skills.sh/uzysjung/uzys-agent-harness).

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
