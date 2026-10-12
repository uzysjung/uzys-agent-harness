# p-26.100.0-A — Codex Agent Guide

> **Generated from**: `.claude/CLAUDE.md` via `scripts/claude-to-codex.sh` (Phase C)
> **Codex Version**: 0.124.0+
> **Linked SPEC**: `docs/specs/codex-compat.md`

## Project Context

> ⚙️ **SCAFFOLD — not filled in yet.** The sections below are a fill-in template for THIS project, not verified facts.
> To fill: open this file and paste each `<!-- FILL: … -->` comment's instruction into your coding agent (e.g. Claude Code) — it will inspect the real repo and write the section. You can also fill them by hand; the comments are the instructions.
> The universal harness rules (Rule 1–12) live in the separate rules layer. This file is **project-specific context only**.

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

<!-- FILL:installed-assets — List the harness assets installed in this project (rules / skills / agents / commands) and add one line each on when to reach for it here. Verify against .claude/rules/*.md, .claude/skills/, .claude/agents/, .claude/commands/ (or this CLI's equivalent) and list ONLY assets whose file exists on disk — do not invent any. Do NOT restate the universal Rule 1-12 (they live in the rules layer) — cross-reference them instead. Delete this comment when done. -->

_(not filled yet — the installed rules/skills/agents/commands and when to use each)_

## Boundaries — Always / Ask First / Never

<!-- FILL:boundaries — Fill the Always / Ask First / Never lists with this repo's real red lines. Read the CI config, CODEOWNERS, .gitignore, and release/deploy scripts. Never must include secrets, generated files, force-push, and direct commits to the default branch, plus any repo-specific "do not touch" directories. Every entry must be specific and enforceable here. Delete this comment when done. -->

_(not filled yet — what to always do, ask before doing, and never do in this repo)_

## Verification Gate

<!-- FILL:verify — State the single command (or short sequence) that PROVES a change is safe here — the test/lint/typecheck/build gate you run before committing — plus the coverage/CI threshold and what "done" means. Sources: package scripts, CI workflow files, CONTRIBUTING. An agent must be able to self-verify without guessing. Delete this comment when done. -->

_(not filled yet — the single command that proves a change is safe, and the done bar)_

## Project Rules

These rules apply to every task in this project unless explicitly overridden.
Bias: caution over speed on non-trivial work. Use judgment on trivial tasks.

## Rule 1 — Think Before Coding
State assumptions explicitly. If uncertain, ask rather than guess.
Present multiple interpretations when ambiguity exists.
Push back when a simpler approach exists.
Stop when confused. Name what's unclear.

## Rule 2 — Simplicity First
Minimum code that solves the problem. Nothing speculative.
No features beyond what was asked. No abstractions for single-use code.
Test: would a senior engineer say this is overcomplicated? If yes, simplify.

## Rule 3 — Surgical Changes
Touch only what you must. Clean up only your own mess.
Don't "improve" adjacent code, comments, or formatting.
Don't refactor what isn't broken. Match existing style.

## Rule 4 — Goal-Driven Execution
Define success criteria. Loop until verified.
Don't follow steps. Define success and iterate.
Strong success criteria let you loop independently.

## Rule 5 — Use the model only for judgment calls
Use me for: classification, drafting, summarization, extraction.
Do NOT use me for: routing, retries, deterministic transforms.
If code can answer, code answers.

## Rule 6 — Token budgets are not advisory
Per-task: 4,000 tokens. Per-session: 30,000 tokens.
If approaching budget, summarize and start fresh.
Surface the breach. Do not silently overrun.

## Rule 7 — Surface conflicts, don't average them
If two patterns contradict, pick one (more recent / more tested).
Explain why. Flag the other for cleanup.
Don't blend conflicting patterns.

## Rule 8 — Read before you write
Before adding code, read exports, immediate callers, shared utilities.
"Looks orthogonal" is dangerous. If unsure why code is structured a way, ask.

## Rule 9 — Tests verify intent, not just behavior
Tests must encode WHY behavior matters, not just WHAT it does.
A test that can't fail when business logic changes is wrong.

## Rule 10 — Checkpoint after every significant step
Summarize what was done, what's verified, what's left.
Don't continue from a state you can't describe back.
If you lose track, stop and restate.

## Rule 11 — Match the codebase's conventions, even if you disagree
Conformance > taste inside the codebase.
If you genuinely think a convention is harmful, surface it. Don't fork silently.

## Rule 12 — Fail loud
"Completed" is wrong if anything was skipped silently.
"Tests pass" is wrong if any were skipped.
Default to surfacing uncertainty, not hiding it.

## Anti-Patterns (Forbidden)
"feels kind of weak intuitively" / "probably won't be used" → speculation
"it's an advanced feature, so low value" → assertion with no criteria
"generally needed" → unverifiable
"in my experience" → unsourced generalization

## When Requesting Decisions or Confirmation
Explain in detail, with the surrounding before/after context, so it's easy to understand.
State the recommended option and the reason for it.
Explain it in a way that can be understood as UI/UX.
Explain it in AS-IS / TO-BE form.
Frame every choice from the user's perspective — the benefit gained vs. the cost incurred — and visualize the trade-off (e.g., a comparison table) instead of leaving it in prose.

## Run Self-Audit on Phase/Task Completion
Acceptance Criteria met [Pass/Fail per item]
Confirm DO NOT CHANGE areas were not modified
Confirm no Non-Goals were violated
Any changes not traceable to the request
Open decisions / follow-up work

## Context Management
autocompact enabled. Consider manual /compact when reaching 50%.
Re-reference SPEC/PRD at the start of every session (Persistent Anchor).
On phase transitions, do a structured state handoff. Keep SPEC/PRD/TODO current.

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

## My Team Rules

MINE-SECTION
