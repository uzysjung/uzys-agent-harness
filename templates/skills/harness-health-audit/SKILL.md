---
name: harness-health-audit
description: >-
  Audit the health of an AI-coding harness — the CLAUDE.md / AGENTS.md files, rules, skills, agents,
  hooks, and commands that steer an agent in a repository — across three questions a linter cannot
  answer: is it TRUE (does it match the real code?), is it USED (do skills actually trigger and does
  the loop actually verify?), and is it AFFORDABLE (is it inside the budget where instructions are
  still followed?). Then surgically correct or remove only what is proven wrong or dead. Use whenever
  the steering layer may have rotted or may not be working: "하네스 점검해줘", "하네스 드리프트 감사",
  "CLAUDE.md가 실제랑 맞는지 봐줘", "룰/스킬이 최신인지 확인해줘", "스킬이 제대로 활용되는지 봐줘",
  "루프 엔지니어링 잘 되고 있는지 검토해줘", "죽은 훅/커맨드 정리해줘", "audit my harness",
  "check the rules still match the real stack", "are my skills actually being used", "review the
  agent loop", after a stack or tooling migration, or when onboarding a repo whose steering docs look
  stale. Every finding must be backed by stated-versus-measured evidence; never guess the correct
  value, and never remove a live path because it merely looks unused.
---

# Harness Health Audit

A **harness** is everything that steers an agent but is not the model itself: `CLAUDE.md` /
`AGENTS.md` at every level, `.claude/rules/*.md`, skills, subagents, hook wiring, slash commands, and
tool/MCP descriptions — plus the `.codex` / `.opencode` equivalents when the repo targets several
CLIs. LangChain frames it as `Agent = Model + Harness`, defining the harness as "every piece of code,
configuration, and execution logic that isn't the model itself"
([LangChain](https://www.langchain.com/blog/the-anatomy-of-an-agent-harness)); Addy Osmani puts the
stakes plainly: "A decent model with a great harness beats a great model with a bad harness"
([Osmani](https://addyosmani.com/blog/agent-harness-engineering/)).

Harnesses fail in two different ways, and most audits only catch the first:

- **They rot.** The stack migrates, a command is renamed, a plugin disappears upstream, a ceremony is
  abandoned — but the steering text still asserts the old world. Nothing fails loudly, because the
  harness is instructions, not code: no test turns red when a rule lies.
- **They stop working while still being true.** Every word is accurate, but the skills never trigger,
  the rules are too long to be followed, and the loop closes on the agent's own say-so instead of a
  real check. A perfectly accurate harness that nothing obeys is still a broken harness.

This audit targets both. It does not claim to catch everything — see the safety gap named below.

## Run the deterministic linter first

Do not spend model tokens on what a program can decide. Form-level checks — file length caps, secret
detection, `.env` gitignoring, action SHA-pinning, resolvable links, naming conventions — are
deterministic. Tools exist: [AgentLint](https://www.agentlint.app/) advertises 33 checks over five
dimensions (findability, instructions, workability, continuity, safety) across `CLAUDE.md`,
`AGENTS.md`, `.cursor/rules`, `.github/copilot-instructions.md`, CI workflows, pre-commit hooks and
`.gitignore`; `cclint` covers syntax. Run what is available, then start here.

> "Never send an LLM to do a linter's job. LLMs are comparably expensive and *incredibly* slow
> compared to traditional linters and formatters."
> — [HumanLayer](https://www.humanlayer.dev/blog/writing-a-good-claude-md)

**This skill exists for what a linter structurally cannot decide.** A linter can measure that a rule
is 40 lines long; it cannot know whether the stack it names is the stack this repo actually uses,
whether the hook it wires still fires, or whether the skill it installs ever triggers. Those require
reading the code and judging. That judgment — truth and efficacy — is this skill's whole job.

## Governing principle

**Keep the live skeleton, cut only the dead flesh.** Correction is surgical and evidence-based, not a
rewrite. A harness that still works must survive the audit almost untouched. Two rules make that safe:

- **Every finding needs stated-versus-measured evidence.** "Looks stale" is not evidence. Quote the
  harness line, then quote the ground-truth source that contradicts it.
- **Never delete a path because it looks unused.** Absence of obvious callers is not proof of death.
  Measure it. If you cannot prove it is dead, keep it and flag it — silently stripping a live gate is
  the one failure worse than drift.

## The three questions

Run them in this order: truth is cheapest, economy needs the whole picture.

| | Question | Failure it catches |
|---|---|---|
| **A** | **Is it TRUE?** | The harness asserts a world the repo left behind |
| **B** | **Is it USED?** | The harness is accurate but inert — nothing triggers, nothing verifies |
| **C** | **Is it AFFORDABLE?** | The harness is accurate and well-designed but too big to be followed |

**These three are not exhaustive, and the gap that matters most is safety.** A harness can be TRUE,
USED, and AFFORDABLE and still be dangerous: a hook that pipes an unpinned remote script straight
into a shell, or a rule that tells the agent to skip permission prompts, is accurate (it describes
what it does), live (it fires), and cheap (one line) — so all three questions pass it. The
deterministic linters cover *form* safety (secrets, `.env` hygiene, action SHA-pinning); what they
cannot judge is whether a live, accurate instruction is a bad idea.

So: **when a check reveals something dangerous, report it — do not discard it because it fits no
question.** Treat safety as a standing lens over A/B/C rather than a fourth pass, and say plainly in
the report that safety was judged ad hoc, not systematically. A dedicated safety axis is a known gap
in this skill, not a solved problem.

---

## A. Is it TRUE? (accuracy)

Drift is the delta between what the harness states and what the repo is. Measure the real state from
load-bearing artifacts, never from memory or prose: dependencies and lockfile for the stack, the
resolvable command set for namespaces, wiring files and recent history for what fires, upstream
existence for advertised assets.

### A1 — Stale-stack drift
The harness mandates a stack the code no longer uses (a rules file requiring `pytest` when the
lockfile shows `vitest`).
**Measure:** diff each stack assertion against dependencies / lockfile / config files.
**Action:** the stack section is load-bearing — **correct** it to the measured stack. Read the new
value; never infer it. Removal applies only where the repo dropped the tooling outright.

### A2 — Stranded command / namespace references
References to commands or namespaces that were renamed or removed.
**Measure:** resolve every referenced command against the actually-installed set.
**Action:** **correct** if the target survives under a new name; **remove** if it is gone. Search
**skill and agent bodies**, not just `CLAUDE.md` — stranded references hide inside asset bodies, which
is where they are hardest to see and most often missed.

### A3 — Dead ceremony
Hooks, gates, agents, or checklists that no longer run: a hook wired to a deleted script, a gate
abandoned mid-adoption, a status file frozen for months, an agent irrelevant to this project.
**Measure:** check wiring and callers first, then whether the ceremony appears in recent history.
**Action:** **remove** only when death is proven (no wiring, no callers, no recent fires, upstream
gone). Dormant-but-unproven → **keep and flag**.

### A4 — False advertising
The harness promises assets or capabilities that no longer exist or no longer behave as claimed: a
skill whose upstream vanished, a catalog count that overstates reality, a documented flag that
crashes.
**Measure:** confirm each advertised asset resolves and each documented capability runs. Advertised is
not working.
**Action:** bring advertised text and actual behaviour into exact agreement. An overstatement is drift
even when nothing is "broken".

---

## B. Is it USED? (efficacy)

A harness can be entirely true and still do nothing. These checks ask whether it actually reaches the
agent's behaviour.

### B1 — Skill and tool utilization
Skills are selected from metadata alone: the agent "pre-loads the `name` and `description` of every
installed skill into its system prompt", and loads the body only "if Claude thinks the skill is
relevant to the current task"
([Anthropic](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)).
So a skill with a vague description is invisible no matter how good its body is — and Anthropic's own
skill-creator guidance warns that Claude "has a tendency to *undertrigger* skills — to not use them
when they'd be useful".

**Measure:**
- **Description triggerability** — does each description name concrete trigger phrases and contexts,
  or does it say "when relevant"? Vague descriptions are the mechanism of undertriggering.
- **Competition and collision** — do several skills claim overlapping triggers, or share a name with a
  command? Overlap forces a selection the model can get wrong. Osmani's tool-design finding applies:
  "Ten focused tools outperform fifty overlapping ones because the model can hold the menu in its
  head" ([Osmani](https://addyosmani.com/blog/agent-harness-engineering/)).
- **Sprawl** — count installed skills/tools. Every one spends startup context on metadata forever.
- **Observed use** — where session transcripts exist, did the skill fire on tasks it should own?

**Action:** **correct** vague descriptions toward concrete triggers and explicit negative cases
("not for X, use Y"); **de-conflict** overlapping claims; flag sprawl for the user's decision — do not
delete someone's skills to reduce a count.

**Honest limit:** Anthropic's guidance offers no quantitative trigger metric — it recommends running
agents "on representative tasks and observing where they struggle" and monitoring "how Claude uses
your skill in real scenarios". So utilization findings are **observational, not measured**. Say so;
do not invent a trigger rate.

### B2 — Loop integrity
The loop is the cycle of reason → act → observe → verify. What makes it work is not the model but the
**quality of the feedback signal** it closes on.

**Measure:**
- **Is there a real verify step?** Does something deterministic (tests, typecheck, lint, build) run and
  feed failures back — or does the loop end on the agent's self-report? The hook pattern to look for:
  "Success is silent, failures are verbose. If typecheck passes, the agent hears nothing. If it fails,
  the error text gets injected into the loop and the agent self-corrects"
  ([Osmani](https://addyosmani.com/blog/agent-harness-engineering/)).
- **Is generation separated from evaluation?** Osmani reports that Anthropic's long-running harness
  work is explicit that "separating generation from evaluation into distinct agents outperforms
  self-evaluation, because agents reliably skew positive when grading their own work"
  ([Osmani](https://addyosmani.com/blog/agent-harness-engineering/)). A harness where the author is
  the only reviewer has a known bias, not a check.
- **Are there stopping conditions?** A loop must break on *no progress*, not only on completion.
- **Is the checked proxy the real goal?** The canonical failure is an agent deleting a failing test to
  turn CI green — the gate passes, the objective is lost.

Known loop failure modes to look for: early stopping; hallucinated success (done without
verification); compounding errors across a long trajectory; incoherence as work stretches across
context windows; poor decomposition ([Osmani](https://addyosmani.com/blog/agent-harness-engineering/)).

**Action:** **correct** loops that close on self-report by wiring a deterministic verifier; **add** a
no-progress stop where a loop can spin; flag proxy-goal mismatches. Do not add gates speculatively —
see the Ratchet tension below.

### B3 — Rule adherence
Presence is not obedience. HumanLayer states it directly: "Claude will ignore the contents of your
`CLAUDE.md` if it decides that it is not relevant to its current task"
([HumanLayer](https://www.humanlayer.dev/blog/writing-a-good-claude-md)).

**Run this check only when transcripts or recent work are available to read.** Adherence cannot be
measured from files alone — without that evidence the check has nothing to say, so skip it and record
it as **unverified** rather than manufacturing a verdict. (Its one file-visible residue — "a rule a
program could enforce belongs in the program" — is C2's job; leave it there rather than duplicating
the finding here.)

**Measure:** pick a few load-bearing rules and check whether the work actually followed them. A rule
routinely violated without consequence is either mis-placed or dead.
**Action:** **flag** rules that are stated but never observed to bind. Route mis-placed ones to C2.

---

## C. Is it AFFORDABLE? (economy)

Instructions compete for a finite attention budget. Past a point, adding correct text makes the
harness *worse*.

### C1 — Instruction budget
The evidence:
- **Context rot.** Chroma tested 18 frontier models (Claude, GPT, Gemini, Qwen families) and found
  "model performance degrades as input length increases, often in surprising and non-uniform ways" —
  even on trivially simple tasks where only length changed. Distractors compound it: "even a single
  distractor reduces performance relative to the baseline, and adding four distractors compounds this
  degradation further" ([Chroma](https://www.trychroma.com/research/context-rot)).
- **Position matters.** Liu et al. found a U-shaped curve — performance is highest when relevant
  information sits at the very start or end of the context and degrades in the middle — and it holds
  even for the strongest model tested ([Liu et al., TACL](https://aclanthology.org/2024.tacl-1.9/)).
- **Length norms.** Reported consensus is "less than 300 lines is best, and shorter is even better";
  HumanLayer's own root `CLAUDE.md` is "less than sixty lines"
  ([HumanLayer](https://www.humanlayer.dev/blog/writing-a-good-claude-md)). Osmani's framing: a
  "pilot's checklist, not style guide" ([Osmani](https://addyosmani.com/blog/agent-harness-engineering/)).

**Measure:** length of each always-loaded file; how many discrete instructions the harness asserts in
total across every always-loaded layer (global + project + directory); how much is irrelevant to a
typical task (those are the distractors).
**Action:** **correct** by moving detail behind pointers — state what is true every session, link the
rest. Prefer removing duplication over shortening prose.
**Honest limit:** Chroma publishes performance *curves*, not a percentage-per-token figure. Do not
quote a precision the research does not contain. Line norms are practitioner consensus, not a measured
threshold — treat them as a smell test, not a gate.

### C2 — Right tool for the job
Instructions asking the model to do what a program should do are both expensive and unreliable.
**Measure:** scan the harness for rules a linter, formatter, hook, or CI check could enforce
deterministically (formatting, import order, banned calls, secret hygiene).
**Action:** **move** them into the deterministic layer and delete the prose. This buys budget back for
the judgment-level guidance only the model can use.

---

## The Ratchet test (cross-cutting)

Osmani proposes: "Every line in a good `AGENTS.md` should be traceable back to a specific thing that
went wrong" — earn each line, add constraints only after observing real failures
([Osmani](https://addyosmani.com/blog/agent-harness-engineering/)).

This is a sharp audit lens: for each line, ask *what failure does this prevent?* If nobody can name
one, it is speculative bloat paying rent in the budget from C1.

**It also conflicts with this skill's removal rule, and the conflict must not be blurred.** The
Ratchet is a rule for **adding** — it justifies refusing new lines. This skill's rule governs
**removing** — proof of death before deletion. An untraceable line is *not* proven dead; it may be the
only thing preventing a failure nobody has hit recently.

**Resolution:** an untraceable line is a **flag**, never an auto-delete. Surface it, name the missing
rationale, and let the user decide. Apply the Ratchet at full strength to anything the audit proposes
to *add*.

## Classification

Route every finding through one decision:

| Decision | When | Guard |
|---|---|---|
| **Correct** | Still used, stated value wrong | Use the measured value, never a guess |
| **Remove** | Provably dead: no wiring, no callers, no fires, upstream gone | Proof required; name it |
| **Move** | Right intent, wrong layer (a linter's job stated as prose) | Verify the new layer actually fires |
| **Keep (flag)** | Looks stale or untraceable, but not proven wrong or dead | Surface it; do not touch it |

When torn between remove and keep, keep. A false "keep" costs a little noise; a false "remove"
silently strips a live gate.

## Workflow

1. **Run the deterministic linter** if one is available. Do not re-do its work by hand.
2. **Inventory the surface.** Every always-loaded file, rule, skill, agent, hook + its wiring, command,
   and the multi-CLI equivalents. Missing a surface is how a rename gets fixed in `CLAUDE.md` and left
   broken inside a skill body.
3. **Measure ground truth.** Real stack (dependencies/lockfile), real commands (what resolves), real
   wiring (what fires), real assets (what exists upstream).
4. **Run A → B → C.** For each check, produce stated/measured pairs. No pair, no finding.
5. **Classify** each finding: correct / remove / move / keep-flag. For every "remove", write the death
   evidence explicitly.
6. **Apply surgically.** Only drifted lines. Do not "improve" adjacent, correct text. Match existing
   conventions. Keep mechanical renames in a separate change from semantic corrections — they carry
   different risk and review differently.
7. **Verify nothing live broke.** Re-check callers and wiring after editing; confirm no hook, command,
   or gate that still fires was removed.
8. **Report** the table below.

## Report format

```markdown
## Harness Health Audit — <repo> @ <commit>
Deterministic linter: <tool + score, or "none available">

| # | Q | Check | Stated | Measured | Action | Evidence |
|---|---|-------|--------|----------|--------|----------|
| 1 | A | stale-stack | "pytest for all tests" | lockfile → vitest | correct | package.json |
| 2 | A | stranded ref | body calls `/oldns:review` | resolves as `agent-skills:review` | correct | skill body |
| 3 | A | dead ceremony | 6-gate pre-commit hook | not wired, 0 fires/3mo | remove | settings.json, git log |
| 4 | B | utilization | skill desc: "when relevant" | no concrete trigger | correct | SKILL.md frontmatter |
| 5 | B | loop integrity | "verify before commit" | no verifier wired; self-report only | correct | hook wiring |
| 6 | C | budget | root CLAUDE.md 700 lines | norm <300 | correct | wc -l |

**Unverified (could not measure):** <list, or "none">
**Kept-and-flagged (not proven dead/wrong):** <list, or "none">
**Safety concerns (ad-hoc lens, not a systematic pass):** <list, or "none seen — not a clean bill">
```

Always print the *Unverified*, *Kept-and-flagged*, and *Safety* rows even when empty. A clean table
that hides a blind spot is itself a drift. The safety row's empty value is "none seen", never "none"
— the audit has no systematic safety pass, so silence there is absence of evidence, not evidence of
absence.

## Anti-patterns

- **Rewriting the whole harness.** "Improving" adjacent, correct text buries the real corrections.
- **Guessing the correct value.** Correcting a stack assertion from memory replaces old drift with new.
- **Fixing only `CLAUDE.md`.** A rename that misses skill and agent *bodies* strands the references.
- **Deleting on "looks unused".** Removing a gate without proving death can strip a live safety check.
- **Treating advertised as working.** A promised asset that no longer resolves is drift, not a footnote.
- **Reporting a trigger rate you did not measure.** Utilization is observational; invented metrics are
  worse than an honest "unverified".
- **Doing a linter's job by hand** — and leaving prose in the harness that should have been a hook.
- **Adding gates because gates feel safe.** Every speculative gate is future dead ceremony (A3) paid
  for out of the budget (C1). Earn it with a real failure.
- **One unreviewable diff.** Blending mechanical renames with semantic edits defeats verification.

## Honest limitations

- **No systematic safety pass.** A/B/C can all pass on a harness that is accurate, live, cheap, and
  unsafe (an unpinned `curl | sh` hook; a rule waiving permission prompts). Safety is a lens applied
  ad hoc, and the linters only cover form-level safety — so a clean audit is not a safety clearance.
  Say so in the report.
- **Presence ≠ adherence.** A correct rule can still be ignored; the model decides relevance. Only
  observation reveals whether a rule binds — files alone cannot.
- **No published utilization metric.** There is no authoritative trigger-rate measure to cite; report
  utilization qualitatively.
- **Gitignored harness.** Much of a harness can live in gitignored files (locally installed skills,
  machine-specific settings). Git history then cannot reconstruct the live workflow — read the actual
  files, and state plainly when a surface could not be measured.
- **Unmeasurable live-fire.** Whether a hook *actually* fired in past sessions is usually not
  recoverable from the repo alone. "Absent from history" is a signal, not proof; confirm with wiring.
- **Cross-CLI asymmetry.** A harness can be correct for one target CLI and drifted for another. Audit
  each surface it claims to support; report per-CLI when they diverge.
- **Norms are not thresholds.** The line-count and tool-count figures here are practitioner consensus.
  Use them to start a conversation, not to fail a build.

## References

- [LangChain — The Anatomy of an Agent Harness](https://www.langchain.com/blog/the-anatomy-of-an-agent-harness) — `Agent = Model + Harness`; harness components.
- [Addy Osmani — Agent Harness Engineering](https://addyosmani.com/blog/agent-harness-engineering/) — loop failure modes, the Ratchet Principle, hook pattern, evaluator separation.
- [Anthropic — Equipping agents for the real world with Agent Skills](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills) — metadata-based triggering; progressive disclosure.
- [HumanLayer — Writing a good CLAUDE.md](https://www.humanlayer.dev/blog/writing-a-good-claude-md) — length norms; "never send an LLM to do a linter's job"; rules can be ignored.
- [Chroma — Context Rot](https://www.trychroma.com/research/context-rot) — 18 models; degradation with input length; distractor effects.
- [Liu et al. — Lost in the Middle (TACL)](https://aclanthology.org/2024.tacl-1.9/) — U-shaped position curve.
- [AgentLint](https://www.agentlint.app/) — deterministic harness linter; run it before this skill.

## Related skills

- **model-orchestration** — picks the model for the audit versus the corrections.
- **compaction-handoff** — persists findings so a long audit survives a context boundary.
- **no-false-ship (rule)** — check A4 is the same advertised-equals-actual discipline.
