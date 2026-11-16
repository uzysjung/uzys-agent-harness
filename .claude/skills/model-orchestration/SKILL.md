---
name: model-orchestration
description: >-
  Select models, reasoning effort, and delegation boundaries for a task. Use when
  choosing direct execution versus subagents, allocating parallel work or
  independent review, or reducing multi-agent token and context overhead. Favor
  context reuse and add model calls or workers when their expected contribution
  justifies the cost.
---

# Model Orchestration

Apply intelligence where it most improves a verified, usable outcome. Optimize
whole-task cost and delay, including context duplication, coordination,
verification, and likely rework, while preserving required quality and authority.
These are allocation principles, not a mandatory multi-agent workflow. Explicit
project requirements remain binding.

## 1. Keep ownership with useful context

The current session normally holds the user's intent and relevant project context.
It chooses the execution structure and owns integration and final acceptance. It
may plan, draft, implement, run checks, and refine directly, or delegate where
another model is better suited. Roles describe responsibilities, not model names
or a requirement for separate workers.

Keep tightly coupled work together when a handoff would mostly make another
agent reconstruct the same understanding. Completing the task in one capable
context is a valid orchestration choice, not a failure to delegate.

Treat model capability, reasoning effort, and context count as separate choices.
Where supported, changing model or effort within an existing context may be more
useful than spawning another agent. Reuse applicable routing decisions rather
than reopening them for every tool call or phase.

## 2. Put capability at the bottleneck

Use stronger reasoning for unresolved design choices, difficult diagnosis,
cross-boundary behavior, and consequential mistakes. Choose sufficient capability
early when uncertainty or recovery cost warrants it; there is no need to exhaust
weaker models first. A stronger model doing the work directly may cost less
overall than a weaker implementation followed by repeated review and repair.

For well-specified work, choose between direct execution, deterministic tools,
and a lighter capable model by total completion cost. Running a known test command
and deciding whether its coverage is adequate are different demands on judgment.
Use tools for execution and measurement; allocate reasoning to decisions they
cannot settle.

Choose from actual capabilities and task evidence rather than fixed vendor-role
assignments or universal effort floors. Honor explicit model, effort, budget,
and data-processing constraints. Adapt when capabilities or evidence change.
Where the project keeps a measured ledger of model and effort outcomes (seeded by
the `external-model-consult` skill's `references/model-evidence.md` where installed,
accumulated in the project's `docs/model-evidence.md`), read its dated entries as
that evidence and say when none applies; do not infer a routing from model names
or recency.

For planning and design, keep drafting in the session when context continuity is
valuable. Use another capable model for problem framing, a first draft, alternative
designs, trade-off analysis, a focused question, or independent review according to
the expected information gain. A model useful for review may be the better author.
Possible arrangements include session drafting followed by useful independent
review, or session-defined goals and constraints followed by another model's
design. The session integrates either result; neither arrangement requires an
extra review by default. Compare separately developed alternatives when their
different approaches justify the additional work.

Route by how open the work is. When what to do, or the answer itself, is still
open (setting direction, product planning, scoping, building a plan), use the
strongest reasoning model available. When a judgment stalls mid-task or a problem
needs a fresh angle, first measure what you can (run it, check the data, read the
code) and bring in the strongest model only if the judgment still splits. Design,
implementation, and verification inside a scope that a spec, the project's
direction, or a benchmark has already fixed go to a capable general model or the
session itself. Work with no judgment at all, such as link checks or confirming
that a rebased change matches the reviewed one, goes to tools, direct execution,
or the implementer.

Choose effort by actual difficulty, interacting decisions, remaining uncertainty,
likely rework, and the benefit of further reasoning. High stakes call for stronger
assurance, not automatically maximum effort: inspecting code, contracts, tests,
or external facts may resolve a risk that more reasoning alone cannot.

For open work, start at high effort. Start at a higher effort when the design is
hard to reverse (permission boundaries, data deletion, migrations, money); a high
run followed by a rerun pays twice. Treat the maximum effort level as an
exception to raise with the user.

Judge every delegated result, from a planner, an implementer, or a reviewer, by
evidence rather than tone: a shallow report reads as confidently as a sound one.
An implementation or verification report needs the commands run with their exit
codes, and for a new guard, a record of the test failing when the guard is
reverted. A review of a consequential area (permissions, approvals, personal
data, exports, audit, migrations) needs a record of reverting the key lines and
watching the tests fail, the counterexample inputs actually run with their
results, and boundary-value checks; a claim of having tried a counterexample
without the input and the result counts as missing. A design or decision needs
the location of each current fact, what breaks if each option is wrong, the
conditions that would change the recommendation, and the assumptions it could
not confirm. A calculation needs its steps and raw data. Rerun only the part that
lacks this, with the doubt written into the request, instead of rerunning the
whole at a higher effort. When the doubt is about a calculation or a behavior,
measure it first and raise the effort only if the judgment still splits.
Narrow confirmation whose
answer is fixed (that a fix now passes the cited counterexample, that a document
points to the right decision, that issue or pull request status matches the
documents) needs only moderate effort, and moves up when it turns into finding
new counterexamples or making a judgment.

## 3. Make additional contexts earn their cost

Add a worker for a concrete benefit: needed expertise or tools, useful context or
permission isolation, independent scrutiny, or genuinely parallel work that
shortens the critical path after startup and integration costs. Compare this
with direct or batched tool use and continuing an existing worker.

Choose coherent, independently ownable units. Bundle related work that shares
context and acceptance criteria instead of splitting by file, phase, or role.
Independence makes parallel work possible; its expected contribution makes it
worthwhile. Each additional worker should provide a distinct useful result.

Parallel changes need clear interfaces and non-overlapping ownership or suitable
isolation, including shared test resources. Different files are insufficient if
workers still depend on each other's unresolved decisions or shared contracts.
Settle those dependencies first or keep the dependent work together. Use the main
context for complementary work rather than repeating a delegated task. Apply the
same benefit test to nested delegation and account for its total cost.

Several perspectives can be considered in one context. Separate them when
independent scrutiny, different evidence, or specialized capability adds value,
not merely to fill a persona panel. Simulated perspectives are not independent
review or observed user feedback.

## 4. Transfer sufficient context, not entire histories

Reuse valid findings and existing worker contexts for related follow-up when
supported. Start fresh when independence, context overload, or a changed purpose
makes reuse counterproductive.

Give a worker the objective, essential constraints, relevant artifact and evidence
references, unresolved question, allowed changes, and completion criteria. Supply
enough context to decide correctly, including material failed approaches; favor
accessible source references over replaying the conversation. Keep critical
constraints explicit rather than relying on a lossy summary or hidden context.
A worker asked to plan or design from facts it cannot see will design from
assumption, so name where it can confirm the current facts (files, records,
queries) and give it read access to them.

Ask for the result needed for integration, its evidence, and remaining gaps.
Short results can return directly. Use durable files or artifacts for large,
reusable, or truncation-prone output; choose the destination when delegating.
Preserve relevant version information so evidence stays attributable.

Let implementers resolve routine details within the agreed scope. Bring newly
discovered consequential choices back to the owning session when they change
user behavior, API or data contracts, architecture, or security boundaries, or
expose a conflict with the design or a material ambiguity. Return the issue and
evidence, not a request to approve every detail. The session resolves it within
existing authority and involves the user only when their decision is needed.

## 5. Review consequential uncertainty, not every stage

Implementers may write and run relevant tests and correct their work. Writing a
test and judging whether it sufficiently covers the outcome are different
responsibilities; assigning a reviewer does not prohibit implementer-written
tests. Self-checking is verification, not independent review. Add independent
review when a fresh perspective materially improves assurance or when explicitly
required.

Consider the consequence of being wrong: costly-to-reverse product scope or core
user-flow decisions, long-lived contracts or data models, compatibility, security,
privacy, deletion, and money. Review uncertain assumptions before dependent work
becomes expensive. Established patterns, confirmed local bug fixes, and mechanical
updates usually need no additional reviewer unless their actual impact or remaining
uncertainty warrants one. Apply the same judgment to plans, designs, and code.

Give the reviewer the original objective, constraints, relevant decisions, actual
artifacts, and execution evidence, with sufficient capability to assess the risks.
Enable inspection of source code, API and data contracts, and measurements when
needed; the draft alone may carry the author's mistaken assumptions. Focus on
consequential assumptions and blind spots without prescribing the conclusion.
Independence comes from a separate assessment of evidence, not a different model
name. Neither model prestige nor agreement among agents substitutes for evidence.

Own acceptance and integration: inspect the artifacts and evidence material to
the outcome, resolve substantiated gaps, and check affected integration behavior.
Reuse applicable execution and review evidence across stages; revisit areas when
changes or new information invalidate it. Finish when required readiness is
supported, rather than commissioning another pass without a likely benefit.
Return substantiated findings to the existing implementer when its retained
context makes correction efficient; reassess only the affected evidence.

## 6. Preserve authority and continuity

Resolve model availability, effort controls, inheritance, and tool behavior from
the actual environment or applicable documentation when needed; reuse current
evidence. Distinguish requested settings from observed execution: a requested effort or
model can be silently not applied. Where a per-call setting can be dropped, fix it
in the worker's definition, and still confirm the actual value from the
execution record before relying on it. Do not claim
a model, effort level, or independent review that was not established.

Apply the same scope, data protections, and approval boundaries to every worker,
whether native or external. Confirm that the actual provider, disclosed data,
and permitted actions are covered by existing authorization before routing.
Obtain approval when that boundary changes; an installed tool is not permission
to disclose repository content or apply changes to shared systems.

When a capability is unavailable, continue through an authorized alternative
that still meets required quality, reporting material substitutions or limits.
If a required gate cannot be satisfied, pause only dependent actions.

For interruptions or ownership changes, preserve the current state, artifact
locations, verified evidence, unresolved issues, and next action. Resume useful
contexts when supported. Collect results and release workers that no longer have
useful pending work, preserving required evidence and existing user work.
