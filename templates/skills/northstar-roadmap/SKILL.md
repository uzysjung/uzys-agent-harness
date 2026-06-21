---
name: northstar-roadmap
description: >-
  Read the project's NORTH_STAR / vision doc, measure current state against the goal, then
  propose a forward direction plus prioritized feature proposals — persisted as a durable
  roadmap in docs/plans + memory so the plan survives /compact and new sessions. Use when
  the user asks where the project should go next or wants a backlog grounded in the vision.
  Fires on the user's real phrasings: "앞으로 어떤 방향으로 개선·발전시킬지 고민해봐",
  "NORTH.md / NORTH_STAR 보고 나아갈 방향 + 기능 제안", "나아갈 방향 + 기능제안 (수용 → 계획 수립하고 메모리에 기록)",
  "북극성 정렬 로드맵", as well as the English equivalents: "what direction should we take next",
  "propose a roadmap / feature backlog from the north star", "plan the next milestones and save it
  to memory". Not for detecting bugs or auditing current quality (see gap-analysis-e2e /
  ultracode-service-audit) — this skill DIRECTS forward planning.
---

# North-Star Roadmap (북극성 정렬 로드맵 + 기능 제안)

Turn a vision document into a forward direction and a ranked feature backlog, then write it
somewhere durable. The point is alignment, not idea generation: every proposal must trace
upward to the north-star, and the result must outlive the conversation that produced it.

## When to use

Reach for this skill when the user steps back from day-to-day work and asks where the project
should head — typically with one of these (their actual phrasings):

- "앞으로 어떤 방향으로 개선·발전시킬지 고민해봐"
- "NORTH.md / NORTH_STAR 보고 나아갈 방향 + 기능 제안"
- "(제안) 수용 → 계획 수립하고 메모리에 기록"
- English: "what direction next", "propose a roadmap from the north star", "save the plan to memory"

Do **not** use it to find what's broken right now. Detecting defects, gaps, or quality regressions
is the job of the sibling skills below; this skill consumes their findings and points forward.

## Why these steps (the frameworks underneath)

The workflow chains four established product-strategy methods so the output is defensible rather
than vibes. Reason with each — don't just cite it:

- **North Star Framework** (Amplitude) — a single North Star Metric is the destination; 3–5
  directly-influenceable *Inputs* are the levers. You assess "current vs goal" against the inputs
  (leading indicators teams can move), not lagging vanity numbers.
  https://amplitude.com/books/north-star/about-north-star-framework
- **Working Backwards / PR-FAQ** (Amazon) — for a major proposal, sketch the future end-state first
  (a one-line "press release" of the value the user gets), then derive the features. This forces
  clarity and stops "we can build X because we know how" reasoning.
  https://workingbackwards.com/concepts/working-backwards-pr-faq-process/
- **OKR lineage, not cascade** (Gothelf) — every roadmap item must have a *parent* it supports in
  the north-star. Items invented bottom-up that don't ladder up get cut. This is the core alignment test.
  https://jeffgothelf.com/blog/aligning-not-cascading-okrs-with-an-okr-lineage/
- **RICE / ICE scoring** (Intercom) — rank proposals by `(Reach × Impact × Confidence) / Effort`
  (RICE), or `Impact × Confidence × Ease` (ICE) when data is thin. Confidence is where you honestly
  discount exciting-but-unproven ideas. Scores are *inputs to a decision, not the verdict* — log
  every strategic override.
  https://www.intercom.com/blog/rice-simple-prioritization-for-product-managers/ ·
  https://agileseekers.com/blog/feature-prioritization-using-rice-and-ice-models-in-product-roadmaps
- **Theme-based Now / Next / Later** — organize the roadmap by outcome themes and horizons, not
  dated feature promises, so it ages gracefully and the why/what stays above the how/when.

## Core workflow

### 1. READ the north-star and restate it as Metric + Inputs

Read the project's vision doc (here: `docs/NORTH_STAR.md` — it already defines the North Star
Statement, the NSM, and measured Inputs). Restate the goal as **one North Star Metric + 3–5
influenceable Inputs**. If the doc already has them, lift them; if it only has a prose vision,
derive a candidate set and show it for confirmation.

Sanity-check the metric before trusting it:
- Is it a **leading** indicator of value, or a lagging one (raw revenue, registered users, page
  views)? Lagging metrics are "what's done is done" — you can't steer by them.
- Is it **gameable**? "If you can move it directly without delivering value, it's not a good
  north-star." Flag it instead of silently planning against a corrupt target.

> In this repo the literal north-star is **GitHub stars** (per memory and the service-audit
> roadmap), with the NORTH_STAR NSM (HITO ≤ 3/feature, low re-clarification) as the *value* the
> stars are supposed to reward. Plan toward stars **via** the value inputs, not by gaming the count.

### 2. ASSESS current state against each Input — expose the gap

For each Input, state where the project is today vs target, using real evidence (existing plans,
audit output, metrics, code state). The deliverable is the **gap**: the distance between now and
the north-star, per lever. Be honest about unknowns — an unmeasured input is a gap too.

### 3. PROPOSE direction + features by working backwards

First name the **forward direction** in a sentence or two — the theme(s) that close the biggest
gaps. Then, for each significant proposal:
- Write a one-line mini-PR (the future state: who gets what value once it ships).
- List the concrete feature(s) that realize it.
- State its **parent** — which Input / north-star pillar it supports. **No parent → cut it.**
  This is the alignment gate that prevents bottom-up feature churn.

### 4. PRIORITIZE with RICE (or ICE) and record overrides

Score each proposal. Use RICE when you have reach/effort signal; ICE for a thin-data first pass.
Write the numbers down so the ranking is auditable. Then apply judgment: dependencies, strategic
table-stakes, and north-star fit may override a score — **log WHY** for every override (the same
honesty the repo's `no-false-ship` and ADR/Decision-Log rules demand). Treat the score as a
decision aid, never an autopilot.

### 5. PERSIST as a Now / Next / Later roadmap in docs + memory

Write the result to a durable artifact so it survives `/compact` and new sessions:
- **Update the existing roadmap SSOT** under `docs/plans/` (here: `service-audit-roadmap.md`) in
  place, organized by outcome themes in **Now / Next / Later** horizons — not dated commitments.
  Prefer one living doc over spawning a dated parallel (e.g. `northstar-roadmap-2026-06.md`): two
  roadmaps drift. Only create a separate dated horizon doc if the user explicitly asks for one.
- A short anchor line in `memory/MEMORY.md` pointing at that doc, so it's re-referenced at session
  start as a Persistent Anchor (per CLAUDE.md "SPEC/PRD는 매 세션 시작 시 재참조").
- If a real architectural decision was made (e.g. dropping a direction), record an ADR under
  `docs/decisions/`, numbered as the next free integer (check the highest existing `ADR-NNN`
  first), per `change-management.md`.

Then report back: the direction, the ranked table, and the file paths written. Mark it a **living
document** — both the metric and the priorities are expected to be revised as strategy evolves.

## Worked example

**Input (user):** `/northstar-roadmap NORTH_STAR 보고 나아갈 방향 + 기능 제안 → 계획 세워서 메모리에 기록`

**Output (abridged):**

> **1. Metric + Inputs** (from `docs/NORTH_STAR.md`)
> North Star Metric: GitHub stars as the adoption signal that the harness delivers real value.
> Inputs: (a) HITO ≤ 3 / feature, (b) Promise = Implementation (advertised assets 100% work),
> (c) first-run install success, (d) vetted+security-audited asset count, (e) 4-CLI parity.
> *Leading-indicator check:* stars alone are gameable, so we plan against inputs (a)–(e), the value
> the stars reward — not the raw count.
>
> **2. Gap** — (a) HITO unmeasured in fresh installs · (b) closed after no-false-ship work · (c)
> install-matrix green but no post-publish telemetry · (e) plugins don't yet reach non-Claude CLIs.
>
> **3. Direction** — "Make the *first 60 seconds* prove the value before asking for a star."
> Proposals: P1 first-run telemetry (parent: Input c); P2 plugin→codex/opencode equivalence
> (parent: Input e); P3 public, continuously-tested compat+security matrix artifact (parent: Input d).
> Each carries a one-line mini-PR.
>
> **4. RICE** — P1 (R 5·I 2·C .8·E 2 = 4.0) · P3 (R 4·I 3·C .7·E 3 = 2.8) · P2 (R 2·I 3·C .6·E 5 = 0.7).
> *Override:* P3 promoted above its score — it's the repo's defensibility wedge (table-stakes for
> a 0-star cold start). Logged here and in the ADR.
>
> **5. Persisted** — updated the SSOT `docs/plans/service-audit-roadmap.md` in place (Now: P1 ·
> Next: P3 · Later: P2), added the anchor to `memory/MEMORY.md`, opened the next free ADR
> `docs/decisions/ADR-0NN-p3-override.md` for the strategic override.

## Pitfalls to design against

- **Vanity / lagging / gameable north-star** — the two failure modes to refuse: picking a metric
  you can't influence (revenue, raw users) or one you can move without delivering value.
- **False precision in RICE/ICE** — subjective Reach/Impact/Effort treated as exact truth. Confidence
  exists to discount shaky estimates; skipping it yields authoritative-looking wrong rankings.
- **Score on autopilot** — shipping the top-RICE item while ignoring dependencies or strategic fit.
- **Dated feature-list roadmap** — timeline promises rot; outcome themes in Now/Next/Later age better.
- **Bottom-up idea dump** — proposals that don't ladder up to an Input. The alignment gate (step 3)
  is the cure.
- **Plan that doesn't persist** — a great assessment that lives only in the chat and is lost at
  `/compact`. The artifact in step 5 is the whole point.

## Cross-references (siblings — do not duplicate)

- **gap-analysis-e2e** — *detects* north-star gaps end-to-end. This skill consumes those gaps as the
  evidence in step 2.
- **ultracode-service-audit** — produces a multi-dimension audit and roadmap of *current* problems.
  This skill takes that roadmap as input and points it forward.
- **strategic-compact** / project ADR + plan-SSOT conventions — the persistence mechanism (step 5)
  reuses them rather than reinventing.

> Audit and gap skills answer "what's wrong now?". This skill answers "where do we go, and in what
> order?" — and makes the answer durable.

## Reference (progressive disclosure)

This SKILL.md is the operating summary. If deeper method detail is ever needed — full RICE worked
calculations, a PR-FAQ template, or a roadmap-doc skeleton — add a `reference.md` beside this file
and link it here. Keep SKILL.md lean; the user dislikes verbose notepad docs.
