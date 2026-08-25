# Compatibility & Verification

This harness installs curated assets — plugins, skills, and rules — into your project.
This page answers one question: **which of those installs are actually tested, and which
are not.**

The four command-line agents involved are **Claude Code**, **Codex**, **OpenCode**, and
**Antigravity**. Not every asset reaches all four; the table below says which reaches which,
and the rule that decides it is [described below](#which-agents-an-asset-reaches).

## What we verify

- **The install command really runs.** Assets are installed inside throwaway Docker
  containers, and the run has to exit cleanly and leave the expected files behind. Nothing
  touches the global configuration on the machine running the test.
- **It keeps working.** A monthly CI job re-installs the whole catalog. If an upstream
  plugin is deleted or renamed, or a package disappears from the registry, the job fails.
- **Packages exist.** For assets delivered as ordinary npm packages, we confirm the exact
  pinned version resolves in the public registry.
- **Files land where they belong.** For assets that ship from this repository as templates,
  CI checks that install writes the right content to the right path for each agent.

**45/60 assets are 🟢 verified by a real install; the remaining 15 assets are 🟡 — templates shipped from this repository, among them dev-method 6 skills, where CI verifies file placement instead.**

Per-asset status is in the generated table below, one row per asset.

## What we do NOT verify

This is the honest boundary. Everything above stops at *installed and discoverable*.

- **That the asset does its job.** We do not run the skill, prompt, or plugin and judge the
  output. Installation succeeding says nothing about quality.
- **That your agent loads it natively.** Whether Codex, OpenCode, or Antigravity actually
  surfaces an installed `SKILL.md` as a usable command is each vendor's own behaviour, and
  it can change without notice. We verify the file is written; we do not verify the agent
  picks it up.
- **That generated CI workflows run.** For scaffolded GitHub Actions files we check the
  YAML is generated and parses. Running them requires your repository, so it is untested here.
- **Asset contents.** We do not scan third-party assets for prompt injection or malicious
  instructions. That is a roadmap item, not a current guarantee — see the next section for
  what we do instead.

## How assets are vetted

We curate rather than scan, in four layers:

1. **Trust tier.** Every asset is `official` (published by Anthropic or by this project),
   `vetted` (1,000+ GitHub stars and actively maintained), or `experimental` (below that
   bar — opt-in only, and the installer warns). A monthly job re-reads real star counts and
   fails if a label has drifted from reality.
2. **Upstream review.** Assets from an official marketplace inherit that marketplace's own
   screening. For those, we depend on the publisher.
3. **The advertised command is the real command.** Every install command in this catalog is
   checked against the registry or marketplace it claims to come from.
4. **Version pinning.** npm-delivered assets are pinned to an exact version, because vetting
   happens at a point in time and `@latest` would run code nobody reviewed. A regression test
   fails the build if any pin is loosened.

**Known gap, stated plainly:** plugin- and skill-delivered assets cannot be pinned — their
install CLIs have no version flag, so they fetch whatever upstream currently publishes. For
those, layers 1 and 2 are all that stand behind them.

## Which agents an asset reaches

The delivery method decides it — there is no separate list to drift out of sync:

| Delivery method | Reaches |
|---|---|
| Plugin (`claude plugin …`) | **Claude Code only.** The install shells out to Claude Code's own plugin command. |
| Skill (`npx skills add`) | **All four.** The skills CLI takes an `--agent` flag and writes each agent's layout. |
| npm / npx | **Agent-independent.** These are standalone tools that run in any terminal. |
| Templates from this repository | **All four.** Install renders the equivalent config for each agent. |

A test compares every row of the table below against the code that makes this decision, so a
stale row fails the build rather than misleading you.

## Full catalog

<!-- AUTO-GEN:CATALOG:START -->

> **Generated** by `scripts/gen-compatibility.mjs` — do not edit by hand. assets **60** (official 22 / vetted 36 / experimental 2) · 🟢 verified **45/60**. Tier source of truth: `src/external-assets.ts`; drift watcher: `trust-tier-drift.yml`.
>
> **🟢 = installability proven by running the real install** (Docker container or registry lookup, decided by delivery method). The date 2026-06-06 is when the verification batch ran — **not a per-asset verification date**. Per-asset history is in the [CHANGELOG](../CHANGELOG.md).

#### 🔄 Workflow (16)

| id | tier | install target | reaches | verified |
|---|---|---|---|---|
| `ci-scaffold` | official | templates (`--with ci-scaffold`) | 4-CLI (templates) | 🟡 local |
| `compaction-handoff` | official | templates (`--with compaction-handoff`) | Claude · Codex · Antigravity (skill) · OpenCode (cmd) | 🟡 local |
| `clear-korean-communication` | official | templates (`--with clear-korean-communication`) | Claude · Codex · Antigravity (skill) · OpenCode (cmd) | 🟡 local |
| `north-star` | official | templates (`--with north-star`) | Claude · Codex · Antigravity (skill) · OpenCode (cmd) | 🟡 local |
| `recurrence-prevention` | official | templates (`--with recurrence-prevention`) | Claude · Codex · Antigravity (skill) · OpenCode (cmd) | 🟡 local |
| `gh-issue-workflow` | official | templates (`--with gh-issue-workflow`) | Claude · Codex · Antigravity (skill) · OpenCode (cmd) | 🟡 local |
| `model-orchestration` | official | templates (`--with model-orchestration`) | Claude · Codex · Antigravity (skill) · OpenCode (cmd) | 🟡 local |
| `task-brief` | official | templates (`--with task-brief`) | Claude · Codex · Antigravity (skill) · OpenCode (cmd) | 🟡 local |
| `audit-harness-fit` | official | templates (`--with audit-harness-fit`) | Claude · Codex · Antigravity (skill) · OpenCode (cmd) | 🟡 local |
| `superpowers` | official | `superpowers@claude-plugins-official` | Claude Code (plugin) | 🟢 Docker |
| `feature-dev` | official | `feature-dev@claude-plugins-official` | Claude Code (plugin) | 🟢 Docker |
| `addy-agent-skills` | vetted | `agent-skills@addy-agent-skills` | Claude Code (plugin) | 🟢 Docker |
| `wshobson-agents` | vetted | `full-stack-orchestration@claude-code-workflows` | Claude Code (plugin) | 🟢 Docker |
| `openspec` | vetted | `@fission-ai/openspec@1.4.1` (npm) | 4-CLI (npm) | 🟢 Docker |
| `bmad-method` | vetted | `bmad-method@6.9.0` (npx) | Claude Code (npx) | 🟢 Docker |
| `game-studios` | vetted | `Donchitos/Claude-Code-Game-Studios` | 4-CLI (skills.sh --agent) | 🟢 Docker |

#### 🎨 Frontend (10)

| id | tier | install target | reaches | verified |
|---|---|---|---|---|
| `tauri-desktop` | official | templates (`--with tauri-desktop`) | 4-CLI (templates) | 🟡 local |
| `frontend-design` | official | `anthropics/skills :: frontend-design` | 4-CLI (skills.sh --agent) | 🟢 Docker |
| `jakubkrehel-skills` | vetted | `jakubkrehel/skills` | 4-CLI (skills.sh --agent) | 🟢 Docker |
| `taste-skill` | vetted | `Leonxlnx/taste-skill :: taste-skill` | 4-CLI (skills.sh --agent) | 🟢 Docker |
| `scroll-world` | vetted | `oso95/scroll-world :: scroll-world` | 4-CLI (skills.sh --agent) | 🟢 Docker |
| `preline` | vetted | `htmlstreamofficial/preline :: theme-generator` | 4-CLI (skills.sh --agent) | 🟢 Docker |
| `react-best-practices` | vetted | `vercel-labs/agent-skills :: vercel-react-best-practices` | 4-CLI (skills.sh --agent) | 🟢 Docker |
| `shadcn-ui` | vetted | `shadcn/ui :: shadcn` | 4-CLI (skills.sh --agent) | 🟢 Docker |
| `web-design-guidelines` | vetted | `vercel-labs/agent-skills :: web-design-guidelines` | 4-CLI (skills.sh --agent) | 🟢 Docker |
| `game-engine` | vetted | `github/awesome-copilot :: game-engine` | 4-CLI (skills.sh --agent) | 🟢 Docker |

#### 🗄️ Backend (6)

| id | tier | install target | reaches | verified |
|---|---|---|---|---|
| `vercel-cli` | vetted | `vercel@54.17.3` (npm) | 4-CLI (npm) | 🟢 registry |
| `netlify-cli` | vetted | `netlify-cli@26.1.0` (npm) | 4-CLI (npm) | 🟢 registry |
| `supabase-cli` | vetted | `supabase@2.108.0` (npm) | 4-CLI (npm) | 🟢 registry |
| `supabase-agent-skills` | vetted | `supabase@supabase-agent-skills` | Claude Code (plugin) | 🟢 Docker |
| `postgres-best-practices` | vetted | `postgres-best-practices@supabase-agent-skills` | Claude Code (plugin) | 🟢 Docker |
| `railway-skills` | experimental | `railway@railway-skills` | Claude Code (plugin) | 🟢 Docker |

#### 📊 Data (1)

| id | tier | install target | reaches | verified |
|---|---|---|---|---|
| `anthropic-data-plugin` | official | `data@knowledge-work-plugins` | Claude Code (plugin) | 🟢 Docker |

#### 💼 Business (3)

| id | tier | install target | reaches | verified |
|---|---|---|---|---|
| `anthropic-document-skills` | official | `document-skills@anthropic-agent-skills` | Claude Code (plugin) | 🟢 Docker |
| `finance-skills` | vetted | `finance-skills@claude-code-skills` | Claude Code (plugin) | 🟢 Docker |
| `marketingskills` | vetted | `marketing-skills@marketingskills` | Claude Code (plugin) | 🟢 Docker |

#### 🛡️ Dev Tools (9)

| id | tier | install target | reaches | verified |
|---|---|---|---|---|
| `audit-service-gaps` | official | templates (`--with audit-service-gaps`) | Claude · Codex · Antigravity (skill) · OpenCode (cmd) | 🟡 local |
| `verification-loop` | official | templates (`--with verification-loop`) | Claude · Codex · Antigravity (skill) · OpenCode (cmd) | 🟡 local |
| `multi-persona-review` | official | templates (`--with multi-persona-review`) | Claude · Codex · Antigravity (skill) · OpenCode (cmd) | 🟡 local |
| `external-model-consult` | official | templates (`--with external-model-consult`) | Claude · Codex · Antigravity (skill) · OpenCode (cmd) | 🟡 local |
| `code-review` | official | `code-review@claude-plugins-official` | Claude Code (plugin) | 🟢 Docker |
| `security-guidance` | official | `security-guidance@claude-plugins-official` | Claude Code (plugin) | 🟢 Docker |
| `find-skills` | vetted | `vercel-labs/skills :: find-skills` | 4-CLI (skills.sh --agent) | 🟢 Docker |
| `product-skills` | vetted | `product-skills@claude-code-skills` | Claude Code (plugin) | 🟢 Docker |
| `trailofbits-skills` | vetted | `differential-review@trailofbits` | Claude Code (plugin) | 🟢 Docker |

#### 🧠 Understanding (4)

| id | tier | install target | reaches | verified |
|---|---|---|---|---|
| `agent-browser` | vetted | `agent-browser@0.31.0` (npm) | 4-CLI (npm) | 🟢 registry |
| `claude-video` | vetted | `watch@claude-video` | Claude Code (plugin) | 🟢 Docker |
| `understand-anything` | vetted | `understand-anything@understand-anything` | Claude Code (plugin) | 🟢 Docker |
| `agentmemory` | vetted | `agentmemory@agentmemory` | Claude Code (plugin) | 🟢 Docker |

#### 🎬 Visual & Media (9)

| id | tier | install target | reaches | verified |
|---|---|---|---|---|
| `frontend-slides` | vetted | `frontend-slides@frontend-slides` | Claude Code (plugin) | 🟢 Docker |
| `marp-slide` | vetted | `softaworks/agent-toolkit :: marp-slide` | 4-CLI (skills.sh --agent) | 🟢 Docker |
| `mermaid-diagrams` | vetted | `softaworks/agent-toolkit :: mermaid-diagrams` | 4-CLI (skills.sh --agent) | 🟢 Docker |
| `gsap-skills` | vetted | `gsap-skills@gsap-skills` | Claude Code (plugin) | 🟢 Docker |
| `remotion` | vetted | `remotion-dev/skills :: remotion-best-practices` | 4-CLI (skills.sh --agent) | 🟢 Docker |
| `ppt-master` | vetted | `hugohe3/ppt-master :: ppt-master` | 4-CLI (skills.sh --agent) | 🟢 Docker |
| `ppt-generation` | vetted | `bytedance/deer-flow :: ppt-generation` | 4-CLI (skills.sh --agent) | 🟢 Docker |
| `web-video-presentation` | vetted | `ConardLi/garden-skills :: web-video-presentation` | 4-CLI (skills.sh --agent) | 🟢 Docker |
| `revealjs` | experimental | `ryanbbrown/revealjs-skill :: revealjs` | 4-CLI (skills.sh --agent) | 🟢 Docker |

#### 📦 ECC Suite (2)

| id | tier | install target | reaches | verified |
|---|---|---|---|---|
| `ecc-prune` | official | `scripts/prune-ecc.sh` | Claude Code (local script) | 🟡 local |
| `ecc-plugin` | vetted | `ecc@ecc` | Claude Code (plugin) | 🟢 Docker |

<!-- AUTO-GEN:CATALOG:END -->

## Evidence

- Real-install runs: `docs/research/realcli-workflows-verification-2026-06-06.md` and
  `docs/research/realcli-verification-2026-05-31.md`.
- Re-verification jobs: `.github/workflows/catalog-verify.yml` and
  `.github/workflows/trust-tier-drift.yml`; the checker itself is `scripts/verify-catalog.mjs`.
- The table above is regenerated with `npm run gen:compat`; editing it by hand fails the build.
- Verification is a snapshot, but a **repeatable** one — every claim on this page is produced
  by a command you can run.
