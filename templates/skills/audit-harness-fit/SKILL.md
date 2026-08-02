---
name: audit-harness-fit
description: >-
  Audits whether a project's resident steering layer still earns the context it costs — the
  CLAUDE.md/AGENTS.md anchor and its `@import` chain, `.claude/rules/`, hooks, permission rules,
  and the skill descriptors preloaded every session. INVENTORY measures what actually loads;
  EVIDENCE gathers block logs and correction history; VERDICT rules each section keep / rewrite /
  relocate / delete against published authoring guidance instead of taste; RELOCATE moves
  procedures into skills, must-hold guarantees into hooks and permission rules, and derivable
  facts back into code or tests; APPLY proposes the edit and waits for approval. Use when the
  user says any of "하네스 정리", "룰·훅이 밥값을 하는지", "CLAUDE.md 다이어트", "상주 컨텍스트
  정리", "룰이 너무 많아", "훅이 실제로 뭘 막고 있는지" — or the English equivalents "harness
  audit", "trim my CLAUDE.md", "are my rules earning their keep", "prune the steering layer",
  "why does Claude ignore my rules". Fires for both Korean and English phrasing. Do NOT use it to
  escalate a countermeasure after a defect came back (that is recurrence-prevention), and not for
  drift between the product's own docs and its code (that is audit-service-gaps DRIFT).
---

# Audit Harness Fit (상주 조종층 감사)

The steering layer around an agent has a documented growth loop and no documented shrink loop.
The published guidance is explicit about when to add — *"Claude makes the same mistake a second
time"*, *"a code review catches something Claude should have known"* — and the natural response is
another line in CLAUDE.md, another rule file, another hook. Nothing in that loop ever fires in
reverse. So the layer grows monotonically until it hits the failure the same guidance names:
*"If your CLAUDE.md is too long, Claude ignores half of it because important rules get lost in the
noise."*

This skill is the reverse pass. It takes the resident layer as it is today, measures it, and rules
on each part with **three kinds of evidence only**:

1. **Published criteria** — what the vendor documentation says belongs resident, what belongs
   on-demand, and what is not an enforcement layer at all. Quotes and sources:
   [references/official-criteria.md](references/official-criteria.md).
2. **Block and correction logs** — what the enforcement layer actually stopped, and what the
   human actually had to correct.
3. **Measurement** — item counts and token estimates per surface, taken the same way twice so
   before and after are comparable.

**Opinion is not one of the three.** "This rule feels important" and "this rule feels like bloat"
are the same evidence class, and a verdict that pits one against the other is a coin flip wearing
a report's clothes. If none of the three applies to a section, the verdict is `unjudged`, and it
stays exactly as it is.

## When to use

- The resident layer has grown across many sessions and nobody has ever removed anything.
- Claude keeps violating a rule that is plainly written down — the diagnostic the docs give for
  that symptom is *file length*, not rule wording.
- You are about to add another rule and want to know what the existing ones are doing first.
- A model upgrade landed and some instructions may now be scaffolding for a weakness that is gone.

Not for: a defect that just recurred — `recurrence-prevention` owns that, and it moves *one*
countermeasure up a ladder rather than re-judging the whole layer. Not for mismatch between the
product's documentation and the product's code — that is `audit-service-gaps` in DRIFT mode.

---

## Stage 1 — INVENTORY (what actually loads every session)

Enumerate the resident surfaces before judging any of them. Resident means loaded at session
start whether or not it gets used:

| Surface | Where it lives | Resident? |
|---|---|---|
| Project anchor | `CLAUDE.md` / `AGENTS.md` at the repo root (and parent directories) | Full text, every session |
| Project anchor 2 | `.claude/CLAUDE.md` — a second file, not an alias of the first | Full text, every session |
| User anchor | the same filenames under the home config dir (`$HOME/.claude/`) | Full text — a separate scope, not a parent directory |
| Imports | every `@path` reachable from any of those anchors, up to four hops | Full text — imports organize, they do not reduce |
| Auto-memory | `MEMORY.md`, written by the agent to itself | Full text; often the single largest item |
| Rules | `.claude/rules/*.md` | Full text if no `paths:` frontmatter; on match if scoped |
| Skills | `.claude/skills/*/SKILL.md` | **Name + description only**; the body loads on trigger |
| Subagents | `.claude/agents/*.md` | Description preloaded, same as skills |
| Hooks | `settings.json` hook entries + their scripts | **Zero**, unless the hook writes to stdout |
| Permissions | `permissions.allow` / `ask` / `deny` | Enforcement, not context |

Then measure. Use whatever the project already provides; if it provides nothing, plain shell is
enough and portable. Measure every row in the same unit — **bytes** — or the rows cannot be added
up, and "half the layer is rules" becomes a guess:

```bash
have() { for f in "$@"; do [ -f "$f" ] && printf '%s\n' "$f"; done; }

# ⓐ every anchor that exists, plus one hop of @imports resolved next to the file that declared them
anchors=$(have CLAUDE.md .claude/CLAUDE.md AGENTS.md "$HOME/.claude/CLAUDE.md")
imports=$(for a in $anchors; do
  grep -o '@[^[:space:])]*' "$a" |
    sed -e "s|^@~|$HOME|" -e "s|^@/|/|" -e "s|^@|$(dirname "$a")/|"
done)
have $anchors $imports | xargs wc -c        # ÷ 4 ≈ tokens

# ⓑ rules — count them, then size only the ones without `paths:` frontmatter
find .claude/rules -name '*.md' | wc -l
grep -L '^paths:' .claude/rules/*.md | xargs wc -c

# ⓒ auto-memory — one home dir holds every project's, so keep the ones naming this project
find . "$HOME/.claude" -name 'MEMORY.md' 2>/dev/null |
  grep -e '^\./' -e "$(basename "$PWD")" | xargs wc -c

# ⓓ for skills and subagents the descriptor is the resident part — size the frontmatter, not the file
awk 'FNR==1{n=0} /^---$/{n++;next} n==1' .claude/skills/*/SKILL.md | wc -c
awk 'FNR==1{n=0} /^---$/{n++;next} n==1' .claude/agents/*.md | wc -c
```

Three traps that make an inventory wrong rather than incomplete:

- **Two copies of the same name.** A repo that *ships* a harness has a development copy and a
  distributed copy of the same filenames. Measure the one the session actually loads, and say
  which one you measured.
- **`paths:` frontmatter changes the answer.** A rule with a `paths:` list is not resident; a rule
  without one is. Read the frontmatter, do not assume.
- **Imports are not free.** Splitting a long anchor into `@imports` improves organization and
  changes the resident total by nothing.

Record the numbers as bytes per surface plus one total. Every later claim about "smaller" has to
point back at them, and a total that quietly drops a surface makes every percentage after it wrong.

## Stage 2 — EVIDENCE (what the layer actually did)

For each resident item, look for a trace that it did work:

- **Block logs.** Blocking hooks that append one line per block (`.uzys-agent-harness/hook-blocks.log`
  where this harness is installed) give the only direct data on what enforcement actually caught.
- **Correction history.** `git log` on the steering files themselves, plus the commits that
  *followed* a rule's introduction: was the mistake it targets absent afterward, or does it recur?
- **The maintainer's own record.** Issue threads, postmortems, memory files — a rule created after
  a real incident has a citation; a rule created out of caution does not.

**A log with zero lines is not an acquittal.** It has two readings that data alone cannot separate:
nothing needed blocking, or the log was born last week / the hook never fired / the hook never wired
up. Report `no sample` and go find a second signal — when the hook was added, whether its matcher can
ever match, whether the file exists at all. A hook whose matcher cannot match anything is not
"quietly effective", it is dead wiring, and that is a finding in its own right.

The same asymmetry runs the other way: a log line proves the hook fired, not that the block was
*correct*. Read the blocked targets. A block on a path the maintainer intended to edit is a false
positive, and false positives are the cost side of the enforcement ledger.

## Stage 3 — VERDICT (rule on each section, one at a time)

The unit is the **section**, not the file. Files are usually mixed — one paragraph carrying a real
project fact, three carrying things any competent model already does.

The primary question comes straight from the published guidance: **"Would removing this cause
Claude to make mistakes?"** If not, cut it. Two corollaries decide most sections without argument:

- Anything derivable from the codebase (directory layouts, dependency lists, file-by-file
  descriptions, API documentation) is derivable *by the model, on demand*. It does not need to be
  resident.
- Anything the model does correctly without the instruction is a no-op that still costs adherence
  from the rules around it.

Then run the **generation lint**. Recent guidance names prompt patterns that were useful for older
models and now actively cost tokens or quality — they survive in steering layers as legacy
scaffolding, so look for them by name:

| Pattern to flag | Why it is now a cost |
|---|---|
| Explicit verification instructions ("add a final verification step", "use a subagent to verify") | The model verifies its own work unprompted; the instruction causes over-verification |
| Re-check instructions ("double-check your answer", "re-verify before responding") | Compounds with behavior the model already has — cost without quality |
| Severity suppression in review prompts ("only report high-severity issues", "be conservative") | Followed literally: the review reports less. Ask for everything, filter in a separate pass |
| Rules telling the model not to think or not to reason, especially naming thinking tags | Increases tag leakage — the documented effect is the opposite of the intent |
| Long stacks of prohibitions | Positive examples of the wanted style outperform instructions about what not to do |
| Aspirational rules nobody follows | Documented as "not worth including"; also teaches that rules are optional |

A flag is a candidate, not a verdict. Confirm it against the section's evidence before ruling.

Assign exactly one verdict per section:

- **keep** — evidence of a real mistake it prevents, and it belongs resident.
- **rewrite** — right content, wrong form: vague where it should be concrete ("format properly" →
  "use 2-space indentation"), or contradicting another section (conflicting instructions get picked
  between arbitrarily).
- **relocate** — right content, wrong layer. Stage 4 decides where.
- **delete** — no evidence, derivable, already-known, or dead wiring.
- **unjudged** — none of the three evidence kinds applies. Leave it alone and say so.

Conflicts deserve their own sweep: two sections that contradict each other are worse than either
alone, because the model may follow either one on any given session.

## Stage 4 — RELOCATE (right content, wrong layer)

Most of what a bloated steering layer holds is not wrong — it is filed in the layer that cannot
enforce it and charges rent for trying.

| What it is | Where it belongs | Why |
|---|---|---|
| Multi-step procedure, playbook, checklist | **Skill** | Loads on demand; the descriptor is the only resident cost |
| Instruction that only matters for part of the tree | **Path-scoped rule** (`paths:` frontmatter) | Loads when matching files are touched, not every session |
| Must happen every time, no exceptions (format on save, block a path) | **Hook** | Prose is advisory; hooks are deterministic and fire regardless of what the model decides |
| Hard allow/deny boundary on tools, commands, paths | **Permission rule** | Documented as the enforcement layer for boundaries; a hook filter is best-effort and fails open on unparseable input |
| A fact the code already states, or should | **Code, test, or generated doc** | Derived facts do not drift; copied facts do |
| Dynamic per-session context (recent commits, open issues) | **SessionStart hook** | Static context belongs in the anchor; only scripted, changing context justifies a hook |
| A system Claude keeps re-reading or cannot see at all; a setup a second repo needs too | **MCP server** or **plugin** | Connect or package the capability instead of narrating it in prose that loads every session |
| A side task whose output would flood the main conversation | **Subagent** | Runs in its own context; only the result comes back |
| Nothing depends on it | **Delete** | |

Two directions that look symmetric and are not: hooks can tighten what permission rules allow but
never loosen it, and a prompt instruction is not on the enforcement list at all — it shapes what
the model attempts, so pair it with one of the two real mechanisms rather than shipping it alone.

Relocation is not free either. A hook adds a shell dependency and an administrative surface; a
skill adds a descriptor to every session. Say what the move costs, not only what it saves.

## Stage 5 — APPLY (propose; the human decides)

Default output is a **proposal**, not an edit. Present it as one table — section, verdict,
evidence, destination — with before/after measurements from Stage 1, then stop.

Apply only what was approved, and keep the applied change checkable:

- One coherent commit, so the removal can be reverted as a unit.
- **Deletions are reversible in version control and nowhere else.** Before deleting a rule, check
  whether a test, gate, or script reads that file by path — a gate that greps for a removed file
  turns green by finding nothing.
- After applying, the honest verification is behavioral: the guidance's own instruction is to
  *"test changes by observing whether Claude's behavior actually shifts."* Say plainly that the
  effect is unverified until that observation exists. A smaller token count is not evidence that
  the layer got better.

Never widen the audit into a rewrite of the project's conventions. This skill decides what loads,
not what the team believes.

---

## Worked example (abridged run)

**Input:** "룰이랑 훅이 밥값 하는지 좀 봐줘 — CLAUDE.md도 너무 길어진 것 같고."

**INVENTORY** — anchor 210 lines + 9 rule files, no `paths:` frontmatter on any of them, 1,100
lines resident in total across both copies of the layer; 4 hooks registered in `settings.json`;
`permissions` has `defaultMode: bypassPermissions` with zero `deny` and zero `ask` entries.

**EVIDENCE** — block log holds 6 lines over 3 weeks: 4 from the protected-file hook (all on
`.env` writes), 2 from an MCP allowlist hook, of which **1 blocked a lookup the maintainer had
explicitly asked for** — a false positive, not a save. Two of the 4 registered hooks appear zero
times; one turns out to have a matcher that cannot match any event name the CLI emits (**dead
wiring**), the other has genuinely never been triggered (**no sample** — reported as unknown, not
as safe).

**VERDICT** — 9 rules → 8 (one file restated the anchor's own principles: `delete`). Within the
survivors, section-level cuts land on: a verification-step instruction and two "double-check
before responding" clauses (generation lint), a directory-layout listing (derivable), and a
"report only blocking issues" clause in the review rule (severity suppression). Resident prose
1,100 → 535 lines. The four rules with incident citations: `keep`, untouched.

**RELOCATE** — the release checklist (11 steps, invoked a few times per month) → skill. The
"never edit `.env`" line stays as prose *and* keeps its hook, since prose alone is not a boundary.
The dead-wired hook is deleted; the never-fired one is left in place with its status recorded as
unknown, because deleting on absence of evidence is the mistake this stage exists to avoid.

**APPLY** — proposal table presented; maintainer approves the deletions, defers the skill
extraction. Reported as: −565 resident lines, 1 dead hook removed, 1 false-positive block
identified; **behavioral effect unverified** until the next few sessions are observed.

## Output, side effects, and stop conditions

- **Output** — the inventory with its measurement method, the evidence table (including `no
  sample` entries), one verdict per section with its evidence kind, the relocation plan with
  costs, and the before/after numbers.
- **Side effects** — this skill proposes; it edits only what was approved. Never touch
  `permissions` or hook configuration without explicit approval: those change what the agent is
  allowed to do, not merely what it reads.
- **Stop** when the project's steering layer is spread across copies you cannot tell apart, or
  when the only available judgment is preference. An audit that ranks sections by taste produces a
  confident list of changes that no one can defend later.

## Cross-references (don't duplicate)

- **`recurrence-prevention`** — opposite direction: it escalates one countermeasure after a
  specific defect returned. This skill audits the layer at rest; it does not decide whether a
  given incident deserves a new rule.
- **`audit-service-gaps`** — audits the product against its target state; DRIFT mode covers
  doc-vs-code mismatch in the product. This skill audits the agent's own steering layer.
- **`north-star`** — where a project's stated direction lives; a rule that no longer serves it is
  a candidate for deletion, but the direction itself is set there, not here.
- **[references/official-criteria.md](references/official-criteria.md)** — the published quotes
  behind every criterion above, with sources. Read it before ruling on a contested section.
