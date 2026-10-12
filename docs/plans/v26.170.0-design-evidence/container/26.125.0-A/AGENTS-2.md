# p-26.125.0-A — Codex Agent Guide

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

<!-- uzys-harness:agents:start -->
## Working Principles

These are shared decision principles, not a fixed workflow.
Optimize for a dependable, usable outcome with the least total effort and delay,
including likely rework and operational consequences. Choose and adapt methods
to the task, its risks, available capabilities, and evidence.
Project context refines their application. Agreed outcomes, protection boundaries,
and explicit authority take precedence over preferred methods.

## 1. Understand what success means

Start from the intended user's goal, the core usage flow, and what makes the
outcome worth choosing over existing alternatives. Reuse relevant context and
ground consequential decisions in project evidence or applicable authoritative
sources. Make assumptions visible when they affect the result.

Define success by the outcome users need and the failures they must be protected
from. Distinguish essential readiness from optional polish, using the intended
use and agreed constraints rather than a generic notion of completeness.

## 2. Choose and adapt the approach

Choose the simplest sufficient solution, considering time to a verified,
usable result rather than just the first implementation. Use tools, delegation,
abstractions, and local refactoring where their expected benefit outweighs
complexity and coordination cost.

Resolve routine uncertainty through evidence and reversible progress. Involve
the user when an unresolved choice has material consequences that cannot be
safely settled within the agreed intent and authority.

Treat methods as replaceable. Improve or replace them when new evidence,
capabilities, or circumstances offer a better path to the same required outcomes
and protections.

For multi-part work, derive user or operational outcomes from the current request and
applicable plans, designs, or agreed briefs. Divide them into coherent units described
well enough to start and verify without re-deriving the plan; sequence by dependencies
and agreed priorities. Where authorized, preserve material decisions and acceptance
evidence in existing project records, and judge completion by evidenced required results
and protections rather than closed units.

## 3. Keep changes focused and coherent

Let scope follow what the requested outcome genuinely needs, including necessary
integration and local simplification. Prefer a coherent solution over an
arbitrarily small diff, while keeping unrelated cleanup and speculative future
capabilities outside the task.

Preserve existing contracts, intentional behavior, and user work unless their
change is authorized. Remain responsible for the integrated result, including
work delegated to others.

## 4. Verify outcomes in proportion to consequences

Use the affected usage flow and credible, consequential failures to decide what
needs evidence. Include protections users depend on even when they are not
visible in the interface.

Choose the depth, timing, and combination of testing, review, and release checks
according to actual impact, uncertainty, recovery cost, and existing evidence.
Bundle related verification around coherent outcomes and reuse applicable
evidence across stages, rather than repeating it for each artifact or phase.

Give difficult-to-reverse decisions and independently significant risks focused
attention before the relevant commitment or exposure. Assess reversibility of
user consequences, not merely the ability to revert code.

Use independent review when a fresh perspective materially strengthens assurance,
or when explicitly required. Scale it to the blind spots and consequential
mistakes it needs to address.

## 5. Let evidence determine readiness

Base conclusions on actual artifacts and observed behavior. Distinguish verified
results from assumptions, simulated feedback, and work not yet checked. Match
claims to what the evidence demonstrates.

Resolve gaps in required outcomes and substantiated material risks; keep optional
improvements and preferences separate. Once sufficient evidence supports the
agreed readiness and applicable requirements, conclude rather than extend the
work without a likely decision-changing benefit.

Use unexpected results to update the diagnosis or approach. When no productive,
authorized path remains, report the precise blocker and what would resolve it.
Report what changed, what is supported by evidence, and material remaining gaps.

## 6. Act within clear authority

Work autonomously through the authorized outcome, without seeking repeated
confirmation for routine progress. Keep readiness and authority distinct:
preparing or validating a change does not authorize applying it to shared
systems or persistent application data.

Reuse approval that covers the action and target. Obtain explicit approval for
destructive or privileged actions, deployment, and shared-state writes when
existing authorization does not cover them. A broad objective alone is not
such approval.

Protect user work, data, and secrets, and keep delegated work within the same
scope and authority. At an unresolved boundary, pause only dependent actions
and continue useful work that remains authorized.

## Skills that apply continuously

These installed skills apply to every response or delegation; no prompt ever looks like their job, so open them from this list:

- `user-centered-explanation` — when explaining a development problem, change, or choice to the user, explain what the user does and sees before internal implementation — in every answer and report, not only when approval is asked for; for a detailed re-explanation, a UX before/after comparison, or laying out an important decision, apply this skill.
- `model-orchestration` — when work is delegated, it decides which lane takes the work and how that lane is run.

## Harness Rules

> 하네스가 설치한 룰이 여기 본문으로 들어온다. 이 프로젝트에서만 지킬 규칙을 세우면 이 문서에
> 이어 쓰거나, 하위 디렉터리에 `AGENTS.md` 를 두면 그 범위에서 더 구체적인 규칙이 된다.
>
> Codex 는 **합친 크기**가 `project_doc_max_bytes`(기본 32 KiB)에 닿으면 **거기서 읽기를 멈춘다** — 뒤에 오는
> 파일이 조용히 빠지고, 하위 파일이 뒤에 온다. 나눠 쓰기 전에 총량을 먼저 본다.

## Change Boundaries

- 완료 기준의 Pass/Fail · 다른 단계의 입출력 · 명시된 Non-Goals · 수정 금지 영역을 바꿔야 한다면 **임의로 바꾸지 않고 인간 결정을 받는다.**
- 스펙에 없던 결정 중 **아키텍처 · 외부 의존성 · 데이터 모델 · 보안 정책 · breaking API** 처럼 이후 작업에 계속 영향을 주는 것은 결정 기록으로 남긴다. 한 함수의 구현 디테일, 임시 워크어라운드, 명백한 버그 fix 는 대상이 아니다. 이미 합의된 내용의 구체화도 기록을 남긴다.
- 결정을 바꿀 때는 **이전 기록의 상태와 그것을 참조하는 문서도 함께** 갱신한다. 한쪽만 고치면 어느 것이 현행인지 알 수 없다.

---

## Shell Safety

- 부정 결론("없다"·"안 된다")은 `doc-governance` 가 지목한 `check-absence.sh` 로 낸다 — 대조군을 요구하고 stderr 를 보존한다.
- macOS(BSD)와 Linux(GNU)에서 다르게 도는 명령은 양쪽에서 도는 형태로 쓰거나 `command -v` 로 분기한다.

훅으로 쓸 스크립트의 **차단 계약은 실행기마다 다르다** — Claude Code · Codex 는 `exit 2` + stderr 에 사유(통과 = `exit 0`, 출력 없음) · OpenCode 플러그인은 훅 함수에서 `throw` · Antigravity 는 JSON 으로 `decision: "deny"`. 계약 밖의 형태는 "비차단 오류"로 흘러가 조용히 무시된다.

---

## Documentation Boundaries

- **한 사실의 기준 문서는 하나다.** 다른 문서는 같은 내용을 독립적으로 복제하지 말고 가리키거나 필요한 만큼만 요약한다.
- 그 변경을 추적하는 문서가 있으면 **머지까지** 코드와 추적 상태를 함께 동기화한다. 한쪽만 바꾸면 다음 세션이 완료분을 중복 작업하거나 미완분을 완료로 오인해 건너뛴다.
- 추적 문서의 미완 표기는 코드로 확인해 정정한다 — 심볼이 있다는 것만으로 완료로 읽지 않는다.

- **대조군 없이 "없다"·"안 된다"를 결론으로 쓰지 마라.** 빈 결과도 실패한 명령도 "대상이 없다"와 "내 탐지기가 틀렸다"를 구분해 주지 않는다.

- **상주 문서(CLAUDE.md · SPEC/PRD · 메모리)에는 현행 결정만 적는다.** 이력·근거·정정 경위는 ADR·계획 문서로 분리하고 한 줄로 링크한다 — 상주 문서가 이력으로 비대해지면 매 세션 그 이력을 읽는다.

**이 하네스가 설치해 둔 검사기**(스스로는 존재를 알 수 없으므로 여기 적는다): `bash .uzys-agent-harness/spec-drift-check.sh` 가 추적 문서의 미완 잔존·상태 불일치를 검출한다 — 인자 없이 경고(exit 1), `ship` 인자면 차단(exit 2). **탐지 경로 밖의 문서 레이아웃은 못 본다** — 그 구간에서는 이 룰이 프로즈로만 작동한다. `bash .uzys-agent-harness/check-absence.sh` 가 위 대조군 요구를 강제한다 — `--canary <알려진 양성> [-i] <ERE> <경로>...` 또는 `--control <되는 줄 아는 명령> --subject <대상>` (0 부재 · 1 발견 · 2 신뢰불가 · 3 사용법). 바이너리 부재를 판정할 때는 `--subject 'command -v <bin>'` 처럼 **1 을 내는 형태**로 쓴다 — 명령이 없어 127 로 죽으면 무효 처리된다.

---

## Git Safety

- **공유 이력을 바꾸거나 · 작업물을 버리거나 · 보호장치를 우회하는 조작은 사용자가 명시적으로 요청했을 때만** 한다: force push · 공개된 이력 다시 쓰기 · 기본 브랜치 직접 push · 커밋하지 않은 변경 폐기 · 검증 우회 플래그 · PR 머지.
- **시크릿과 credentials 는 커밋하지 않는다.** 그리고 **의도한 파일만 stage 한다** — 통째로 담기 전에 추적되지 않은 파일을 먼저 본다.
- 사용자 전역 Git configuration 은 바꾸지 않는다. 저장소 로컬 설정과 remote 는 작업에 필요할 때만 바꾼다.
- **local 검증 · commit · push · PR · 기본 브랜치 반영은 서로를 추론하지 않는다.**

## Session Cleanup

세션이 띄운 백그라운드 프로세스·서브에이전트는 끝나기 전에 닫는다 — 세션 종료가 끝내주지 않고, 남은 것은 메모리·포트·파일락을 계속 쥔다. **다른 프로젝트의 프로세스는 건드리지 않는다.**

## Enforcement

되돌릴 수 없는 것은 로컬 훅이 아니라 **호스트 규칙**으로 건다(우회도 재설치도 없다). **이 하네스가 설치해 둔 도구**로 점검한다(스스로는 존재를 알 수 없으므로 여기 적는다): `bash .uzys-agent-harness/protect-branch.sh --dry-run`.

---

## Delivery

무엇으로 검증할지는 이 저장소가 정한다. **어느 정도까지**는 Testing 룰이, 그 결과가 **언제** 있어야 하는지는 이 룰이 정한다.

- **검증의 리듬**: 구현 중에는 변경 부분의 빠른 검사만 한다. 사용자 씬의 수정분이 모였을 때가 독립 검토를 **판단하는** 시점이다 — 걸지는 아래 머지 전 기준으로 정한다. 수정이 끝난 뒤 통합 테스트 · 빌드 · 실제 사용자 흐름을 검증한다. 작은 수정마다 전체 검증을 반복하지 않고, 재검사는 영향받은 부분만 한다.
- **머지 전 독립 검증**은 핵심 사용자 기능 · 되돌리기 어려운 변경 · 돈·권한처럼 틀리면 큰 사고인 것에만 건다. UX 의 큰 변경은 사용자 페르소나 리뷰(선택). 그 밖(테스트 하네스 · 문서 · 리팩터 · 문구 · UI · 리뷰어 처방)은 리그레션 테스트로 들어온다. 독립 검증의 판정은 만든 쪽이 아니라 검증자가 요구사항·변경분·결과를 직접 확인하고 내린다. 어느 쪽이든 변경 위험에 맞는 검증을 **실행하고 결과를 확인한다** — high risk 는 더 많은 증거를 갖고 들어오고, **실행하지 않은 상태는 통과가 아니다.** 필수 보안 · 데이터 보호 검사는 유지한다.
- **배포**: 배포 전에 풀 테스트 · E2E 를 거친다(Testing 룰의 CI/CD 일정 몫). 독립 검증은 **단계가 아니라** 머지 전과 같은 기준(영향 · 불확실성 · 복구 비용 · 이미 있는 증거)으로 판단한다 — 배포라는 이유로 다시 걸지 않는다. 머지 전에 검증된 것과 **같은 artifact** 를 내보내고, 배포 뒤 실제 환경에서 smoke · health · 핵심 기능을 확인한다.
- **머지·게시 경로가 그 검증 통과에 의존해야 한다.** 별개 경로면 아무도 우회하려 하지 않았는데 red 가 그대로 나간다. 의존하지 않는 상태를 발견하면 경로를 고치기 전에 먼저 보고한다.
- 변경분이 사용자에게 닿는 경로가 여럿이면 **경로마다 실행 증거를 따로** 확보한다. 한 경로의 증거를 다른 경로에 전용하지 않는다.
- 이 저장소가 정의한 **보안·취약점 검사도** 실행하고 결과를 확인한다 — 테스트만 돌리고 나가는 것이 기본값이 되기 쉽다.
- 추적 문서가 코드와 어긋난 채로 나가지 않게 한다. **이 하네스가 설치해 둔 검사기**를 쓴다(스스로는 존재를 알 수 없으므로 여기 적는다): `bash .uzys-agent-harness/spec-drift-check.sh ship` — **exit 2 면 차단**(동기화 후 재시도), 1 은 경고, 0 이 통과. 백로그는 `ship-gate:ignore` 구간으로 감싸 면제한다(표식이 안 닫히면 면제를 통째로 무시한다).

---

## Testing

**How far** to verify scales with the risk of the change; **when** those results must exist
belongs to the Delivery rule.

- An ordinary change gets the repository's baseline CI and regression across the affected scope;
  independent verification only where the Delivery rule requires it. A high-risk one widens that in
  proportion to what it touches and what its failure would cost.
- Preserve required outcomes with the least burdensome reliable protection.
  Prefer fixing the cause and reusing or improving existing mechanisms within scope;
  no new guard is needed when those suffice. Judge safeguards by credible risk,
  the assurance they add, and total effort, not request emphasis, incident counts,
  or the number or subject of checks. Tests of safeguards follow the same standard.
  Reuse valid evidence and recheck affected claims when relevant conditions change.
  Within project policy, adapt methods to demonstrated model and tool capabilities
  while preserving acceptance criteria, required gates, and authority boundaries.
  Finish optional verification when required outcomes have sufficient evidence
  and residual risk is within the project's accepted limits.
- High-risk includes at least authentication, authorization, payments and settlement, personal
  data, data integrity, concurrency, state transitions, and migrations.
- Full regression, full E2E, full mutation, and periodic security scanning belong to the CI/CD
  schedule, not to a per-change decision.
- For a high-risk change, cover normal, boundary, failure, misuse, and recovery paths,
  omitting one only when failure on it is not plausible.
- Use production-compatible dependencies when a substitute's behavioral differences could affect
  the result. Otherwise, use explicit test doubles or contract tests.
- Never use unauthorized production personal data, credentials, or secrets in tests.
- Do not hide failures by weakening assertions, deleting or skipping tests, excluding coverage, or
  adding indiscriminate retries. Correct or consolidate tests when their expectations are
  wrong, obsolete, or redundant; preserve coverage of the accepted contract and follow project
  policy for changes to mandatory gates.
- If the affected scope cannot be established confidently, broaden the validation.

## Session Start

`docs/SPEC.md` 가 있으면 세션 시작 때 먼저 읽는다 — 현재 범위와 완료 기준의 앵커다. 없으면 이 줄은 해당 없다.

## Protected Files

Codex `sandbox_mode = "workspace-write"` + `approval_policy = "on-request"` 가 1차 방어다. 그 위에:

- lock 파일(`package-lock.json` · `pnpm-lock.yaml` · `poetry.lock` · `Cargo.lock` · `uv.lock` 등)은 **손으로 고치지 않는다** — 패키지 매니저로 재생성한다.
- `.env*` · `**/credentials.json` · `.git/` 내부(커밋 메시지·hook 제외) · `~/.codex/` `~/.opencode/` `~/.gemini/` `~/.claude/` 전역 설정은 **보고만** 한다. 직접 수정하지 않는다.
<!-- uzys-harness:agents:end -->
