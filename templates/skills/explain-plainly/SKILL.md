---
name: explain-plainly
description: >-
  Explain a technical finding to someone who has not read the code: fix the
  referent first (one name often points at two things), lead with who is
  affected and what changes, then show evidence. Run it whenever you explain a
  bug, a cause, or what your change did — especially the moment the reader says
  they don't follow ("뭔 소리야", "쉽게 설명해줘", "이해가 안 돼", "I don't follow",
  "in plain terms"), or when your draft opens with a file path or symbol name.
---

# Explain Plainly

A **repair-and-prevent discipline** for the moment your explanation does not land.
Not a style guide — a short diagnostic you run before (and after) explaining
something technical to someone who has not read the code.

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

## Step 3 — Then escalate, in this order

Each rung only if the previous one left a real gap:

1. **One sentence** — who is affected, what changes.
2. **Contrast** — before vs after, or expected vs actual. A table if there are
   ≥3 dimensions; a two-line before/after if fewer. (For an approval moment,
   hand off to `asis-tobe-decision` — that skill owns the decision format.)
3. **Evidence** — `file:line`, test output, measured numbers. This is where
   precision lives, and where it stops costing comprehension.

Stop as soon as the reader has what they need. Rungs 2 and 3 are not obligations.

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

## Failure modes

- **Reaching for a nicer format first.** Format is rung 2; referent is rung 0.
- **"Let me redo it from the user's perspective"** as a reflex. Perspective does
  not fix referent ambiguity — it just re-narrates the same confusion.
- **Leading with a coordinate.** `file:line` is proof, not an opening.
- **Explaining your work instead of their change.** "I added X" is a changelog
  entry; "your Y now does Z" is an explanation.
- **Over-simplifying into vagueness.** Plain ≠ imprecise. Keep the exact numbers
  and paths — just put them after the claim.
- **Manufacturing a diagram when nothing collides.** Cost with no benefit.

## Worked example

**Input** (the failing draft): *"`update-mode.ts:53-78` の targets array lists
rules/agents/commands/hooks. `skills` is absent, and `install-render.ts:431`
iterates `updated`, so no row renders."*

Every clause is true, and it does not land.

**Output** (after the diagnostic):

> There are two `.claude/` directories, and I mixed them:
>
> ```
> ① this repo (we build here)    ② someone's project (installed here)
>    templates/skills/  ──npm──▶    .claude/skills/
> ```
>
> **The problem, in one sentence:** in ②, skills installed once never change
> again, no matter how many times the user runs update.
>
> Update refreshes rules, agents, commands, and hooks — but skills were left out
> of that list, and the summary screen only prints directories that were
> touched. So nothing on screen said anything was skipped.
>
> Evidence: `update-mode.ts:53-78` (the target list), `install-render.ts:431`
> (the render loop).

Same facts, same precision, three lines to comprehension.

## Related skills

- `asis-tobe-decision` — takes over when the explanation ends in a **decision**.
  This skill gets the reader to understand; that one gets them to choose.
- `recurrence-prevention` — when a *misexplanation* keeps recurring, that ladder
  decides whether it becomes a note, a rule, or a gate.
