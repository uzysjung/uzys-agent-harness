---
name: model-orchestration
description: >-
  Apply the fixed model-role and thinking-effort policy whenever work is delegated to subagents
  or a model/effort choice is made: the orchestrator (top-tier model) DIRECTLY sets service
  direction, reviews plan/spec documents (with multi-persona-review), improves shipped features,
  and hunts performance/security problems; plan/spec/planning documents are AUTHORED by Opus,
  which also owns core implementation and V&V, at xhigh or above; repetitive implementation and
  E2E tests go to Sonnet at high or above — never delegate below those effort floors. Use whenever you are about to spawn an Agent/Task/Workflow worker, pick a model for a
  subtask, set a thinking/effort level, assign verification, or hand off orchestration because
  the current model's quota is exhausted. Trigger on "위임해", "에이전트로 돌려", "오케스트레이션",
  "모델 역할분담", "어떤 모델로", "effort 얼마로", "thinking level", "서브에이전트", or in English
  "delegate this", "spawn an agent for", "which model should", "route this task", "verify with",
  "orchestrate". Fire even when the user doesn't name the policy — any delegation decision is
  in scope.
---

# Model Orchestration Policy

A fixed role split between model tiers, set by the user (2026-07-04, revised 2026-07-07). The
premise is
**quality-over-cost**: delegation floors are set at the effort levels Anthropic itself
recommends for intelligence-sensitive work ("start with xhigh for coding and agentic use
cases, high as the minimum for most intelligence-sensitive workloads" — official effort
guidance), not at the cost-saving end ("low ... like subagents"). When this policy and a
cost instinct conflict, the policy wins; surface the cost, don't silently downgrade.

## Role split

| Role | Who | Effort floor | Duties |
|------|-----|--------------|--------|
| **Orchestrator + Product Manager** | Top-tier session model (Fable) | session level | Directs everything. Directly: 서비스 방향성 수립·논의, 기획/스펙문서 **리뷰**, 기개발 기능 **개선**, 문제점(성능·보안) 발굴 — see below |
| **Doc author + core builder + V&V** | `opus` | **xhigh** (or `max`) | 기획/스펙/계획 문서 **작성·관리**, 핵심 구현(novel logic · architecture-touching · security surface), V&V |
| **Repetitive implementation + E2E** | `sonnet` | **high** (or above) | 반복 구현(pattern-following, boilerplate, example-driven migrations), E2E 테스트 작성·실행, research sweeps |
| **Orchestrator stand-in** (quota exhausted) | `opus` @ `max` | max | Takes over orchestration via a handoff — see "Orchestrator handoff" |

The orchestrator assigns a thinking/effort level **per task** at delegation time. Delegating
below a floor is a policy violation, not a tuning choice.

## The orchestrator's own lane: direction, review, judgment

The orchestrator authors **direction**, not documents. 서비스 방향성(where the product goes),
스펙 리뷰(is this plan right?), 기능 개선(what should get better in what shipped?), and
성능·보안 문제 발굴 stay in the orchestrator's window — that's where user intent, constraints,
and history live, and judgment is the one thing a delegation prompt can't carry.

Document *drafting* is delegated to Opus with a direction brief (intent, constraints, decided
trade-offs). This buys an author≠reviewer split for documents themselves: **Opus writes, the
orchestrator reviews** — a draft you review with fresh eyes gets scrutiny your own draft never
would. For 기획/스펙문서 리뷰, run the [[multi-persona-review]] skill (3–5 disjoint persona
reviewers, severity-ranked synthesis) instead of a single-pass read; the orchestrator arbitrates
its findings rather than line-editing alone.

## Routing test: repetitive vs core

Before routing to any model: **deterministic transforms don't get a model at all.** A rename,
a format sweep, a mechanical find-and-replace is `sed`/`grep`/script work — spending model
tokens on what code answers deterministically fails the routing test at step zero.

Route to **Sonnet** (반복 구현 · E2E) when ALL of these hold; otherwise it's Opus core work:

- The task is **repetitive or example-driven** — a pattern already exists to follow (an
  adjacent implementation, a spec with worked examples, a test suite to extend). Acceptance
  criteria fit in a few lines without "use judgment" clauses.
- It's **low-blast-radius**: boilerplate, N-th instance of an established shape, E2E test
  authoring/execution, a research sweep. A wrong answer is cheap to detect and redo.
- It needs **no architectural or cross-cutting decisions**. Actions carry implicit decisions;
  a worker making design choices in isolation silently diverges from the system (the classic
  parallel-agent failure).

**Core implementation** — novel logic, first-of-its-kind shapes, ambiguity, security surface,
multi-file coupling — routes to **Opus @ xhigh+**, as does all verification duty. When unsure,
route up — the cost delta is smaller than a redo.

Parallelism rule of thumb (three independent sources converge on this): **parallel reads are
safe, parallel writes are dangerous**. Fan out freely for research/search/review; keep writes
sequential or isolated (worktree) so two workers never make conflicting implicit decisions in
the same files.

## Effort floors — and the inheritance gotcha

Effort tiers: `low` < `medium` < `high` < `xhigh` < `max`. Fable 5, Sonnet 5, and Opus 4.8/4.7
support all five; on models without `xhigh` the request silently falls back to the nearest
lower level — check the model before assuming the floor holds.

**The gotcha that breaks this policy silently:** the Agent/Task tool accepts a per-invocation
`model`, but **not a per-invocation `effort`** — a spawned agent inherits the session effort
unless its definition says otherwise. Session default is `high`, so a plain
`Agent(model: "opus")` runs at `high`, **below the xhigh floor**, with no warning. Enforce the
floor through one of these three paths:

1. **Pre-defined agent roles** — `.claude/agents/<role>.md` frontmatter pins both knobs.
   This is the durable path for recurring roles:

   ```yaml
   ---
   name: verifier
   description: Fresh-context V&V per model-orchestration policy
   model: opus
   effort: xhigh
   ---
   ```

2. **Workflow scripts** — `agent(prompt, {model: "opus", effort: "xhigh"})` supports both
   per call. Use for scripted fan-outs.

3. **Session inheritance** — if the session already runs at `xhigh` (e.g. `/effort xhigh` or
   ultracode), a bare `Agent(model: "opus")` inherits a compliant level. Verify with
   `/effort`; don't assume.

One environment caveat: `CLAUDE_CODE_SUBAGENT_MODEL` outranks every per-invocation and
frontmatter model choice. If delegation models look wrong, check that env var first.

## Delegation prompt spec

Every delegation carries these four elements (the exact set Anthropic found necessary after
their orchestrator over-spawned and workers duplicated work), plus acceptance criteria:

1. **Objective** — one sentence, plus why it matters (models perform better knowing intent).
2. **Output format** — what comes back, in what structure. State that the final message IS the
   deliverable (raw data, no user-facing preamble).
3. **Tool/source guidance** — where to look, what to trust, what to skip.
4. **Boundaries** — what NOT to touch, where the task ends, what is out of scope.
5. **Acceptance criteria** — how the worker (and you) know it's done. Strong AC lets the
   worker loop independently instead of returning half-done.

Scale worker count to the task, stated up front in your own plan: trivial lookup → no agent at
all (do it directly); bounded question → one agent; genuinely independent axes → one agent per
axis. Over-spawning is a documented failure mode, and multi-agent runs cost ~15× a plain chat
turn — delegate when the task's value justifies it, not by reflex.

## Worker lifecycle — 다 쓴 에이전트는 닫는다

Delegation is not finished when the result arrives — it is finished when the worker is closed.
A completed agent left running stays resident: in split-terminal setups (iTerm2 subagent panes
등) every leftover worker keeps a window open, and idle agents keep pinging the session long
after their job ended. The clutter compounds per delegation.

- **Consume the result → stop the agent** (TaskStop or the harness's stop mechanism) as one
  motion. Close-after-use is the default, not a cleanup chore for later.
- Keep a worker alive ONLY when you will genuinely continue it via SendMessage (e.g. a reviewer
  that must re-verify after fixes land) — and state that intent when you decide it, so every
  still-open agent is a declared decision, not a leak.
- **Sweep at checkpoints**: at phase end and during [[compaction-handoff]], list running agents
  and stop every finished one before moving on.

## V&V separation

The implementer never verifies its own work — the *instance* that wrote something never judges
it. How that plays out per lane:

- **Sonnet implemented** (반복 구현/E2E) → **Opus @ xhigh verifies** (cross-model + fresh
  context — catches classes of bugs same-model review does not).
- **Opus implemented** (핵심 구현) → a **fresh Opus instance** verifies: a NEW agent with no
  shared history. A verifier that watched the implementation happen inherits the implementer's
  mental model and anchors on it — same-session self-review reliably misses the same edge
  cases the implementation missed. Instance separation is what makes "Opus builds AND Opus
  verifies" coherent.
- **Orchestrator layer on top**: the orchestrator hunts 성능·보안 문제점 in shipped features —
  a second, higher-altitude pass that judges what a diff-level verifier doesn't (product fit,
  systemic risk). Documents get the same split: Opus authors, the orchestrator reviews via
  [[multi-persona-review]].

This pairs with, not replaces, deterministic gates (tests, typecheck, CI) — the verifier
judges what automation can't: spec fit, missed edge cases, design drift.

**Verdict vocabulary (fixed).** A verifier's report never ends in free prose — it ends with
exactly one verdict, `PASS` / `PASS_WITH_NITS` / `FAIL`, and every finding carries one
severity label, `CRITICAL` / `HIGH` / `MEDIUM` / `LOW` (full contract: the verification-loop
skill's Verdict Contract). Two consequences for orchestration:

- **FAIL closes only on re-verification.** Fix → re-verify is one cycle; if the same
  reviewer will re-verify, keep it alive via SendMessage and *declare* that intent
  (worker lifecycle) — otherwise spawn a fresh verifier.
- **PASS_WITH_NITS is not silent PASS.** Its LOW/MEDIUM findings come back to the
  orchestrator as recorded follow-ups, not as buried prose — deciding their fate is an
  orchestrator judgment call, never the verifier's. (The name says nits, but the tier it
  covers is LOW **and** MEDIUM.)

## Orchestrator handoff (quota exhaustion)

When the top-tier orchestrator's quota runs out mid-project, **Opus @ `max` takes over
orchestration**. There is no reliable automatic path — documented fallback chains explicitly
exclude rate-limit errors, and plan-level auto-switching is undocumented behavior you must not
build on. Hand off manually:

1. Run the [[compaction-handoff]] protocol: persist durable facts to memory, take an atomic
   git snapshot (clean tree + open-PR check), emit the fixed-field resume anchor
   (current state / verified / what's left / next action).
2. The successor session starts on `opus` at `max` (`/model opus` + `/effort max`), reads the
   anchor, and continues as orchestrator under this same policy — setting direction, reviewing,
   and hunting problems itself (it can author documents directly too, since it already runs at
   the Opus doc-author tier — no separate delegation needed while it stands in).
3. When the top-tier model becomes available again, hand back the same way.

## Anti-patterns

| Anti-pattern | Why it's a violation |
|---|---|
| `Agent(model: "opus")` with session at default effort | Inherits `high` < xhigh floor — use a pinned agent role, Workflow opts, or raise session effort |
| Delegating 방향성 수립 or a final judgment call to a worker | Direction is the orchestrator's own — a delegation prompt can't carry the shaping context |
| Accepting an Opus-authored spec/plan without orchestrator review | Author≠reviewer applies to documents too — run [[multi-persona-review]] before accepting |
| Orchestrator hand-writing full spec/plan drafts itself | Authoring is Opus's lane — brief the direction, delegate the draft, review the result |
| Sonnet on core work (novel / architectural / security) | Fails the routing test; route up to Opus |
| Effort below floor "to save tokens" | The floors ARE the policy; surface cost concerns to the user instead |
| Implementer verifying its own diff | Anchoring — verification needs fresh context, prefer a different model |
| Two agents writing the same files in parallel | Conflicting implicit decisions; keep writes sequential or worktree-isolated |
| Spawning an agent for what one direct tool call answers | 15× token multiplier for zero value — do trivial work directly |
| Relying on plan-level auto-fallback for continuity | Undocumented behavior; use the manual handoff protocol |
| Finished worker left running after its result is consumed | Subagent panes/windows accumulate (iTerm2 등) and idle pings pollute the session — TaskStop as one motion with consuming the result |

## Quick reference

```
방향성 수립 / 스펙 리뷰(multi-persona-review) / 기능 개선 / 성능·보안 문제발굴
                               → 오케스트레이터(Fable) 직접
기획·스펙·계획 문서 작성·관리 / 핵심 구현 / V&V
                               → opus  @ xhigh (또는 max)   — pinned role 또는 Workflow opts
V&V 판정                       → PASS | PASS_WITH_NITS | FAIL + CRITICAL~LOW (verification-loop 계약)
반복 구현 / E2E 테스트 / 리서치 스윕
                               → sonnet @ high 이상
결정적 변환 (rename·포맷)      → 모델 위임 금지 — sed/grep/스크립트 직접
위임 완료                      → 결과 수거와 동시에 TaskStop (SendMessage 재사용 예정 시만 유지 선언)
Fable 소진                     → compaction-handoff → opus @ max 가 오케스트레이터 대행
```
