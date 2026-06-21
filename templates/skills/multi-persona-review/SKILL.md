---
name: multi-persona-review
description: >-
  A panel-review skill that critiques ONE artifact (launch post, README, doc, markdown, plan,
  design) via 3-5 disjoint user-perspective personas running in parallel, then synthesizes deduped,
  severity-ranked improvement points (P0/P1/P2). Use when the user says "작성글을 사용자 관점의
  페르소나를 여러명 만들어서 (손넷 모델정도로) 피드백 받아바", "다면 리뷰 해볼까", "페르소나로 리뷰",
  "여러 관점으로 피드백", or in English "multi-persona review", "review this from different user
  perspectives", "get persona feedback on this post/README/doc", "panel review this artifact".
  Lighter than a full service audit — point it at ONE artifact, not a whole codebase. NOT for a
  whole-codebase multi-dimension audit (use ultracode-service-audit) or a single-axis
  gap-vs-benchmark loop (use gap-analysis-e2e).
---

# Multi-Persona Review (다면페르소나 워크플로우 리뷰)

Run a small panel of realistic target-user personas over one artifact, independently and in
parallel, then synthesize their findings into a deduped, prioritized fix list. This is how the
user actually works: "작성글을 사용자 관점의 페르소나를 여러명 만들어서 손넷 모델정도로 피드백 받아바"
and "이부분도 다면 리뷰 해볼까?" — 4-5 Sonnet-tier personas across 1-2 passes over a launch post,
yielding P0~P2 prioritized fixes.

## When to use

- A draft is "done" but you want blind spots an author is fatigue-blind to: launch post, README,
  PRD/plan, doc, marketing copy, a design.
- The user names personas or "다면 리뷰" / "여러 관점" / "multi-persona" / "panel review".
- You want **reproducible, severity-ranked** feedback, not one reviewer's gut reaction.

Do **not** use this for whole-codebase quality work — that's `ultracode-service-audit`. This skill
is deliberately lighter: one artifact, one panel, one synthesis. For surfacing missing user
journeys end-to-end, this feeds the UX lens of `gap-analysis-e2e`.

## Why a panel beats one reviewer (the evidence)

The whole method rests on one empirical fact: **independent reviewers find largely
non-overlapping problems.**

- **Heuristic Evaluation (Nielsen & Molich) + the 3-5 evaluator rule** — a single evaluator
  catches only ~35% of usability issues; aggregating independent evaluators raises coverage to
  ~85% at five, with sharp diminishing returns beyond. The value comes from *low overlap between
  perspectives*, not any one reviewer being thorough. Some of the hardest issues are found by an
  evaluator who otherwise finds few. Each judges against the *same explicit checklist* so reviews
  stay comparable and dedupable.
  https://www.nngroup.com/articles/how-to-conduct-a-heuristic-evaluation/theory-heuristic-evaluations/
- **Panel of LLM evaluators (PoLL)** — a panel of several smaller, *disjoint* judges beats one
  large judge, shows less self-preference bias, and costs ~7x less. This is the cost-tier reason
  the user runs the persona panel at Sonnet tier and reserves the main model for orchestration and
  synthesis. https://arxiv.org/abs/2404.18796
- **"Nine Judges, Two Effective Votes"** — panels help *only to the extent members fail
  independently*. A 9-judge panel carried only ~2 independent votes' worth of information because
  the models made the same mistakes on the same items. The bottleneck is **correlated reviewers,
  not panel size or aggregation math** — so persona design must maximize genuine viewpoint
  diversity, not nominal count. https://arxiv.org/abs/2605.29800
- **LLM-as-persona-reviewer vs human experts (GPT-4o study)** — persona review finds many real
  issues but also emits false positives humans wouldn't flag, and misses issues needing embodied
  experience. Recommended posture: a **hybrid** where personas generate candidate findings that a
  human validates — never a replacement for human judgment. https://arxiv.org/pdf/2506.16345
- **RICE prioritization (Intercom)** — (Reach × Impact × Confidence) / Effort turns rough guesses
  into one comparable score, down-weighting low-confidence/high-effort items and countering the
  reviewer's bias toward what they'd personally use. A lightweight analog gives a *defensible,
  reproducible* map from findings to P0/P1/P2.
  https://www.intercom.com/blog/rice-simple-prioritization-for-product-managers/

## Core workflow

### 1. Frame the artifact (orchestrator, main model)

Capture three things the personas will all share:
- **Goal** — what is this artifact trying to achieve? (e.g. "get a developer to `npx` install in
  under 2 minutes and star the repo")
- **Audience** — who is the real target reader?
- **Rubric** — the shared checklist every persona scores against, so findings are comparable and
  dedupable. Default rubric (adapt to the artifact): *clarity of value prop · first-action
  friction · credibility/trust signals · scannability · accuracy/honesty · accessibility ·
  call-to-action*. Without a shared rubric, red-team reviews decay into proofreading and generic
  opinions, and findings stop being comparable across personas.

### 2. Design 3-5 genuinely disjoint personas

Cap the panel at five — coverage flattens beyond that, and extra personas mostly inflate tokens
and false confidence (the "Nine Judges" trap). Engineer **diversity, not count**: pick personas
with disjoint goals, contexts, and *failure-fears* so their blind spots don't correlate. A strong
default spread:

| Persona | Lens / what they fear |
|---|---|
| Skeptical newcomer | Doesn't know the domain; fears wasting time on hype. Tests "do I get it in 10s?" |
| Time-pressured expert | Knows the domain; fears fluff between them and the command. Tests scannability + first action. |
| Accessibility-dependent user | Screen reader / low vision / non-native reader. Tests structure, alt text, plain language. |
| Hostile/adversarial reader | Looks for overclaims, vague benefits, anything to dismiss. Tests honesty + credibility. |
| Adjacent-tool migrant *(optional 5th)* | Already uses a competitor. Tests differentiation + "why switch?". |

Swap personas to fit the artifact (e.g. for a PRD: implementing engineer, on-call SRE, PM,
security reviewer). The test is always: would these two personas make the *same* mistake? If yes,
they're not independent — replace one.

### 3. Review in parallel, independently (Sonnet-tier panel)

Spawn one sub-agent per persona via the **Task tool** (or the harness's sub-agent mechanism). Each
one gets the artifact + goal + audience + the *same* rubric, and **must not see the other personas'
output** — independence is the precondition that makes aggregation add information. Anchoring on a
peer collapses the panel toward one effective vote.

Prefer pinning the persona sub-agents to a cheaper tier (Sonnet) — see the cost-tier note. But this
degrades gracefully: if the harness can't pin sub-agents to a specific model, just run the panel on
the default sub-agent model and note in the step-6 coverage caveat that the panel ran at the
orchestrator tier. The tier is an economy, not a hard prerequisite.

Each persona returns findings as **strengths / weaknesses / specific recommendations**. Require
every finding to be specific and actionable: **quote the offending passage and propose a concrete
fix.** Ban vague "needs work" notes — that's the classic red-team failure mode (briefing +
structured findings + independence are the load-bearing parts, not the critical attitude).
https://loopio.com/blog/red-team-review/

### 4. Synthesize: dedupe, but preserve minority findings (orchestrator, main model)

Collapse overlapping findings into one entry, noting *how many personas raised it* (frequency is a
prioritization signal). **But never drop a single-persona finding** — heuristic-evaluation data
says the hardest, most valuable issues are often raised by only one reviewer. Majority-vote /
consensus filtering would silently discard exactly those. Keep them, tagged as single-source.

### 5. Prioritize with a transparent rule → P0/P1/P2

Map each finding to a bucket with a **reproducible** rule, not by gut feel or by which persona
phrased it loudest. Use a RICE-style or **severity × frequency** score:

- **P0** — blocks the artifact's goal for many readers (e.g. value prop unreadable in first
  screen; a false claim). High impact × high confidence, any effort.
- **P1** — meaningfully hurts conversion/trust but has a workaround.
- **P2** — polish, edge-reader, or low-confidence/high-effort items.

Show the score inputs so the ranking is auditable.

### 6. Triage as candidates, state coverage honestly

Present the list as **candidate findings needing a validation pass**, not gospel. Flag likely
false positives and note where real-user confirmation is warranted before committing fixes — LLM
personas both miss embodied issues and invent non-issues. End with an honest coverage caveat: a
panel never finds every issue and offers no systematic fix generation (Nielsen's own caveat).
Claiming exhaustiveness here would be a no-false-ship violation.

**Second pass (the "1-2 passes"):** run the same panel again *after fixes land* to confirm the P0s
are actually closed and that the edits didn't introduce new issues. One pass to find, one to verify
— a third rarely pays off.

## Worked example (Input → Output)

**Input:** Trigger — "이 런치 포스트 다면 리뷰 해볼까? 손넷으로 페르소나 4명." Artifact: a launch
post for an npm installer CLI. Goal: "reader runs `npx ... init` and stars the repo." Audience:
indie devs scanning a feed.

**Panel (parallel, Sonnet tier):** skeptical newcomer · time-pressured expert ·
accessibility-dependent reader · hostile reader.

**Raw findings (excerpt):**
- Newcomer: "Paragraph 1 says 'context-engineered harness' — I don't know what that buys me.
  Quote: *'A context-engineered harness for agentic CLIs.'* Fix: lead with the outcome — *'Install
  vetted plugins, skills, and rules across 4 AI CLIs in one command.'*"
- Expert: "The install command is below three paragraphs of philosophy. Fix: move `npx` line to
  the first screen." *(also raised by newcomer → frequency 2)*
- Accessibility: "Demo is a GIF with no text fallback; the actual command only appears in the GIF.
  Fix: put the command in a code block as text."
- Hostile: "'Works everywhere' — claims 4 CLIs but only shows Claude. Fix: either show all four or
  soften to 'Claude today, others in progress.'" *(single-source, kept)*

**Synthesized + prioritized output:**

| ID | Finding (deduped) | Personas | Sev × Freq | Bucket |
|---|---|---|---|---|
| F1 | Install command buried below the fold / inside GIF only | expert, newcomer, a11y | high × 3 | **P0** |
| F2 | Value prop is jargon, not outcome, in first screen | newcomer | high × 1 | **P0** |
| F3 | "Works everywhere" overclaims vs. evidence shown | hostile | med × 1 | **P1** |
| F4 | Demo GIF has no text alternative | a11y | med × 1 | **P1** |

**Caveat returned to user:** candidate findings from a 4-persona Sonnet panel; F3 (overclaim) is
worth confirming against what the post can actually demo before rewording. Not exhaustive — a real
indie-dev read may surface more.

This mirrors the user's real run (memory: `persona-feedback-improvements`, P0-before-publish gate).

## Cost-tier note

Run the **persona panel at a cheaper tier (Sonnet)** — PoLL shows a disjoint panel of smaller
judges beats one big judge at a fraction of the cost. Reserve the **main/orchestrator model** for
framing the rubric and synthesizing (steps 1, 4-6), where reasoning quality pays off most.

## Pitfalls to avoid

- **False diversity** — personas that share the model's default assumptions give far fewer than N
  views. Design for disjoint fears; if two would make the same mistake, replace one.
- **Scaling count to fix quality** — past ~5 personas you mostly buy tokens and noise. Fix
  independence, not size.
- **Consensus filtering** — dropping single-persona findings discards the rare, hard issues that
  are the whole point.
- **Anchoring** — letting personas see each other's output before judging collapses the panel.
- **Opaque P0/P1/P2** — ranking by vibe or loudest wording is unauditable. Show the score.
- **Over-claiming coverage** — report it as candidate findings, never "found everything."

## Cross-references

- `ultracode-service-audit` — full multi-dimensional audit of a whole service/codebase; this skill
  is the lighter, single-artifact UX lens.
- `gap-analysis-e2e` — this skill feeds its UX/user-journey lens.
- `critique` — design-specific persona critique with anti-pattern detection; reach for it when the
  artifact is a UI rather than prose/markdown.

> This SKILL.md is complete and self-contained — everything needed to run a panel is above. If the
> method ever needs deeper appendices (full default rubrics per artifact type, persona prompt
> templates, a RICE scoring worksheet), a `reference/` file alongside this SKILL.md is the place to
> add them. That's a future-extension option, not a missing dependency.
