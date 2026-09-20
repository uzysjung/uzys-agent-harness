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

The agent holding the user's intent and relevant project context owns the
integrated result. It may plan, draft, implement, run checks, and refine directly.
Roles describe responsibilities; they do not require separate workers.

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
isolation, including shared test resources and integration assumptions. Use the
main context for complementary work rather than repeating a delegated task.
Apply the same benefit test to nested delegation and account for its total cost.

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

Ask for the result needed for integration, its evidence, and remaining gaps.
Short results can return directly. Use durable files or artifacts for large,
reusable, or truncation-prone output, agreeing on the destination before it is
produced. Preserve relevant version information so evidence stays attributable.

## 5. Review consequential uncertainty, not every stage

Implementers should execute relevant checks and correct their work. This is
verification, but not independent review. Add independent review when a fresh
perspective materially improves assurance or when explicitly required.

Give the reviewer the original objective, constraints, actual artifacts, and
execution evidence, with sufficient capability to assess the material risks.
Focus independent assessment on consequential assumptions and blind spots rather
than replaying the author's reasoning or assigning a reviewer to each artifact.
Neither model prestige nor agreement among agents substitutes for evidence.

Own acceptance and integration: inspect the artifacts and evidence material to
the outcome, resolve substantiated gaps, and check affected integration behavior.
Reuse applicable execution and review evidence across stages; revisit areas when
changes or new information invalidate it. Finish when required readiness is
supported, rather than commissioning another pass without a likely benefit.

## 6. Preserve authority and continuity

Resolve model availability, effort controls, inheritance, and tool behavior from
the actual environment or applicable documentation when needed; reuse current
evidence. Distinguish requested settings from observed execution. Do not claim
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
