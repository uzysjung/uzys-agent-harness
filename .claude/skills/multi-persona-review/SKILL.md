---
name: multi-persona-review
description: >-
  A panel-review skill that critiques ONE artifact (launch post, README, doc, markdown, plan,
  design) via 3-5 disjoint user-perspective personas running in parallel, then synthesizes deduped,
  severity-ranked improvement points (P0/P1/P2). Use when the user says "작성글을 사용자 관점의
  페르소나를 여러명 만들어서 (손넷 모델정도로) 피드백 받아바", "다면 리뷰 해볼까", "페르소나로 리뷰",
  "여러 관점으로 피드백", or in English "multi-persona review", "review this from different user
  perspectives", "get persona feedback on this post/README/doc", "panel review this artifact".
  Lighter than a full service audit — point it at ONE artifact, not a whole codebase. Do NOT use it
  for a whole-service or whole-codebase audit, nor for a gap-vs-benchmark loop (both are
  audit-service-gaps), and do NOT simulate diversity by renaming reviewers that inspect the same
  evidence.
---

# Multi-Persona Review (다면페르소나 워크플로우 리뷰)

Run a small panel of realistic target-user personas over one artifact, independently and in
parallel, then synthesize their findings into a deduped, prioritized fix list. This is how the
user actually works: "작성글을 사용자 관점의 페르소나를 여러명 만들어서 손넷 모델정도로 피드백 받아바"
and "이부분도 다면 리뷰 해볼까?" — 4-5 Sonnet-tier personas across 1-2 passes over a launch post,
yielding P0~P2 prioritized fixes.

## When to use

- A draft is "done" but you want blind spots an author is fatigue-blind to: launch post, README,
  PRD/plan, doc, marketing copy, a design.
- The user names personas or "다면 리뷰" / "여러 관점" / "multi-persona" / "panel review".
- You want **reproducible, severity-ranked** feedback, not one reviewer's gut reaction.

Do **not** use this for whole-codebase quality work or for a gap-vs-benchmark loop — that is
`audit-service-gaps` (its FULL and BENCHMARK modes). This skill is deliberately lighter: one
artifact, one panel, one synthesis. For surfacing missing user journeys end-to-end, this feeds the
user-perspective lens of `audit-service-gaps`.

## Why a panel beats one reviewer (the evidence)

The whole method rests on one empirical fact: **independent reviewers find largely
non-overlapping problems.**

- **Heuristic Evaluation (Nielsen & Molich) + the 3-5 evaluator rule** — a single evaluator
  catches only ~35% of usability issues; aggregating independent evaluators raises coverage to
  ~85% at five, with sharp diminishing returns beyond. The value comes from *low overlap between
  perspectives*, not any one reviewer being thorough. Some of the hardest issues are found by an
  evaluator who otherwise finds few. Each judges against the *same explicit checklist* so reviews
  stay comparable and dedupable.
  https://www.nngroup.com/articles/how-to-conduct-a-heuristic-evaluation/theory-heuristic-evaluations/
- **Panel of LLM evaluators (PoLL)** — a panel of several smaller, *disjoint* judges beats one
  large judge, shows less self-preference bias, and costs ~7x less. This is the cost-tier reason
  the user runs the persona panel at Sonnet tier and reserves the main model for orchestration and
  synthesis. https://arxiv.org/abs/2404.18796
- **"Nine Judges, Two Effective Votes"** — panels help *only to the extent members fail
  independently*. A 9-judge panel carried only ~2 independent votes' worth of information because
  the models made the same mistakes on the same items. The bottleneck is **correlated reviewers,
  not panel size or aggregation math** — so persona design must maximize genuine viewpoint
  diversity, not nominal count. https://arxiv.org/abs/2605.29800
- **LLM-as-persona-reviewer vs human experts (GPT-4o study)** — persona review finds many real
  issues but also emits false positives humans wouldn't flag, and misses issues needing embodied
  experience. Recommended posture: a **hybrid** where personas generate candidate findings that a
  human validates — never a replacement for human judgment. https://arxiv.org/pdf/2506.16345
- **RICE prioritization (Intercom)** — (Reach × Impact × Confidence) / Effort turns rough guesses
  into one comparable score, down-weighting low-confidence/high-effort items and countering the
  reviewer's bias toward what they'd personally use. A lightweight analog gives a *defensible,
  reproducible* map from findings to P0/P1/P2.
  https://www.intercom.com/blog/rice-simple-prioritization-for-product-managers/

## Core workflow

### 1. Frame the artifact (orchestrator, main model)

Capture three things the personas will all share:
- **Goal** — what is this artifact trying to achieve? (e.g. "get a developer to `npx` install in
  under 2 minutes and star the repo")
- **Audience** — who is the real target reader?
- **Rubric** — the shared checklist every persona scores against, so findings are comparable and
  dedupable. Default rubric (adapt to the artifact): *clarity of value prop · first-action
  friction · credibility/trust signals · scannability · accuracy/honesty · accessibility ·
  call-to-action*. Without a shared rubric, red-team reviews decay into proofreading and generic
  opinions, and findings stop being comparable across personas.

### 2. Design 3-5 genuinely disjoint personas

Cap the panel at five — coverage flattens beyond that, and extra personas mostly inflate tokens
and false confidence (the "Nine Judges" trap). Engineer **diversity, not count**: pick personas
with disjoint goals, contexts, and *failure-fears* so their blind spots don't correlate. A strong
default spread:

| Persona | Lens / what they fear |
|---|---|
| Skeptical newcomer | Doesn't know the domain; fears wasting time on hype. Tests "do I get it in 10s?" |
| Time-pressured expert | Knows the domain; fears fluff between them and the command. Tests scannability + first action. |
| Accessibility-dependent user | Screen reader / low vision / non-native reader. Tests structure, alt text, plain language. |
| Hostile/adversarial reader | Looks for overclaims, vague benefits, anything to dismiss. Tests honesty + credibility. |
| Adjacent-tool migrant *(optional 5th)* | Already uses a competitor. Tests differentiation + "why switch?". |

Swap personas to fit the artifact (e.g. for a PRD: implementing engineer, on-call SRE, PM,
security reviewer). The test is always: would these two personas make the *same* mistake? If yes,
they're not independent — replace one. The mechanical version of that test, more lens patterns per
artifact type, and the fixed field list each reviewer returns are in
[references/reviewer-design.md](references/reviewer-design.md).

Model provenance is a **correlation control, not a lens** — designing lenses comes first, choosing
which seat an outside model fills comes second. The mechanics are in
[references/reviewer-design.md](references/reviewer-design.md).

### 3. Review in parallel, independently (Sonnet-tier panel)

Spawn one sub-agent per persona via the **Task tool** (or the harness's sub-agent mechanism). Each
one gets the artifact + goal + audience + the *same* rubric, and **must not see the other personas'
output** — independence is the precondition that makes aggregation add information. Anchoring on a
peer collapses the panel toward one effective vote.

**Have each persona write its findings to a file, not return them inline** — a panel report is
exactly the long payload that gets dropped in transit, and the loss is silent. Losing one persona's
report does not merely cost that report: it quietly shrinks the panel, which is the one variable
the whole method depends on (see "Nine Judges, Two Effective Votes" above). Name the path when you
spawn, not after — see [[model-orchestration]] "Worker lifecycle" for the general rule.

Prefer pinning the persona sub-agents to a cheaper tier (Sonnet) — see the cost-tier note. But this
degrades gracefully: if the harness can't pin sub-agents to a specific model, just run the panel on
the default sub-agent model and note in the step-6 coverage caveat that the panel ran at the
orchestrator tier. The tier is an economy, not a hard prerequisite.

Each persona returns findings as **strengths / weaknesses / specific recommendations**. Require
every finding to be specific and actionable: **quote the offending passage and propose a concrete
fix.** Ban vague "needs work" notes — that's the classic red-team failure mode (briefing +
structured findings + independence are the load-bearing parts, not the critical attitude).
https://loopio.com/blog/red-team-review/

#### Seats an outside tool can fill

**A panel that spans more than one tool is the user's call before it runs, not after.** Name the
tools that will answer, how many external round-trips that is, and what text leaves the machine;
then wait. Native reviewers are the default — one outside seat is a considered upgrade, several are
a bill the user has not seen yet.

Spend that seat where a miss costs the most: a judgment that is expensive to reverse, a surface like
UI/UX where one model's default taste becomes the answer, or a panel you already ran and suspect
every member missed the same thing in. Otherwise native is the default.

The outside seat goes out through `external-model-consult` where installed — the call itself, its
guardrails, and its failure handling are that skill's and are not repeated here. Where it isn't
installed the seat doesn't exist, and the panel runs native.

If the seat cannot be filled — the consult skill is not installed, its CLI is missing, auth expired,
or the provider refused — do **not** quietly replace it with another native reviewer of the same
shape; that keeps the count and loses the independence, which is the only variable this method's
value is made of. Fill it with a lens that fears a different failure, and record in the step-6
coverage caveat which seats were native and which were external, and which model answered each.
A panel's claim rests on how its members fail; a reader who cannot see who answered cannot audit it.

### 4. Synthesize: dedupe, but preserve minority findings (orchestrator, main model)

**Close every panel worker as you collect it.** A panel is the highest fan-out this method runs —
3-5 workers spawned in one breath — so it is also where leftovers accumulate fastest: a finished
agent keeps its pane/window open and keeps pinging the session, and after two or three panels the
clutter is the session. Read the persona's report file, then stop that agent in the same motion
(TaskStop or the harness's stop mechanism); do not defer it to "cleanup later". By the time you
start deduping, zero panel agents should still be running. The general rule and its rationale live
in [[model-orchestration]] "Worker lifecycle" — this is that rule at panel scale.

Do **not** keep the panel alive for the step-6 second pass. Re-verification wants a *fresh* agent
reading the fixed artifact from disk, not a resumed one carrying its own first-pass findings —
a resumed reviewer grades against its memory of what it already said, which is the anchoring
failure this method exists to avoid.

Collapse overlapping findings into one entry, noting *how many personas raised it* (frequency is a
prioritization signal). **But never drop a single-persona finding** — heuristic-evaluation data
says the hardest, most valuable issues are often raised by only one reviewer. Majority-vote /
consensus filtering would silently discard exactly those. Keep them, tagged as single-source.

When two personas recommend contradictory fixes, do not average them — resolve against the
artifact's declared goal and the stronger evidence, and keep the rejected alternative on the record
([references/reviewer-design.md](references/reviewer-design.md), "Conflict resolution").

### 5. Prioritize with a transparent rule → P0/P1/P2

Map each finding to a bucket with a **reproducible** rule, not by gut feel or by which persona
phrased it loudest. Use a RICE-style or **severity × frequency** score:

- **P0** — blocks the artifact's goal for many readers (e.g. value prop unreadable in first
  screen; a false claim). High impact × high confidence, any effort.
- **P1** — meaningfully hurts conversion/trust but has a workaround.
- **P2** — polish, edge-reader, or low-confidence/high-effort items.

Show the score inputs so the ranking is auditable.

### 6. Triage as candidates, state coverage honestly

Present the list as **candidate findings needing a validation pass**, not gospel. Flag likely
false positives and note where real-user confirmation is warranted before committing fixes — LLM
personas both miss embodied issues and invent non-issues. End with an honest coverage caveat: a
panel never finds every issue and offers no systematic fix generation (Nielsen's own caveat).
Claiming exhaustiveness here would be a false-ship.

**Say where each seat came from**, not only which tier it ran at: how many reviewers were native,
how many external, and which model answered each. A caveat that reports the tier alone turns false
the moment the panel spans tools, and provenance a reader can't see is a panel they can't reproduce.

**Second pass (the "1-2 passes"):** run the same panel again *after fixes land* to confirm the P0s
are actually closed and that the edits didn't introduce new issues. **One pass to find, one to
verify — a third rarely pays off.** Use a *fresh* agent per persona, never a resumed one, for the
anchoring reason in step 4.

A complete Input → Output run — trigger sentence, four personas' raw quotes and proposed fixes, the
deduped findings table with severity × frequency and buckets, and the caveat returned to the user —
is in [references/worked-example.md](references/worked-example.md).

## Cost-tier note

Run the **persona panel at a cheaper tier (Sonnet)** — PoLL shows a disjoint panel of smaller
judges beats one big judge at a fraction of the cost. Reserve the **main/orchestrator model** for
framing the rubric and synthesizing (steps 1, 4-6), where reasoning quality pays off most. Where
the harness cannot pin a sub-agent's model, run the panel on the default sub-agent model and say so
in the coverage caveat — the tier is an economy, not a prerequisite.

## Output, side effects, and stop conditions

- **Output** — persona definitions plus why they are disjoint · per-persona findings, each with a
  quoted passage and a concrete fix · the deduped, attributed findings table with score inputs and
  P0/P1/P2 · contradictions and the rejected alternative · the honest coverage caveat.
- **Side effects** — spawning reviewers changes runtime state, and every worker must be stopped as
  its report is collected (step 4). Reviewers stay read-only unless the user asked for edits and
  each worker owns a disjoint file set.
- **Stop** at five lenses, or earlier when one more persona would inspect the same evidence with
  the same failure fear — that persona buys tokens, not coverage.

## Pitfalls to avoid

- **False diversity** — personas that share the model's default assumptions give far fewer than N
  views. Design for disjoint fears; if two would make the same mistake, replace one. Renaming a
  reviewer does not create a second reviewer.
- **Scaling count to fix quality** — past ~5 personas you mostly buy tokens and noise. Fix
  independence, not size.
- **Consensus filtering** — dropping single-persona findings discards the rare, hard issues that
  are the whole point.
- **Anchoring** — letting personas see each other's output before judging collapses the panel.
- **Opaque P0/P1/P2** — ranking by vibe or loudest wording is unauditable. Show the score.
- **Over-claiming coverage** — report it as candidate findings, never "found everything."
- **Leaving the panel running** — the panel dies when you stop it, not when it answers. N finished
  agents left open per review is the fastest way to a session full of idle workers; stop each one
  as you read its report (step 4).
- **Buying tools instead of lenses** — the same lens seated twice with a different model behind it
  is still one reviewer with two names. A second vendor lowers correlation only between lenses that
  already differ; it is never a substitute for designing them.
- **Unlabelled provenance** — if the caveat doesn't say which seats answered from outside, the
  coverage claim can't be audited and the panel can't be reproduced.

## Cross-references

- `audit-service-gaps` — the multi-mode service audit. Its FULL mode is the whole-service sweep
  this skill is deliberately lighter than, and its user-perspective lens delegates *here* instead
  of re-implementing persona evaluation.
- `north-star` — the same target state seen from the other end: it *directs* the product; a panel
  only judges one artifact against a goal you already hold.
- `recurrence-prevention` — borrows this panel's mechanics to design countermeasures when the
  failure model itself is disputed.
- `external-model-consult` — its persona mode also answers "다면 페르소나 / second opinion"
  phrasing, but through ONE external model call role-playing several personas. Prefer THIS skill
  for a native, genuinely independent parallel panel; reach for the external consult when a
  non-Claude model's opinion is specifically the point. A third shape now exists — a native panel
  with one seat filled from outside — and the confirmation before running it belongs here
  ("Seats an outside tool can fill"), not there.
- A UI artifact wants design-specific critique with anti-pattern detection rather than prose
  review — use whichever design-critique skill the project installs, not this one.
