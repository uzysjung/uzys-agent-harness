# ADR-023: Remove the uzys 6-Gate workflow (BREAKING)

- **Status**: Accepted
- **Date**: 2026-06-26
- **PR**: (this PR)
- **Supersedes**: ADR-011 (uzys-harness 6-Gate opt-in), ADR-017 (codex-prompts-uzys-coupling), ADR-018 (codex-uzys-mapping-complete). Partially supersedes ADR-012 (codex-prompts-default — the uzys-prompt portion).

## Context

The uzys 6-Gate workflow — the `/uzys:spec /plan /build /test /review /ship` (+ `/uzys:auto`)
slash commands, the `gate-check.sh` / `agentshield-gate.sh` hooks, the `.claude/gate-status.json`
state machine, and the per-CLI mappings (Codex `.agents/skills/uzys-*` + `.codex/prompts/uzys-*`,
OpenCode `.opencode/commands/uzys-*` + `uzys-harness.ts` plugin, Antigravity `.agents/skills` +
`.agents/workflows/uzys-*`) — was made opt-in in ADR-011 (v26.44.0) via `withUzysHarness`, later
internalized as the `uzys-harness` asset in ADR-022 (v26.81.0).

A multi-persona audit found the opt-in gating was **incomplete**: only the Claude `/uzys:*`
commands were gated on `withUzysHarness`. The surrounding machinery leaked even when the workflow
was NOT selected — `ALWAYS_HOOKS` carried `gate-check.sh` + `agentshield-gate.sh` unconditionally;
`session-start.sh` advertised `/uzys:spec`; `install-render` printed "6-Gate order"; agent
descriptions and project-CLAUDE fragments documented the gate; and the OpenCode transform emitted
the full `/uzys-*` command set + plugin to **every** user regardless of selection. This is a
no-false-ship violation (advertising a feature that may not be installed).

Rather than complete the gating, the maintainer decided to **remove the feature entirely** — its
value no longer justified the cross-surface maintenance cost across four CLIs.

## Decision

Completely remove the uzys 6-Gate workflow:

- Delete the `uzys-harness` asset, all `templates/commands/uzys/*`, `gate-check.sh`,
  `agentshield-gate.sh`, `.claude/gate-status.json`, the OpenCode `uzys-harness.ts` plugin, and the
  pre-staged Codex/OpenCode uzys stubs.
- Remove `AssetSpec.withUzysHarness` + all manifest gating; strip uzys emission from the Codex /
  OpenCode / Antigravity transforms (their dev-method-skill output is unaffected).
- Remove the now-dead global opt-in flags `withCodexSkills` / `withCodexPrompts` /
  `withAntigravityGlobal` (and CLI flags `--with-codex-skills` / `--with-codex-prompts` /
  `--no-codex-prompts` / `--with-antigravity-global`). `runCodexOptIn` is reduced to
  `~/.codex/config.toml` trust-entry registration (`--with-codex-trust` kept — general, not 6-Gate).
- Delete dead render helpers `renderSkill`, `renderCommand`, `renderCodexPrompt`.
- Remove the 6-Gate from README / README.ko / USAGE / WORKFLOWS / NORTH_STAR / COMPATIBILITY and
  from this repo's own `.claude/` dogfooding config.

## Alternatives

1. **Complete the gating** (gate every hook/agent/transform on `withUzysHarness`). Rejected: keeps a
   high-surface-area feature the maintainer no longer wants, across four CLIs.
2. **Keep machinery inert** (remove emission, leave flags as no-ops). Rejected: dead flags advertising
   a removed feature is itself a no-false-ship smell ("깔끔하게 정리" requirement).

## Consequences

- **BREAKING**: `/uzys:*` slash commands no longer exist; `--with uzys-harness` and the four global
  opt-in flags are removed. Asset catalog count 58 → 57 (official 12 → 11).
- This repo no longer dogfoods the 6-Gate for its own development; `ship-checklist.md` / `git-policy.md`
  reword `/uzys:ship|review|test` references to plain process steps.
- **Explicitly preserved** (not 6-Gate): the dev-method skills (`multi-persona-review`,
  `gap-analysis-e2e`, `ultracode-service-audit`, `asis-tobe-decision`, `compaction-handoff`,
  `northstar-roadmap`); `tauri-desktop`; the `reviewer` / `plan-checker` agents (gate references
  removed, agents kept); the general hooks `session-start` / `spec-drift-check` / `checkpoint-snapshot`
  (gate-coupled lines removed, general behavior kept); `gates-taxonomy.md` (general gate taxonomy,
  unrelated to `/uzys:`); `withCodexTrust`; the Antigravity `.agents/rules/uzys-harness.md` project-context
  rule (CLAUDE.md content — filename retained).
