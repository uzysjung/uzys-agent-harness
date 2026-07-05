---
name: model-orchestration
description: >-
  Apply the fixed model-role and thinking-effort policy whenever work is delegated to subagents
  or a model/effort choice is made: the orchestrator (top-tier model) does planning, design,
  documentation, and synthesis DIRECTLY; V&V and complex work go to Opus at xhigh or above;
  simple bounded coding goes to Sonnet at high or above — never delegate below those effort
  floors. Use whenever you are about to spawn an Agent/Task/Workflow worker, pick a model for a
  subtask, set a thinking/effort level, assign verification, or hand off orchestration because
  the current model's quota is exhausted. Trigger on "위임해", "에이전트로 돌려", "오케스트레이션",
  "모델 역할분담", "어떤 모델로", "effort 얼마로", "thinking level", "서브에이전트", or in English
  "delegate this", "spawn an agent for", "which model should", "route this task", "verify with",
  "orchestrate". Fire even when the user doesn't name the policy — any delegation decision is
  in scope.
---

# Model Orchestration Policy

A fixed role split between model tiers, set by the user (2026-07-04). The premise is
**quality-over-cost**: delegation floors are set at the effort levels Anthropic itself
recommends for intelligence-sensitive work ("start with xhigh for coding and agentic use
cases, high as the minimum for most intelligence-sensitive workloads" — official effort
guidance), not at the cost-saving end ("low ... like subagents"). When this policy and a
cost instinct conflict, the policy wins; surface the cost, don't silently downgrade.

## Role split

| Role | Who | Effort floor | Notes |
|------|-----|--------------|-------|
| **Orchestrator + Product Manager** | Top-tier session model (Fable) | session level | Directs everything. Does planning, design, and documents **itself** — see below |
| **V&V (verification) + complex work** | `opus` | **xhigh** (or `max`) | Verification, review, architecture-heavy or ambiguous implementation |
| **Simple, bounded coding** | `sonnet` | **high** (or above) | Mechanical edits, well-specified single-purpose implementations, research sweeps |
| **Orchestrator stand-in** (quota exhausted) | `opus` @ `max` | max | Takes over orchestration via a handoff — see "Orchestrator handoff" |

The orchestrator assigns a thinking/effort level **per task** at delegation time. Delegating
below a floor is a policy violation, not a tuning choice.

## Never delegated: planning, design, documents

기획(planning) · 설계(design) · 문서(documentation) are the orchestrator's own work — along
with final synthesis and judgment calls. Why: these artifacts *are* the orchestration. A plan
written by a worker model becomes a plan the orchestrator has to re-derive to trust; the
context that shaped it (user intent, constraints, history) lives in the orchestrator's window
and does not survive a delegation prompt. Delegate execution, not direction.

## Routing test: simple vs complex

Before routing to any model: **deterministic transforms don't get a model at all.** A rename,
a format sweep, a mechanical find-and-replace is `sed`/`grep`/script work — spending model
tokens on what code answers deterministically fails the routing test at step zero.

Route to **Sonnet** when ALL of these hold; otherwise it's Opus work:

- The task is **bounded and fully specified** — you can write its acceptance criteria in a few
  lines without "use judgment" clauses.
- It's **low-blast-radius**: mechanical edits, a well-scoped function, a research sweep, test
  boilerplate. A wrong answer is cheap to detect and redo.
- It needs **no architectural or cross-cutting decisions**. Actions carry implicit decisions;
  a worker making design choices in isolation silently diverges from the system (the classic
  parallel-agent failure).

Anything with ambiguity, security surface, multi-file coupling, or verification duty routes to
**Opus @ xhigh+**. When unsure, route up — the cost delta is smaller than a redo.

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

## V&V separation

The implementer never verifies its own work. Two mechanisms, use both when stakes allow:

- **Fresh context**: a verifier that saw the implementation happen inherits the implementer's
  mental model and anchors on it — same-session self-review reliably misses the same edge
  cases the implementation missed. Spawn verification as a NEW agent with no shared history.
- **Different model**: Sonnet implements → **Opus @ xhigh verifies**. If the orchestrator
  implemented something directly, Opus still verifies. Cross-model review catches classes of
  bugs same-model review does not.

This pairs with, not replaces, deterministic gates (tests, typecheck, CI) — the verifier
judges what automation can't: spec fit, missed edge cases, design drift.

## Orchestrator handoff (quota exhaustion)

When the top-tier orchestrator's quota runs out mid-project, **Opus @ `max` takes over
orchestration**. There is no reliable automatic path — documented fallback chains explicitly
exclude rate-limit errors, and plan-level auto-switching is undocumented behavior you must not
build on. Hand off manually:

1. Run the [[compaction-handoff]] protocol: persist durable facts to memory, take an atomic
   git snapshot (clean tree + open-PR check), emit the fixed-field resume anchor
   (current state / verified / what's left / next action).
2. The successor session starts on `opus` at `max` (`/model opus` + `/effort max`), reads the
   anchor, and continues as orchestrator under this same policy — including doing planning,
   design, and documents itself.
3. When the top-tier model becomes available again, hand back the same way.

## Anti-patterns

| Anti-pattern | Why it's a violation |
|---|---|
| `Agent(model: "opus")` with session at default effort | Inherits `high` < xhigh floor — use a pinned agent role, Workflow opts, or raise session effort |
| Delegating a plan, spec, or doc draft to a worker | Direction work is the orchestrator's own — delegation loses the shaping context |
| Sonnet on an ambiguous / architectural / security task | Fails the routing test; route up to Opus |
| Effort below floor "to save tokens" | The floors ARE the policy; surface cost concerns to the user instead |
| Implementer verifying its own diff | Anchoring — verification needs fresh context, prefer a different model |
| Two agents writing the same files in parallel | Conflicting implicit decisions; keep writes sequential or worktree-isolated |
| Spawning an agent for what one direct tool call answers | 15× token multiplier for zero value — do trivial work directly |
| Relying on plan-level auto-fallback for continuity | Undocumented behavior; use the manual handoff protocol |

## Quick reference

```
복잡한 구현 / 검증 / 리뷰      → opus  @ xhigh (또는 max)   — pinned role 또는 Workflow opts
단순 코딩 / 리서치 스윕        → sonnet @ high 이상
결정적 변환 (rename·포맷)      → 모델 위임 금지 — sed/grep/스크립트 직접
기획 · 설계 · 문서 · 종합      → 오케스트레이터 직접 (위임 금지)
Fable 소진                     → compaction-handoff → opus @ max 가 오케스트레이터 대행
```
