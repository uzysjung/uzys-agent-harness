# Failure analysis

Support material for SKILL.md. Step 1 uses "Capture"; Step 2 uses "Classify the cause"; Step 3b
uses "Countermeasure mechanisms" when comparing panel options.

## Capture

Record, at the moment of failure:

- active goal;
- failure signature (the *class*, not the file);
- error or wrong observable result;
- last successful state;
- failed tool, command, or decision;
- environment assumptions that turned out false;
- repeated action pattern, if the same action was retried;
- impact: time, tokens, data, security, or user-visible effect.

Do not store secrets or full conversation transcripts in a recurrence record. The record has to
survive in durable memory, and a record nobody can safely keep is a record that gets deleted.

## Classify the cause

This taxonomy sorts *why the failure was possible*. It complements — it does not replace — the
단순 실수 / 복잡한 하네스 문제 split in SKILL.md Step 2, which sorts *whether the correct behavior
was disputed*.

- **logic** — implementation or contract is wrong;
- **state** — actual files, branch, process, or deployment differ from assumptions;
- **environment** — dependency, service, permission, or runtime mismatch;
- **policy** — a decision boundary or safeguard is missing or wrong;
- **coordination** — ownership, handoff, or evidence was lost between lanes;
- **loop** — the same action repeats without a discriminating observation.

`logic`/`state` with agreed-correct behavior is normally a slip (ladder). `policy`/`coordination`
is normally the complex path (panel) — the countermeasure model itself is what is in question.

## Contained recovery

Before designing anything durable, stop the bleeding without widening the blast radius:

1. Restate the objective.
2. Verify actual state (don't reason from the assumed one).
3. Narrow to one failure.
4. Run one check that distinguishes the competing hypotheses.
5. Change the plan only when the evidence supports it.

## Countermeasure mechanisms

Prefer the smallest mechanism that prevents the *cause*, not the symptom — and count, for each
candidate, what it costs on every run and what judgment it takes away from the model:

| Cause shape | Mechanism | Per-run cost | Autonomy impact |
|---|---|---|---|
| Incorrect behavior | Fix the code or the contract | none | none |
| A stable behavioral boundary regressed | Regression test | CI time | none — checks a result, not a method |
| The same truth is written in two places | Derive from one source (delete the copy) | none (removes work) | none |
| A deterministic lifecycle event is violated | Hook, or a verification gate | every matching action; a blocking hook adds a round each time it misfires | low if it checks a result; high if it fixes a procedure |
| A judgment recurs at decision time and no check can express it | A concise Rule (Level 1) | every session (standing context) | feeds the judgment when it states a criterion; replaces it when it fixes a procedure — write the criterion |
| Completion is claimed without evidence | Verification gate that requires the evidence | per completion claim | none — asks for evidence, not a method |
| Human or external coordination gap | Operating procedure / checklist | every run of the procedure | high — use only where coordination, not judgment, is the gap |

Verify a mechanical mechanism on **both** the bad case and the corrected case — a gate seen green
only has never been shown to bite. Record prose-only safeguards as unverified enforcement; that
label is what justifies escalation if the failure recurs.
