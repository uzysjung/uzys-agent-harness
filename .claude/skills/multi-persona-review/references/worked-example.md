# Worked example (Input → Output)

One complete run of the SKILL.md workflow, end to end.

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
- Hostile: "'Works everywhere' — claims 4 CLIs but only shows one. Fix: either show all four or
  soften to 'one CLI today, others in progress.'" *(single-source, kept)*

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

Two details in this table are the method, not decoration. **F2 is single-source and still P0** —
consensus filtering would have deleted the finding that mattered most. And the buckets are derived
from the shown `Sev × Freq` inputs, so a reader can disagree with the ranking by disagreeing with
an input rather than with a verdict.

This mirrors the user's real run (memory: `persona-feedback-improvements`, P0-before-publish gate).
