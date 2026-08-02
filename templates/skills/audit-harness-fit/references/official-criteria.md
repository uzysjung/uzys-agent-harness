# Published criteria for the resident steering layer

Every judgment in `SKILL.md` traces to a quote here. Quotes are **verbatim English** from the
vendor documentation, each with its source URL. Anything summarized rather than quoted is labeled
`(summary)`. Where the documentation is silent, this file says so instead of inventing a rule —
"not stated" is itself a finding when someone claims a criterion that does not exist.

Sources (collected 2026-08; several original URLs redirect, the landing URL is what is cited):

| # | Document | URL |
|---|---|---|
| 1 | Give Claude context: CLAUDE.md and better prompts | `https://support.claude.com/en/articles/14553240-give-claude-context-claude-md-and-better-prompts` |
| 2 | Claude Code power user tips | `https://support.claude.com/en/articles/14554000` |
| 3 | Prompting Claude Opus 5 | `https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5` |
| 4 | How Claude remembers your project (memory) | `https://code.claude.com/docs/en/memory` |
| 5 | Best practices for Claude Code | `https://code.claude.com/docs/en/best-practices` |
| 6 | Skill authoring best practices | `https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices` |
| 7 | Hooks guide | `https://code.claude.com/docs/en/hooks-guide` |
| 8 | Hooks reference | `https://code.claude.com/docs/en/hooks` |
| 9 | Permissions | `https://code.claude.com/docs/en/permissions` |
| 10 | Features overview | `https://code.claude.com/docs/en/features-overview` |

**Evidence grade.** Sources (1) and (2) were captured through a fetch tool's extraction rather than
a read of the rendered page: their quotes are verbatim as the tool reported them, but they were not
compared against the full text. Carry that caveat when citing those two. The rest were taken from
the full page.

## Contents

- [ⓐ What belongs resident, and what does not](#ⓐ-what-belongs-resident-and-what-does-not)
- [ⓑ Size, and why length costs adherence](#ⓑ-size-and-why-length-costs-adherence)
- [ⓒ Resident vs on-demand: rules, path scoping, skills](#ⓒ-resident-vs-on-demand-rules-path-scoping-skills)
- [ⓓ Advisory vs enforcement: hooks and permissions](#ⓓ-advisory-vs-enforcement-hooks-and-permissions)
- [ⓔ Generation lint: instructions that are now a cost](#ⓔ-generation-lint-instructions-that-are-now-a-cost)
- [The growth loop the documentation prescribes](#the-growth-loop-the-documentation-prescribes)
- [What the documentation does not say](#what-the-documentation-does-not-say)

---

## ⓐ What belongs resident, and what does not

The include/exclude table (5):

> "| ✅ Include | ❌ Exclude |
> | Bash commands Claude can't guess | Anything Claude can figure out by reading code |
> | Code style rules that differ from defaults | Standard language conventions Claude already knows |
> | Testing instructions and preferred test runners | Detailed API documentation (link to docs instead) |
> | Repository etiquette (branch naming, PR conventions) | Information that changes frequently |
> | Architectural decisions specific to your project | Long explanations or tutorials |
> | Developer environment quirks (required env vars) | File-by-file descriptions of the codebase |
> | Common gotchas or non-obvious behaviors | Self-evident practices like "write clean code" |"

Worth including / not worth including (1):

> "Commands — how to build, test, lint, and run locally"
> "Conventions — naming, error handling, file layout, and 'we use X, not Y'"
> "Architecture in three sentences — what the major pieces are"
> "Hard constraints — for example, 'never write to the production database'"
> "Known gotchas — the issues every new engineer trips on"

> "Full API documentation (Claude can read the code directly)"
> "Changelogs or history"
> "Anything that is already obvious from the file tree"
> "Aspirational rules the team does not actually follow"

The character of what stays (4):

> "Keep it to facts Claude should hold in every session: build commands, conventions, project
> layout, "always do X" rules. If an entry is a multi-step procedure or only matters for one part
> of the codebase, move it to a [skill] or a [path-scoped rule] instead."

The vendor's own trim heuristic (4):

> "The [`/doctor`] checkup proposes trims for a checked-in CLAUDE.md: it cuts content Claude can
> derive from the codebase, such as directory layouts, dependency lists, and architecture
> overviews, and keeps pitfalls, rationale, and conventions that differ from tool defaults."

Assume competence (6):

> "**Default assumption:** Claude is already very smart
>
> Only add context Claude doesn't already have. Challenge each piece of information:
>
> * "Does Claude really need this explanation?"
> * "Can I assume Claude knows this?"
> * "Does this paragraph justify its token cost?""

The pruning question, verbatim (5):

> "Keep it concise. For each line, ask: *"Would removing this cause Claude to make mistakes?"* If
> not, cut it. Bloated CLAUDE.md files cause Claude to ignore your actual instructions!"

## ⓑ Size, and why length costs adherence

Numeric targets (1, 4):

> "Aim for a file that is short and signal-dense — under roughly 200 lines"

> "Every line is loaded into context on every request, so each one should be worth its cost"

> "**Size**: target under 200 lines per CLAUDE.md file. Longer files consume more context and
> reduce adherence."

> "Files over 200 lines consume more context and may reduce adherence. Use [path-scoped rules] to
> load instructions only when Claude works with matching files, or trim content that isn't needed
> in every session."

> "This limit applies only to `MEMORY.md`. CLAUDE.md files are loaded in full regardless of
> length, though shorter files produce better adherence."

Why it matters at all (5):

> "Most best practices are based on one constraint: Claude's context window fills up fast, and
> performance degrades as it fills."

The named failure pattern, with its prescribed fix (5):

> "* **The over-specified CLAUDE.md.** If your CLAUDE.md is too long, Claude ignores half of it
> because important rules get lost in the noise.
>   > **Fix**: Ruthlessly prune. If Claude already does something correctly without the
>   > instruction, delete it or convert it to a hook."

The diagnostic to run when a rule is being ignored (5):

> "If Claude keeps doing something you don't want despite having a rule against it, the file is
> probably too long and the rule is getting lost. If Claude asks you questions that are answered in
> CLAUDE.md, the phrasing might be ambiguous. Treat CLAUDE.md like code: review it when things go
> wrong, prune it regularly, and test changes by observing whether Claude's behavior actually
> shifts."

Imports do not reduce the bill (4):

> "CLAUDE.md files can import additional files using `@path/to/import` syntax. Imported files are
> expanded and loaded into context at launch alongside the CLAUDE.md that references them."

> "Splitting into [`@path` imports] helps organization but doesn't reduce context, since imported
> files load at launch."

Skill budgets, for the same audit applied to skills (6):

> "At startup, only the metadata (name and description) from all Skills is pre-loaded. Claude reads
> SKILL.md only when the Skill becomes relevant, and reads additional files only as needed."

> "Keep SKILL.md body under 500 lines for optimal performance"

> "For reference files longer than 100 lines, include a table of contents at the top."

> "The [context window] is a public good. Your Skill shares the context window with everything else
> Claude needs to know"

Writing quality criteria that decide `rewrite` verdicts (4):

> "**Specificity**: write instructions that are concrete enough to verify. For example:
>
> * "Use 2-space indentation" instead of "Format code properly"
> * "Run `npm test` before committing" instead of "Test your changes"
> * "API handlers live in `src/api/handlers/`" instead of "Keep files organized""

> "**Consistency**: if two rules contradict each other, Claude may pick one arbitrarily. Review
> your CLAUDE.md files, nested CLAUDE.md files in subdirectories, and [`.claude/rules/`]
> periodically to remove outdated or conflicting instructions."

## ⓒ Resident vs on-demand: rules, path scoping, skills

Load timing is the whole distinction (4):

> "Rules load into context every session or when matching files are opened. For task-specific
> instructions that don't need to be in context all the time, use [skills] instead, which only load
> when you invoke them or when Claude determines they're relevant to your prompt."

> "Rules without [`paths` frontmatter] are loaded at launch with the same priority as
> `.claude/CLAUDE.md`."

> "Rules without a `paths` field are loaded unconditionally and apply to all files. Path-scoped
> rules trigger when Claude reads files matching the pattern, not on every tool use."

The three-way comparison (10):

> | Aspect       | CLAUDE.md                           | `.claude/rules/`                                   | Skill                                    |
> | **Loads**    | Every session                       | Every session, or when matching files are opened   | On demand, when invoked or relevant      |
> | **Scope**    | Whole project                       | Can be scoped to file paths                        | Task-specific                            |
> | **Best for** | Core conventions and build commands | Language-specific or directory-specific guidelines | Reference material, repeatable workflows |

> "**Rule of thumb:** Keep CLAUDE.md under 200 lines. If it's growing, move reference content to
> skills or split into [`.claude/rules/`] files."

Broad-only in the anchor (5):

> "CLAUDE.md is loaded every session, so only include things that apply broadly. For domain
> knowledge or workflows that are only relevant sometimes, use [skills] instead. Claude loads them
> on demand without bloating every conversation."

Procedures are skills (10, blog linked from the docs' comparison section):

> "Procedures belong in skills. CLAUDE.md is for facts Claude should hold all the time"

## ⓓ Advisory vs enforcement: hooks and permissions

Prose is context, not configuration (4):

> "Both are loaded at the start of every conversation. Claude treats them as context, not enforced
> configuration. To block an action regardless of what Claude decides, use a [PreToolUse hook]
> instead. The more specific and concise your instructions, the more consistently Claude follows
> them."

> "CLAUDE.md content is delivered as a user message after the system prompt, not as part of the
> system prompt itself. Claude reads it and tries to follow it, but there's no guarantee of strict
> compliance, especially for vague or conflicting instructions."

Hooks are the guarantee (5, 7, 10):

> "Hooks are user-defined shell commands. Claude Code runs them at specific points in its
> lifecycle, which gives you deterministic control: certain actions always happen rather than
> relying on the LLM to choose to run them."

> "Use hooks for actions that must happen every time with zero exceptions."

> "Unlike CLAUDE.md instructions which are advisory, hooks are deterministic and guarantee the
> action happens."

> "**Put guardrails in hooks.** An instruction like "never edit `.env`" in CLAUDE.md or a skill is
> a request, not a guarantee. A `PreToolUse` hook that blocks the edit is enforcement. If a rule
> must hold every time, make it a hook rather than a prompt instruction."

> "**Use a hook** when the action must happen the same way every time and doesn't need Claude to
> think. For example: format on save, reject `rm -rf /`, post a Slack message when a session ends."

> "**Use a skill** when Claude should decide how to apply the steps, or when the content is
> knowledge rather than a script. For example: a `/release` checklist, your API style guide, a
> debugging playbook."

Boundaries are permission rules, not hooks (7, 9):

> "The filter also fails open, running your hook regardless of pattern, when the Bash command can't
> be parsed. Because the filter is best-effort, use the [permission system] rather than a hook to
> enforce a hard allow or deny."

> "Permission rules are enforced by Claude Code, not by the model. Instructions in your prompt or
> `CLAUDE.md` shape what Claude tries to do, but they don't change what Claude Code allows. To
> grant or revoke access, use `/permissions`, the rules described here, a [permission mode], or a
> [PreToolUse hook]."

> "* **Add CLAUDE.md guidance**: describe your allowed curl patterns in `CLAUDE.md`. This shapes
> what Claude tries but doesn't enforce a boundary, so pair it with one of the options above"

Direction is asymmetric — a hook can tighten, never loosen (7):

> "The reverse is not true: a hook returning `"allow"` doesn't bypass deny rules from settings, and
> it can't suppress the prompt for connector tools your organization set to `ask` or MCP tools
> marked `requiresUserInteraction`. Hooks can tighten restrictions but not loosen them past what
> permission rules allow."

Context cost of a hook is zero — until it speaks (10):

> "**What loads:** Nothing by default. Hooks execute outside the main conversation.
> **Context cost:** Zero, unless the hook returns output that gets added as messages to your
> conversation."

Static context does not justify a hook (8, 7):

> "Runs when Claude Code starts a new session or resumes an existing session. Useful for loading
> development context like existing issues or recent changes to your codebase, or setting up
> environment variables. For static context that doesn't require a script, use [CLAUDE.md]
> instead."

> "For injecting context on every session start, consider using [CLAUDE.md] instead."

Hook blind spots worth checking before trusting one (7):

> "Claude can also create or modify files by running shell commands through the `Bash` tool. If
> your hook must see every file change, such as for compliance scanning or audit logging, add a
> [`Stop`] hook that scans the working tree once per turn."

> "Exit code 0 with no output means the hook has no decision to report, so the tool call continues
> through the normal [permission flow]. The hook can deny the call, but staying silent doesn't
> approve it."

> "Keep the matcher as narrow as possible. Matching on `.*` or leaving the matcher empty would
> auto-approve every permission prompt, including file writes and shell commands."

## ⓔ Generation lint: instructions that are now a cost

All quotes in this section are from (3) and apply to current-generation models. They are the
reason a steering layer written for an older model needs re-reading rather than only trimming.

> "Claude Opus 5 verifies its own work without being told to. If your prompt contains explicit
> verification instructions ("include a final verification step for any non-trivial task," "use a
> subagent to verify"), remove them: instructions like these cause over-verification on Claude Opus
> 5, and removing them reduces wasted tokens with no loss in quality. The same applies to legacy
> harness scaffolding that adds separate verification steps."

> "Claude Opus 5 catches and fixes its own mistakes well without prompting. Avoid instructing
> re-checks it already performs ("double-check your answer," "re-verify before responding"); like
> verification instructions, these compound with the model's own behavior and add cost without
> improving results."

> "If your review prompt says "only report high-severity issues" or "be conservative," the model
> may follow that instruction literally and report less; ask it to report everything and filter in
> a separate pass instead."

> "If your system prompt contains a rule instructing the model not to think or not to reason,
> remove it; that kind of instruction increases tag leakage."

> "Instructions that call out thinking tags by name are less effective than the general form, so
> avoid naming them specifically."

> "Positive examples of the communication style you want tend to be more effective than
> instructions about what not to do."

Related, from (5) — the same over-asking failure on the review side:

> "A reviewer prompted to find gaps will usually report some, even when the work is sound, because
> that is what it was asked to do. Chasing every finding leads to over-engineering: extra
> abstraction layers, defensive code, and tests for cases that can't happen."

## The growth loop the documentation prescribes

This is what the audit is the counterweight to — the add-side loop is explicit and has no
documented reverse.

> "Treat CLAUDE.md as the place you write down what you'd otherwise re-explain. Add to it when:
>
> * Claude makes the same mistake a second time
> * A code review catches something Claude should have known about this codebase
> * You type the same correction or clarification into chat that you typed last session
> * A new teammate would need the same context to be productive" — (4)

> "anytime Claude does something incorrectly, add it to `CLAUDE.md` so it knows not to repeat the
> mistake." — (2)

> "If you do something more than once a day, turn it into a skill." — (2)

The trigger table that routes each addition to a layer, all eight rows — (10):

> | Trigger | Add |
> | Claude gets a convention or command wrong twice | Add it to [CLAUDE.md] |
> | You keep typing the same prompt to start a task | Save it as a user-invocable [skill] |
> | You paste the same playbook or multi-step procedure into chat for the third time | Capture it as a [skill] |
> | You keep copying data from a browser tab Claude can't see | Connect that system as an [MCP server] |
> | Claude reads many files to find where a symbol is defined or used | Install a [code intelligence plugin] for your language |
> | A side task floods your conversation with output you won't reference again | Route it through a [subagent] |
> | You want something to happen every time without asking | Write a [hook] |
> | A second repository needs the same setup | Package it as a [plugin] |

> "The same triggers tell you when to update what you already have. A repeated mistake or a
> recurring review comment is a CLAUDE.md edit, not a one-off correction in chat. A workflow you
> keep tweaking by hand is a skill that needs another revision." — (10)

(summary) Document (2) additionally groups hook usage by lifecycle event — session start for
dynamic context, pre-tool for logging and blocking, post-tool for formatting, permission-request
for routing, stop for deterministic checks, post-compaction for re-injection — and recommends
pre-allowing safe commands through `/permissions` and then committing the result to the team's
`settings.json`. Treated as a summary, not a quote.

## What the documentation does not say

Claiming one of these as a criterion is inventing a rule. Say "not stated" instead.

- **No line or file-count budget for `.claude/rules/`.** The 200-line target is stated for
  CLAUDE.md only. There is no published cap on how many rule files a project may have.
- **No number for adherence loss per added instruction.** The published causal claim is about
  *file length* ("longer files ... reduce adherence"), never about rule *count*.
- **No published rule for how many hooks are too many.** Only per-hook timeouts, the parallel/dedup
  behavior, and administrative kill switches (`disableAllHooks`, managed-hooks-only settings).
- **Hook security guidance** was not located in the current hooks reference when these sources were
  collected — the guide still links a `#security-considerations` anchor, but the section itself was
  not found. Do not cite it from memory.
