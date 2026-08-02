# Audit modes and evidence

## Mode selection

| Mode | Required anchor | Main output |
|---|---|---|
| REVERSE | Ideal state and the revision it came from | Ranked current-to-ideal deltas |
| DEFECT | Contract, implementation, and a reproduction surface | Reproducible defects |
| EXPERIENCE | A named user or operator journey | Broken or costly journey steps |
| BENCHMARK | One specific gap and a reference target | Observed comparison and an adapted option |
| FULL | Service boundary and independent rubrics | Consolidated multi-lens audit |
| VERIFY | The original finding and its closure criterion | Open, partial, or closed verdict |
| CHANGE-IMPACT | Old and new baseline revisions | Finding reclassification |
| DRIFT | Active documents and the implementation state | Contradictions and stale artifacts |

A mode whose anchor is missing does not degrade into a softer version of itself — it stops. An
audit with no named baseline ranks findings against the auditor's taste.

## Finding contract

Each finding carries:

- a stable identifier;
- mode and lens;
- observed current state;
- expected state, and the baseline it comes from;
- evidence or reproduction;
- impact and the affected user;
- severity 0–4 (and Opp. where real user data exists — never invented);
- confidence and verification status;
- the proposed next decision, not an automatic feature;
- a trace to roadmap or issue where one exists.

## Evidence states

- `confirmed` — reproduced behavior, a hard artifact, or independent verification.
- `unverified` — plausible but missing sufficient direct or independent evidence.
- `rejected` — contradicted, already handled, outside the baseline, or a rubric match with no
  observable consequence.

Keep rejected and unverified items **visible in their own sections**. Deleting them makes the next
audit rediscover them, and hiding them lets an unverified claim graduate into a fact by attrition.

## Benchmark evidence grades

The SKILL.md rule is binary at write time — VERIFIED, or COULD NOT INSPECT — inferred. This refines
the verified side for reporting:

- `observed` — directly inspected product, code, or official contract;
- `documented` — supported by authoritative documentation you read, not the running product;
- `inferred` — a plausible mechanism you did not directly verify. Travels labeled, always.

## Ranking

Use available inputs only. Impact, reach, confidence, effort, frequency, and persistence are valid
inputs where the project actually supports them. **Never invent user importance or satisfaction
scores** — that is what turns ODI from a prioritization aid into laundered guessing (SKILL.md,
"Score every gap").

Show the inputs next to the rank. A rank a reader cannot argue with by arguing about an input is
not auditable.
