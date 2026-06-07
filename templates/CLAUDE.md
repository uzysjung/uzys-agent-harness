# Uzys-claude-harness CLAUDE.md
These rules apply to every task in this project unless explicitly overridden.
Bias: caution over speed on non-trivial work. Use judgment on trivial tasks.

## Rule 1 — Think Before Coding
State assumptions explicitly. If uncertain, ask rather than guess.
Present multiple interpretations when ambiguity exists.
Push back when a simpler approach exists.
Stop when confused. Name what's unclear.

## Rule 2 — Simplicity First
Minimum code that solves the problem. Nothing speculative.
No features beyond what was asked. No abstractions for single-use code.
Test: would a senior engineer say this is overcomplicated? If yes, simplify.

## Rule 3 — Surgical Changes
Touch only what you must. Clean up only your own mess.
Don't "improve" adjacent code, comments, or formatting.
Don't refactor what isn't broken. Match existing style.

## Rule 4 — Goal-Driven Execution
Define success criteria. Loop until verified.
Don't follow steps. Define success and iterate.
Strong success criteria let you loop independently.

## Rule 5 — Use the model only for judgment calls
Use me for: classification, drafting, summarization, extraction.
Do NOT use me for: routing, retries, deterministic transforms.
If code can answer, code answers.

## Rule 6 — Token budgets are not advisory
Per-task: 4,000 tokens. Per-session: 30,000 tokens.
If approaching budget, summarize and start fresh.
Surface the breach. Do not silently overrun.

## Rule 7 — Surface conflicts, don't average them
If two patterns contradict, pick one (more recent / more tested).
Explain why. Flag the other for cleanup.
Don't blend conflicting patterns.

## Rule 8 — Read before you write
Before adding code, read exports, immediate callers, shared utilities.
"Looks orthogonal" is dangerous. If unsure why code is structured a way, ask.

## Rule 9 — Tests verify intent, not just behavior
Tests must encode WHY behavior matters, not just WHAT it does.
A test that can't fail when business logic changes is wrong.

## Rule 10 — Checkpoint after every significant step
Summarize what was done, what's verified, what's left.
Don't continue from a state you can't describe back.
If you lose track, stop and restate.

## Rule 11 — Match the codebase's conventions, even if you disagree
Conformance > taste inside the codebase.
If you genuinely think a convention is harmful, surface it. Don't fork silently.

## Rule 12 — Fail loud
"Completed" is wrong if anything was skipped silently.
"Tests pass" is wrong if any were skipped.
Default to surfacing uncertainty, not hiding it.

## Anti-Patterns (Forbidden)
"feels kind of weak intuitively" / "probably won't be used" → speculation
"it's an advanced feature, so low value" → assertion with no criteria
"generally needed" → unverifiable
"in my experience" → unsourced generalization

## When Requesting Decisions or Confirmation
Explain in detail, with the surrounding before/after context, so it's easy to understand.
State the recommended option and the reason for it.
Explain it in a way that can be understood as UI/UX.
Explain it in AS-IS / TO-BE form.
Frame every choice from the user's perspective — the benefit gained vs. the cost incurred — and visualize the trade-off (e.g., a comparison table) instead of leaving it in prose.

## Run Self-Audit on Phase/Task Completion
Acceptance Criteria met [Pass/Fail per item]
Confirm DO NOT CHANGE areas were not modified
Confirm no Non-Goals were violated
Any changes not traceable to the request
Open decisions / follow-up work

## Context Management
autocompact enabled. Consider manual /compact when reaching 50%.
Re-reference SPEC/PRD at the start of every session (Persistent Anchor).
On phase transitions, do a structured state handoff. Keep SPEC/PRD/TODO current.
