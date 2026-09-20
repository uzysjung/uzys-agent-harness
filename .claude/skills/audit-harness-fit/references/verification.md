# User Journeys, Verification, and Execution Routes

## Contents

- [Start from the usage scene](#start-from-the-usage-scene)
- [Choose sufficient evidence](#choose-sufficient-evidence)
- [Choose timing and change boundaries](#choose-timing-and-change-boundaries)
- [Reuse evidence with explicit invalidation](#reuse-evidence-with-explicit-invalidation)
- [Choose a suitable execution route](#choose-a-suitable-execution-route)
- [Demonstrate improvement honestly](#demonstrate-improvement-honestly)

## Start from the usage scene

Use confirmed requirements and accessible product evidence to identify **actor,
precondition, action/input, observable outcome, and consequential failure/recovery**
where relevant to the change. Actors include end users, operators, API consumers,
and scheduled jobs. Reuse established context; keep assumed goals distinct from
accepted requirements. An isolated contract change can use its existing contract
without reopening the whole product brief.

Propose the smallest coherent implementation slice that delivers the requested
outcome. Required persistence, retrieval, authorization, and recovery belong in
that slice even when the visible screen already works. Choose boundaries that
support useful feedback and manageable risk; extend only with requested capabilities.
This skill proposes implementation and verification guidance, not product-code edits.

## Choose sufficient evidence

Map each affected scene or critical contract to an observable pass condition and
sufficient evidence. Reuse existing coverage. A compact form, when useful, is:

| Scene / contract | Observable pass condition | Existing or proposed evidence | Required gate / optional check; owner where relevant |
|---|---|---|---|

Choose the reliable level or combination with the lowest reasonable total burden:
unit checks for isolated logic, integration for real boundaries, and E2E when a
whole-path claim needs evidence. Include setup, selection, execution, diagnosis,
and maintenance effort. A fast, reliable full suite can be simpler than elaborate
selection. A user-facing slice does not require every assertion to be E2E.

For example, saving and retrieving a record may use persistence integration coverage
and a representative UI journey, with input validation at unit level. This is an
illustration, not a universal test prescription. Target changed behavior, credible
failure/recovery paths, and affected dependencies rather than every private function,
a coverage quota, or unrelated hypothetical edge case.

Treat consequential contracts such as authorization, payments, integrity, concurrency,
migration, and interoperability as explicit verification targets when affected.
Each needs evidence adequate to its claim; a happy-path screenshot alone cannot
establish these properties. One test or execution can cover several contracts when
its assertions and conditions actually support each. Separate targets do not by
themselves require separate runs or separate reviewers. Add checks for evidence gaps,
credible risk, or applicable policy; required review independence is a separate issue.

A new check is shown to bite once, when it is introduced (failing on the bad case,
passing on the fix); it then stands on its own without a standing check of the check.
Size a safeguard by observed frequency, damage, and reversibility rather than by how
strongly it was requested, and count its per-run cost against the incident it prevents.

Identify binding tests and independent-review gates from their policy / CI source.
Explicit project policy can bind even without CI enforcement. Preserve those gates;
route disproportionate mandatory requirements to a separate policy decision. Retain
an unclear gate pending clarification while continuing work independent of it.
Generic requests to "think again" are assessed for evidence value, not presumed gates.
Document-only effects normally need document checks unless policy or dependencies
require more. State checks not run and the resulting limits.

## Choose timing and change boundaries

Choose verification timing and batch size for useful feedback, uncertainty, impact,
and recoverability. Resolve costly assumptions and unproven boundaries early enough
to avoid building substantial work on an unsupported contract. Run quick local checks,
incremental tests, or a broader bundle when they offer the best feedback for the task.
Use existing tools and evidence before introducing new process overhead.

Work may proceed in parallel when it is isolated or relies on sufficiently established
contracts. Make consequential unverified assumptions visible and contain their impact.
As a change grows beyond reliable review or recovery, split it or verify the uncertain
boundary sooner. Complete the evidence required for acceptance and applicable merge /
release gates before crossing those boundaries.

Organize edits into coherent, reviewable, recoverable units. Follow the project's
commit policy and actual authorization; logical change boundaries are not a command
to commit each edit. Existing diffs, checkpoints, or version history can support
recovery where appropriate. Commit and push actions remain outside this cleanup.

Assess a prescribed cadence by the evidence it adds and its total cost. Checking a
changed state can be useful even after a small edit; repeating a check with unchanged
relevant conditions may add nothing. Per-edit full suites, continuous checks, batched
verification, and targeted runs can each be suitable. Retain explicitly required
cadence and propose policy changes separately. Choose a method instead of replacing
one universal schedule with another.

## Reuse evidence with explicit invalidation

Use existing results to establish what was checked, relevant source state, inputs /
dependencies, environment, and result. Add missing material provenance only. Existing
records are sufficient when they support that determination; a new evidence-management
or fingerprinting framework is not a prerequisite.

Reuse a result when its coverage and relevant conditions still hold. Reassess and
recheck affected scope when code, configuration, dependencies, meaningful inputs,
environment, or acceptance criteria change; coverage is insufficient; a failure or
credible nondeterminism remains; or policy requires a new run. A changed dependency
can invalidate evidence beyond the edited file. When impact is uncertain, widen the
check enough to address that uncertainty.

Reuse unaffected optional results when another reviewer arrives, a response is due,
or time passes without a relevant validity limit. Time-sensitive credentials, data,
or environment guarantees may themselves expire. Finish optional verification when
acceptance conditions have sufficient evidence and remaining uncertainty is within
accepted risk boundaries. Report residual uncertainty; a past pass does not certify
a new state.

## Choose a suitable execution route

Reuse the established routing policy and current route by default. Change routes
when task-specific evidence supports a better quality / effort trade-off. Options
can include an existing deterministic tool, the current agent, a specialist, a
lower-cost capable model, a more capable model, or an authorized human reviewer.
Routine tasks need no repeated model comparison.

Consider expected answer quality, reliability, latency, total cost, context-transfer
and review effort, data boundaries, and required independence. Delegate when the
likely benefit justifies the handoff. A model's name, price, or recency alone does
not establish task fitness; use configured capabilities and relevant observations.

Before an actual call, establish that the tool / model exists and applicable data,
permission, and cost boundaries permit it. Reuse valid configuration and approvals.
A read-only audit can propose a route without invoking it. Send a bounded question
with the scene or contract, constraints, necessary evidence, uncertainty, acceptance
criteria, and requested decision. Minimize sensitive context and unnecessary repetition.

Model judgment complements executable evidence. Do not present an opinion as a test
result, self-review as required independent review, or a proposed handoff as executed.
Where independence is required, use a genuinely separate permitted reviewer/process;
a different model label alone does not supply it. Keep required review pending when
no suitable route is available, identify an allowed alternative, and continue work
that does not depend on the unmet gate. This guidance adds no universal review gate.

## Demonstrate improvement honestly

Distinguish a well-supported guidance proposal from observed improvement in delivery.
Structural validity, fewer words, fewer tool calls, and model agreement do not by
themselves prove better outcomes. Use existing observations first; select a small
representative comparison only when it can resolve a material uncertainty.

For an authorized comparison, hold the accepted outcome, quality criteria, and
safeguards constant. Compare completion and relevant regressions first, then useful
available measures of elapsed work, cost, avoidable questions, and rework. A method
can improve efficiency at retained quality or improve quality within the permitted
budget. Evidence lost from an affected critical contract is not an efficiency gain.

Account for task difficulty, model/tool configuration, and repeated-task familiarity
when interpreting a result. Report what was observed and its limits; a successful
case supports its tested scope, not universal superiority. Restore or revise a trial
that misses acceptance criteria, increases material risk, or loses its expected value.
[Apply](apply.md) governs authorization and adoption. Clear supported edits can proceed
without an experiment; comparisons stay bounded to decisions that need them.
