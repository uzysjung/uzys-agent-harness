---
name: recurrence-prevention
description: >-
  When the same defect, mistake, or incident happens AGAIN — a recurrence, not a one-off — verify
  it against prior evidence (memory, rule case tables, git/CHANGELOG history), classify it as a
  simple slip vs a complex harness problem, then escalate the countermeasure one level up the
  ladder: record (1st) → forced rule with a case table (2nd) → structural gate — test, hook, or
  derive — once prose has failed (3rd+). Complex problems get countermeasure candidates designed
  by a multi-persona panel instead of a quick patch. Use for "재발했어", "같은 실수 또 했네",
  "이거 저번에도 그랬잖아", "재발방지 대책 등록해줘", "재발방지 룰 만들어", "this happened again",
  "same bug as last time", "add a recurrence countermeasure", "postmortem this failure". NOT for a
  first-time defect (fix it, record it, stop) and NOT a general steering-layer audit (that's
  harness-health-audit).
---

# Recurrence Prevention (재발방지)

A defect that happens once is a bug. A defect that happens **twice is a countermeasure failure** —
whatever was supposed to prevent the second occurrence (a mental note, a memory entry, a rule)
demonstrably did not. So on a recurrence, the unit of work is not the fix (you already know the
fix — you applied it last time). The unit of work is the **countermeasure**, and the core move is:
**escalate it one level, because the current level just failed.**

This skill codifies a practice proven in the harness repo that ships it: the no-false-ship rule
was created only after the *third* false-ship incident; CHANGELOG drift survived a written
convention for seven releases and stopped only when a test gate enforced it; comment warnings
against hardcoded-list drift failed twice before "derive to a single source" became mandatory.
The pattern is consistent: **each enforcement level fails in a characteristic way, and the answer
is the next level up — not a louder version of the same level.**

## When to use

- You just hit a bug/mistake and it feels familiar — "이거 저번에도 그랬잖아".
- The user reports a recurrence or asks for a countermeasure: "재발했어", "같은 실수 또 했네",
  "재발방지 대책 등록해줘", "postmortem this".
- You are fixing a defect and, while investigating, find a prior record of the same failure mode
  (memory entry, rule case table, CHANGELOG note) — even if nobody said "recurrence" out loud.
- A rule or gate that was supposed to prevent this class of failure existed **and was bypassed** —
  that is itself a recurrence at the countermeasure level.

**NOT for:** a first-time defect (fix + record + stop — see Level 0); a general health audit of
the steering layer (use `harness-health-audit`; it audits countermeasures *at rest*, this skill
fires *at the moment of failure*); pure product bugs with no process/harness dimension where a
normal regression test is obviously the whole answer (just write the test).

## Step 1 — Verify the recurrence (counting method)

Recurrence counting is evidence work, not vibes. "내 경험상 자주 그랬던 것 같다" is banned as a
count basis — an unsourced generalization inflates counts and produces rule bloat.

1. **Name the failure signature** — the *failure-mode class*, not the file or line. "Forgot to
   update the CHANGELOG in a release commit" is a signature; "bug in CHANGELOG.md" is not. Same
   mistake in a different file/module **counts as the same signature**; a different mistake in the
   same file does not. Write the signature down first — it decides everything after.
2. **Search prior evidence** for that signature, in order of reliability:
   - durable memory (project memory entries, lessons/feedback notes)
   - existing rule files and their case tables (a matching case-table row = confirmed prior)
   - `git log --grep`, CHANGELOG entries, ADRs, postmortem docs
   - the current conversation (the user saying "저번에도" is a claim — try to find the artifact)
3. **Count = confirmed prior occurrences + this one.** If you find no prior evidence, this is
   occurrence #1 even if it "feels" familiar — record it well (Level 0) so the *next* count has
   evidence to find. If the user asserts a prior occurrence you cannot find, take it as count 2
   but say plainly that the prior occurrence has no artifact — that missing record is itself a
   Level-0 failure worth noting.

## Step 2 — Classify: simple slip vs complex harness problem

| | 단순 실수 (simple slip) | 복잡한 하네스 문제 (complex problem) |
|---|---|---|
| Correct behavior | Known, agreed, undisputed | Disputed, unclear, or trade-off-laden |
| Why it recurred | Wasn't followed: forgot, skipped, overlooked | The countermeasure itself was wrong/insufficient, or cause spans components |
| Typical examples | Forgot a checklist step; committed a forbidden file; skipped a verification | A "verified" path that still shipped broken; drift between N surfaces; a gate that passes while the behavior fails |
| Path | **Escalation ladder** (Step 3a) | **Multi-persona countermeasure design** (Step 3b) |

Two quick discriminators:
- Could you write the corrective rule in one sentence right now, with confidence nobody would
  dispute it? → simple slip.
- Did a previously registered countermeasure fire *as designed* and the failure still happened?
  → complex: the model of the failure is wrong, and patching harder at the same level will fail
  again. Design before enforcing.

## Step 3a — Simple slip: the escalation ladder

Enter the ladder at the level matching the count. **Never enter above your count** — a gate for a
first-time slip is gate inflation, and every gate is permanent maintenance + false-positive cost.

| Level | When | Countermeasure | Characteristic failure of this level |
|---|---|---|---|
| **0 기록** | 1st occurrence | Fix + durable record: memory/lessons entry with **Why** it matters and **How to apply**, or a case-table row if a related rule already exists | Records don't steer — nothing re-reads them at the decision moment |
| **1 룰 강제 등록** | 2nd occurrence (the record failed) | Register a forced rule the agent loads every session: `.claude/rules/<name>.md` (Claude Code) or a rules section in `AGENTS.md` (other CLIs), using the template below — one-line principle + case table | Prose can be skimmed, forgotten under context pressure, or rationalized around |
| **2 구조적 게이트** | 3rd+ occurrence, **or** a rule existed and was violated | Deterministic enforcement that does not depend on the agent reading anything: a test gate that fails CI, a PreToolUse hook that blocks the action, or **derive-to-single-source** so the drift is structurally impossible | Gates that never demonstrably fire; gates so noisy they get bypassed |

Load-bearing principle at Level 2: **comment warnings and doc reminders are not a blocking
mechanism.** If the countermeasure's effect depends on someone (human or model) reading prose at
the right moment, it is Level 1 no matter where the prose lives. Level 2 means the wrong action
*cannot complete*: the test fails, the hook exits 2, the duplicated list no longer exists.

**Confirm before adding standing cost.** A rule is read every session and a gate runs on every
CI/tool call — both are permanent taxes on the harness. Levels 1 and 2 therefore need explicit
user confirmation (a brief escalation: signature, count with evidence, proposed artifact, its
standing cost). Level 0 needs none — recording a fact is free and always right.

### Rule registration template (Level 1)

```markdown
# <rule-name>

<One-line principle, stated as an imperative.> 신설 근거: N회 재발 (YYYY-MM-DD):

| 사례 | 내용 |
|------|------|
| <date/version> | <what happened, one line> |
| <date/version> | <what happened, one line> |

## 절대 원칙

**<The enforced behavior. One sentence if possible.>**
<What is explicitly forbidden, and what to do instead.>

## 위반 발견 시

1. 즉시 정정 보고 (무엇이 어떻게 위반이었는지 명시)
2. 본 사례표 + durable memory 에 추가
3. 재위반이면 구조적 게이트(테스트/훅/derive)로 승격 — 프로즈는 이미 두 번 실패했다
```

The case table is not decoration — it is the recurrence counter for the *next* occurrence, and
it is what makes the rule persuasive to a future agent deciding whether to comply.

## Step 3b — Complex problem: multi-persona countermeasure design

When the failure model is unclear, generating one fix and enforcing it hard just entrenches a
wrong guess. Instead, design candidates with a small disjoint panel (see `multi-persona-review`
for mechanics — run 3-5 personas in parallel, independently, then synthesize):

- **The one who made the mistake** — reconstructs the decision moment: what information was
  missing or misleading right then?
- **The reviewer who missed it** — why did existing review/gates pass it?
- **The maintainer, one year later** — which candidate countermeasure rots, annoys, or gets
  bypassed over time?
- **The adversary** — "this countermeasure will fail because…" for each candidate.

Synthesize into 2-3 concrete countermeasure options with costs, and present them as a decision
(recommendation first, ASIS→TOBE contrast — see `asis-tobe-decision` if bundled). The chosen
option still lands on the ladder: it becomes a record, a rule, or a gate — the panel decides
*what* the countermeasure is, the ladder decides *how hard* it is enforced.

## Step 4 — Verify the countermeasure fires

A countermeasure that has never been seen to fire is unverified, and reporting it as protection
would be a false ship. Before closing:

- **Test gate**: run it against the *old* (bad) behavior and show it RED, then GREEN on the fix.
- **Hook**: invoke it once with a mocked payload (`echo '{...}' | bash hook.sh`; expect exit 2 on
  the forbidden action, exit 0 otherwise).
- **Derive/single-source**: show the duplicated site is gone (grep returns one definition).
- **Rule (prose)**: not mechanically verifiable — say so explicitly ("등록됨, 준수는 미검증").
  That honesty is what justifies escalating to Level 2 if it recurs anyway.

## Output format — 재발방지 보고

```
## 재발방지 보고
- Signature: <failure-mode class, one line>
- Count: N회 — evidence: <memory entry / case-table row / commit·CHANGELOG ref per occurrence>
- Classification: 단순 실수 | 복잡한 하네스 문제 (+ the discriminator that decided it)
- Countermeasure: Level 0 기록 | Level 1 룰 | Level 2 게이트 | 페르소나 설계 → <chosen option>
- Artifact: <path of memory entry / rule file / test or hook>
- Fires-verified: <RED→GREEN output, hook exit code, grep proof — or "룰 프로즈: 미검증" honestly>
- User confirmation: <obtained for Level 1/2 | not needed (Level 0)>
```

## Pitfalls

- **Signature too narrow** — scoping the signature to one file makes every recurrence look like a
  first occurrence. Class of mistake, not location.
- **Signature too broad** — "carelessness" matches everything and justifies infinite rules.
  If the one-line corrective principle wouldn't have prevented *both* occurrences as stated,
  the signature is too broad.
- **Rule bloat** — every rule is standing context; a harness drowning in rules follows none of
  them. That is why Level 0 exists, why Levels 1-2 need user confirmation, and why entering the
  ladder above your count is forbidden.
- **Gate theater** — a gate that was never seen to fire may be checking nothing (wrong matcher,
  wrong path, dead config). Step 4 is mandatory, not optional polish.
- **Same-level retry** — responding to a recurrence by rewriting the same rule more emphatically
  (CAPS, "NEVER", repetition). The level failed, not the wording. Escalate.

## Cross-references

- `multi-persona-review` — panel mechanics for the complex path (Step 3b).
- `asis-tobe-decision` — presenting countermeasure options for user confirmation.
- `harness-health-audit` — periodic audit of accumulated rules/gates (are they TRUE, USED,
  AFFORDABLE, SAFE?); the natural cleanup loop for artifacts this skill creates.
