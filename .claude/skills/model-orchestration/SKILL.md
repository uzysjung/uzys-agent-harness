---
name: model-orchestration
description: >-
  Apply the fixed model-role and thinking-effort policy whenever work is delegated to subagents
  or a model/effort choice is made: the orchestrator (top-tier model, Fable) DIRECTLY owns
  설계·기획·분배·리뷰 — sets service direction, reviews plan/spec documents, improves shipped
  features, and hunts performance/security problems; core implementation, test
  authoring/execution (E2E included), and code verification/V&V go to Opus at xhigh or above;
  repetitive/simple implementation goes to Sonnet at high or above — Sonnet is never used for
  tests or verification; plan/spec drafts may be produced by Opus from a Fable direction brief,
  but the review/decision is always Fable's. Never delegate below the effort floors. Use whenever
  you are about to spawn an Agent/Task/Workflow worker, pick a model for a subtask, set a
  thinking/effort level, or assign verification. Trigger on "위임해", "어떤 모델로",
  "effort 얼마로", "서브에이전트", "delegate this", "which model should". Fire even when the
  user doesn't name the policy — any delegation is in scope.
---

# Model Orchestration Policy

A fixed role split between model tiers, set by the user (2026-07-04, revised 2026-07-07 and
2026-08-02 — *"설계·분배·기획·리뷰는 Fable5, 핵심 구현·테스트·검증은 opus5, 반복·단순 구현은
sonnet"*). The premise is
**quality-over-cost**: delegation floors are set at the effort levels Anthropic itself
recommends for intelligence-sensitive work ("start with xhigh for coding and agentic use
cases, high as the minimum for most intelligence-sensitive workloads" — official effort
guidance), not at the cost-saving end ("low ... like subagents"). When this policy and a
cost instinct conflict, the policy wins; surface the cost, don't silently downgrade.

## Role split

| Role | Who | Effort floor | Duties |
|------|-----|--------------|--------|
| **Orchestrator + Product Manager** | Top-tier session model (Fable) | session level | 설계·기획·분배·**리뷰** 전부. Directly: 서비스 방향성 수립·논의, 설계 결정·트레이드오프 확정, 작업 분배, 기획/스펙문서 **리뷰·중재**, 기개발 기능 **개선**, 문제점(성능·보안) 발굴 — see below |
| **Core builder + Tester + V&V** | `opus` | **xhigh** (or `max`) | **핵심 구현**(새 설계 표면·경계 판단이 남는 것) + **테스트 작성·실행**(E2E 포함) + **코드 리뷰·검증/V&V**(fresh instance). 기획/스펙 문서 *초안*은 Fable의 방향 브리프를 받아 작성 가능하되, 확정은 Fable 리뷰를 거친다. **리뷰의 분업**: 설계·기획·스펙 문서 리뷰 = Fable / 코드(diff) 리뷰 = Opus V&V |
| **Repetitive builder + read-only assist** | `sonnet` | **high** (or above) | **반복·단순 구현** — 확립된 패턴의 적용, 설계 판단이 이미 끝난 기계적 구현 (산출물은 Opus 교차검증) + 리서치 스윕. **테스트·검증 투입 금지** |
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

## Routing test

Before routing to any model: **deterministic transforms don't get a model at all.** A rename,
a format sweep, a mechanical find-and-replace is `sed`/`grep`/script work — spending model
tokens on what code answers deterministically fails the routing test at step zero.

Past that gate (2026-08-02 사용자 결정):

- **Core implementation, all tests, anything that judges code** — new design surface, boundary
  decisions, test authoring and execution (E2E included), code verification/V&V — route to
  **Opus @ xhigh+**.
- **Repetitive/simple implementation** — applying an established pattern where the design
  decisions are already made (N번째 유사 변환, 확정 스펙의 기계적 구현) — routes to
  **Sonnet @ high+**, and its output gets Opus cross-verification before it gates anything.
  The routing question is *"새 판단이 남아 있는가?"* — 남아 있으면 핵심(Opus), 없으면 반복(Sonnet).
- **Read-only assists** (research sweeps) may also go to Sonnet; tests and verification never do.
- **Judgment-free implementation whose pass condition is a command** — the repetitive lane above
  stays the default; only when every predicate in the next section holds may that work go to an
  external executor instead.
- **Korean the user will read** · **shorter and better structured** — an external advisory
  round-trip. Which provider takes which is `external-model-consult`'s provider table; that table
  is the SSOT and is not copied here.
- **A judgment that needs several perspectives** → [[multi-persona-review]] (native panel). **One
  non-Claude perspective** → `external-model-consult` persona mode. A panel that mixes both asks
  the user before it runs, and that gate belongs to [[multi-persona-review]].
- 설계·기획·분배·리뷰 decisions never route down at all — they are the orchestrator's own
  (see above).

Parallelism rule of thumb (three independent sources converge on this): **parallel reads are
safe, parallel writes are dangerous**. Fan out freely for research/search/review; keep writes
sequential or isolated (worktree) so two workers never make conflicting implicit decisions in
the same files.

## External executors — the lane outside the harness

This lane buys **capacity, not quality.** It is not a fourth rank below Sonnet — the ranking above
is by judgment, and an outside CLI has not earned a place in it. What it can hold is work whose
**quality a command decides**, the only case where "cheaper" doesn't also mean "worse." Choosing it
because some other vendor is supposedly better inverts this policy's quality-over-cost premise.

**All five predicates must hold; any one false closes the lane.** Each is a question you can answer
right now, not a "use it if it helps."

| # | Predicate | How you answer it now |
|---|---|---|
| **P1** | No judgment is left | The routing question above, unchanged — *"새 판단이 남아 있는가?"* 남아 있으면 닫힌다 |
| **P2** | Passing is machine-decided | Write the pass command on one line, right now. Can't? Closed |
| **P3** | The output gates nothing | It gates no merge, no release, no decision until in-harness cross-verification clears it |
| **P4** | The repo may go to that provider | The first-use approval below is done, and this file set is inside what was approved |
| **P5** | It is **not the CLI you are running on**, and it can use a shell | Delegating to yourself is not a round trip; with no shell, this lane doesn't exist for you |

Even with all five true, **the in-harness repetitive lane is still the default.** Go outside when
mechanical work is eating capacity a judgment lane needs — and reach for the fewest tools that
answer the task, not every tool installed.

**First use in a repository is the user's call, not yours.** Routing implementation to an external
CLI puts this repository's code into another vendor's session — a disclosure none of the in-harness
lanes make. Before the first such delegation in a project, say which tool, which provider its own
config resolves to, which files the worker may touch, and what comes back; then wait. After that one
approval, routing inside the predicates above is yours. Ask again when the boundary moves — a
different tool, or files outside what was approved.

**Tool missing, auth expired, provider refused → step down a lane and report what you could not
use.** Never install it, never log in for them, and never quietly substitute a different provider:
the user knows which tool answered, so a silent swap makes your report false. Recognizing each
failure — and the exact wording for it — belongs to [[external-model-consult]]; where that skill
isn't installed, only the conclusion survives: stop and ask.

**This lane does not choose models.** The tool runs whatever its own config resolves to, and you
report what answered. A model id written down here goes stale and pins the user to a retired model.

**Call the tool's non-interactive mode from the shell.** Read the subcommand off `--help` rather
than typing one from memory, and stop and report if it isn't there. Writes stay isolated (worktree
or equivalent) — the parallel-write rule above holds for outside workers too.

The delegation prompt spec and the file-handoff contract below apply here unchanged: an outside
worker is still a worker.

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
  and stop every finished one before moving on. Compaction wipes the orchestrator's own ledger
  of open workers, so the sweep must use an enumeration probe (a TaskStop against a nonexistent
  id lists running teammates), not memory.

### Collect results as a file, not as a return message

A worker's final message is not durable transport — long results get truncated silently, and
what was cut is gone. This burned three separate times — most
recently a panel run that lost three reviewers' output — before it was codified as a gate.
The contract: the worker writes its deliverable to a scratchpad/output **file whose path the
orchestrator fixes in the spawn prompt** — collection is a spawn-time decision, because a
truncated reply cannot be retrofit into a file after the fact. The final message then carries
only the file path plus a short summary. Treat any delegation whose prompt names no output
file as not yet dispatched.

## V&V separation

The implementer never verifies its own work — the *instance* that wrote something never judges
it. How that plays out per lane:

- **Sonnet implemented** (반복·단순 구현) → **Opus cross-verifies** — a different model has
  different blind spots, which is the cheapest anchoring break available.
- **Opus implemented** (핵심 구현·테스트) → a **fresh Opus instance** verifies: a NEW agent with no
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
| Sonnet on tests, verification, or **core** implementation | Sonnet 의 레인은 반복·단순 구현(확립 패턴 적용)과 읽기 전용 보조까지다 — 테스트·V&V·새 설계 판단은 Opus/Fable 몫 |
| Sonnet 반복 구현물이 Opus 교차검증 없이 머지를 게이트 | 교차검증이 Sonnet 레인의 존립 조건이다 — 검증 없는 반복 구현은 레인 위반과 같다 |
| Effort below floor "to save tokens" | The floors ARE the policy; surface cost concerns to the user instead |
| Implementer verifying its own diff | Anchoring — verification needs fresh context, prefer a different model |
| Two agents writing the same files in parallel | Conflicting implicit decisions; keep writes sequential or worktree-isolated |
| Spawning an agent for what one direct tool call answers | 15× token multiplier for zero value — do trivial work directly |
| Relying on plan-level auto-fallback for continuity | Undocumented behavior; use the manual handoff protocol |
| Finished worker left running after its result is consumed | Subagent panes/windows accumulate (iTerm2 등) and idle pings pollute the session — TaskStop as one motion with consuming the result |
| 외부 실행기에 **테스트 작성·검증**·핵심 구현을 넘김 | 이 레인은 판단 잔여 0 인 일만 받는다 — 무엇을 단언할지 정하는 일을 밖으로 내보내면 외부 산출물을 검사할 기준 자체가 밖에 있게 된다. 형태가 이미 고정된 표에 케이스 한 줄을 복제하는 일은 무엇을 단언할지 정하지 않으므로 여기 해당하지 않는다 |
| 도구가 없어서 조용히 다른 제공자로 갈아타 실행 | 사용자는 어느 도구가 답했는지 알고 있다 — 대체는 보고 대상이지 판단 대상이 아니다 |
| 외부 실행기를 "품질이 더 낫다"는 이유로 고름 | 이 레인이 사는 것은 용량이다. 품질을 근거로 들면 이 정책의 quality-over-cost 전제를 뒤집는 것이다 |

## Quick reference

```
방향성 수립 / 설계·기획 확정 / 작업 분배 / 스펙 리뷰(multi-persona-review) / 기능 개선 / 성능·보안 문제발굴
                               → 오케스트레이터(Fable) 직접
스펙 문서 초안(Fable 브리프 기반) / 핵심 구현 / 테스트 작성·실행(E2E 포함) / 코드 리뷰·검증(V&V)
                               → opus  @ xhigh (또는 max)   — pinned role 또는 Workflow opts
반복·단순 구현(확립 패턴 적용) / 리서치 스윕
                               → sonnet @ high 이상 — 테스트·검증 투입 금지, 산출물은 Opus 교차검증
결정적 변환 (rename·포맷)      → 모델 위임 금지 — sed/grep/스크립트 직접
판단 잔여 0 + 합격을 명령 하나로 판정
                               → sonnet 기본 / 다섯 술어 충족 시 외부 실행기 — 최초 1회 사용자 확인, 산출물은 in-harness 교차검증
도구 부재·인증 만료            → 레인을 내리고 무엇을 못 썼는지 보고 — 대신 설치/로그인 금지, 조용한 제공자 교체 금지
위임 완료                      → 결과 수거와 동시에 TaskStop (SendMessage 재사용 예정 시만 유지 선언)
Fable 소진                     → compaction-handoff → opus @ max 가 오케스트레이터 대행
```
