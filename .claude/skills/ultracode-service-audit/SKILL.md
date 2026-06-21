---
name: ultracode-service-audit
description: >-
  Run a multi-agent, adversarially-verified full-service audit across 7 dimensions
  (code / UX / scalability / planning+north-star / security / promotion / extensible),
  separating findings into confirmed / unverified / rejected and producing a
  priority-ranked, M-numbered milestone roadmap (as many milestones as the findings warrant).
  Use when the user says
  "ultracode 전체 서비스 점검", "전체 서비스를 점검하자", "코드·UX·확장성·기획·북극성지표·보안·홍보 문제점을 파악하고 우선순위에 따라 개선",
  "다차원 서비스 감사", or in English "audit the whole service / full multi-dimensional service audit /
  find code, UX, scalability, planning, security, and marketing problems and prioritize fixes".
  The heavyweight superset audit — orchestrate it as a Workflow with fan-out finders and an adversarial verify pass.
  NOT for a single-artifact prose/README review (use multi-persona-review) or a single-axis
  gap-vs-benchmark loop (use gap-analysis-e2e) — those are the lighter siblings.
---

# Ultracode Service Audit

The heavyweight, multi-agent audit of an *entire* service across many dimensions at once.
The fan-out is orchestrated as a **Workflow / multi-agent run, and it can be large** — the real
run drove many agents in parallel, not a 7-agent minimum. "ultracode" implies that heavyweight
parallelism: a finder (often several) per dimension plus a separate squad of verifiers. Where a
single skill inspects one axis (UX, or code, or strategy), this one fans out finder agents per
dimension, then runs a **separate adversarial verification pass** so that only findings that
survive cross-examination are reported as real. The output is one priority-ranked roadmap where
every item is dimension-tagged, evidence-graded, and traceable to the product's North Star.

This is the skill behind the user's real request (turn 94):

> "ultracode 현재까지 개발한 내용을 기준으로 전체 서비스를 점검하자. 코드상 문제, UX 상 문제,
> 확장성 문제, 기획 및 북극성지표, 보안상, 홍보상의 문제점을 파악하고 각각의 개선점 ...
> 우선순위에 따라 개선하자"

That run produced **확정 29 / 미검증 0 / 기각 8** — the confirmed/unverified/rejected split
is not decoration, it is the whole point. The **미검증 0 was *that run's* outcome, not a
guarantee the bucket goes unused**: the 미검증 bucket is load-bearing and stays in the report
the moment any finding lands with no verifier votes. A finding nobody could verify never gets
reported as fact.

## When to use

- The user wants a **whole-service health check**, not one narrow review — "전체 서비스를 점검하자",
  "다차원 감사", "audit everything before launch / before we promote".
- You have the **Workflow / ultracode multi-agent capability** available (this skill assumes you
  can fan out independent agents and re-aggregate). Without it, fall back to running the
  dimensions sequentially yourself — but step 3 forbids a finder from grading itself, so
  sequential mode **cannot produce a true 확정**. In that mode, never emit 확정 verdicts: label
  every finding 미검증 or evidence-backed-only (a failing test / exposed secret / reproduced
  crash counts; an opinion does not), and state plainly in the report that no independent
  verification ran. That keeps the no-false-ship invariant honest when fan-out is absent.
- You need an output that is **prioritized and trustworthy** — every claim graded, weak claims
  sunk in the ranking, nothing over-claimed.

If the user only wants one axis, use the focused sibling instead (see Cross-references). This
skill is the superset; don't reach for it when a scalpel will do.

## The seven dimensions (extensible)

Each dimension gets a **named, enumerated rubric** before any auditing starts, so findings are
checked against explicit criteria rather than vibes. This is the discipline behind heuristic
evaluation (Nielsen / NN/g): a violation of a named rule is a *candidate* defect, justified
against context — not an automatic one.

| # | Dimension | Rubric to hand the finder agent |
|---|-----------|----------------------------------|
| 1 | **Code** | correctness/logic, security (injection, authz, exposed secrets), readability, tests-that-fail-when-logic-breaks, design/architecture fit (SonarSource multi-axis review) |
| 2 | **UX** | Nielsen's 10 usability heuristics; rate severity by impact, not by rule-match count |
| 3 | **Scalability** | data-model limits, hot paths, statefulness, single points of failure, cost-per-unit growth |
| 4 | **Planning + North Star** | the one North Star metric + its Inputs (Amplitude); does each finding move the metric or an Input? |
| 5 | **Security** | secrets exposure, authz boundaries, dependency CVEs, input trust, data egress |
| 6 | **Promotion / Marketing** | Working-Backwards: take the product's *implied PR/FAQ* (its promised value) and audit whether the built service + its messaging actually deliver — surface over-claim / false-ship gaps |
| 7 | **+ Extensible** | add a dimension by giving it (a) a named rubric and (b) its own independent verifier. Nothing else changes |

The framework set is load-bearing, not ornamental:
- **Heuristic Evaluation / Nielsen's 10** — named criteria per dimension, independent evaluators,
  severity by impact. <https://www.nngroup.com/articles/how-to-conduct-a-heuristic-evaluation/>
- **Multi-axis code review** — distinct correctness/security/tests/design axes beat one
  "looks good". <https://www.sonarsource.com/resources/library/code-review/>
- **North Star Framework** — anchors dimension 4; filters strategically immaterial noise.
  <https://amplitude.com/books/north-star/about-north-star-framework>
- **Working Backwards (PR/FAQ)** — the inverse-test for promotion + planning: promised value vs
  delivered. <https://workingbackwards.com/concepts/working-backwards-pr-faq-process/>

## Core workflow

Orchestrate this as a **Workflow**: fan-out → adversarial verify → synthesize.

### 1. Scope and set North Star (pre-flight)
Read the service's SPEC/PRD/NORTH_STAR and recent state. Name the North Star metric and its
Inputs explicitly — they are the strategic anchor every finding will be tested against. If you
can't state the North Star, stop and ask; auditing dimensions in isolation with no anchor just
generates busywork.

### 2. Fan-out: independent finder(s) per dimension
Spawn at least one finder agent for each dimension with **its own rubric** (table above) — and
spawn several per dimension where the surface is large. This is the heavyweight step: a real run
fans out to **many agents in parallel**, not a fixed seven. Run them
**independently** — NN/g's finding is that independent passes catch issues a single pass misses
(3 evaluators ≈ 60% of issues; one agent per dimension is not enough on its own, which is why
step 3 exists). Each finder returns candidate findings with: dimension tag, the rubric item
violated, the evidence it actually observed, and a proposed severity.

### 3. Adversarial verify pass (the load-bearing step)
This is **a distinct second pass**, not the finders grading themselves. Re-order the reviewer
agents and give them *diverse* prompts/roles, then task them with peer-reviewing every round-one
assertion. This is Multi-Agent Verification (BoN-MAV): reliability scales at test time by
running multiple independent verifiers and accepting only what survives cross-validation.
<https://arxiv.org/pdf/2502.20379>

Decision rule per finding:
- **Confirmed (확정)** — survives verification, or carries irrefutable evidence (a failing test,
  an exposed secret, a reproduced crash). Verifier consensus, not one voice.
- **Unverified (미검증)** — **0 adversarial-verify votes** and no hard evidence. Kept in a
  separate bucket. **Never reported as fact.** This is the no-false-ship invariant
  (`.claude/rules/no-false-ship.md`).
- **Rejected (기각)** — majority of verifiers refute it (rubric-match without real defect, wrong
  reasoning, already handled). A majority refute *kills* the finding.

> Engineer verifier diversity deliberately. MAV names the failure mode that breaks the whole
> ensemble: **correlated-verifier collapse** — if every reviewer shares the same model, prompt,
> and blind spot, the adversarial pass rubber-stamps wrong findings and hands you false
> confidence. Vary roles, ordering, and prompts so verifiers don't share blind spots. If you
> cannot achieve independence, say so in the report and downgrade your confidence accordingly.

### 4. Cap the loops
Verification cost scales with verifier count and debate rounds. Set a hard ceiling on
revision/debate iterations (this is a `gates-taxonomy` Revision gate — iteration cap mandatory)
and **escalate to the user rather than loop forever** on a contested finding. Unbounded debate
buys diminishing returns at runaway token cost.

### 5. Score surviving findings with RICE
Rank confirmed (and any carried-forward unverified) findings with **Reach × Impact × Confidence
/ Effort** = impact per time worked.
<https://www.intercom.com/blog/rice-simple-prioritization-for-product-managers/>

The **Confidence multiplier is where the verification tier pays off** — map it directly:

| Verdict | RICE Confidence |
|---------|-----------------|
| Confirmed + hard evidence | 100% |
| Confirmed by verifier consensus | 80% |
| Unverified (carried, not dropped) | 50% or lower |

This makes weakly-evidenced findings **sink in the ranking automatically** — you carry them
honestly instead of either pretending they're certain or silently deleting them. Rank by raw
severity or gut feel and high-impact-but-unproven items jump the queue; the Confidence term
exists precisely to stop that.

### 6. Synthesize the M-numbered roadmap
Cluster surviving findings (affinity-style), trace each to the North Star or an Input (drop the
strategically immaterial), and emit a milestone roadmap with **as many milestones as the
findings warrant** — M1, M2, … however far the work runs (the real run landed at M4). There is
no fixed milestone count; severity and clustering decide it. Every roadmap item carries:
**dimension tag · verdict · RICE score · North-Star linkage · evidence pointer.** Items that
don't move the metric or an Input are flagged as nice-to-have, not milestone-blocking.

## No-false-ship evidence matrix

Because this audit *itself* can over-claim, report each dimension's verification the same way the
repo's `no-false-ship` rule demands for shipped features — per-path evidence, unverified shown as
unverified, never one path's evidence reused for another:

```
| Dimension   | Finder evidence            | Verifier outcome        | Verdict   |
|-------------|----------------------------|-------------------------|-----------|
| Code        | failing test repro'd       | 3/3 verifiers confirm   | 확정      |
| UX          | heuristic #4 violation     | 2/3 confirm, context ok | 확정      |
| Security    | suspected authz gap        | 0 verifier votes        | 미검증    |
| Promotion   | README claim vs built      | majority refute         | 기각      |
```

A row with no verifier votes stays "미검증" in the final report. Hiding it and declaring "audit
complete" is exactly the false-ship failure this skill exists to prevent.

## Worked example (Input → Output)

**Input** (user, verbatim trigger):
> "ultracode 전체 서비스를 점검하자 — 코드·UX·확장성·기획·북극성지표·보안·홍보 문제점 파악하고
> 우선순위에 따라 개선하자."

**Process:**
1. Pre-flight: North Star = "weekly successful first-install completions"; Inputs = wizard
   completion rate, CLI flag coverage, install success rate.
2. Fan-out: 7 finders, each with its rubric. ~40 raw candidate findings.
3. Adversarial verify (re-ordered, diverse verifiers): 29 survive, 8 refuted, several land in
   미검증 with 0 votes and stay there.
4. Loop cap hit on one contested scalability claim → escalated to user, not debated to death.
5. RICE: a confirmed-with-failing-test code bug (Confidence 100%) outranks a plausible-but-
   unverified marketing gap (Confidence 50%) even though the marketing gap *felt* bigger.
6. Synthesize.

**Output** (abridged):
```
Service Audit — 확정 29 / 미검증 (carried) N / 기각 8

M1 (now):   [Code·확정·RICE 9.6]  install crash on --with-* flag (failing test attached)
            [Security·확정·RICE 8.1] secret in committed config — moves Input "install success"
M2:         [UX·확정·RICE 6.4]   wizard step skips a category — moves Input "wizard completion"
M3:         [Scale·확정·RICE 4.2] category list hardcoded in 2 places → derive
M4:         [Promotion·확정·RICE 3.5] README over-claims a feature (Working-Backwards gap)
Parked:     [Security·미검증·conf 50%] suspected authz gap — needs reproduction before action
Rejected:   8 findings (rubric-match without real defect / already handled)
            (the run stopped at M4 — milestone count follows the findings, it is not a fixed five)
```
Every M-item: dimension-tagged, verdict-graded, North-Star-linked, RICE-ranked.

## Cross-references (don't duplicate — hand off)

- **UX dimension** can spawn the multi-persona UX review skill (`multi-persona-review`) for
  deeper persona-based heuristic inspection instead of a single UX finder.
- **Gap findings** (built vs promised, missing E2E coverage) hand off to `gap-analysis-e2e`
  rather than being re-derived here.
- **The roadmap output** feeds `northstar-roadmap`, which owns milestone sequencing and
  North-Star input modeling in depth.
- For repo discipline this skill enforces: `.claude/rules/no-false-ship.md` (evidence matrix,
  confirmed/unverified/rejected) and `.claude/rules/gates-taxonomy.md` (Revision-loop cap,
  Escalation on contested findings).

## Progressive disclosure

This SKILL.md is the operating manual. If per-dimension rubrics need to grow (e.g. a full
Nielsen severity scale, or a language-specific code-review checklist), put them in a
`reference/` file beside this one and link it here — keep this file lean. The extensibility
contract stays: a new dimension = a named rubric + its own independent verifier, nothing else.
