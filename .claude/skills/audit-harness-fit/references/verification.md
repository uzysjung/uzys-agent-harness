# User Journeys, Verification, and Model Delegation

## Contents

- [Start from the usage scene](#start-from-the-usage-scene)
- [Choose sufficient evidence](#choose-sufficient-evidence)
- [Bundle verification by completed scene](#bundle-verification-by-completed-scene)
- [Reuse evidence with explicit invalidation](#reuse-evidence-with-explicit-invalidation)
- [Delegate only when the judgment warrants it](#delegate-only-when-the-judgment-warrants-it)
- [Demonstrate improvement honestly](#demonstrate-improvement-honestly)

## Start from the usage scene

Use confirmed requirements and accessible product evidence to identify **actor,
precondition, action/input, observable outcome, and consequential failure/recovery**.
Actors can be end users, operators, API consumers, or scheduled jobs. An assumption
about a persona or goal remains an assumption, not a requirement inferred from code.

Propose the smallest working end-to-end implementation slice for the requested
outcome. A visible screen is not complete when its required persistence, retrieval,
authorization, or error recovery is absent. Extend only with requested capabilities.
This skill proposes how to implement and verify; it does not change product code.

## Choose sufficient evidence

Map each affected scene or critical contract to a check and an observable pass
condition. Reuse existing coverage. A compact form is:

| Scene / contract | Observable pass condition | Existing check or proposed check | Required or optional; execution / review owner |
|---|---|---|---|

Choose the narrowest reliable level: unit for isolated logic, integration for real
boundaries, and E2E for journeys requiring whole-path evidence. A slice being end-to-end
does not mean every test must be E2E. Avoid testing every private function, arbitrary
coverage targets, duplicate layers that prove nothing new, and running the entire
suite after each edit solely because a prompt demands it.

For example, saving a record and later retrieving it may need persistence integration
coverage and one representative UI journey; validation edge cases can stay at unit
level. This is an example, not a fixed test prescription for every product.

Scale optional checks with impact, affected dependencies, uncertainty, and reversibility.
Include credible negative/recovery paths and non-visible contracts such as authorization,
data integrity, payments, concurrency, migration, and interoperability when affected.
Happy-path screenshots do not establish those contracts. Avoid expanding to every
hypothetical edge case unrelated to the change.

Required tests and independent-review gates remain binding. Identify their policy /
CI source: an explicit project test policy can be mandatory even without CI enforcement.
Distinguish those gates from generic requests to "think again"; if their status is
unclear, retain them pending a policy decision. When a required gate seems
disproportionate, propose a separate policy decision;
do not disable it, lower its threshold, or relabel it to make cleanup succeed.
Document checks are sufficient for document-only effects unless applicable policy
or actual dependencies require broader checks. State checks not run and why.

## Bundle verification by completed scene

Implementation and verification follow the scene, not the edit. While a scene is being
built, run only the quick checks for the parts being changed. When the scene's changes are
complete, bundle them and verify once from usage: the scene's observable outcome, its
integration boundaries, and one representative journey. Re-verify only the parts a later
change affects. Treat instructions that force a full run or an independent review after
every edit as a finding under audit area 5 — they cost development speed without adding
evidence — unless a required gate names that cadence explicitly.

## Reuse evidence with explicit invalidation

Use existing logs or results to identify what was checked, the affected source state,
inputs/dependencies, relevant environment, and result. Add only missing material
provenance; do not require a new fingerprinting or evidence-management framework.
A result is reusable when those relevant conditions and its coverage still hold.

Recheck the affected scope when code, configuration, dependencies, meaningful inputs,
environment, or acceptance criteria change; when evidence does not cover the contract;
when a failure or credible nondeterminism remains; or when policy requires a new run.
Do not rerun unaffected optional checks merely because time passed, another reviewer
arrived, or a response is about to be sent. A stale result cannot certify a new diff.
Stop optional verification when acceptance conditions have sufficient evidence and
there is no relevant unresolved failure or risk. Do not claim all work safe forever.

## Delegate only when the judgment warrants it

Propose or use a more capable available model for a difficult design trade-off,
a blocked diagnosis, or high-impact journey review when likely to improve the answer.
Prefer the existing routing policy and actual environment. Routine implementation /
checks stay with the current agent; a model's label, price, or recency is not evidence
that it is better at the task. Do not prescribe an unverified model name or CLI flag.

Before actually delegating, confirm the tool/model exists and the data sharing,
permission, and cost boundaries permit it. A read-only audit may propose delegation
without making a new external call. Send a bounded question with the scene, constraints,
diff / necessary evidence, acceptance criteria, uncertainty, and requested review output.
Ask for the specific decision or missing test, not a repeated open-ended "check everything".

Model judgment complements executable evidence, never substitutes for it. Keep author
and reviewer independent where required; changing a model label in the author's own
self-review is not independent review. Do not introduce a new universal review gate.
If no suitable model/reviewer is available, disclose that fact, use a permitted human
or other route where available, and leave required review pending. Continue work that
does not depend on the unmet gate. Never claim delegation happened when it did not.

## Demonstrate improvement honestly

For an uncertain simplification, propose a small representative comparison only if
needed: did the agent complete the same scene with fewer avoidable questions/checks
while retaining acceptance evidence and safeguards? Reuse existing observations.
Label expected benefits as hypotheses until observed; byte counts and model agreement
are not behavioral validation. Do not make every guidance edit wait for an experiment.
