# Roadmap method — 근거 · 워크드 예제 · 함정

SKILL.md 의 5단계 워크플로가 왜 그 순서인지, 실제 계산이 어떻게 생겼는지, 그리고 그 단계에서
반복되는 실패가 무엇인지. 로드맵을 실제로 만들 때 읽는다.

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
  the north star. Items invented bottom-up that don't ladder up get cut. This is the core alignment test.
  https://jeffgothelf.com/blog/aligning-not-cascading-okrs-with-an-okr-lineage/
- **RICE / ICE scoring** (Intercom) — rank proposals by `(Reach × Impact × Confidence) / Effort`
  (RICE), or `Impact × Confidence × Ease` (ICE) when data is thin. Confidence is where you honestly
  discount exciting-but-unproven ideas. Scores are *inputs to a decision, not the verdict* — log
  every strategic override.
  https://www.intercom.com/blog/rice-simple-prioritization-for-product-managers/ ·
  https://agileseekers.com/blog/feature-prioritization-using-rice-and-ice-models-in-product-roadmaps
- **Theme-based Now / Next / Later** — organize the roadmap by outcome themes and horizons, not
  dated feature promises, so it ages gracefully and the why/what stays above the how/when.

## Worked example

**Input (user):** `NORTH_STAR 보고 나아갈 방향 + 기능 제안 → 계획 세워서 메모리에 기록`

**Output (abridged):**

> **1. Metric + Inputs** (from the north-star doc)
> North Star Metric: GitHub stars as the adoption signal that the tool delivers real value.
> Inputs: (a) context cost per install (resident + fired tokens), (b) Promise = Implementation
> (advertised assets 100% work), (c) first-run install success, (d) justified-asset ratio,
> (e) multi-CLI parity.
> *Leading-indicator check:* stars alone are gameable, so we plan against inputs (a)–(e), the value
> the stars reward — not the raw count.
>
> **2. Gap** — (a) fired-body tokens unmeasured · (b) closed after the false-ship work · (c)
> install matrix green but no post-publish telemetry · (e) plugins don't yet reach non-default CLIs.
>
> **3. Direction** — "Make the *first 60 seconds* prove the value before asking for a star."
> Proposals: P1 first-run telemetry (parent: Input c); P2 plugin→other-CLI equivalence
> (parent: Input e); P3 public, continuously-tested compat+security matrix artifact (parent: Input d).
> Each carries a one-line mini-PR.
>
> **4. RICE** — P1 (R 5·I 2·C .8·E 2 = 4.0) · P3 (R 4·I 3·C .7·E 3 = 2.8) · P2 (R 2·I 3·C .6·E 5 = 0.7).
> *Override:* P3 promoted above its score — it's the repo's defensibility wedge (table-stakes for
> a 0-star cold start). Logged here and in the ADR.
>
> **5. Persisted** — updated the roadmap SSOT under `docs/plans/` in place (Now: P1 · Next: P3 ·
> Later: P2), added the anchor line to the memory file, opened the next free ADR
> (`docs/decisions/ADR-0NN-p3-override.md`) for the strategic override.

읽는 법: 4단계의 override 한 줄이 이 예제의 핵심이다. P3 는 점수가 2위인데 1위로 올라갔고,
**그 사실과 이유가 산출물에 남아 있다.** 점수만 남기고 판단을 감추면 다음 사람이 순위를
근거로 착각한다.

## Pitfalls to design against

- **Vanity / lagging / gameable north star** — the two failure modes to refuse: picking a metric
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

- **audit-service-gaps** — *detects* north-star gaps end-to-end. This workflow consumes those gaps
  as the evidence in step 2.
- **strategic-compact** / the project's ADR + plan-SSOT conventions — the persistence mechanism
  (step 5) reuses them rather than reinventing.

> Audit and gap skills answer "what's wrong now?". This skill answers "where do we go, and in what
> order?" — and makes the answer durable.
