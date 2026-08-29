---
name: audit-service-gaps
description: >-
  Audits the observable gaps between a service as it is today and an explicit target state, then
  researches how reference services actually solved each high-ranked gap before proposing a fix.
  DETECT scans through three independent lenses — north-star alignment, correctness (bugs), and
  user-perspective (UX) — and enumerates concrete, severity-ranked gaps; BENCHMARK verifies how a
  reference service closes each one and PROPOSES a differentiated close. VERIFY, CHANGE-IMPACT,
  DRIFT and FULL extend the same loop to post-fix closure, baseline changes, doc-vs-code drift, and
  the whole-service sweep. Use when the user says any of: "북극성 기준으로 부족한 점", "갭분석",
  "다른 벤치마크 서비스는 이 부분을 어떻게 해결했는지", "레퍼런스 서비스랑 비교해서 부족한 점
  찾아줘" — or the English "gap analysis", "benchmark against reference services", "audit this
  service". Do NOT use it to *define* product direction (that is north-star), to review ONE
  standalone artifact's prose (that is multi-persona-review), or to turn an unverified benchmark
  claim into a fact.
---

# Audit Service Gaps (reverse + competitive)

A targeted loop, not a sweep by default. You take the service as it is today, find where it
falls short of the ideal **and** where it is simply broken or awkward, then for each real shortfall
you go look at how a benchmark service solved that exact problem before proposing a fix. The user's
own framing:

> "현재 서비스 개발 상태에서 북극성 기준으로 부족하거나, 버그가 있거나, 사용자 관점에서 부족한 점을
> 인지하면 다른 벤치마크 서비스는 이부분을 어떻게 해결했는지를 확인해 가는 거지."

So the work fuses two moves that are usually done separately: **reverse-gap** (distance from the
north-star / ideal) and **competitive benchmark resolution** (how others closed the same gap).
DETECT finds gaps; BENCHMARK closes them. They chain: detect → for each gap, benchmark → propose
fix.

Two rules hold across every mode: **measure against a named baseline**, and **do not turn an
opinion or an unverified benchmark claim into a fact.**

## When to use

- You have a working-ish service and want to know, concretely, where it's behind its own north
  star, where it has bugs, and where the UX disappoints.
- You've found a weak spot and want "다른 유사 깃허브 프로젝트 / 레퍼런스 SaaS 는 이걸 어떻게 했지?"
  before inventing a fix.
- You want a ranked, auditable list of gap → benchmark evidence → proposed close, not a vague
  "we could improve X."

Not for: *directing* the roadmap forward — that's `north-star`, which SETS the target state while
this DETECTS gaps against it. Not for a single artifact's prose/UX critique — that's
`multi-persona-review`, which this skill *invokes* for its UX lens rather than re-implementing.

## Modes

The default chain is `DETECT → BENCHMARK`. The rest extend the same machinery to other questions:

- `REVERSE` — work backward from the target state (Lens A on its own).
- `DEFECT` — implementation, contract, and advertised-vs-actual defects (Lens B on its own).
- `EXPERIENCE` — user and operator journeys (Lens C on its own).
- `BENCHMARK` — compare one specific gap with observed reference behavior.
- `FULL` — all lenses over an agreed service boundary, consolidated (the whole-service sweep).
- `VERIFY` — after fixes, determine whether named gaps are actually closed.
- `CHANGE-IMPACT` — reclassify existing findings after the goal or baseline changed.
- `DRIFT` — detect mismatch among active direction, documents, and implementation.

Read [references/modes-and-evidence.md](references/modes-and-evidence.md) before choosing or
combining modes — it holds each mode's required anchor and output, the finding contract, and the
evidence states.

---

## MODE 1 — DETECT

Run three **independent** passes, then consolidate. The usability and gap-analysis literature is
unanimous that one undifferentiated pass systematically under-finds: heuristic evaluation works
precisely because several evaluators inspect separately and you aggregate (Nielsen & Molich). Blend
the lenses into one sweep and you will miss large categories of gap. So scan each lens on its own
terms, then merge.

A gap is only valid if it is a **concrete delta between two describable states** — the observable
current state and a specific ideal state. "It feels unpolished" is an opinion; "the onboarding has
no empty-state for zero projects, the ideal is a guided first-run" is a gap. (Gap Analysis:
Current → Future State.)

### Lens A — North-star alignment (the reverse / planning lens)

For the ideal state, use a **Working-Backwards** artifact: write (or read, if it exists in
`docs/NORTH_STAR.md`) the one-paragraph press release of the finished, ideal product, then reason
backward. The gap is the distance between today's product and that press release (Amazon PR-FAQ).
Then make it testable with the **North Star Framework**: is each surface tied to a north-star
*input* metric? Two gap shapes fall out automatically:

- an input lever that should move the north star but doesn't, and
- product surface area that contributes to **no** input (candidate for removal).

Where the target state lives: `docs/NORTH_STAR.md` and the project's `CLAUDE.md`/`AGENTS.md` vision
statement. Judge surfaces against *that*, not taste. Record which revision you judged against — a
finding ranked against an unnamed goal cannot be re-checked later.

No `docs/NORTH_STAR.md`? Don't skip Lens A — write the one-paragraph Working-Backwards press
release *inline* from the README / `CLAUDE.md` vision first, then score against it. The ideal state
is the anchor; an absent file is no excuse to drop the planning lens. But if the user asks you to
audit against a target baseline that is genuinely ambiguous (two conflicting documents, or a
direction still under discussion), **stop and ask** — ranking findings against an inferred goal
manufactures a priority order out of your own guess.

### Lens B — Correctness (the bug lens)

Inspect for things that are simply wrong: broken flows, crashes, mismatched advertised-vs-actual
behavior, drift between docs and code. The failure family has a recognizable shape — a `--with-*`
flag that's advertised in the README but unregistered so it crashes, a `--version` that lies, a
category missing from the wizard that the docs promise. Treat each as a correctness gap with a
**reproduction**, not a hunch: an advertised-vs-actual claim with no repro is a suspicion, and
suspicions do not get ranked next to reproduced defects.

### Lens C — User-perspective (the UX lens)

Judge the interface against **named criteria**, not vibes — Nielsen's 10 heuristics (visibility of
system status, match between system and the real world, user control and freedom, consistency and
standards, error prevention, recognition rather than recall, flexibility and efficiency of use,
aesthetic and minimalist design, help users recognize and recover from errors, help and
documentation) so each finding traces to a principle and is reproducible. For the heavy UX pass,
hand this lens to the **`multi-persona-review`** skill (independent persona evaluators) rather than
duplicating its machinery here. Remember the limits: heuristic inspection finds roughly half of
what real user testing finds and produces false positives — it's a cheap first filter, not ground
truth.

### Score every gap before you spend benchmark effort

Never present an unranked gap list — the benchmark research in Mode 2 is the expensive part, so it
must run only on gaps that matter. Tag each gap with:

- **Severity 0–4** (Nielsen): roughly frequency × impact × persistence. **0 = not really a problem,
  1 = cosmetic, 2 = minor, 3 = major, 4 = catastrophe, must fix before release.**
- **Opportunity (optional, ODI)**: `Importance + max(Importance − Satisfaction, 0)` (importance
  weighted twice; Ulwick). High-importance/low-satisfaction = under-served, prime target.
  Low-importance/high-satisfaction = **over-served** — flag it for *removal/simplification*, not
  addition. Surfacing over-served areas is the structural antidote to feature bloat; a good scan
  proposes cuts too.

DETECT is fully usable on **severity 0–4 alone**. ODI needs real importance and satisfaction data;
for a solo/tooling repo without it, *skip* the Opp. column rather than inventing
importance/satisfaction numbers — fabricated inputs launder a guess as data. Reach for ODI only
when you genuinely have user-sourced signal.

Keep the numbers as a prioritization aid, not proof — self-reported importance and made-up severity
launder a guess as data if you over-trust them.

**DETECT output** — one table:

| # | Lens | Gap (current → ideal delta) | Severity 0–4 | Opp. | Notes / repro |
|---|------|------------------------------|--------------|------|---------------|

Scale the rigor to severity: a 4 earns the full reverse-from-ideal write-up; a 1 gets a one-line
pre-flight note. Don't run the heavy PR-FAQ ritual on every tiny gap — that's analysis paralysis.

---

## MODE 2 — BENCHMARK (runs only on high-ranked gaps)

For each gap worth closing, work like a **competitive teardown**: take apart how a reference service
*actually* solves that exact problem and document the **verified mechanism** — the real flow,
states, and copy you observed — not the assumed implementation. Claim only what you inspected. If
you couldn't verify how they do it, **say so** ("COULD NOT INSPECT — inferred") rather than
fabricating a plausible-sounding mechanism. Fictional evidence is the named failure mode of both
Working-Backwards and this skill.

The line is binary at the point of writing: **VERIFIED** means you observed the mechanism yourself;
anything else is **COULD NOT INSPECT — inferred**, and it travels with that label attached
(`references/modes-and-evidence.md` refines "verified" into `observed` vs `documented` for cases
where an authoritative contract, not the running product, is your source).

Sources, in order of trust: the running reference product / its repo (first-hand), then docs, then
write-ups. For "다른 유사 깃허브 프로젝트 보고 수정", read their actual code path, not their README
claims.

Then **PROPOSE** the closing approach in **jobs-to-be-done** terms — what job does the user need
done — and consciously resist the **feature-parity trap**. Copying a competitor's feature list is a
catch-up trap that breeds bloat (Zune out-featured the iPod and lost; customers wanted the job done,
not the features). For each gap, decide explicitly: does closing it defend table-stakes, or does a
*differentiated* approach make the competitor's solution irrelevant? Propose accordingly.

Record each proposed fix **ADR-style** — rationale + the rejected benchmark alternative — so the
whole chain is auditable (a `docs/decisions/` entry where the project keeps one).

**BENCHMARK output** — per high-ranked gap:

```
Gap #N (sev X): <one line>
  Benchmark:   <service> — VERIFIED how they solve it: <real flow/state/copy>
               [or: COULD NOT INSPECT — inferred, treat as hypothesis]
  Job:         <the customer job this gap blocks>
  Proposed:    <closing approach in JTBD terms — differentiate, don't mirror>
  Rejected:    <the benchmark's exact approach, and why not, if diverging>
```

---

## The chain, in order

1. **Define states.** Current (observable) + ideal (Working-Backwards press release, anchored to
   `docs/NORTH_STAR.md` and its revision). A gap is the delta between them.
2. **DETECT** — three independent passes (north-star / correctness / UX via
   `multi-persona-review`), each against named criteria.
3. **Consolidate & score** — merge into one table; severity 0–4 + optional ODI opportunity; tag
   over-served items for removal.
4. **BENCHMARK** — only the high-ranked gaps; verified teardown of how a reference service solves
   each; mark anything unverified.
5. **PROPOSE** — closing approach in JTBD terms, differentiate over parity-match, recorded
   ADR-style with the rejected alternative.

`VERIFY`, `CHANGE-IMPACT`, and `DRIFT` reuse steps 1-3 with a different baseline: the original
finding, the previous target state, and the active documents respectively. `FULL` is steps 1-5 over
the whole service boundary instead of a scoped area.

A complete Input → Output run of the chain — the consolidated DETECT table with real severity and
opportunity numbers, the BENCHMARK block for the top gap, and the routing decisions for the gaps
that skip benchmarking — is in [references/worked-example.md](references/worked-example.md).

## Output, side effects, and stop conditions

- **Output** — mode, scope, the baselines and their revisions, the DETECT table, the BENCHMARK
  blocks for high-ranked gaps, rejected claims, closure status in `VERIFY`, and the remaining
  uncertainty.
- **Side effects** — this skill *finds and proposes*; it does not silently fix. Implement only when
  implementation was requested. External benchmark access and any external write follow the current
  permission boundary.
- **Stop** when the target baseline or the service boundary is ambiguous — do not rank findings
  against an inferred goal. Where independent verification is unavailable, label judgment findings
  `unverified`; a hard reproduction may still be `confirmed`.

## Cross-references (don't duplicate)

- **`multi-persona-review`** — owns the UX lens (Lens C). Invoke it; don't re-implement persona
  evaluation here.
- **`north-star`** — same target state, opposite direction: it *directs* the roadmap forward; this
  *detects* gaps against it. It also owns the roadmap ordering this skill's findings feed.
- **`verification-loop`** — after a fix lands, it produces the evidence and the fixed verdict;
  `VERIFY` mode consumes that rather than re-deriving it.
- **ADR conventions** — record each proposed fix as an architecture decision record in the
  project's `docs/decisions/`, including the rejected benchmark alternative.

## Notes on rigor (where deeper detail lives)

The mode anchors, finding contract, evidence states, and ranking inputs live in
[references/modes-and-evidence.md](references/modes-and-evidence.md); the end-to-end example lives
in [references/worked-example.md](references/worked-example.md). If a future version needs the full
scoring rubrics (the complete Nielsen 10-item checklist text, the ODI questionnaire wording) or
per-domain benchmark source lists, add them as siblings there. Keep SKILL.md the practical map, not
the encyclopedia.
