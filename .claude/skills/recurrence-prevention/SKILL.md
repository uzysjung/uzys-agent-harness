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
  "same bug as last time", "add a recurrence countermeasure", "postmortem this failure". Do NOT use
  it for a first-time defect (fix it, record it, stop), do NOT create a standing rule from an
  unverified first occurrence, and do NOT use it as a general audit of the steering layer at rest.
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

### Positive triggers

- "재발했어" / "같은 실수 또 했네" / "이거 저번에도 그랬잖아"
- "재발방지 대책 등록해줘" / "재발방지 룰 만들어"
- "this happened again" / "same bug as last time" / "our previous rule did not stop this"
- "add a recurrence countermeasure" / "postmortem this failure"

### Negative triggers

- **A first-time defect** — fix + record + stop (Level 0). A standing rule built on one unverified
  occurrence is rule bloat with a story attached.
- **A general health audit** of the steering layer with no failure in hand — that audits
  countermeasures *at rest*; this skill fires *at the moment of failure*.
- **A pure product bug with no process dimension** where a normal regression test is obviously the
  whole answer — just write the test.

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
   - recorded observations, if the project keeps them — a session-observation digest that lists
     commands and files repeated across sessions. Narrow but real: it turns "I kept redoing this"
     into a count. It cannot confirm a *failure* signature (the records carry no exit code), so it
     corroborates repetition, never failure.
   - the current conversation (the user saying "저번에도" is a claim — try to find the artifact)
3. **Count = confirmed prior occurrences + this one.** If you find no prior evidence, this is
   occurrence #1 even if it "feels" familiar — record it well (Level 0) so the *next* count has
   evidence to find. If the user asserts a prior occurrence you cannot find, take it as count 2
   but say plainly that the prior occurrence has no artifact — that missing record is itself a
   Level-0 failure worth noting.

For the capture checklist (what to write down about the failure so the next count can find it) see
[references/failure-analysis.md](references/failure-analysis.md).

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

When the classification itself is unclear, the cause taxonomy in
[references/failure-analysis.md](references/failure-analysis.md) (logic · state · environment ·
policy · coordination · loop) usually decides it: a `logic`/`state` cause with agreed correct
behavior is a slip; a `policy`/`coordination` cause is almost always the complex path.

## Step 3a — Simple slip: the escalation ladder

Enter the ladder at the level matching the count. **Never enter above your count** — a gate for a
first-time slip is gate inflation, and every gate is permanent maintenance + false-positive cost.
(Two exceptions. Downward-honest: a **registered countermeasure that failed** counts that failure
at its own level — a violated Level-1 rule at count 2 legitimately escalates to Level 2. And
cost-driven: the Level 1 pre-flight below sends a count-2 slip straight to Level 2 when the wrong
action is deterministically detectable, because a gate is the *cheaper* artifact, not the stronger
one.)

| Level | When | Countermeasure | Characteristic failure of this level |
|---|---|---|---|
| **0 기록** | 1st occurrence | Fix + durable record: memory/lessons entry with **Why** it matters and **How to apply**, or a case-table row if a related rule already exists | Records don't steer — nothing re-reads them at the decision moment |
| **1 룰 강제 등록** | 2nd occurrence (the record failed) | Register a forced rule on the project's **always-loaded steering surface**, using the template below — one-line principle + case table. `.claude/rules/<name>.md` (Claude Code) or a rules section in `AGENTS.md` (other CLIs) — and **verify it actually loads**: if the always-loaded context (CLAUDE.md / AGENTS.md) doesn't already pull that location in, reference the rule from it. A rule file nothing loads is still Level 0 with extra steps | Prose can be skimmed, forgotten under context pressure, or rationalized around |
| **2 구조적 게이트** | 3rd+ occurrence, **or** a registered countermeasure failed — bypassed *or* followed as designed yet insufficient | Deterministic enforcement that does not depend on the agent reading anything: a test gate that fails CI, a pre-action hook that blocks the command (where the CLI supports hooks), or **derive-to-single-source** so the drift is structurally impossible | Gates that never demonstrably fire; gates so noisy they get bypassed |

Load-bearing principle at Level 2: **comment warnings and doc reminders are not a blocking
mechanism.** If the countermeasure's effect depends on someone (human or model) reading prose at
the right moment, it is Level 1 no matter where the prose lives. Level 2 means the wrong action
*cannot complete*: the test fails, the hook exits 2, the duplicated list no longer exists.

**Write the gate as a sweep, not a list.** A Level-2 gate that enumerates the surfaces it covers
has just made a second copy of the very list that drifted — and whatever is missing from that copy
becomes the next habitat for the same defect. Prefer a glob, or a derive from a single source, that
picks up new surfaces on its own; if someone has to remember to extend the gate, it is already
failing at Level 1 wearing a Level-2 costume. Grant exemptions by marking the exempt item, never by
curating an inclusion list — the **default must be checked**. This harness learned it the expensive
way: five recurrences of one doc-fact drift, each answered by adding one more per-surface pattern,
and a file named as a drift surface in the fourth postmortem still carried zero coverage at the
fifth.

**Level 1 pre-flight — a 2nd occurrence does not automatically earn a rule.** Per unit of
enforcement a rule is the most expensive artifact on the ladder: it is read **every session, by
every install, forever**, while a gate costs CI time and **zero** standing context. Answer three
questions in order and stop at the first that decides:

1. **Can the wrong action be detected deterministically?** — a failing test, a hook that exits
   non-zero, a derive that deletes the duplicated list. If yes, **write the gate instead, even at
   count 2.** This is the one sanctioned way to enter above your count, and it is not gate
   inflation: you are not buying stronger enforcement than the count justifies, you are picking
   the cheaper artifact for the same enforcement. Code answers what code can answer.
2. **Would the rule change behaviour that would otherwise be wrong?** If the corrective principle
   is something a competent agent does anyway, or it restates a rule that already exists, it buys
   nothing and bills every session. Stay at Level 0.
3. **Is it general, or is it this project's circumstance?** A project's own incidents belong on
   that project's steering surface — never in a rule set that strangers install.

Only what survives all three — **a judgement call no deterministic check can express, that
changes behaviour, and that generalises** — is a rule candidate. That is the bar for "serious
enough to be worth permanent context".

**Confirm before adding standing cost.** Levels 1 and 2 need explicit user confirmation. For a
rule the escalation must state, in one block: signature · count with evidence · the proposed text ·
**its standing cost in tokens and the resulting total** · which of the three questions it survived
and why the deterministic alternative does not work. **Do not guess the cost — measure the draft**
(if the project reports context cost, run that report). Level 0 needs no confirmation — recording
a fact is free and always right.

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
(recommendation first, ASIS→TOBE contrast — see `clear-korean-communication` if bundled). The
chosen option still lands on the ladder: it becomes a record, a rule, or a gate — the panel decides
*what* the countermeasure is, the ladder decides *how hard* it is enforced. The
never-above-your-count guard governs slips with no failed countermeasure; here, a prior
countermeasure that fired as designed and still failed already justifies landing one level above
it (a failed Level-1 rule → a Level-2 gate is escalation, not inflation).

When choosing among the panel's options, compare them on prevention strength, false-positive rate,
standing context cost, maintenance cost, and permission impact — and prefer the *smallest*
mechanism that actually prevents the cause. The mechanism menu is in
[references/failure-analysis.md](references/failure-analysis.md).

## Step 4 — Verify the countermeasure fires

A countermeasure that has never been seen to fire is unverified, and reporting it as protection
would be a false ship. Before closing:

- **Test gate**: run it against the *old* (bad) behavior and show it RED, then GREEN on the fix.
- **Hook**: invoke it once with a mocked payload (`echo '{...}' | bash hook.sh`; expect exit 2 on
  the forbidden action, exit 0 otherwise). Hook support varies by CLI — where absent, prefer a
  test gate or derive.
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
- Standing cost: <rule 이면 측정치 ~N tokens/session + 갱신된 총합 | gate·record 면 0>
- Pre-flight: <Level 1 3질문 통과 근거 — 결정론 불가 사유 · 행동 변화 · 일반성>
- Fires-verified: <RED→GREEN output, hook exit code, grep proof — or "룰 프로즈: 미검증" honestly>
- User confirmation: <obtained for Level 1/2 | not needed (Level 0)>
```

Every field is required. A report that returns "signature, evidence, root cause, countermeasure"
as one sentence has dropped exactly the fields that make it auditable — the count evidence, the
standing cost, and the fires-verified proof.

## Side effects and authorization

Rules, hooks, remote process changes, and standing procedures are **durable** side effects: obtain
the confirmation their scope requires (Level 1 and 2 always; anything externally visible always)
before creating them. Level 0 records need no confirmation.

## Pitfalls

- **Signature too narrow** — scoping the signature to one file makes every recurrence look like a
  first occurrence. Class of mistake, not location.
- **Signature too broad** — "carelessness" matches everything and justifies infinite rules.
  If the one-line corrective principle wouldn't have prevented *both* occurrences as stated,
  the signature is too broad.
- **Rule bloat** — every rule is standing context; a harness drowning in rules follows none of
  them. That is why Level 0 exists, why Levels 1-2 need user confirmation, and why the Level 1
  pre-flight routes anything deterministic to a gate instead. Watch the *rate*, not just the
  count: rules only ever grow, so a steering surface that gained more prose this month than last
  is already on the failing trajectory even if no single rule looks unreasonable.
- **Gate theater** — a gate that was never seen to fire may be checking nothing (wrong matcher,
  wrong path, dead config). Step 4 is mandatory, not optional polish.
- **Same-level retry** — responding to a recurrence by rewriting the same rule more emphatically
  (CAPS, "NEVER", repetition). The level failed, not the wording. Escalate.
- **Inflating the count** — when no prior artifact can be found, record this as the first confirmed
  occurrence rather than borrowing a remembered one to reach count 2.

## Cross-references

- `multi-persona-review` — panel mechanics for the complex path (Step 3b).
- `clear-korean-communication` — presenting countermeasure options for user confirmation
  (recommendation first, ASIS→TOBE contrast).
- **Periodic audit of accumulated countermeasures** — the natural cleanup loop for what this skill
  creates (are the rules and gates still TRUE, USED, AFFORDABLE, SAFE?). No bundled skill owns it;
  run it as a scheduled review of the artifacts this skill's reports list.
