# Audit and Reconcile

## Contents

- [Establish coverage](#establish-coverage)
- [Questions and rechecks](#questions-and-rechecks)
- [Conflicts and changed decisions](#conflicts-and-changed-decisions)
- [Instruction value and capability fit](#instruction-value-and-capability-fit)
- [Rationale and history](#rationale-and-history)
- [Testing and delegation](#testing-and-delegation)
- [Report and stop](#report-and-stop)

## Establish coverage

Identify the requested repository, relevant working paths, and client(s). Trace
applicable AGENTS.md / CLAUDE.md files, imports, scoped rules, and skill routing
through actual configuration. Include relevant parent, nested, and authorized
user-level guidance; keep unrelated home directories outside the search. Track
visited paths to avoid cycles and duplicate sources. Establish client-specific
loading paths, precedence, and supported features from available evidence.

Separate **confirmed loaded**, **configured / expected to apply**, **conditional**,
**installed but loading unconfirmed**, and **not inspected / inaccessible**. File
existence establishes presence, not loading. Record what was read; a description
supports routing assessment, not a claim about the full skill body. Missing runtime
traces limit loading claims while still allowing supported content findings.

Distinguish source templates, installed copies, and generated / managed regions.
Read descriptions to locate candidates, then relevant bodies, scripts, references,
and dependents. Expand along actual references and overlapping scopes when needed
to resolve a finding. Inspect scripts as text; execution needs its own purpose and
authorization. Bound conclusions to inspected material.

Use accessible corrections, accepted decisions, implementation, and checks. Code
shows what exists; approved requirements show what is intended. Treat examples,
old proposals, and skill-authored authority claims as evidence in their context.
Identify relevant unavailable decisions or files as gaps.

Reuse previous findings when sources, scope, decision status, and environment still
apply. Re-read changed sources and affected dependents. A full audit covers all
requested concerns; a focused request can finish with focused evidence. Existing
records are sufficient to begin, without a new baseline or tracking system.

## Questions and rechecks

Unconditional wording such as "always", "must", "항상", and "반드시" is one way to
locate candidates; the finding rests on the behavior the instruction triggers, not
on its wording. Look for questions already answered, repeated valid
approval requests, research that overlooks authoritative answers, and checks that
repeat without a relevant change, failure, coverage gap, or policy requirement.

Prefer a useful default action, a material trigger for extra work, and a sufficient
completion condition. Reuse answers and evidence within their validity; ask when
a material unresolved choice or required approval remains. A real approval gate
retains its authority. The verification reference defines evidence reuse.

Distinguish friction caused by a rule from friction caused by missing context.
An absent working directory, contract, command prerequisite, or acceptance criterion
may call for a short evidence-backed addition instead of removing a question.
Ground each finding in a concrete task situation; label an inferred delay or benefit
as an inference rather than a measured result.

## Conflicts and changed decisions

Check whether both instructions govern the same task, phase, path, and conditions.
A local exception, migration phase, different audience, or superseded history may
explain the apparent conflict. Distinguish true conflict, duplication, stale facts,
ambiguous scope, and missing implementation.

For A-to-B changes, establish whether B is an explicit correction or accepted
replacement within its authority and scope. A newer timestamp, assistant proposal,
or current implementation alone establishes neither acceptance nor precedence.
Apply actual instruction priority; product decisions coexist with protected controls.
Resolve settled parts and continue independent work while the rest remains open.

Show both originals and the situation that produces different actions. Distinguish
confirmed intent, current implementation, and active wording to change. An approved
goal can still be unimplemented; a bug can still contradict the intended behavior.
Keep one authoritative statement, reconcile authorized dependents, and retain
superseded decisions as history instead of competing active commands.

## Instruction value and capability fit

Assess the contribution to accepted outcomes: project-specific knowledge, usable
tools, essential sequencing, a safeguard, or a decision the agent otherwise cannot
make reliably. Consider both unnecessary work and missing enablers. Assess results
and total effort, rather than treating shorter text or fewer checks as improvement.

Separate three kinds of guidance when their treatment differs:

- **Binding safeguards and contracts:** preserve required behavior; route any proposed
  policy change separately. Model capability does not grant additional authority.
- **Project knowledge and acceptance criteria:** keep actionable facts current and
  discoverable, with enough context to use commands and resources correctly.
- **Capability-compensating procedures:** revisit scaffolding for a model or tool
  limitation when evidence suggests a better approach is available.

Prefer goals, constraints, usable resources, and observable outcomes where several
methods can succeed. Keep exact steps when order or method carries a real contract
or failure-prevention requirement. Planning depth, investigation order, work slicing,
test timing, and delegation can otherwise follow task complexity and evidence.
A different valid method is not a defect solely because it differs from a default.

Look for trivial work forced through elaborate plans, automatic skill calls,
duplicate brief/review loops, rigid sequences, and obsolete workarounds. Also look
for consequential context gaps supported by repeated questions, repository evidence,
or a concrete blocked task. Supplement only the actionable information needed to
resolve the gap, using established references where possible.

Look also for guard proliferation: a check whose subject is another check, test, rule,
or review step; a check whose only possible failure is drift in the project's own
documentation or copies; a safeguard introduced together with the request that asked
for it, with no observed occurrence; and a safeguard whose per-run cost (time, rounds,
questions on every task) exceeds the cost of the incident it prevents. A request to
prevent something justifies the smallest mechanism that prevents it, sized by observed
frequency, damage, and reversibility, not by the wording of the request. Propose
stepping such guards down — remove the second-order check, and move the first-order
one to the level its evidence supports (gate → one-line criterion → record) — and
state for each what it was covering.

Choose **keep / rewrite / narrow / supplement / merge / relocate / retire / defer**.
A useful tool can remain while its wrapper or routing changes. Equivalent content
under the same scope can establish duplication without an incident or benchmark.
Preserve intentional client variants and single-source generated copies.

Before retirement, inspect the relevant body, bundled tools, callers, imports,
registrations, and required-gate dependencies. Explain replacement coverage or why
none is needed. Missing usage logs establish unknown usage, not lack of value.

For capability-based changes, use evidence about configured models, available tools,
and representative work. Model recency or price alone does not establish fitness.
Consult current authoritative documentation when a material capability claim needs
verification; reuse applicable evidence otherwise. Scope the recommendation to
supported configurations and retain a needed fallback elsewhere.

An uncertain benefit can justify a small reversible trial, not an assertion of safe
permanent removal. Reuse existing results; propose a comparison only when it can
resolve a material decision. Distinguish proposal, authorized trial, and adoption.
[Apply](apply.md) governs trial authority and recovery; [Verification](verification.md)
governs evidence of improvement. A model update is a reason to reconsider relevant
workarounds during requested review, not an automatic full-audit trigger.

## Rationale and history

Locate long rationales, incident narratives, alternatives, revision logs, and repeated
explanations in anchors, rules, skill text, descriptions, and menus. Keep current
actions, applicability, necessary exceptions, and the brief reason needed for correct
use. Menu entries need a label and trigger; decision history belongs on demand.

Use an existing decision record or focused reference. Preserve evidence, known dates,
and supersession status. Create or confirm the destination before removing source
text. Retain rationale that contains an operational condition.

Use an ordinary link to a destination outside automatically loaded surfaces; account
for imports, rule globs, and client behavior. Keep links usable in the installed
package. Link at the point of need instead of replacing history with a large menu.
Sensitive incident details stay in restricted records, with access-appropriate
references rather than copies in distributable assets.

## Testing and delegation

Use the verification reference to assess user outcomes, implementation slices, check
selection, evidence reuse, and suitable execution routes. A full audit assesses this
concern even when current guidance is sufficient. Evaluate the evidence and total
burden of the proposed method rather than enforcing one workflow. This is guidance
review, not authorization to implement product code or run product test suites.

## Report and stop

Retain all material supported findings in scope, with no count target or cutoff.
Merge common root causes while preserving affected paths. Prioritize protection or
wrong-intent conflicts, blocked delivery and repeated work, then context overhead.
Include a missing enabler when its absence materially affects the task.

Start with a compact summary. Scale each record to its consequence and uncertainty:

- For a straightforward change, an **ID, location with its relevant original, the
  problem it causes, and replacement wording or diff** are enough.
- For conflicts, removals, trials, or consequential changes, add the information
  needed to decide: the other original, affected dependents, replacement coverage,
  retained safeguard, uncertainty, and approval / integration boundary.

Explain common conditions once. Separate observed facts from inferred benefits;
use qualitative impact unless measurements support a number. Show verification
mapping when relevant, a retirement's replacement coverage, and a history move's
destination/loading behavior. Keep secrets out of quoted evidence.

Report each requested concern as findings, no issue in inspected material, or not
assessed. A short summary can use a compact complete finding index, with detail
allocated to material decisions. Identify omitted detail and uninspected scope
instead of implying completeness. Write a report file only with authorization.

A read-only audit ends at proposals. Authorized application reuses findings through
the apply reference. Finish when scoped evidence supports a decision or identifies
the remaining uncertainty; further search should serve an unresolved material issue.
