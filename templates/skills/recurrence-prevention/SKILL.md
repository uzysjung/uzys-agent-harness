---
name: recurrence-prevention
description: >-
  When the same defect, mistake, or incident happens AGAIN — a recurrence, not a one-off — verify
  it against prior evidence (memory, rule 근거 links, git/CHANGELOG history), classify it as a
  simple slip vs a complex harness problem, then re-evaluate the countermeasure that failed:
  repair or replace it, choosing a record, a one-line criterion, a code fix, or a structural gate
  (test, hook, derive) by evidence — more deterministic when prose has demonstrably failed,
  nothing new when repair suffices. Complex problems get countermeasure candidates designed
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
fix — you applied it last time). The unit of work is the **countermeasure**: re-evaluate the cause
analysis and whatever was supposed to prevent this, repair or replace it, and reach for a more
deterministic mechanism only when repairing the existing one cannot suffice. **A recurrence is
evidence for that re-evaluation, not an order to add a level.**

This skill codifies a practice proven in the harness repo that ships it: the no-false-ship rule
was created only after the *third* false-ship incident; CHANGELOG drift survived a written
convention for seven releases and stopped only when a test gate enforced it; comment warnings
against hardcoded-list drift failed twice before "derive to a single source" became mandatory.
The pattern is consistent: **each enforcement level fails in a characteristic way, and when one
has demonstrably failed the answer is usually a more deterministic mechanism — not a louder
version of the same level, and not a new mechanism when the existing one can be repaired.**

## When to use

- You just hit a bug/mistake and it feels familiar — "이거 저번에도 그랬잖아".
- The user reports a recurrence or asks for a countermeasure: "재발했어", "같은 실수 또 했네",
  "재발방지 대책 등록해줘", "postmortem this".
- You are fixing a defect and, while investigating, find a prior record of the same failure mode
  (memory entry, a rule's 신설 근거 link, CHANGELOG note) — even if nobody said "recurrence" out loud.
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
   - existing rule files and the occurrence links on their "신설 근거" line (a linked prior
     occurrence = confirmed prior)
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
| Path | **Choose the countermeasure level** (Step 3a) | **Multi-persona countermeasure design** (Step 3b) |

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

## Step 3a — Simple slip: choose the countermeasure level

The levels below are **options ordered by determinism, not a mandatory sequence**. The count is
evidence of how far the current countermeasure has failed; it does not select the level by itself.
Choose the least burdensome option that reliably prevents the cause: repair or replace the failed
countermeasure first; prefer a gate when prose has demonstrably failed or when the wrong action is
deterministically detectable (a gate is then the *cheaper* artifact, not the stronger one); and
let credible risk, not the count, justify protection — a concrete irreversible-damage path earns a
gate at count 0, while a first-time slip with no credible risk earns none (every gate is permanent
maintenance + false-positive cost).

| Level | Typical evidence (a signal, not a trigger) | Countermeasure | Characteristic failure of this level |
|---|---|---|---|
| **0 기록** | 1st occurrence | Fix + durable record: memory/lessons entry with **Why** it matters and **How to apply**, or an occurrence link on a related rule's 신설 근거 line if one already exists | Records don't steer — nothing re-reads them at the decision moment |
| **1 룰 강제 등록** | 2nd occurrence (the record failed) | Register a forced rule on the project's **always-loaded steering surface**, using the template below — one-line principle + a one-line "신설 근거" with links to each occurrence. `.claude/rules/<name>.md` (Claude Code) or a rules section in `AGENTS.md` (other CLIs) — and **verify it actually loads**: if the always-loaded context (CLAUDE.md / AGENTS.md) doesn't already pull that location in, reference the rule from it. A rule file nothing loads is still Level 0 with extra steps. **Shape**: the *minimum condition* that prevents the failure — what must be true, not how to do it — stated in positive form; a prohibition only where the damage is irreversible | Prose can be skimmed, forgotten under context pressure, or rationalized around |
| **2 구조적 게이트** | 3rd+ occurrence, **or** a registered countermeasure failed — bypassed *or* followed as designed yet insufficient | Deterministic enforcement that does not depend on the agent reading anything: a test gate that fails CI, a pre-action hook that blocks the command (where the CLI supports hooks), or **derive-to-single-source** so the drift is structurally impossible. **Shape**: a stronger countermeasure means *more deterministic*, not *more forbidden* — the gate checks a result and leaves the model's judgment where no check can express it | Gates that never demonstrably fire; gates so noisy they get bypassed |

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
every install, forever**, while a gate costs CI time and **zero** standing context. Answer four
questions in order and stop at the first that decides:

1. **Can the wrong action be detected deterministically?** — a failing test, a hook that exits
   non-zero, a derive that deletes the duplicated list. If yes, **write the gate instead of a
   rule.** That is not gate inflation: you are not buying stronger enforcement than the risk
   justifies, you are picking the cheaper artifact for the same enforcement. Code answers what
   code can answer.
2. **Would the rule change behaviour that would otherwise be wrong?** If the corrective principle
   is something a competent agent does anyway, or it restates a rule that already exists, it buys
   nothing and bills every session. Stay at Level 0.
3. **Is it general, or is it this project's circumstance?** A project's own incidents belong on
   that project's steering surface — never in a rule set that strangers install.
4. **Does the rule replace the model's judgment, or feed it?** A rule that fixes a procedure
   ("always run X before Y", "review every edit") replaces a judgment the model could make by
   risk — and stops improving when the model improves. Rewrite it as a one-line criterion (what
   must be true, what evidence counts) and let the model choose the depth. A rule that removes a
   place where the model decides is not a rule candidate in that form.

Only what survives all four — **a judgement call no deterministic check can express, that
changes behaviour, that generalises, and that gives the judgment an input instead of replacing
it** — is a rule candidate. That is the bar for "serious
enough to be worth permanent context".

**Confirm before adding standing cost.** Levels 1 and 2 need explicit user confirmation. For a
rule the escalation must state, in one block: signature · count with evidence · the proposed text ·
**its standing cost in tokens and the resulting total** · **its per-run cost** (seconds, rounds, or questions added to every task — a countermeasure that slows every task to prevent one incident is rejected unless "what actually happens without it" is the answer) · which of the four questions it survived
and why the deterministic alternative does not work. **Do not guess the cost — measure the draft**
(if the project reports context cost, run that report). Level 0 needs no confirmation — recording
a fact is free and always right.

### Rule registration template (Level 1)

```markdown
# <rule-name>

<One-line principle, stated as an imperative.> **신설 근거: N회 재발** (<date/version> ·
<date/version>) — 발생별 기록은 <issue / ADR / postmortem link per occurrence>.

## 지켜야 할 상태

**<The state that must hold when this rule is followed — positive form, one sentence if possible.>**
<What breaks it, and what to do instead. A prohibition ("X 금지") belongs here only when X is
irreversible damage or a protected gate; otherwise state the condition and leave the method to the agent.>

## 위반 발견 시

1. 즉시 정정 보고 (무엇이 어떻게 위반이었는지 명시)
2. 발생을 이슈·ADR 에 기록하고 durable memory 에 추가한 뒤, 위 근거 줄의 횟수와 링크를 올린다
3. 재위반이면 원인 분석과 이 룰을 재평가한다 — 룰을 고쳐 충분하면 거기서 끝내고, 프로즈가 실제로
   실패한 것이면 결정론적 장치(테스트/훅/derive)로 대체한다
```

The 근거 line is not decoration — it is the recurrence counter for the *next* occurrence, and it
is what makes the rule persuasive to a future agent deciding whether to comply. **Keep the count
and the links on the rule; keep the incident narratives in the linked issues/ADRs.** A standing
rule is re-read every session by every install, so each incident row it carries is a permanent
context cost — the link costs one line and still lets the next agent verify the count.

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
(recommendation first, ASIS→TOBE contrast — see `user-centered-explanation` if bundled). The
chosen option still lands on the ladder: it becomes a record, a rule, or a gate — the panel decides
*what* the countermeasure is, the evidence decides *how deterministic* it must be. A prior
countermeasure that fired as designed and still failed is evidence that repairing it is not
enough, which justifies a more deterministic mechanism (a failed rule → a gate); it is not a
mandate to add one — replacing the failed mechanism is the default, stacking a new one on top is not.

When choosing among the panel's options, compare them on prevention strength, false-positive rate,
standing context cost, **per-run speed cost** (time, rounds, and questions added to every task),
**effect on the model's autonomy** (does it feed a judgment or replace one), maintenance cost, and
permission impact — and prefer the *smallest* mechanism that actually prevents the cause. The mechanism menu is in
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
  That honesty is what justifies replacing it with a deterministic mechanism if it recurs anyway.

## Output format — 재발방지 보고

```
## 재발방지 보고
- Signature: <failure-mode class, one line>
- Count: N회 — evidence: <memory entry / rule 근거 link / commit·CHANGELOG ref per occurrence>
- Classification: 단순 실수 | 복잡한 하네스 문제 (+ the discriminator that decided it)
- Countermeasure: Level 0 기록 | Level 1 룰 | Level 2 게이트 | 페르소나 설계 → <chosen option>
- Artifact: <path of memory entry / rule file / test or hook>
- Standing cost: <rule 이면 측정치 ~N tokens/session + 갱신된 총합 | gate·record 면 0> · per-run: <매 작업에 더해지는 시간·라운드·질문 | 0>
- Pre-flight: <Level 1 4질문 통과 근거 — 결정론 불가 사유 · 행동 변화 · 일반성 · 판단을 대신하지 않음>
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
- **Prohibition accumulation** — countermeasures written only as "do not X" pile into a defence
  list: each blocks one path to the bad state and none of the others, and a model reading a wall
  of prohibitions either routes around it or freezes. Write the state that must hold; reserve
  prohibitions for irreversible damage and protected gates.
- **Same-level retry** — responding to a recurrence by rewriting the same rule more emphatically
  (CAPS, "NEVER", repetition). The level failed, not the wording — repair it if it can be
  repaired, otherwise replace it with a more deterministic mechanism.
- **Inflating the count** — when no prior artifact can be found, record this as the first confirmed
  occurrence rather than borrowing a remembered one to reach count 2.

## Cross-references

- `multi-persona-review` — panel mechanics for the complex path (Step 3b).
- `user-centered-explanation` — presenting countermeasure options for user confirmation
  (recommendation first, ASIS→TOBE contrast).
- **Periodic audit of accumulated countermeasures** — the natural cleanup loop for what this skill
  creates (are the rules and gates still TRUE, USED, AFFORDABLE, SAFE?). No bundled skill owns it;
  run it as a scheduled review of the artifacts this skill's reports list.
