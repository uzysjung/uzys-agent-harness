# p-26.140.0-B — Codex Agent Guide

> **Generated from**: `.claude/CLAUDE.md` via `scripts/claude-to-codex.sh` (Phase C)
> **Codex Version**: 0.124.0+
> **Linked SPEC**: `docs/specs/codex-compat.md`

## Project Context

> ⚙️ **SCAFFOLD — not filled in yet.** The sections below are a fill-in template for THIS project, not verified facts.
> To fill: open this file and paste each `<!-- FILL: … -->` comment's instruction into your coding agent (e.g. Claude Code) — it will inspect the real repo and write the section. You can also fill them by hand; the comments are the instructions.
> The working principles live in this project's harness anchor — `.claude/CLAUDE.md` (Claude Code), `AGENTS.md` (Codex/OpenCode), or `.agents/rules/uzys-harness.md` (Antigravity). This file is **project-specific context only**.

## Identity & Purpose

<!-- FILL:identity — Replace the H1 title above with this project's real name, then state in 1-2 plain sentences what it does, who uses it, and why it exists. Sources: README.md, the package.json / pyproject.toml "description", docs/. Do NOT describe the harness itself. Delete this comment when done. -->

_(not filled yet — what this project is, who it is for, and why it exists)_

## Stack & Commands

<!-- FILL:stack — Replace the list below with this project's REAL stack. Inspect package.json / pyproject.toml / go.mod / Cargo.toml / Gemfile + lockfiles and any Makefile/justfile/package scripts. List the language(s)+versions, framework(s), package manager, and the exact install/build/test/run commands. Verify each command exists before writing it — never guess. Delete lines that do not apply, then delete this comment. -->

_(not filled yet — languages, runtimes, package manager, and the install/build/test/run commands)_

## Architecture & Layout

<!-- FILL:architecture — Map this repository. List each top-level source directory and what it holds, the entry point(s), the 3-5 files a newcomer reads first, and how data/requests flow between the main layers. View the real tree (e.g. `git ls-files | sed 's#/.*##' | sort -u`) — do not assume a framework's conventional layout. Flag any generated/vendored directories that must never be hand-edited. If this is a single small module, say so in one line. Delete this comment when done. -->

_(not filled yet — where things live, the entry points, and how data flows between layers)_

## Installed Harness Assets

<!-- FILL:installed-assets — List the harness assets installed in this project (rules / skills / agents / commands) and add one line each on when to reach for it here. Verify against .claude/rules/*.md, .claude/skills/, .claude/agents/, .claude/commands/ (or this CLI's equivalent) and list ONLY assets whose file exists on disk — do not invent any. Do NOT restate the harness's working principles (they live in this project's harness anchor and rules layer) — cross-reference them instead. Delete this comment when done. -->

_(not filled yet — the installed rules/skills/agents/commands and when to use each)_

## Boundaries — Always / Ask First / Never

<!-- FILL:boundaries — Fill the Always / Ask First / Never lists with this repo's real red lines. Read the CI config, CODEOWNERS, .gitignore, and release/deploy scripts. Never must include secrets, generated files, force-push, and direct commits to the default branch, plus any repo-specific "do not touch" directories. Every entry must be specific and enforceable here. Delete this comment when done. -->

_(not filled yet — what to always do, ask before doing, and never do in this repo)_

## Verification Gate

<!-- FILL:verify — State the single command (or short sequence) that PROVES a change is safe here — the test/lint/typecheck/build gate you run before committing — plus the coverage/CI threshold and what "done" means. Sources: package scripts, CI workflow files, CONTRIBUTING. An agent must be able to self-verify without guessing. Delete this comment when done. -->

_(not filled yet — the single command that proves a change is safe, and the done bar)_

## Project Rules

These are decision principles, not an exhaustive procedure. These principles
apply by default. Project-specific policy may refine them. Do not infer approval
for destructive, privileged, or shared-state operations from a broad task
request.

## 1. Think before coding

Do not hide material uncertainty.

Before editing, inspect the affected implementation, tests, callers, and
interfaces. Resolve questions from the repository before asking the user. When
the answer lies outside the repository and you do not know it, research it
before planning. Do not guess at external behavior, specifications, or failure
modes.

If an unresolved choice could materially change behavior, data, security,
cost, or scope and would be expensive to correct later, surface the options
and their material trade-offs, then ask before building on it. Otherwise,
state the assumption, choose a reasonable interpretation, and proceed.
When independent lanes disagree, or the call is genuinely uncertain and expensive to reverse, settle
it with an adversarial panel of independent reviewers rather than the loudest lane; on smaller calls
take the better-evidenced answer, since a panel costs more than the decision is worth.

State uncertainty plainly. Do not present assumptions or judgments as evidence.

Mention a simpler sufficient approach when one exists. Push back when the
requested approach conflicts with the stated goal, contract, or security
boundary.

## 2. Prefer the simplest sufficient solution

Write the minimum code that satisfies the request.

- Do not add unrequested features.
- Do not introduce abstractions for one use.
- Do not add speculative configurability.
- Do not add defensive code without a credible failure mode, contract,
  trust boundary, or security requirement.

Could the same completion criteria be met with fewer concepts, branches, or
abstractions? If yes, simplify.

Prefer the most direct implementation a reader can follow without explanation.
Clarity is part of sufficiency, not a separate concern. Among approaches that
are equally sufficient, take the one that reaches a verified result soonest.

Prefer behavior that can be specified, reproduced, and tested. Brevity is not
simplicity when it makes behavior non-reproducible.

## 3. Make surgical changes and preserve existing work

Change only what the request requires and what is necessarily caused by
implementing or verifying it.

Do not refactor, reformat, rewrite, or delete unrelated code. Match the
existing local style even when you would design it differently. Remove only
artifacts made obsolete by your own change.

Leave unrelated dead code untouched. Report it separately only if it
materially affects the task or its verification.

Pre-existing worktree changes belong to the user. Do not overwrite, revert,
stage, or reformat them. If they overlap the target area and safe editing is
unclear, stop and report the conflict.

Contracts, security boundaries, and intentionally tested behavior take
precedence over local convention.

## 4. Define success before editing

Translate the request into observable completion criteria and decide how each
criterion will be verified.

For reproducible behavior changes and bug fixes, prefer a regression test at
a stable contract boundary. If automated testing is impractical, state why
and define the strongest available alternative verification before editing.

For multi-step work, state a short plan with a verification point for each
major step.

Start with targeted verification and broaden it according to the risk of the
change.

Run the defined checks and iterate until the completion criteria pass. If
further progress is blocked, report precisely what remains unmet and why
rather than weakening or silently dropping the criteria.

Delegate review to an agent other than the one that produced the work.
Required, not optional, at two points: a completed spec, plan, or design
document before it is built on, and any change before deployment. Give the
reviewer the completion criteria. Delegated review supplements your own verification; it does not
replace it. A reviewer verifies the work itself rather than trusting the author's report. At those
two points an unreviewed artifact is not verified.

## 5. Report evidence, not confidence

Report what changed, what was verified, what was not verified, and what
remains.

Do not claim `Pass`, `Works`, or `Completed` without corresponding evidence.
A completion criterion that was not verified is not complete. Relevant broader
checks that were not run must be disclosed, but do not invalidate verified
completion by themselves.

If repeated attempts stop producing new evidence, stop and provide a concise
handoff rather than continuing blindly.

## 6. Do not cross high-impact boundaries alone

Before executing a destructive, privileged, or shared-state operation, state
the exact action and target and obtain explicit approval. Do not infer approval
from a general objective.

Preparing a migration, deployment change, or other reviewable artifact is not
the same as applying it to shared or persistent state.

## Decisions and explanations

Present a decision or approval request as AS-IS → TO-BE with a recommendation and the trade-off, not
as prose. Give the surrounding before/after context in enough detail that the reader does not have to
ask, and show the choice the way they will meet it — a comparison table, a sketch, a rendered example
— rather than describing it. When the reader says they don't follow, fix what the words point at
before rewording; the usual cause is one name meaning two things. Where the `asis-tobe-decision` and
`explain-plainly` skills are installed, use them for this.

## Session Start

매 세션 시작 시:
1. `git pull --rebase`
2. `docs/SPEC.md` 및 `docs/specs/*.md` 재참조 (Persistent Anchor)
3. `docs/todo.md` 현재 Phase 확인

`session_start` hook이 자동 수행. Hook 실패 시 수동 수행.

## Protected Files (DO NOT EDIT)

Codex `sandbox_mode = "workspace-write"` + `approval_policy = "on-request"` 가 1차 방어. LLM 추가 준수:

- `.env*`
- `**/credentials.json`
- `*.lock`, `package-lock.json`, `pnpm-lock.yaml`, `poetry.lock`, `Cargo.lock`, `uv.lock`
- `.git/` 내부 파일 (커밋 메시지/hook 제외)
- `~/.codex/`, `~/.claude/` 글로벌 (D16 보호)

보호 영역 이슈 발견 시 **보고만**. 직접 수정 금지.

## Git Policy

- 코드/문서 변경 시 **즉시 commit**. "나중에 한꺼번에" 금지.
- `main` 직접 커밋 금지. feature branch 사용.
- 세션 시작 시 `git pull` 필수.
- Conventional Commits — `<type>: <description>` (feat, fix, refactor, docs, test, chore, perf, ci)

## Agents (subagent, multi_agent stable)

| Agent | Model | 역할 |
|-------|-------|------|
| reviewer | opus | 검증 전용 (SOD). 5축 리뷰 |
| data-analyst | opus | Python / DuckDB / Trino / ML / PySide6 |
| strategist | opus | 제안서 / DD / PPT / 경쟁분석 / 재무모델 |
| code-reviewer | sonnet | 일상적 코드 리뷰 |
| security-reviewer | sonnet | OWASP Top 10, 보안 패턴 |

subagent 호출은 `spawn_agent / wait_agent / close_agent` 툴. 부모 컨텍스트 격리.

## Hooks 현황 (Codex 0.124.0 실측 제약)

- `pre_tool_use` / `post_tool_use` — **Bash 툴 한정 발화** (Issue #16732). ApplyPatch(파일 쓰기) 가로채기는 불가. `sandbox_mode` + `approval_policy`로 대체 보호.
- 프로젝트 `.codex/config.toml` 훅은 사용자 `~/.codex/config.toml`에 trust entry 등록된 경우에만 로드.
- 인터랙티브 세션 hook 로딩 bug (Issue #17532) 존재 가능 — `codex exec` 비대화형은 정상.

## Experience Accumulation

- Codex `memories` feature (experimental) — Claude auto memory 유사
- 검증된 learning만 Rules 승격

## Context Management

- SPEC/PRD 매 세션 시작 시 재참조 (Persistent Anchor)
- `child_agents_md` feature flag는 **under development, disabled** — AGENTS.md 디렉토리 계층 merge 사용 불가. 글로벌 `~/.codex/AGENTS.md` + 프로젝트 `AGENTS.md` 2단만 사용.

---

*이 문서는 자동 생성됨. 수동 편집 시 `scripts/claude-to-codex.sh` 재실행이 덮어쓸 수 있음. 원본은 `.claude/CLAUDE.md` 또는 `templates/CLAUDE.md`.*
