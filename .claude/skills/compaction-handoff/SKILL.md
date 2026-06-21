---
name: compaction-handoff
description: >-
  Execute a structured handoff right before a context compaction so no state is lost — persist
  durable facts to memory, take an atomic git snapshot (clean tree + open-PR check), and emit a
  fixed-field resume anchor (current state / verified / what's left / next action) plus a suggested
  custom /compact summary line. Use when the user says "컴팩션 준비해줘", "컴팩션하고 이어서
  진행할 수 있게 준비해줘", "핸드오프 준비해줘", or in English "prepare for compaction",
  "get ready to compact and continue", "hand off before /compact", "checkpoint before compacting".
  Also fire proactively when context is nearing the window limit and an auto-compact is imminent.
---

# Compaction Handoff Protocol

A context window is about to be summarized and reinitialized. The model is stateless, so **only
what you write out survives** — the new window starts from a lossy summary, not the live history.
This skill runs the handoff deliberately so the resumed session can pick up without re-deriving
lost state.

> Sibling skill `strategic-compact` decides **WHEN** to compact (phase boundaries, token pressure).
> This skill is the **HOW**: it executes the handoff at that moment. Run `strategic-compact`'s
> decision first if you're unsure whether to compact at all; run this when the answer is "yes".

## When to use

The user works in Korean and triggers this repeatedly. Treat any of these as a fire signal:

- **"컴팩션 준비해줘"** / **"컴팩션하고 이어서 진행할 수 있게 준비해줘"** / **"핸드오프 준비해줘"**
- English equivalents: "prepare for compaction", "get ready to compact and continue", "hand off".
- **Proactively, before the cliff.** Don't wait for auto-compact at 100%. Auto-compaction fires
  near the window limit; a common practice is to trigger the handoff earlier (around ~80% of the
  window) so there's still budget to write a clean anchor — a rushed handoff at the cliff is exactly
  where load-bearing context gets dropped.

Why proactive matters: auto-compact optimizes for *generic* continuity, not for THIS task's
load-bearing facts (an open PR, a chosen-but-unwritten decision). If you skip the handoff because
the task "looks finished," you risk silent information loss — the resumed agent assumes work
shipped that did not.

## The model: three legs of a checkpoint

Treat the handoff as a deliberate checkpoint, not a passive summary. Three legs, each grounded in
an established practice:

1. **Persist durable facts to external memory** *(before compacting, never after)*.
   The window will be wiped; structured note-taking exists precisely because the summary alone
   can't be trusted to carry everything. Route load-bearing *decisions* to ADRs (`docs/decisions/`)
   so the *why* survives every future compaction, not just this one.
2. **Take an atomic, reconstructible snapshot** — git clean (or a `savepoint` commit) plus an
   **open-PR check**. A dirty/half-committed tree is a corrupt checkpoint; an open PR is itself
   critical state that belongs in "what's left." This is the Checkpoint **Atomicity** and **State
   Completeness** principles applied to the working tree.
3. **Emit a fixed-field resume anchor** — current state / verified / what's left / next action —
   framed *working backwards* from the next concrete step so a freshly-compacted agent re-orients
   instantly instead of replaying history forward.

### Preserve-list, not a prose blob

Use an explicit preserve-list rather than a free-form paragraph (Anthropic's stated preserve/discard
split):

| Preserve (high-value) | Discard (low-value) |
|---|---|
| Architectural decisions + their *why* (link ADR) | Redundant tool outputs, raw logs |
| Unresolved bugs / blockers | Intermediate reasoning already acted on |
| Processed-vs-remaining boundary | File contents you can re-read from disk |
| Open PRs / unpushed branches | Tool-call counts and history |
| Verified-vs-merely-claimed evidence | Restated CLAUDE.md / rules (already loaded) |

## Workflow

Run these in order. Each writes durable state *before* the window is touched.

**1. Memory — persist durable facts.**
Update the auto-memory (`MEMORY.md`) and any session-summary entry with the preserve-list items.
For a load-bearing decision (architecture, dependency, data model, breaking change), write or update
an ADR in `docs/decisions/` — this is the one place "the why behind the constraint" survives lossy
compaction. Don't rely on the `/compact` summary to carry a decision; it strips provenance.

**2. Git — atomic snapshot + open-PR check.**
Make the working tree reflect a consistent state. The `gh pr list` step is **not optional** — it is
the git-policy **Session Cleanup** gate, which is mandatory before any `/clear` or `/compact`. Run it
every handoff:
```bash
git status --short                 # is the tree clean?
# IF tree is dirty AND the work is worth keeping:
git add -A && git commit -m "chore: savepoint before compaction handoff"
gh pr list --state open            # list open PRs — each open PR is what's-left state to surface, not necessarily an anomaly
git branch --show-current          # note unpushed branch state
```
This folds the git-policy **Session Cleanup** gate into the handoff. An open PR is not a
loose end to hide — surface it in the anchor's "what's left" with its number, CI status, and
mergeability, and let the user decide (no auto-merge).

**3. Resume anchor — four fixed fields.**
Emit the anchor. Keep "verified" distinct from "done": *done* is a claim, *verified* encodes the
evidence (test PASS output, exit 0, a merged PR). The resumed agent re-trusts only what's verified.
Make **next action** mandatory and singular — it's the entry point the resumed session executes
first, so the anchor is self-serve (Recovery Automation), not a note to re-interpret.

**4. Suggested /compact line.**
Hand the user a one-line custom summary to pass to `/compact` (e.g.
`/compact Resume: finish ADR-022 flag removal; PR #160 merged, branches drift test failing`). This
is a pointer to the durable anchor, not a replacement for it.

## Handoff report format

Present a compact status table, then the anchor:

```
| Check          | Result                                  | Status |
|----------------|-----------------------------------------|--------|
| Memory         | MEMORY.md + ADR-022 updated             | ✓      |
| Git            | tree clean, savepoint a1b2c3d           | ✓      |
| Open PRs       | gh pr list → 0 open                      | ✓      |
| Files          | resume anchor written, plan SSOT synced | ✓      |
```

## Worked example

**Input** (user, at ~78% context):
> 컴팩션하고 이어서 진행할 수 있게 준비해줘

**Output:**

Handoff checks:

| Check    | Result                                          | Status |
|----------|-------------------------------------------------|--------|
| Memory   | MEMORY.md code-quality-cycle entry refreshed    | ✓      |
| Git      | tree clean (no savepoint needed)                | ✓      |
| Open PRs | `gh pr list` → **1 open: #165** CI pass, mergeable | ⚠ surfaced |
| Files    | resume anchor below; persona-feedback SSOT synced | ✓      |

**Resume anchor**
- **Current state:** Persona P0 fixes in progress on branch `fix/persona-p0`. 2 of 4 fixes landed.
- **Verified:** `npm run ci` exit 0 on current HEAD (typecheck + lint + coverage branches 88.4% + build). Docker scenario for `--with <id>` exit 0.
- **What's left:** Fixes 3 & 4 (wizard copy + COMPATIBILITY honesty). **Open PR #165 is not merged** — publishing is blocked until P0 complete (per persona-feedback-improvements.md). Branch `fix/persona-p0` unpushed for the last 2 commits.
- **Next action:** Implement fix 3 (wizard understanding-category copy), then re-run `npm run ci`.

**Suggested /compact line:**
`/compact Resume fix/persona-p0: do fix 3 (wizard copy) next, then ci; PR #165 open & blocks publish until all 4 P0 done`

Notice what the anchor does deliberately: it leads with the **next action** (working-backwards), keeps
the open PR visible in "what's left" instead of assuming it shipped, and separates the *verified* CI
evidence from the *unverified* remaining fixes.

## Pitfalls this guards against

- **Lossy summary-stripping** — a headline-only handoff looks complete but is unrecoverable because
  the evidence and reasoning chains are gone. Fix: preserve-list + ADR provenance, not a prose blob.
- **Lost-in-the-Middle over-stuffing** — dumping full history into the new window doesn't help;
  buried facts follow a U-shaped accuracy curve. The anchor stays short and structured.
- **Telephone-game decay** — fidelity erodes across successive compactions. Routing load-bearing
  facts to stable memory/ADRs breaks the degradation chain a chain of summaries can't.
- **Non-atomic snapshot** — handing off with a half-committed tree reconstructs an inconsistent
  state. The git leg forces a clean or savepoint-committed tree.
- **Incomplete state save** — omitting the processed-vs-remaining boundary forces duplicate work or
  silent re-execution of irreversible actions. The "what's left" field is mandatory.

## References

- Anthropic — *Effective context engineering for AI agents* (Compaction; Structured Note-Taking /
  Agentic Memory): https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- Hendricks.ai — Checkpoint patterns (State Completeness, Atomicity, Recovery Automation):
  https://hendricks.ai/insights/checkpoint-patterns-long-running-ai-agent-tasks
- XTrace — AI agent context handoff (Decisions / Artifacts / Preferences / Timeline; decision
  provenance): https://xtrace.ai/blog/ai-agent-context-handoff
- Architectural Decision Records (ADR) — append-only single-decision records; route load-bearing
  decisions here so the *why* survives compaction.
- Amazon *Working Backwards* — lead the anchor with the end state and the single next action.

## Related skills

- **strategic-compact** — decides WHEN to compact (phase boundaries, token pressure). Pair with it:
  it answers "compact now?", this skill executes the handoff when the answer is yes.
- **git-policy Session Cleanup** — the open-PR check (leg 2) is the same gate; this skill folds it
  into the pre-compaction moment.
