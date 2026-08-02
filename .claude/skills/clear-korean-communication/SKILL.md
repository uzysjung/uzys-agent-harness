---
name: clear-korean-communication
description: >-
  Make a technical explanation land, and turn the decision at the end of it into
  something the reader can approve in one pass. Two halves of one job: (1) EXPLAIN
  — fix the referent first (one name often points at two things), lead with who is
  affected and what changes, put file paths and symbols after the claim as evidence;
  (2) DECIDE — present approval/choice moments in the user's four-part format
  전후맥락 (context) → 추천 + 이유 (recommendation) → UI/UX 형태 (a scannable
  table/option-list) → ASIS→TOBE contrast, led by the recommendation so the user can
  say yes fast. Run it whenever you explain a bug, a cause, or what your change did
  — especially the moment the reader says they don't follow ("뭔 소리야", "쉽게
  설명해줘", "이해가 안 돼", "I don't follow", "in plain terms"), or when your draft
  opens with a file path or symbol name — and whenever you are about to ask
  "should I do this?". Triggers on the user's verbatim phrases "ASIS TOBE로 설명",
  "ASIS-TOBE로 알려줘", "화면으로 ASIS TOBE로 설명", "의사결정 / 컨펌 요청",
  "이거 진행할까요?", the softer "다음 진행할 것들 알려줘", and the English
  equivalents "present this as ASIS/TOBE", "give me the as-is to-be", "should I do
  A or B", "ask for my approval", "lay out the options". Do NOT fire for pure
  information with no decision in it, for trivial reversible actions you would just
  do, or for context-free word/sentence translation — that is ordinary translation.
---

# Clear Korean Communication

A **repair-and-prevent discipline** for the moment your explanation does not land,
plus the **presentation format** for the decision it usually ends in. Not a style
guide — a short diagnostic you run before (and after) explaining something
technical to someone who has not read the code.

Part 1 (Explain) gets the reader to *understand*. Part 2 (Decide) gets them to
*choose*. Most real messages need Part 1; only genuine approval moments need Part 2.

## Why this exists (and why format alone won't save you)

A correct, well-formatted explanation can still fail completely. Observed case:
an agent explained a bug in the required ASIS→TOBE decision format — tables,
before/after, quantified gap — and the reader replied **"뭔 소린지 모르겠다"**.
The second attempt was explicitly rewritten "from the user's perspective" and
failed *again*. What actually fixed it was one drawing that separated two things
that shared a name.

The lesson: **when an explanation fails, the usual suspect is not tone, length,
or format. It is that the reader cannot tell what you are talking about.**
Reaching for a nicer format first is why the second attempt fails too.

## Sort the facts before you write

Split the input into these four buckets and never mix them in one sentence:

1. **관찰된 출력 문제** — what you actually saw in a response, log, screen, or test run.
2. **반복되는 실패 패턴** — the same shape confirmed across several cases.
3. **원인 가설** — explains the symptom but is not yet verified.
4. **아직 검증할 수 없는 항목** — model internals, unmeasured effects, long-session
   claims you have no operating log for.

One case is not a general cause. Mark an unverified cause as a hypothesis and say
how it could be checked. Do not present a guess as evidence.

---

# Part 1 — Explain

## Step 1 — Fix the referent (do this before anything else)

Ask: *does any name in my explanation point at more than one thing?*

This is the dominant failure. Codebases are full of names that legitimately
denote two different objects — and the writer, who holds both in their head,
never notices the collision:

| Collision shape | Example |
|---|---|
| Same path, two locations | `.claude/` in *this* repo vs `.claude/` in an *installed user's* project |
| Same word, two layers | "config" = the file on disk vs the parsed object |
| Same name, two lifecycles | "the build" = CI job vs local artifact |
| Same entity, two roles | "user" = the human here vs a row in the DB |

If you find one: **separate and name them before explaining anything else**, and
prefer a small diagram over prose — prose forces the reader to hold the split in
working memory while you keep talking.

```
① this repo (where we develop)     ② the user's project (where it gets installed)
   templates/skills/  ──npm──▶        .claude/skills/
```

If nothing collides, say so to yourself and move on — do not manufacture a
diagram you don't need.

## Step 2 — Lead with one sentence: who, and what changes

Before any table, write **one sentence** naming the affected party and the
concrete change:

> "Skills installed in someone's project never update, no matter how many times
> they run update."

Test it: could the reader repeat that sentence back after reading it once? If it
needs a second clause to make sense, it is not the lead sentence yet.

Bad leads, all real patterns:
- opens with a coordinate — *"`update-mode.ts:53-78` の targets array…"*
- opens with mechanism — *"the render loop iterates `updated` keys, so…"*
- opens with what **you** did rather than what **changed** — *"I added a sha256
  baseline to the install log."*

Coordinates and mechanism are **evidence**. They belong after the claim, never
in front of it — to a reader who has not opened the file, `foo.ts:53` carries no
meaning at all.

Name the role that is actually affected (최종 사용자 / 운영자 / 개발자 / 리뷰어 /
보안 담당자 / 의사결정자). If the end user's screen does not change, do not invent
an end-user benefit — say who really benefits instead.

## Step 3 — Then escalate, in this order

Each rung only if the previous one left a real gap:

1. **One sentence** — who is affected, what changes.
2. **Contrast** — before vs after, or expected vs actual. A table if there are
   ≥3 dimensions; a two-line before/after if fewer. (If this is an approval
   moment, switch to Part 2 — that is where the decision format lives.)
3. **Evidence** — `file:line`, test output, measured numbers. This is where
   precision lives, and where it stops costing comprehension.

Stop as soon as the reader has what they need. Rungs 2 and 3 are not obligations.

Separate 이득 / 손실 / 위험, and separate 측정값 from 추정값. If it was not
measured, write "미측정" or "감소가 예상되지만 확인되지 않음" — never a number
invented to fill a cell.

## Step 4 — When they say they don't follow: diagnose, don't rewrite

The instinct is to rewrite the same content in a softer voice. That reproduces
the same defect with different words — the second failure in the observed case.
Instead, ask which of these is missing, in order:

| Symptom in their reply | Likely cause | Fix |
|---|---|---|
| "is this X or Y?" | **referent collision** | Step 1 — separate and name |
| "so what?" / "and?" | no stated consequence | Step 2 — who is affected |
| "why does that happen?" | jumped to fix, skipped cause | one causal sentence |
| repeats your term back with a "?" | unexplained jargon | define once, in their words |

Their question is the diagnostic. **Read what they actually asked** rather than
assuming the explanation was merely too long. In the observed case the reader's
question — *"is this about installing, or about the project directory?"* — named
the defect exactly, and the fix took three lines.

---

# Part 2 — Decide

Fire this half whenever you are about to:

- ask for approval before doing something ("이거 이렇게 진행할까요?")
- offer the user a choice between two or more approaches
- propose a change to architecture, config, scope, or plan
- recommend one option over others

Softer/secondary trigger: reporting "next steps" the user must sign off on ("다음
진행할 것들"). Do **not** fire for pure information with no decision in it, or for
trivial reversible actions you'd just do.

## The four slots

Cover all four, but **lead with the recommendation** — readers decide off the
conclusion, so put it up top even though it is item 2 in the user's rule.

```
추천 + 이유   (item 2)  ← lead here: the recommendation and the explicit ask
전후맥락       (item 1)  ← context: the forces that make this decision necessary now
UI/UX 형태     (item 3)  ← one scannable table / option-list, never prose
ASIS→TOBE     (item 4)  ← current → proposed contrast, gap made concrete
```

- **추천 + 이유** — state it as a **concrete commitment in active voice** ("I'll
  switch X to Y"), not "we could consider maybe looking at Y". Give the short why
  (a line or two), then the **explicit ask**: "Approve A, or pick B?" A proposal
  with no actual ask leaves the loop open and guarantees another round.
- **전후맥락** — the forces at play in plain language: the technical, product, or
  constraint pressure that makes this decision necessary *now*. Without it a
  reader either blindly accepts or blindly rejects.
- **UI/UX 형태** — one scannable table or option list, **never a wall of prose**.
  Aligned columns the reader can scan vertically; pre-answer the obvious
  objection inline ("왜 B가 아닌가") so they don't have to ask.
- **ASIS→TOBE** — columns *항목 / ASIS (현재) / TOBE (제안) / Gap*. **Quantify the
  gap** with a metric or cost — an unquantified gap ("느림 → 빨라짐") is rhetoric,
  not a basis for deciding. List trade-offs honestly, **including the downside of
  the recommended option**; hidden downsides surface later as distrust. Close with
  a one-line tail of what happens on approval ("승인 시 → …").

## Don't over-fire the table

ASIS→TOBE or a comparison table earns its space only when at least one holds:

- 현재 상태와 변경 후 상태를 비교해야 한다.
- 실제 선택이나 승인이 필요하다.
- 비용·일정·범위·위험 또는 동작 차이가 있다.
- 항목을 정렬하면 판단이 실제로 쉬워진다.

단순한 버그 원인, 간단한 테스트 결과, 완료 여부, 선택지가 없는 작업 보고, 한두
문장으로 충분한 답변에는 쓰지 마라. A table around a one-sentence answer is noise,
and it is the most common way this skill gets misused.

## Common failure modes to avoid

- **Reaching for a nicer format first.** Format is rung 2; referent is rung 0.
- **"Let me redo it from the user's perspective"** as a reflex. Perspective does
  not fix referent ambiguity — it just re-narrates the same confusion.
- **Leading with a coordinate.** `file:line` is proof, not an opening.
- **Explaining your work instead of their change.** "I added X" is a changelog
  entry; "your Y now does Z" is an explanation.
- **Over-simplifying into vagueness.** Plain ≠ imprecise. Keep the exact numbers
  and paths — just put them after the claim.
- **Manufacturing a diagram when nothing collides.** Cost with no benefit.
- **Hedged recommendation** ("고려해볼 수 있습니다") — forces the user to do the
  analysis. State a commitment.
- **Recommendation buried under option analysis** — lead with the lead option.
- **Context but no ask** — leaves the loop open. Always end the 추천 with the ask.
- **Prose instead of a table** at a real decision — skips the "UI/UX 형태" item.
- **Unquantified ASIS→TOBE gap** — rhetoric, not a decision basis.
- **Suppressed downsides** to make the proposal look cleaner — surfaces later as
  distrust. List trade-offs.

## Before you send

Run the pre-send checklist in
[references/pre-send-checklist.md](references/pre-send-checklist.md) — 14 checks,
one pass, fix and re-check. Never append "검수했습니다" to the answer itself.

## References (read on demand, not by default)

- [references/worked-examples.md](references/worked-examples.md) — the two full
  before→after walkthroughs: a failing explanation repaired by the Step 1–4
  diagnostic, and a complete four-slot decision with a quantified ASIS→TOBE table.
- [references/pre-send-checklist.md](references/pre-send-checklist.md) — the 14
  self-checks to run before sending.
- [references/why-it-works.md](references/why-it-works.md) — the named frameworks
  behind each rule (BLUF, RICE, Working Backwards PR/FAQ, ADR, working-memory
  limits). Optional: read it when you have to defend the format, not to apply it.

## Related skills

A cross-cutting **communication discipline**, not a workflow. Sibling skills that
produce findings or choices should render them through this one:

- `audit-service-gaps` — its gap output maps directly onto the ASIS→TOBE table.
- `recurrence-prevention` — when a *misexplanation* keeps recurring, that ladder
  decides whether it becomes a note, a rule, or a gate.
- `multi-persona-review` — panel findings are input to Part 2, not a substitute
  for the recommendation you owe the user.

This skill stops at understanding and the ask. Executing the approved change is
someone else's job.
