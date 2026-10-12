# 26.100.0-codex-B — Codex Agent Guide

## Project Context

## Identity & Purpose

MINE-CONTEXT: payments reconciliation service for ACME.

_(not filled yet — what this project is, who it is for, and why it exists)_

## Stack & Commands

<!-- FILL:stack — Replace the list below with this project's REAL stack. Inspect package.json / pyproject.toml / go.mod / Cargo.toml / Gemfile + lockfiles and any Makefile/justfile/package scripts. List the language(s)+versions, framework(s), package manager, and the exact install/build/test/run commands. Verify each command exists before writing it — never guess. Delete lines that do not apply, then delete this comment. -->

_(not filled yet — languages, runtimes, package manager, and the install/build/test/run commands)_

## Architecture & Layout

<!-- FILL:architecture — Map this repository. List each top-level source directory and what it holds, the entry point(s), the 3-5 files a newcomer reads first, and how data/requests flow between the main layers. View the real tree (e.g. `git ls-files | sed 's#/.*##' | sort -u`) — do not assume a framework's conventional layout. Flag any generated/vendored directories that must never be hand-edited. If this is a single small module, say so in one line. Delete this comment when done. -->

_(not filled yet — where things live, the entry points, and how data flows between layers)_

## Installed Harness Assets

<!-- FILL:installed-assets — List the harness assets installed in this project (rules / skills / agents / commands) and add one line each on when to reach for it here. Verify against .claude/rules/*.md, .claude/skills/, .claude/agents/, .claude/commands/ (or this CLI's equivalent) and list ONLY assets whose file exists on disk — do not invent any. Do NOT restate the universal Rule 1-12 (they live in the rules layer) — cross-reference them instead. Delete this comment when done. -->

_(not filled yet — the installed rules/skills/agents/commands and when to use each)_

## Boundaries — Always / Ask First / Never

<!-- FILL:boundaries — Fill the Always / Ask First / Never lists with this repo's real red lines. Read the CI config, CODEOWNERS, .gitignore, and release/deploy scripts. Never must include secrets, generated files, force-push, and direct commits to the default branch, plus any repo-specific "do not touch" directories. Every entry must be specific and enforceable here. Delete this comment when done. -->

_(not filled yet — what to always do, ask before doing, and never do in this repo)_

## Verification Gate

<!-- FILL:verify — State the single command (or short sequence) that PROVES a change is safe here — the test/lint/typecheck/build gate you run before committing — plus the coverage/CI threshold and what "done" means. Sources: package scripts, CI workflow files, CONTRIBUTING. An agent must be able to self-verify without guessing. Delete this comment when done. -->

_(not filled yet — the single command that proves a change is safe, and the done bar)_

## MINE Top Section

MINE-TOP: team conventions first.

## Rule 2 — Simplicity First
Minimum code that solves the problem. Nothing speculative.
No features beyond what was asked. No abstractions for single-use code.
Test: would a senior engineer say this is overcomplicated? If yes, simplify.
MINE-EDIT-ANCHOR: we also require a changelog line per PR.

## MINE MIDA Section

MINE-MIDA: our own middle rules.

## MINE MIDB Section

MINE-MIDB: our own middle rules.

## Protected Files (DO NOT EDIT)

Codex `sandbox_mode = "workspace-write"` + `approval_policy = "on-request"` 가 1차 방어. LLM 추가 준수:

- `.env*`
- `**/credentials.json`
- `*.lock`, `package-lock.json`, `pnpm-lock.yaml`, `poetry.lock`, `Cargo.lock`, `uv.lock`
- `.git/` 내부 파일 (커밋 메시지/hook 제외)
- `~/.codex/`, `~/.claude/` 글로벌 (D16 보호)

보호 영역 이슈 발견 시 **보고만**. 직접 수정 금지.
- MINE-EDIT-NAMED: secrets/ directory too

## Experience Accumulation

- Codex `memories` feature (experimental) — Claude auto memory 유사
- 검증된 learning만 Rules 승격
MINE-EDIT-TAIL: our team adds this line.

## MINE Copied Guidance
autocompact enabled. Consider manual /compact when reaching 50%.
Re-reference SPEC/PRD at the start of every session (Persistent Anchor).
On phase transitions, do a structured state handoff. Keep SPEC/PRD/TODO current.

## MINE End Section

MINE-END: last words.
