---
name: compaction-handoff
description: >-
  Create a compact, reconstructible checkpoint immediately before context compaction. Persist only
  durable facts and decisions, overwrite one current resume anchor, verify Git and open-PR state,
  and emit one concrete next action plus a short /compact line. Use for "컴팩션 준비해줘",
  "컴팩션하고 이어서 진행할 수 있게 준비해줘", "핸드오프 준비해줘", or "prepare for
  compaction", or equivalent. Repeated execution must be idempotent and must not grow state files
  without bound.
---

# Compaction Handoff Protocol

Context compaction is lossy. Create a deliberate checkpoint that lets the next session resume from
verified state without replaying the full conversation.

This protocol is **snapshot-based, not append-based**:

- `MEMORY.md`: durable facts and pointers only.
- `docs/decisions/`: durable, load-bearing decisions only.
- `.handoff/CURRENT.md`: current resumable state; overwrite on every handoff.
- Git and PR state: authoritative implementation snapshot.
- `/compact` line: short pointer to the anchor, not another summary.

> `strategic-compact` decides **when** to compact. This skill defines **how** to checkpoint.

## Goals

A valid handoff is:

- **Recoverable:** the next session can start from one exact action.
- **Atomic:** the anchor refers to one coherent repository state.
- **Evidence-based:** verified results are distinct from claims and pending work.
- **Compact:** only load-bearing information survives.
- **Idempotent:** rerunning updates existing state instead of duplicating it.
- **Bounded:** state files remain within fixed size limits.

## Trigger

Run on explicit compaction or handoff requests, or proactively before automatic compaction while
there is still enough context to write a clean checkpoint.

Do not run after compaction without first reconstructing the best available state.

## State and retention rules

### `.handoff/CURRENT.md` — transient resume SSOT

- Single source of truth for current resumable state.
- Overwrite; never append old anchors.
- No raw logs, full file contents, or conversation replay.
- Reference commits, PRs, tests, files, and ADRs instead of copying them.
- Target: **120 lines / 12 KB maximum**.
- Write atomically through a temporary file when practical.
- Historical archives are disabled by default. If explicitly required, keep them under
  `.handoff/archive/`, apply a retention limit, and never auto-load them on resume.

### `MEMORY.md` — rules, not history

Memory is loaded **every session**, so every line is a standing cost. What earns that cost is
**principles, recurrence countermeasures, and facts you actually need to do the work** — not a
record of what was done.

**Judge every entry — the ones you are adding AND the ones already there — with three questions:**

1. **Does it change what I do next time?** If not, don't write it. "We shipped X" changes nothing.
2. **Does it already live somewhere?** Rules, the project's instruction files, ADRs, skills, and
   git history are each a source of truth. If the fact is there, that place owns it — do not keep
   a copy here. **A duplicated fact is guaranteed to rot on one side**, and you cannot tell which.
3. **Is it finished?** Completed cycles, release logs, and version history belong to the
   changelog, ADRs, and git — not here.

What survives all three: **operating principles · countermeasures for repeated mistakes ·
facts that cannot be derived from the repository** (another tool's flags, limits, and policies;
standing decisions such as "we accepted this risk, do not re-open it").

**Re-judge the whole index at every handoff, not just the new lines.** An index only ever grows
unless something forces the question, and this is that moment.

Prefer updating an existing entry over adding a near-duplicate. To drop one, **move the file to
`archive/` rather than deleting it** — it leaves the index (so it stops loading) while staying
recoverable.

**Size is a symptom, not the standard.** Keep the index under **200 lines / 20 KB** (unless the
repository sets another limit), but being under it is *not* evidence the index is healthy: a short
index full of duplicates and finished history still fails all three questions. Measured case: an
index at 67 lines / 20.7 KB passed the size rule while **48 of its entries were dead** — completed
cycle records and copies of facts already owned by rules and ADRs. Re-judged against the three
questions, it came out at 23 lines / 6.0 KB.

### `docs/decisions/` — durable decisions only

Create or update an ADR only for expensive-to-reverse decisions such as:

- architecture or major dependency choices;
- API, data-model, compatibility, or migration contracts;
- security trust boundaries and control ownership;
- deployment topology, operational responsibility, or deliberate breaking changes.

Do not create ADRs for branch status, task order, temporary workarounds, test failures, or today's
remaining work. Search existing ADRs first; update or supersede rather than duplicate.

### Git and PR state — implementation authority

Inspect:

```bash
git status --short
git branch --show-current
git rev-parse --short HEAD
git log -1 --oneline
```

When GitHub CLI is available:

```bash
gh pr list --state open
gh pr status
```

Never assume a PR is merged. Surface open PR number, CI/review status, and mergeability when
available. Never merge or modify a PR unless separately requested.

## Preserve versus discard

| Preserve | Discard |
|---|---|
| Current objective and processed/remaining boundary | Full conversation replay |
| Durable decisions via ADR reference | Intermediate reasoning already acted on |
| Unresolved blockers and exact impact | Raw logs and repetitive tool output |
| Branch, commit, dirty state, open PRs | Re-readable file contents |
| Test/build evidence | Unsupported "done" claims |
| One exact next action | Broad speculative future work |

When uncertain, preserve a concise reference rather than duplicated content.

## Workflow

### 1. Inspect existing state

```bash
test -f MEMORY.md && sed -n '1,240p' MEMORY.md
test -f .handoff/CURRENT.md && sed -n '1,180p' .handoff/CURRENT.md
find docs/decisions -maxdepth 1 -type f 2>/dev/null | sort
```

Use existing files to update and prune. Never blindly append.

### 2. Classify each item

Route each fact once:

1. durable fact → `MEMORY.md`;
2. durable decision with rationale → ADR;
3. transient resumable state → `.handoff/CURRENT.md`;
4. reconstructible or low-value detail → discard.

A fact should not exist in multiple places unless one location contains only a pointer.

### 3. Update durable state

For `MEMORY.md`:

- merge duplicates;
- replace superseded facts;
- remove completed transient state;
- add only genuinely durable information;
- keep a pointer to `.handoff/CURRENT.md`.

For ADRs:

- confirm the decision is durable;
- search for an equivalent ADR;
- update or supersede when possible;
- create a new ADR only when necessary.

If there are no durable changes, leave these files unchanged.

### 4. Make Git state reconstructible

Preferred order:

1. reuse the current meaningful commit if the tree is clean;
2. make a normal semantic commit for a coherent completed unit when authorized;
3. otherwise use a named stash when safe and authorized;
4. use a temporary savepoint commit only as a last resort;
5. if no safe write action is authorized, leave the tree unchanged and record dirty files and risk.

Do not stage unrelated files. Do not create another savepoint when state has not materially changed.

### 5. Overwrite `.handoff/CURRENT.md`

Use this structure:

```markdown
# Compaction Resume Anchor

- Updated: <ISO-8601 timestamp with timezone>
- Repository: <name or path>
- Branch: <branch or n/a>
- Commit: <short SHA or n/a>
- Working tree: <clean | concise dirty-file summary>
- Open PRs: <none | concise status>

## Current state
<Active objective, completed work, and processed-vs-remaining boundary.>

## Verified
<Evidence only: command and exit status, reviewed diff, artifact, merged PR, or "not verified".>

## What's left
<Pending work, blockers, dirty or unpushed state, open PRs, and unresolved decisions.>

## Next action
<Exactly one executable next step, preferably naming the file, command, or decision target.>

## References
- <Only directly useful plan/spec/ADR/PR/file references>
```

Requirements:

- `Next action` is mandatory and singular.
- `Verified` must name evidence; assumptions are not passes.
- `What's left` must expose relevant uncommitted, unpushed, unmerged, failed, or blocked state.
- Keep references minimal.

Atomic write example:

```bash
mkdir -p .handoff
cat > .handoff/CURRENT.md.tmp <<'ANCHOR'
...
ANCHOR
mv .handoff/CURRENT.md.tmp .handoff/CURRENT.md
```

### 6. Validate

```bash
wc -l -c MEMORY.md .handoff/CURRENT.md 2>/dev/null
git status --short
git diff --check
```

Confirm:

- anchor matches current branch and commit;
- no old anchor was appended;
- no transient state leaked into `MEMORY.md`;
- no duplicate ADR was created;
- open PR state is visible;
- `Verified` is evidence-backed;
- `Next action` is singular and executable.

If size limits are exceeded, prune. Do not create another summary file to hide the problem.

### 7. Report and suggest `/compact`

```markdown
| Check | Result | Status |
|---|---|---|
| Durable memory | unchanged / updated and pruned | ✓ / ⚠ |
| ADRs | none / updated / created | ✓ / ⚠ |
| Git snapshot | branch, commit, clean/dirty | ✓ / ⚠ |
| Open PRs | none / concise status | ✓ / ⚠ |
| Resume anchor | overwritten and validated | ✓ / ⚠ |
```

Then give the four resume fields in concise form and one short pointer:

```text
/compact Resume from .handoff/CURRENT.md; next: <single action>; <branch>@<sha>; <PR or dirty-state warning if material>
```

## Resume protocol

After compaction, load only:

1. repository instructions (`CLAUDE.md` or equivalent);
2. `MEMORY.md`;
3. `.handoff/CURRENT.md`;
4. ADRs referenced by the anchor;
5. current Git and open-PR state;
6. source files required for the next action.

Do not auto-load archives, old summaries, raw logs, or the full prior conversation. If Git conflicts
with the anchor, Git wins; report the discrepancy before continuing.

## Idempotency checks

Every rerun must satisfy:

- `CURRENT.md` replaced, not appended;
- memory facts updated, not duplicated;
- ADRs reused, updated, or superseded rather than cloned;
- no new savepoint without material repository change;
- one open PR represented once;
- completed work removed from `What's left`;
- file sizes remain stable.

## Failure handling

If tools or repository access are unavailable:

- do not fabricate Git, PR, CI, or test status;
- mark unavailable evidence as `not verified`;
- create the best available anchor from known state;
- identify missing verification as a blocker or next action when material;
- do not claim an atomic checkpoint when repository state could not be inspected.

If durable files cannot be written, do not claim that compaction is safe. Report the failure and emit
a minimal manual resume anchor in the response.

## Anti-patterns

- Appending each handoff to `MEMORY.md`.
- Keeping multiple active anchors.
- Creating ADRs for routine task progress.
- Copying complete logs into the anchor.
- Loading all historical handoffs after compaction.
- Creating a savepoint commit on every run.
- Hiding dirty files, failed CI, unpushed commits, or open PRs.
- Listing several possible next actions instead of one entry point.

## Related skills

- **strategic-compact** — decides when to compact.
- **git-policy Session Cleanup** — defines repository and PR cleanup expectations.
