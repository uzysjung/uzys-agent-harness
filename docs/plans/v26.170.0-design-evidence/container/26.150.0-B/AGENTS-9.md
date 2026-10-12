# p-26.150.0-B — Codex Agent Guide

> **Generated from**: `templates/CLAUDE.md` (4-CLI 단일 원본) via `scripts/claude-to-codex.sh` (Phase C)
> **Codex Version**: 0.124.0+
> **Linked SPEC**: `docs/specs/codex-compat.md`

## Project Context

> ⚙️ **SCAFFOLD — not filled in yet.** The sections below are a fill-in template for THIS project, not verified facts.
> To fill: open this file and paste each `<!-- FILL: … -->` comment's instruction into your coding agent (e.g. Claude Code) — it will inspect the real repo and write the section. You can also fill them by hand; the comments are the instructions.
> **This file (`AGENTS.md`) is the harness anchor** — it carries the working principles in full, further down. Only the `## …` sections immediately below are project-specific context for you to fill in.

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

These are default decision principles. Project-specific instructions may refine
them.

## 1. Understand First

Before editing, inspect the affected code, tests, callers, interfaces,
dependencies, documentation, and worktree changes. Resolve questions from the
repository before asking the user.

Before designing, examine how established products solve the same problem.
Prefer proven patterns. Verify external behavior, specifications, failure
modes, and library capabilities from current authoritative sources; do not
guess. When only an outside source can answer and you cannot reach one, say
which question is unanswered rather than filling it in.

State uncertainty plainly and distinguish facts, assumptions, and judgments.
If an unresolved choice could materially affect behavior, data, security,
cost, architecture, or scope and would be expensive to reverse, present the
options and trade-offs and ask before proceeding. When independent lanes
disagree or the call is genuinely uncertain, settle it with an adversarial
panel of independent reviewers rather than the loudest lane; a panel costs
more than a decision that is cheap to undo is worth. Otherwise, state a
reasonable assumption and continue.

Mention a simpler sufficient approach when one exists. Push back when a request
conflicts with the goal, contract, or security boundary.

## 2. Define Success and Keep It Simple

Before editing, define observable completion criteria and how each will be
verified. For multi-step work, use a short plan with verification points.

Prefer regression tests at stable contract boundaries. If automated testing is
impractical, state why and define the strongest reproducible alternative.

Implement the minimum change that completely satisfies the request. Do not add
unrequested features, speculative configuration, one-use abstractions,
unnecessary indirection, unused extension points, or defensive code without a
credible failure mode, contract, trust boundary, or security requirement.

Prefer direct, explicit, reproducible, and testable behavior. If equally
sufficient approaches exist, choose the simplest one that reaches a verified
result soonest. Brevity is not simplicity when it obscures behavior or
verification.

When building something that does not exist yet, start with the smallest
working end-to-end path and add one verified capability at a time. Do not trade
working code for unfinished complexity.

## 3. Preserve Sound Boundaries

Separate modules only where responsibilities, trust boundaries, lifecycle, or
reasons to change differ. Keep interfaces narrow; do not abstract hypothetical
reuse.

Before implementing or adding a package, inspect installed dependencies and
verify their versions, documentation, types, and capabilities. Prefer
maintained libraries when they reduce total complexity or improve reliability.
Do not reimplement common functionality without a concrete reason.

Make architectural decisions for the system's expected lifetime. Avoid both
speculative generality and temporary designs known to require replacement.

Do not preserve backward compatibility unless an active contract or persisted
data requires it. Delete verified-unused paths instead of adding compatibility
layers, fallbacks, dual paths, or migrations. A path counts as verified-unused
only when every caller you found is inside this repository; when a consumer can
be outside it, you cannot establish that from here. Breaking active
dependencies requires explicit authorization.

## 4. Make Surgical Changes

Change only what the request and its verification require. Do not refactor,
reformat, rename, rewrite, or delete unrelated code. Remove only artifacts made
obsolete by the change or paths verified as unused and safe to remove.

Leave unrelated dead code untouched. Report it only if it materially affects
the task or verification.

Follow local style unless it conflicts with a contract, security boundary,
data integrity, or intentionally tested behavior.

Pre-existing changes belong to the user. Do not overwrite, revert, stage, or
reformat them. Stop if they overlap the target and safe editing is unclear.

## 5. Verify and Review

Run targeted checks first, then broaden according to risk. Iterate until the
completion criteria pass. Do not weaken or silently omit criteria. If blocked,
report exactly what remains unmet and why.

Independent review by an agent or person other than the one that produced the
work is required at two points: for a completed specification, plan, or design
before it is built on, and for any completed change before it is merged into
shared work.

Give the reviewer the completion criteria and relevant constraints. A reviewer
verifies the work itself rather than trusting the author's report, so
independent review supplements direct verification; it does not replace it. At
these boundaries, an unreviewed artifact is not verified. Starting a review is
always available, so "no reviewer" is a decision rather than a condition: if
you proceed without one, the artifact stays unverified — say so, and never
present self-review as independent review.

## 6. Protect High-Impact Boundaries

Before any destructive, privileged, costly, or shared-state operation, state
the exact action and target and obtain explicit approval. Do not infer approval
from a broad objective.

Preparing a migration, deployment, release, command, or other reviewable
artifact does not authorize applying it to shared or persistent state.

These principles shape decisions; they do not block actions. Anything that must
hold every time regardless of judgment belongs in the enforcement layer, not in
a sentence here.

## 7. Report Evidence

Report what changed, what was verified and how, what independent review found,
what was not verified, what remains, and the risk that remains.

Do not claim `Pass`, `Works`, or `Completed` without evidence. An unverified
criterion is incomplete. Disclose relevant broader checks not run; their
absence does not invalidate separately verified results.

If repeated attempts produce no new evidence, stop and provide a concise
handoff.

## Presenting a decision

Present a decision or approval request as AS-IS → TO-BE with a recommendation
and the trade-off, not as prose.

**Write it from the position of whoever lives with the result** — the person who
uses what you are building, or the operator who runs it. Name that role, and say
what they can do now that they could not before, or what stops happening to them;
a field added to a module is not something anyone outside the code can feel. When
a change has no user-visible effect, say who does benefit rather than inventing a
user.

Give the surrounding before/after context in enough detail that the reader does
not have to ask, and show the choice the way they will meet it — a comparison
table, a sketch, a rendered example — rather than describing it. When the reader
says they don't follow, fix what the words point at before rewording; the usual
cause is one name meaning two things.

## Skills that apply continuously

A skill's body loads when the prompt looks like the skill's job. That is enough
for task-shaped skills and not enough for these, which apply to every response
or every delegation — nothing in a prompt ever looks like those, so without a
line here they never open. Each is selected individually at install time, hence
the condition on every line.

- `clear-korean-communication`, where installed — applies to every answer,
  report, and approval request, including the AS-IS → TO-BE form above; not
  only at the moment approval is asked for.
- `task-brief`, where installed — normalize an incoming work request into the
  brief shape before starting, fill the fields it left open from context, and
  show the filled-in brief so the user can carry it straight into a prompt,
  marking which values were assumed.
- `model-orchestration`, where installed — when work is delegated, it decides
  which lane takes the work and how that lane is run.

## Harness Rules

> Codex 는 룰 디렉터리가 없고 `AGENTS.md` 계층만 읽는다. 그래서 하네스가 설치한 룰이 여기 본문으로
> 들어온다. 이 프로젝트에서만 지킬 규칙을 세우면 이 문서에 이어 쓴다.
>
> 하위 디렉터리 `AGENTS.md` 로 범위를 좁히는 것도 되지만, Codex 는 **합친 크기**가
> `project_doc_max_bytes`(기본 32 KiB)에 닿으면 **거기서 읽기를 멈춘다** — 뒤에 오는 파일이
> 조용히 빠지고, 하위 파일이 뒤에 온다. 나눠 쓰기 전에 총량을 먼저 본다.

## Change Boundaries

- **합의된 범위와 완료 기준 안에서는 자율적으로 수행한다.**
- 완료 기준의 Pass/Fail · 다른 단계의 입출력 · 명시된 Non-Goals · 수정 금지 영역을 바꿔야 한다면 **임의로 바꾸지 않고 인간 결정을 받는다.** 보류하는 것은 그 경계뿐이고, 범위 안에서 할 수 있는 일은 계속한다.
- 이미 합의된 내용의 구체화는 즉시 반영하되 **기록을 남긴다.** 기존 결정이나 요구사항의 **의미**를 바꾸는 것은 먼저 합의한다.
- 스펙에 없던 결정 중 **아키텍처 · 외부 의존성 · 데이터 모델 · 보안 정책 · breaking API** 처럼 이후 작업에 계속 영향을 주는 것은 결정 기록으로 남긴다. 한 함수의 구현 디테일, 임시 워크어라운드, 명백한 버그 fix 는 대상이 아니다.
- 결정을 바꿀 때는 **이전 기록의 상태와 그것을 참조하는 문서도 함께** 갱신한다. 한쪽만 고치면 어느 것이 현행인지 알 수 없다.

---

## Shell Safety

- **빈 결과는 부재의 증거가 아니다.** 미지원 플래그를 만난 명령은 에러만 내고 아무것도 출력하지 않는다. `2>/dev/null` 이 그 에러를 지우면 남는 빈 출력은 "깨끗함"과 구분되지 않는다 — **부재를 확인하는 명령에 stderr 를 버리지 마라.**
- **파이프 뒤 `$?` 는 마지막 명령의 것이다.** 파이프 없이 실행하거나 `set -o pipefail` 을 쓴다.
- 처음 쓰는 플래그로 "이상 없음"을 결론내지 마라. 알려진 값이 잡히는지로 탐지기를 먼저 검증한 뒤에 빈 결과를 신뢰한다. (부정 결론 전반의 요구와 그것을 강제하는 도구는 `doc-governance` 에 있다.)
- macOS(BSD)와 Linux(GNU)는 `sed -i` · `date` · `readlink -f` · `realpath -m` · `find -newermt` · `stat` 포맷이 호환되지 않는다. 양쪽에서 도는 형태를 쓰거나 `command -v` 로 분기한다.

훅으로 쓸 스크립트의 **차단 계약은 실행기마다 다르다** — Claude Code · Codex 는 `exit 2` + stderr 에 사유(통과 = `exit 0`, 출력 없음) · OpenCode 플러그인은 훅 함수에서 `throw` · Antigravity 는 JSON 으로 `decision: "deny"`. 계약 밖의 형태는 "비차단 오류"로 흘러가 조용히 무시된다.

---

## Documentation Boundaries

- **한 사실의 기준 문서는 하나다.** 다른 문서는 같은 내용을 독립적으로 복제하지 말고 가리키거나 필요한 만큼만 요약한다.
- 그 변경을 추적하는 문서가 있으면 **머지까지** 코드와 추적 상태를 함께 동기화한다. 한쪽만 바꾸면 다음 세션이 완료분을 중복 작업하거나 미완분을 완료로 오인해 건너뛴다.
- 착수 시점의 미완 표기는 "안 된 것"이 아니라 **"모르는 것"**이다. 코드를 먼저 확인하고 상태를 정정한다 — 심볼이 있다는 것만으로 완료로 읽지 않는다. 못 찾았다고 착수를 보류하지는 않는다.

- **대조군 없이 "없다"·"안 된다"를 결론으로 쓰지 마라.** 빈 결과도 실패한 명령도 "대상이 없다"와 "내 탐지기가 틀렸다"를 구분해 주지 않는다.

**이 하네스가 설치해 둔 검사기**(스스로는 존재를 알 수 없으므로 여기 적는다): `bash .uzys-agent-harness/spec-drift-check.sh` 가 추적 문서의 미완 잔존·상태 불일치를 검출한다 — 인자 없이 경고(exit 1), `ship` 인자면 차단(exit 2). **탐지 경로 밖의 문서 레이아웃은 못 본다** — 그 구간에서는 이 룰이 프로즈로만 작동한다. `bash .uzys-agent-harness/check-absence.sh` 가 위 대조군 요구를 강제한다 — `--canary <알려진 양성> [-i] <ERE> <경로>...` 또는 `--control <되는 줄 아는 명령> --subject <대상>` (0 부재 · 1 발견 · 2 신뢰불가 · 3 사용법). 바이너리 부재를 판정할 때는 `--subject 'command -v <bin>'` 처럼 **1 을 내는 형태**로 쓴다 — 명령이 없어 127 로 죽으면 무효 처리된다.

---

## Git Safety

- **공유 이력을 바꾸거나 · 작업물을 버리거나 · 보호장치를 우회하는 조작은 사용자가 명시적으로 요청했을 때만** 한다: force push · 공개된 이력 다시 쓰기 · 기본 브랜치 직접 push · 커밋하지 않은 변경 폐기 · 검증 우회 플래그 · PR 머지.
- **시크릿과 credentials 는 커밋하지 않는다.** 그리고 **의도한 파일만 stage 한다** — 통째로 담기 전에 추적되지 않은 파일을 먼저 본다.
- 사용자 전역 Git configuration 은 바꾸지 않는다. 저장소 로컬 설정과 remote 는 작업에 필요할 때만 바꾼다.
- **local 검증 · commit · push · PR · 기본 브랜치 반영은 서로를 추론하지 않는다.**

## Session Cleanup

세션이 띄운 백그라운드 프로세스·서브에이전트는 끝나기 전에 닫는다 — 세션 종료가 그것들을 반드시 끝내주지는 않는다. 부모만 죽고 `ppid=1` 로 재부모화돼 메모리·포트·파일락을 계속 쥐는 경우가 있다. **다른 프로젝트의 프로세스는 건드리지 않는다.**

## Enforcement

되돌릴 수 없는 것은 로컬 훅이 아니라 **호스트 규칙**으로 건다(우회도 재설치도 없다). **이 하네스가 설치해 둔 도구**로 점검한다(스스로는 존재를 알 수 없으므로 여기 적는다): `bash .uzys-agent-harness/protect-branch.sh --dry-run`.

---

## Delivery

무엇으로 검증할지는 이 저장소가 정한다. **어느 정도까지**는 Testing 룰이, 그 결과가 **언제** 있어야 하는지는 이 룰이 정한다.

- **완료 판정은 만든 쪽이 아니라 검증자가 내린다.** 요구사항·변경분·검증 결과를 **직접 다시 확인**한 뒤 판정한다 — 보고를 읽고 승인하는 것은 판정이 아니다.
- **머지 전**: 변경 위험에 맞는 검증을 **실행하고 결과를 확인한다.** high risk 는 더 많은 증거를 갖고 들어오고, **실행하지 않은 상태는 통과가 아니다.**
- **배포**: 머지 전에 검증된 것과 **같은 artifact** 를 내보내고, 배포 뒤 실제 환경에서 smoke · health · 핵심 기능을 확인한다.
- **머지·게시 경로가 그 검증 통과에 의존해야 한다.** 별개 경로면 아무도 우회하려 하지 않았는데 red 가 그대로 나간다. 의존하지 않는 상태를 발견하면 경로를 고치기 전에 먼저 보고한다.
- 변경분이 사용자에게 닿는 경로가 여럿이면 **경로마다 실행 증거를 따로** 확보한다. 한 경로의 증거를 다른 경로에 전용하지 않는다.
- 이 저장소가 정의한 **보안·취약점 검사도** 실행하고 결과를 확인한다 — 테스트만 돌리고 나가는 것이 기본값이 되기 쉽다.
- 추적 문서가 코드와 어긋난 채로 나가지 않게 한다. **이 하네스가 설치해 둔 검사기**를 쓴다(스스로는 존재를 알 수 없으므로 여기 적는다): `bash .uzys-agent-harness/spec-drift-check.sh ship` — **exit 2 면 차단**(동기화 후 재시도), 1 은 경고, 0 이 통과. 백로그는 `ship-gate:ignore` 구간으로 감싸 면제한다(표식이 안 닫히면 면제를 통째로 무시한다).

---

## Testing

**How far** to verify scales with the risk of the change; **when** those results must exist
belongs to the Delivery rule.

- An ordinary change gets the repository's baseline CI, regression across the affected scope, and
  whatever independent verification it warrants. A high-risk one widens that in proportion to what
  it touches and what its failure would cost.
- High-risk includes at least authentication, authorization, payments and settlement, personal
  data, data integrity, concurrency, state transitions, and migrations.
- Full regression, full E2E, full mutation, and periodic security scanning belong to the CI/CD
  schedule, not to a per-change decision.
- Test observable behavior — contracts and invariants — at whichever level best exposes
  plausible failures.
- For a high-risk change, cover normal, boundary, failure, misuse, and recovery paths,
  omitting one only when failure on it is not plausible.
- Keep tests deterministic: time, randomness, shared state, execution order, network, and
  external services.
- Use production-compatible dependencies when a substitute's behavioral differences could affect
  the result. Otherwise, use explicit test doubles or contract tests.
- Never use unauthorized production personal data, credentials, or secrets in tests.
- Do not hide failures by weakening assertions, deleting or skipping tests, excluding coverage, or
  adding indiscriminate retries. Change tests only when the intended behavior has changed.
- Coverage signals untested risk; it is not a target. Follow the repository-defined CI gates.
- If the affected scope cannot be established confidently, broaden the validation.

## Session Start

매 세션 시작 시:
1. `docs/SPEC.md` 및 `docs/specs/*.md` 재참조 (Persistent Anchor)
2. `docs/todo.md` 현재 Phase 확인

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

*이 문서는 자동 생성됨. 수동 편집 시 `scripts/claude-to-codex.sh` 재실행이 덮어쓸 수 있음. 원본은 `templates/CLAUDE.md` (claude 설치본은 루트 `CLAUDE-uzys-harness.md`).*

## My Team Rules

MINE-SECTION
