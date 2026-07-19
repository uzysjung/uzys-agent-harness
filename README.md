# uzys-agent-harness

Install vetted AI-coding skills, plugins, rules, and hooks for Claude Code, Codex, OpenCode, and Antigravity — one interactive wizard, scoped to your project.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/github/v/tag/uzysjung/uzys-agent-harness?label=version)](https://github.com/uzysjung/uzys-agent-harness/releases)
[![CI](https://github.com/uzysjung/uzys-agent-harness/actions/workflows/test.yml/badge.svg)](https://github.com/uzysjung/uzys-agent-harness/actions)

![agent-harness demo — one-command install of vetted AI-coding skills & plugins](https://raw.githubusercontent.com/uzysjung/uzys-agent-harness/main/docs/assets/agent-harness-demo.gif)

🇰🇷 [한국어](./README.ko.md)

---

## Install

```bash
npx -y @uzysjung/agent-harness
```

The wizard walks through six steps:

```
1/6  Tracks          pick your stack
2/6  CLI             claude / codex / opencode / antigravity
3/6  Install items   review pre-checked recommendations
4/6  Scope           Project (default) or Global
5/6  Confirm
6/6  Installing
```

Then start your CLI — skills, rules, and hooks are active:

```bash
claude    # or codex / opencode / agy
```

**Project scope is the default.** Nothing is written to `~/.claude/`, `~/.codex/`, `~/.opencode/`, `~/.gemini/`, or global npm unless you pick Global at step 4.

**Safe on an existing project.** Before replacing an editable file whose contents differ, the installer writes a timestamped backup next to it and prints every backup path in the summary. Nothing is deleted.

The wizard needs a TTY. For CI, containers, or onboarding scripts there is a flag-based mode — see the [usage guide](docs/USAGE.md#non-interactive-install).

What it installed is recorded, so you can review it and take it back out:

```bash
npx -y @uzysjung/agent-harness list        # what this project got
npx -y @uzysjung/agent-harness uninstall   # pick what to remove
```

Run in a terminal, `uninstall` asks what to take out — item by item, or everything. It reverses what it safely can and *prints* the rest — global assets, hook registrations, and files outside `.claude/` such as `.mcp.json` — instead of editing files that hold your own content. Unchecking something in the installer never removes it; removal only happens here. See [uninstall](docs/USAGE.md#uninstall-v26640).

## Why

Coding agents keep getting stronger on their own. But every skill and MCP you install sits in the context window each session whether you use it or not, and the awesome-lists carry hundreds of options with no way to tell which ones your stack actually calls for. So you either install everything and pay for it every session, or read through the lists yourself each time you start a project.

This tool starts from the stack instead. You pick a track, and it pre-checks the assets that track calls for — you review and uncheck before anything installs.

## What you get

- **Curation by tech stack.** Of the vetted options, you install only what this project calls for. Pick `csr-supabase` and step 3 pre-checks React, shadcn, Supabase, and Postgres assets — not the other sixty.

- **A discipline layer.** Rules, hooks, and CI scaffolds distilled from running real production projects with agents: doc governance, verification gates, benchmark-parity loops, recurrence prevention. This layer is what makes it a harness rather than a skill pack.

- **Four CLIs, one vocabulary.** Claude Code is first class — all assets, hooks, and plugins. Codex, OpenCode, and Antigravity get the skills and rules layer. Your project is not locked to one CLI.

## Vetting

An asset is **vetted** when it has at least 1,000 GitHub stars, shows active maintenance, and passes an install-verification run in an isolated Docker container. A CI cron re-checks all three monthly.

Vetting is **not** a line-by-line security audit, and it does not scan asset contents for prompt injection. npm and npx assets are version-pinned; plugin and skill assets resolve to upstream HEAD and are not commit-pinned yet.

Treat installed assets like any other third-party dependency — see [SECURITY.md](SECURITY.md).

Every asset carries its tier as a badge at step 3: **★ official** (Anthropic-official marketplaces and this harness's own assets), **vetted**, or **⚠ experimental** (under 1,000 stars, opt-in only). Tiers inform; they never block.

## Tracks

Eleven tracks, grouped by what you're building:

- **Frontend + backend** — `csr-supabase` · `csr-fastify` · `csr-fastapi` · `ssr-nextjs` · `ssr-htmx`
- **Data** — `data`
- **Business** — `executive` · `project-management` · `growth-marketing`
- **Meta** — `tooling` (Bash and Markdown projects with no app stack)
- **Everything** — `full`

### [See what each track installs →](docs/TRACKS.md)

## Docs

### [Read the usage guide →](docs/USAGE.md)

Workflow detail, install internals, uninstall, scope, CI flags, and per-CLI setup.

### [Check the compatibility matrix →](docs/COMPATIBILITY.md)

Per-asset install method and verification status.

### [Browse the tracks →](docs/TRACKS.md)

What each track pre-checks, asset by asset.

### [Read the security notes →](SECURITY.md)

What vetting covers, what it doesn't, and how to report an issue.

Workflow bundles are compared in [docs/WORKFLOWS.md](docs/WORKFLOWS.md); design principles live in [docs/NORTH_STAR.md](docs/NORTH_STAR.md); architecture decisions in [docs/decisions/](docs/decisions/).

## License

MIT.
