---
name: verification-loop
description: >-
  A comprehensive verification system. Selects and runs proportional verification tracks for UI,
  API/service, CLI/TUI, library/SDK, documents/configuration, and real user flows, then ends every
  run with a fixed verdict — PASS / PASS_WITH_NITS / FAIL — plus severity-labeled findings
  (CRITICAL/HIGH/MEDIUM/LOW) and the evidence each one rests on. Use after implementation, before
  a PR or handoff, after a refactor, or to verify a claimed fix. Do NOT use a green build, a passing
  type check, or file existence as proof of user-visible completion, and do NOT let the instance
  that wrote the change issue its own verdict.
origin: ECC
---

# Verification Loop Skill

> Derived from the `verification-loop` skill in everything-claude-code (ECC), used under the MIT
> License.

A comprehensive verification system for coding sessions. The job is not "run the gates" — it is to
**verify the changed behavior through the surface a real user or consumer actually uses**, and to
end with one verdict that cannot be softened into prose.

## When to Use

Invoke this skill:
- After completing a feature or significant code change
- Before creating a PR
- When you want to ensure quality gates pass
- After refactoring
- To verify that a fix actually closed the reported failure

### Positive triggers

- "Verify this implementation before handoff."
- "Confirm the bug is closed in the real CLI."
- "Run visual and functional QA on the changed flow."

### Negative triggers

- Pure planning with no artifact to verify.
- A generic request for more tests with no changed behavior or acceptance criterion in hand.
- Anything where you would be verifying code you just wrote yourself (see the Verdict Contract).

## Pick the real surface first

Static gates support verification; they do not constitute it. Before running anything, list the
acceptance criteria as observable outcomes and select every track the change touches — UI,
API/service, CLI/TUI, library/SDK, documents/configuration, user flow. Each track has a required
observation and its own evidence record: read
[references/tracks.md](references/tracks.md).

## Then pick the depth — it scales with the risk

The Testing rule says depth follows risk and names what counts as high-risk (authentication,
authorization, payments and settlement, personal data, data integrity, concurrency, state
transitions, migrations). It deliberately stops there. **Which** instruments to widen with is a
per-change judgment, and this is where that menu lives:

| Instrument | Reach for it when |
|---|---|
| Regression beyond the directly affected scope | the change moves a shared type, a schema, a config default, or anything the affected scope was only *assumed* to bound |
| Integration / contract tests | it crosses a boundary someone else owns — a service, a queue, a stored format, a published API |
| Critical-path E2E | a user-visible flow that must not break can only be observed end to end |
| Mutation testing | **you doubt the tests you already have would catch a defect** |

**Mutation testing is an option, not a requirement.** It is expensive, so being labelled
high-risk is not by itself a reason to run it — the reason is uncertainty about detection power.
When the existing suite has already been shown to bite (a negative control, a caught regression),
the doubt it answers is not there and the cost buys nothing.

Two things this depth choice is *not*: it is not a coverage target, and it is not the scheduled
full run. Full regression, full E2E, full mutation, and periodic security scanning belong to the
CI/CD schedule — do not launch them here for one change.

## Verification Phases (static gates)

### Phase 1: Build Verification
```bash
# Check if project builds
npm run build 2>&1 | tail -20
# OR
pnpm build 2>&1 | tail -20
```

If build fails, STOP and fix — then re-verify from Phase 1 in a fresh instance. Continuing
through the remaining phases yourself would make you the verifier of code you just wrote,
which the Verdict Contract below forbids.

### Phase 2: Type Check
```bash
# TypeScript projects
npx tsc --noEmit 2>&1 | head -30

# Python projects
pyright . 2>&1 | head -30
```

Report all type errors. Fix critical ones before continuing.

### Phase 3: Lint Check
```bash
# JavaScript/TypeScript
npm run lint 2>&1 | head -30

# Python
ruff check . 2>&1 | head -30
```

### Phase 4: Test Suite
```bash
# Run tests with coverage
npm run test -- --coverage 2>&1 | tail -50

# Check coverage threshold
# Target: 80% minimum
```

Report:
- Total tests: X
- Passed: X
- Failed: X
- Coverage: X%

Where the project declares its own threshold, that number wins — 80% is the floor to use when no
project threshold exists, not a licence to lower one that does.

### Phase 5: Security Scan
```bash
# Check for secrets
grep -rn "sk-" --include="*.ts" --include="*.js" . 2>/dev/null | head -10
grep -rn "api_key" --include="*.ts" --include="*.js" . 2>/dev/null | head -10

# Check for console.log
grep -rn "console.log" --include="*.ts" --include="*.tsx" src/ 2>/dev/null | head -10
```

### Phase 6: Diff Review
```bash
# Show what changed
git diff --stat
git diff HEAD~1 --name-only
```

Review each changed file for:
- Unintended changes
- Missing error handling
- Potential edge cases

Adapt the commands to the repository's stack — the six phases (build, types, lint, tests,
security, diff) are the contract; `npm`/`pyright`/`ruff` are just this list's defaults.

## Then run the live surface

Static green with no live run verifies nothing a user can see. For each selected track:

- **UI** — browser-driven flow, screenshots, console errors, responsive states, and explicit
  approval before any intentional baseline change.
- **API/service** — start the service and call the real endpoint; check response *and* side effect.
- **CLI/TUI** — invoke the built command through its terminal interface; check exit code, stdout,
  and the error path.
- **Library/SDK** — run a minimal consumer program against the public interface.
- **Documents/configuration** — parse, resolve references, and exercise the consumer that loads it.
- **User flow** — complete the representative end-to-end scenario across the affected components.

Do not reuse evidence from a different path: one path's green is not another path's evidence.

## Output Format

After running all phases, produce a verification report:

```
VERIFICATION REPORT
==================

Build:     [PASS/FAIL]
Types:     [PASS/FAIL] (X errors)
Lint:      [PASS/FAIL] (X warnings)
Tests:     [PASS/FAIL] (X/Y passed, Z% coverage)
Security:  [PASS/FAIL] (X issues)
Diff:      [X files changed]

Live surface: [track] — [command/interaction] → [observed] (artifact: path)

Verdict:   PASS | PASS_WITH_NITS | FAIL

Findings:
| ID | Severity | Finding | Evidence (file:line / command output) |
|----|----------|---------|---------------------------------------|
| F1 | HIGH     | ...     | ...                                   |
```

Skipped and unverified criteria are listed explicitly, with the reason — silence reads as "passed".

## Verdict Contract

The report ends with exactly one verdict. Free-prose closings ("looks ready", "should be
fine") are banned — they leave room to bury defects. A fixed vocabulary makes the report
honest and machine-checkable.

| Verdict | Meaning | Action |
|---------|---------|--------|
| **PASS** | All gates green, zero findings at any severity | Ship |
| **PASS_WITH_NITS** | Ship-safe: only LOW/MEDIUM findings, each recorded with a follow-up | Ship + log follow-ups |
| **FAIL** | Any gate red, or one or more CRITICAL/HIGH findings | Block → fix → **re-verify** |

Every finding gets exactly one severity:

- **CRITICAL** — data loss, security hole, or the change misbehaves in real use if shipped
- **HIGH** — main-path defect or regression; users will hit it
- **MEDIUM** — edge-case or quality defect; unlikely to block real use
- **LOW** — nit: style, naming, doc wording

Rules:
- Severity is judged by impact evidence, not by how easy the fix is.
- FAIL → fix → re-verify is one cycle. A fix alone never upgrades the verdict — the
  re-verification must reproduce green.
- A run that aborts early (Phase 1 build failure) still emits a report: verdict **FAIL**
  with the failing gate as a CRITICAL finding. Stopping to fix is how you *reach* the next
  verdict, not a reason to skip issuing this one — an unreported run reads as "not run".
- Missing evidence for a required criterion is a FAIL, not a PASS with a caveat.
- The instance that wrote the change never issues its own verdict: verification runs in a
  fresh instance (see the model-orchestration skill's V&V separation).

## Safety

- Never kill broad process patterns, hardcode credentials, or bypass authentication controls.
- Never update a visual baseline without explicit review of the changed images.
- Do not claim installed, supported, or tested runtimes that were not actually exercised.
- Tests, browsers, and services create local artifacts and processes — keep them inside the
  requested workspace and stop the ones you started.
- Stop before authentication, baseline replacement, or any external mutation the user did not
  authorize.

## Continuous Mode

For long sessions, run verification every 15 minutes or after major changes:

```markdown
Set a mental checkpoint:
- After completing each function
- After finishing a component
- Before moving to next task

Run: /verify
```

## Integration with Hooks

This skill complements PostToolUse hooks but provides deeper verification.
Hooks catch issues immediately; this skill provides comprehensive review.
