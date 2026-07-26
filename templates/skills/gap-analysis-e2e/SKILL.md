---
name: gap-analysis-e2e
description: >-
  Two-mode chained gap analysis. DETECT scans the current service end-to-end
  through three lenses — north-star alignment, correctness (bugs), and
  user-perspective (UX) — and enumerates concrete, severity-ranked gaps. Then
  BENCHMARK researches how reference/benchmark services actually solved each
  high-ranked gap and PROPOSES a closing approach. Use when the user says any of:
  "북극성 기준으로 부족한 점", "사용자 관점에서 부족한 점", "다른 벤치마크 서비스는 이 부분을
  어떻게 해결했는지", "갭분석", "레퍼런스 서비스랑 비교해서 부족한 점 찾아줘" — or the
  English equivalents: "gap analysis", "what are we missing vs the
  ideal/north-star", "benchmark against reference services". Fires for both
  Korean and English phrasing. NOT for a whole-codebase multi-dimension audit
  (use ultracode-service-audit) or single-artifact prose review (use
  multi-persona-review) — this is the narrower gap-vs-benchmark loop.
---

# Gap Analysis E2E (reverse + competitive)

A targeted loop, not a sweep. You take the service as it is today, find where it
falls short of the ideal **and** where it is simply broken or awkward, then for
each real shortfall you go look at how a benchmark service solved that exact
problem before proposing a fix. The user's own framing:

> "현재 서비스 개발 상태에서 북극성 기준으로 부족하거나, 버그가 있거나, 사용자 관점에서 부족한 점을
> 인지하면 다른 벤치마크 서비스는 이부분을 어떻게 해결했는지를 확인해 가는 거지."

So the work fuses two moves that are usually done separately: **reverse-gap**
(distance from the north-star / ideal) and **competitive benchmark resolution**
(how others closed the same gap). DETECT finds gaps; BENCHMARK closes them. They
chain: detect → for each gap, benchmark → propose fix.

## When to use

- You have a working-ish service and want to know, concretely, where it's behind
  its own north star, where it has bugs, and where the UX disappoints.
- You've found a weak spot and want "다른 유사 깃허브 프로젝트 / 레퍼런스 SaaS 는 이걸
  어떻게 했지?" before inventing a fix.
- You want a ranked, auditable list of gap → benchmark evidence → proposed close,
  not a vague "we could improve X."

Not for: directing the roadmap forward (that's `northstar-roadmap` — it DIRECTS;
this DETECTS gaps against the same north star). Not a full N-dimension audit
(that's `ultracode-service-audit`; this is a narrower gap-to-benchmark loop).

---

## MODE 1 — DETECT

Run three **independent** passes, then consolidate. The usability and gap-analysis
literature is unanimous that one undifferentiated pass systematically under-finds:
heuristic evaluation works precisely because several evaluators inspect separately
and you aggregate (Nielsen & Molich). Blend the lenses into one sweep and you
will miss large categories of gap. So scan each lens on its own terms, then merge.

A gap is only valid if it is a **concrete delta between two describable states** —
the observable current state and a specific ideal state. "It feels unpolished" is
an opinion; "the onboarding has no empty-state for zero projects, the ideal is a
guided first-run" is a gap. (Gap Analysis: Current → Future State.)

### Lens A — North-star alignment (the reverse / planning lens)

For the ideal state, use a **Working-Backwards** artifact: write (or read, if it
exists in `docs/NORTH_STAR.md`) the one-paragraph press release of the finished,
ideal product, then reason backward. The gap is the distance between today's
product and that press release (Amazon PR-FAQ). Then make it testable with the
**North Star Framework**: is each surface tied to a north-star *input* metric? Two
gap shapes fall out automatically:

- an input lever that should move the north star but doesn't, and
- product surface area that contributes to **no** input (candidate for removal).

Where this repo's north star lives: `docs/NORTH_STAR.md` and `CLAUDE.md`
("설치 서비스 = installer + curator"). Judge surfaces against *that*, not taste.

No `docs/NORTH_STAR.md`? Don't skip Lens A — write the one-paragraph
Working-Backwards press release *inline* from the README / `CLAUDE.md` vision
first, then score against it. The ideal state is the anchor; an absent file is no
excuse to drop the planning lens.

### Lens B — Correctness (the bug lens)

Inspect for things that are simply wrong: broken flows, crashes, mismatched
advertised-vs-actual behavior, drift between docs and code. In this repo the
`no-false-ship` rule names the exact failure family — a `--with-*` flag that's
advertised but unregistered, a `--version` that lies, a category missing from the
wizard. Treat each as a correctness gap with a reproduction, not a hunch.

### Lens C — User-perspective (the UX lens)

Judge the interface against **named criteria**, not vibes — Nielsen's 10
heuristics (visibility of system status, match to the real world, error
prevention, recognition over recall, etc.) so each finding traces to a principle
and is reproducible. For the heavy UX pass, hand this lens to the
**`multi-persona-review`** skill (independent persona evaluators) rather than
duplicating its machinery here. Remember the limits: heuristic inspection finds
roughly half of what real user testing finds and produces false positives — it's
a cheap first filter, not ground truth.

### Score every gap before you spend benchmark effort

Never present an unranked gap list — the benchmark research in Mode 2 is the
expensive part, so it must run only on gaps that matter. Tag each gap with:

- **Severity 0–4** (Nielsen): roughly frequency × impact × persistence. 0 = not
  really a problem, 4 = catastrophe, must fix before release.
- **Opportunity (optional, ODI)**: `Importance + max(Importance − Satisfaction, 0)`
  (importance weighted twice; Ulwick). High-importance/low-satisfaction =
  under-served, prime target. Low-importance/high-satisfaction = **over-served** —
  flag it for *removal/simplification*, not addition. Surfacing over-served areas
  is the structural antidote to feature bloat; a good scan proposes cuts too.

DETECT is fully usable on **severity 0–4 alone**. ODI needs real importance and
satisfaction data; for a solo/tooling repo without it, *skip* the Opp. column
rather than inventing importance/satisfaction numbers — fabricated inputs launder a
guess as data. Reach for ODI only when you genuinely have user-sourced signal.

Keep the numbers as a prioritization aid, not proof — self-reported importance and
made-up severity launder a guess as data if you over-trust them.

**DETECT output** — one table:

| # | Lens | Gap (current → ideal delta) | Severity 0–4 | Opp. | Notes / repro |
|---|------|------------------------------|--------------|------|---------------|

Scale the rigor to severity: a 4 earns the full reverse-from-ideal write-up; a 1
gets a one-line pre-flight note. Don't run the heavy PR-FAQ ritual on every tiny
gap — that's analysis paralysis.

---

## MODE 2 — BENCHMARK (runs only on high-ranked gaps)

For each gap worth closing, work like a **competitive teardown**: take apart how a
reference service *actually* solves that exact problem and document the **verified
mechanism** — the real flow, states, and copy you observed — not the assumed
implementation. This mirrors `no-false-ship`: claim only what you inspected. If you
couldn't verify how they do it, **say so** ("could not inspect — inferred") rather
than fabricating a plausible-sounding mechanism. Fictional evidence is the named
failure mode of both Working-Backwards and this skill.

Sources, in order of trust: the running reference product / its repo (first-hand),
then docs, then write-ups. For "다른 유사 깃허브 프로젝트 보고 수정", read their actual
code path, not their README claims.

Then **PROPOSE** the closing approach in **jobs-to-be-done** terms — what job does
the user need done — and consciously resist the **feature-parity trap**. Copying a
competitor's feature list is a catch-up trap that breeds bloat (Zune out-featured
the iPod and lost; customers wanted the job done, not the features). For each gap,
decide explicitly: does closing it defend table-stakes, or does a *differentiated*
approach make the competitor's solution irrelevant? Propose accordingly.

Record each proposed fix **ADR-style** — rationale + the rejected benchmark
alternative — so the whole chain is auditable. (This repo already has an
`architecture-decision-record` convention and `docs/decisions/`.)

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

1. **Define states.** Current (observable) + ideal (Working-Backwards press
   release, anchored to `docs/NORTH_STAR.md`). A gap is the delta between them.
2. **DETECT** — three independent passes (north-star / correctness / UX via
   `multi-persona-review`), each against named criteria.
3. **Consolidate & score** — merge into one table; severity 0–4 + optional ODI
   opportunity; tag over-served items for removal.
4. **BENCHMARK** — only the high-ranked gaps; verified teardown of how a reference
   service solves each; mark anything unverified.
5. **PROPOSE** — closing approach in JTBD terms, differentiate over parity-match,
   recorded ADR-style with the rejected alternative.

---

## Worked example (Input → Output)

**Input:** "이 설치 서비스 갭분석 해줘 — 북극성 대비 부족한 점이랑 버그랑 UX, 그리고 다른
벤치마크는 어떻게 했는지."

**DETECT (consolidated, abridged):**

| # | Lens | Gap (current → ideal) | Sev | Opp | Notes |
|---|------|------------------------|-----|-----|-------|
| 1 | North-star | Wizard lists assets but never explains *why* each is vetted; north star is "이해하고 선택", so an unexplained list under-serves the core job | 3 | 14 | no provenance/★ shown at select time |
| 2 | Correctness | `--with-foo` advertised in README but crashes (flag unregistered) | 4 | — | repro: `install --with-foo` → CAC throw |
| 3 | UX | First run gives no "what happens next" status (Nielsen: visibility of system status) | 3 | 11 | via multi-persona-review |
| 4 | North-star (over-served) | Three near-duplicate verbose `--help` walls; low importance, high satisfaction | 1 | 2 | candidate for **removal** |

**BENCHMARK (gap #1, high-ranked):**

```
Gap #1 (sev 3): wizard shows assets with no "why vetted" at decision time
  Benchmark:   VS Code Marketplace — VERIFIED: each extension card shows
               install count + verified-publisher badge + star rating inline
               in the pick list, so the trust signal sits at the moment of choice.
  Job:         "I need to trust this asset enough to install it, right here."
  Proposed:    Inline a one-line provenance (source repo + ★ + 'vetted: <date>')
               on each wizard row — surface the trust signal at decision time.
               Differentiator: we curate, so add a one-line *curator reason*,
               which a raw marketplace can't.
  Rejected:    Marketplace's full detail-page-per-extension — too heavy for a
               terminal wizard; defers the decision instead of supporting it.
```

The gap #1 proposal lands as an ADR — e.g. `docs/decisions/ADR-0NN-wizard-provenance.md`
recording the inline-provenance decision and the rejected full-detail-page
alternative — so step 5's "record ADR-style" is concrete, not just advice.

Gap #2 (correctness, sev 4) skips benchmarking — it's a bug, fix directly and add
the drift guard `no-false-ship` requires. Gap #4 proposes deletion, not a
benchmark. That selective routing is the point: spend research only where it pays.

---

## Cross-references (don't duplicate)

- **`multi-persona-review`** — owns the UX lens (Lens C). Invoke it; don't
  re-implement persona evaluation here.
- **`northstar-roadmap`** — same north star, opposite direction: it *directs* the
  roadmap forward; this *detects* gaps against it.
- **`ultracode-service-audit`** — the full N-dimension sweep. This skill is the
  narrower, faster gap → benchmark loop when you don't need the whole audit.
- **`architecture-decision-record`** — record each proposed fix as an ADR.

## Notes on rigor (where deeper detail would live)

If a future version needs the full scoring rubrics (the complete Nielsen 10-item
checklist text, the ODI questionnaire wording) or per-domain benchmark source
lists, the option is to summarize here and split the long-form into a sibling
`reference.md` — no such file exists yet, and this SKILL.md is self-sufficient
without it. Keep SKILL.md the practical map, not the encyclopedia.
