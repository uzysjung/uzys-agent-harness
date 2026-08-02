# Verification tracks

## Select the real surface

| Track | Required observation |
|---|---|
| UI | Browser flow, rendered state, console, responsive layout, accessibility-relevant interaction |
| API or service | Running process, real request, response and side effect |
| CLI or TUI | Built command, exit code, stdout or screen behavior, error path |
| Library or SDK | Minimal consumer program using the public interface |
| Document or configuration | Parser or loader result, resolved references, consumer behavior |
| User flow | End-to-end outcome across the affected components |

Static checks (SKILL.md Phases 1-6) support these tracks but do not replace them. A change that
touches two tracks needs evidence from both — one track's green is not the other's evidence.

## UI baseline policy

- Capture deterministic viewports and named states.
- Compare with the approved baseline using hashes or pixel comparison before semantic review.
- Treat blank pages, missing core content, and console errors as regressions.
- Require human approval before adopting an intentional changed baseline.
- Never launch browsers by killing broad process patterns, and never embed login credentials.

## Evidence record

For each acceptance criterion record:

- exact command or interaction;
- environment and relevant version;
- observed outcome;
- exit status;
- artifact or screenshot path;
- `pass` / `fail` / `skipped` / `unverified`;
- why this evidence covers this criterion.

The last field is the one that catches self-deception: evidence that cannot be tied to a criterion
is output, not proof. `skipped` and `unverified` belong in the report — an omitted criterion reads
as a passing one.

## Verdict

- `PASS` — all required gates and user-surface scenarios passed with no findings.
- `PASS_WITH_NITS` — required behavior passed; only recorded LOW/MEDIUM follow-ups remain.
- `FAIL` — any required gate failed, a main path is broken, or evidence is missing for a required
  criterion.

Severity definitions and the rules that bind a verdict to them are in SKILL.md "Verdict Contract";
they are not restated here so the two cannot drift apart.
