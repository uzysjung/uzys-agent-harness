# Reviewer design

Read this when picking the panel (SKILL.md step 2) or when two reviewers disagree (step 4).

## Define independence — the mechanical test

The prose test is "would these two personas make the *same* mistake?". Mechanically: a reviewer is
distinct only when at least one of these differs from every other reviewer on the panel.

- artifact surface inspected;
- stakeholder goal;
- failure feared;
- evidence accepted;
- decision criterion.

Names, tone, job titles, or demographic labels alone do not create independence. Two reviewers that
read the same section, fear the same failure, and accept the same evidence are one reviewer with
two names — and the panel's whole value is the count of *independent* failures, not the count of
labels ("Nine Judges, Two Effective Votes").

**Model provenance is a correlation control, not a sixth criterion.** Two reviewers with the same
lens stay one reviewer whichever models run them — the five tests above still decide independence.
What a second vendor buys is different: two reviewers whose lenses already differ fail *together*
less often when they do not share a model family, and that joint-failure rate is the quantity
"Nine Judges, Two Effective Votes" says a panel's information content is made of. So spend an
outside seat on the lens whose miss would cost the most, not on the panel at large, and write down
which model answered each seat — a panel whose provenance is unrecorded cannot be replicated.

## Useful lens patterns

| Artifact | Distinct lenses |
|---|---|
| Launch post / README / marketing copy | skeptical newcomer, time-pressured expert, accessibility-dependent reader, hostile reader, adjacent-tool migrant |
| Product plan / PRD | target user, implementing engineer, operator, security, business owner |
| Technical design | correctness, failure recovery, maintainability, security, migration |
| Documentation | newcomer action, expert scan, accessibility, claim accuracy, support burden |
| UI flow | first-time user, repeat user, keyboard or assistive access, error recovery, operator |

Choose only lenses relevant to the artifact. A lens with nothing to inspect returns filler, and
filler still costs a slot on a five-slot panel.

## Reviewer finding format

Every finding a persona returns fills these fields. Anything that cannot fill "Evidence" and
"Recommendation" is an opinion, not a finding.

```text
Lens:
Surface or passage:            # quote the offending text or name the exact screen/state
Evidence:                      # what in the artifact shows this
Impact:                        # who is blocked, and from what
Recommendation:                # the concrete replacement, not "improve this"
Confidence:
Needs real-user validation:    # yes when the claim rests on embodied experience
```

## Conflict resolution

Do not average contradictory advice — the average of two coherent recommendations is usually
incoherent. Compare each recommendation against the artifact's declared goal, constraints, and
evidence; select one, record why, and preserve the rejected alternative whenever it represents a
genuine trade-off rather than a mistake. A synthesis that hides the disagreement reads as consensus
the panel never reached.
