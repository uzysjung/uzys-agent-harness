# uzys-claude-harness

> Claude Code agent harness — 6-gate workflow, 11 tracks, project-scope by default.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/github/v/tag/uzysjung/uzys-claude-harness?label=version)](https://github.com/uzysjung/uzys-claude-harness/releases)
[![CI](https://github.com/uzysjung/uzys-claude-harness/actions/workflows/test.yml/badge.svg)](https://github.com/uzysjung/uzys-claude-harness/actions)

🇰🇷 [README.ko.md](./README.ko.md)

## Install

```bash
npx -y github:uzysjung/uzys-claude-harness
```

Interactive wizard guides you through 6 steps: tracks → CLI → install items → scope → confirm → install. No flags needed.

```bash
# After install:
claude
> /uzys:spec
> /uzys:auto
```

## Tracks

Pick one (or multiple) at step 1.

### Dev
| Track | Stack |
|---|---|
| `csr-supabase` | Vite + React + Supabase |
| `csr-fastify` | Vite + React + Fastify |
| `csr-fastapi` | Vite + React + FastAPI |
| `ssr-nextjs` | Next.js (App Router) |
| `ssr-htmx` | HTMX + server-side |
| `data` | DuckDB + Polars + PySide6 |
| `full` | union of all dev tracks |

### Business
| Track | Use |
|---|---|
| `executive` | proposals, DD, decks, financial models |
| `project-management` | PM workflow |
| `growth-marketing` | growth + content marketing |

### Meta
| Track | Use |
|---|---|
| `tooling` | Bash + Markdown meta-projects |

## Install items

Step 3 shows recommended items grouped by category. Toggle anything.

| Category | Examples |
|---|---|
| **Frontend** | shadcn-ui, react-skill, frontend-design |
| **Backend** | supabase, fastapi-skill |
| **Data** | polars, dask, python-data, python-ml |
| **Business** | strategist, pm-skills, c-level-strategy |
| **Dev Tools** | playwright, agent-browser, ADR, find-skills |
| **Workflow** | uzys-harness 6-Gate, addy-agent-skills, superpowers, gsd |
| **ECC** | code-reviewer, security-reviewer, continuous-learning-v2, eval-harness |

Recommendations are computed from your track selection; you adjust before install.

## Scope (v26.64.0)

Wizard asks at step 4. **Project is default** — no global write.

| | Project (default) | Global (opt-in) |
|---|---|---|
| `claude plugin` | `--scope project` (projectPath-isolated) | `--scope user` |
| `npx skills` | project node_modules | `-g` (user-level) |
| `npm` | `--save-dev` | `-g` |
| Codex prompts/skills/trust | `.codex/` (project) | `~/.codex/` |
| `~/.claude/skills`, `~/.codex/`, `~/.opencode/`, `npm -g` | **untouched** | written per asset |

Only `~/.claude/plugins/{cache,marketplaces,installed_plugins.json}` is written by claude CLI itself in both modes; the `installed_plugins.json` metadata isolates entries by `projectPath` so other projects are unaffected.

## Workflow (6-Gate)

```
/uzys:spec → /uzys:plan → /uzys:build → /uzys:test → /uzys:review → /uzys:ship
```

Each gate is enforced by hooks. Skipping a gate fails the next one (exit 2).

## Uninstall

```bash
npx -y github:uzysjung/uzys-claude-harness uninstall
```

Log-based reverse (`.claude/.harness-install.json`). Project-scope assets removed automatically; global-scope assets are listed for manual removal (D16 — no automatic global deletion).

Flags: `--dry-run`, `--keep-templates`.

## Advanced

- [docs/USAGE.md](./docs/USAGE.md) — workflow detail, asset matrix, CI flags, ECC, Codex/OpenCode integration
- [docs/NORTH_STAR.md](./docs/NORTH_STAR.md) — design principles
- [docs/decisions/](./docs/decisions/) — ADRs (architectural decisions)

## License

MIT.
