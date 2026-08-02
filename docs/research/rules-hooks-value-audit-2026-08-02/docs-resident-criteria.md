# Anthropic 공식 문서 — 상주 지시문(CLAUDE.md·rules)에 무엇을 담고 무엇을 빼는가

수집일: 2026-08-02. 출처는 Anthropic 공식 도메인(support.claude.com / platform.claude.com /
code.claude.com)만 사용. 요청받은 5 URL 중 3건은 301/302/308 리다이렉트를 따라갔다.

| # | 요청 URL | 실제 읽은 URL | 비고 |
|---|---|---|---|
| 1 | https://support.claude.com/en/articles/14553240-give-claude-context-claude-md-and-better-prompts | 동일 | 200 |
| 2 | https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5 | 동일 | 200 |
| 3 | https://docs.claude.com/en/docs/claude-code/memory | https://code.claude.com/docs/en/memory | 301 |
| 4 | https://www.anthropic.com/engineering/claude-code-best-practices | https://code.claude.com/docs/en/best-practices | 308 |
| 5 | https://docs.claude.com/en/docs/agents-and-tools/agent-skills/best-practices | https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices | 302 |

**증거 등급 주의**: #2~#5 는 WebFetch 가 페이지 전문을 반환해 인용을 원문에서 직접 옮겼다.
**#1 은 WebFetch 요약 모델이 추출한 인용만 확보**했고 전문을 보지 못했다 — 인용 자체는 도구가
verbatim 으로 표시했으나, 전문 대조는 하지 않았다. #1 인용은 이 한계를 붙여서 쓸 것.

---

## 1. support.claude.com — "Give Claude context: CLAUDE.md and better prompts"

URL: https://support.claude.com/en/articles/14553240-give-claude-context-claude-md-and-better-prompts

섹션 헤딩: `Part 1 — CLAUDE.md: your project's memory` / `Part 2 — Prompting habits that pay off in
Claude Code` / `Quick reference`

### 담으라 (Worth including)

> "Commands — how to build, test, lint, and run locally"
>
> "Conventions — naming, error handling, file layout, and 'we use X, not Y'"
>
> "Architecture in three sentences — what the major pieces are"
>
> "Hard constraints — for example, 'never write to the production database'"
>
> "Known gotchas — the issues every new engineer trips on"

### 담지 마라 (Not worth including)

> "Full API documentation (Claude can read the code directly)"
>
> "Changelogs or history"
>
> "Anything that is already obvious from the file tree"
>
> "Aspirational rules the team does not actually follow"

### 분량

> "Aim for a file that is short and signal-dense — under roughly 200 lines"
>
> "Every line is loaded into context on every request, so each one should be worth its cost"
>
> "it is still worth keeping the file lean for context-window space and signal-to-noise"

### 온디맨드 역할 분담

하위 디렉터리 CLAUDE.md 에 대해:

> "loaded on demand later, when Claude reads files in that subdirectory"

### 준수율/희석

**해당 문서에 없음** — 지시문 개수 증가에 따른 준수율 저하/희석에 대한 명시적 서술이 추출되지 않았다.
(단, 분량 인용의 "each one should be worth its cost" 가 비용 측면만 언급한다.)

---

## 2. platform.claude.com — "Prompting Claude Opus 5"

URL: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5

섹션 헤딩: `Capability improvements` / `Response length and verbosity` / `User-facing progress
updates` / `Written deliverable length` / `Task scope and over-verification` / `Controlling subagent
spawning` / `Self-correction` / `Running with thinking disabled`

### 안티패턴 — 과잉 검증 지시 (이 리포에 가장 직접 걸리는 항목)

> "Claude Opus 5 verifies its own work without being told to. If your prompt contains explicit
> verification instructions ("include a final verification step for any non-trivial task," "use a
> subagent to verify"), remove them: instructions like these cause over-verification on Claude Opus
> 5, and removing them reduces wasted tokens with no loss in quality. The same applies to legacy
> harness scaffolding that adds separate verification steps."

### 안티패턴 — 모델이 이미 하는 재확인을 지시하는 것

> "Claude Opus 5 catches and fixes its own mistakes well without prompting. Avoid instructing
> re-checks it already performs ("double-check your answer," "re-verify before responding"); like
> verification instructions, these compound with the model's own behavior and add cost without
> improving results."

### 안티패턴 — 지시가 문자 그대로 먹혀서 산출을 깎는 경우

> "If your review prompt says "only report high-severity issues" or "be conservative," the model may
> follow that instruction literally and report less; ask it to report everything and filter in a
> separate pass instead."

### 안티패턴 — 금지형 규칙이 역효과를 내는 경우

> "If your system prompt contains a rule instructing the model not to think or not to reason, remove
> it; that kind of instruction increases tag leakage."

> "Instructions that call out thinking tags by name are less effective than the general form, so
> avoid naming them specifically."

### 부정문보다 긍정 예시

> "Positive examples of the communication style you want tend to be more effective than instructions
> about what not to do."

### 긴 시스템 프롬프트에서의 배치 (분량 관련 유일한 구조 지침)

> "A short conciseness instruction is effective."

> "In a long system prompt, pair the instruction with a short reminder near the end of the prompt:"
>
> ```
> <tone_preference>
> Keep outputs reasonably concise.
> </tone_preference>
> ```

### 담으라 — 명시적으로 프롬프트에 넣으라고 한 것

범위 제어(과잉 확장 억제):

> "Deliver what was asked, at the scope intended. Make routine judgment calls yourself, and check in
> only when different readings of the request would lead to materially different work. If the request
> seems mistaken or a better approach exists, say so in a sentence and continue with the task as asked
> rather than quietly narrowing, widening, or transforming it. Finish the whole task, and stop short
> of actions that are clearly beyond what was asked."

서브에이전트 위임 억제:

> "Delegate to a subagent only for large tasks that are genuinely independent and parallelizable,
> such as a wide multi-file investigation. Do not delegate work you can finish yourself in a handful
> of tool calls, and do not use subagents to verify or double-check your own work. If one subagent can
> complete the task, use one rather than several, and keep spawn counts low."

문서 길이 보정:

> "Match the length of written documents to what the task needs: cover the substance, but do not pad
> with filler sections, redundant summaries, or boilerplate."

정정 서술 억제:

> "Only correct an earlier statement when the error would change the user's code, conclusions, or
> decisions. State corrections plainly and briefly, then continue the task. For slips that change
> nothing for the user, make the fix and move on without noting it."

### 긴 컨텍스트에서의 지시 준수

> "Claude Opus 5 has a [1M token context window] as both the default and the maximum, and its
> instruction following, tool calling, and reasoning stay consistent throughout the window."

### 분량 수치

**해당 문서에 줄 수·토큰 수치 없음** (1M 컨텍스트 윈도 외).

---

## 3. code.claude.com/docs/en/memory — "How Claude remembers your project"

URL: https://code.claude.com/docs/en/memory (원 요청 URL 에서 301)

섹션 헤딩: `CLAUDE.md vs auto memory` / `CLAUDE.md files`(When to add to CLAUDE.md · Choose where to
put CLAUDE.md files · Set up a project CLAUDE.md · Write effective instructions · Import additional
files · AGENTS.md · How CLAUDE.md files load · Organize rules with `.claude/rules/` · Manage
CLAUDE.md for large teams) / `Auto memory` / `View and edit with /memory` / `Troubleshoot memory
issues` / `Related resources`

### 상주 지시문의 성격 — 계약이 아니라 컨텍스트

> "Both are loaded at the start of every conversation. Claude treats them as context, not enforced
> configuration. To block an action regardless of what Claude decides, use a [PreToolUse
> hook](/docs/en/hooks-guide) instead. The more specific and concise your instructions, the more
> consistently Claude follows them."

> "Settings rules are enforced by the client regardless of what Claude decides to do. CLAUDE.md
> instructions shape Claude's behavior but are not a hard enforcement layer."

> "CLAUDE.md content is delivered as a user message after the system prompt, not as part of the
> system prompt itself. Claude reads it and tries to follow it, but there's no guarantee of strict
> compliance, especially for vague or conflicting instructions."

### 언제 담는가 (When to add to CLAUDE.md)

> "Treat CLAUDE.md as the place you write down what you'd otherwise re-explain. Add to it when:
>
> * Claude makes the same mistake a second time
> * A code review catches something Claude should have known about this codebase
> * You type the same correction or clarification into chat that you typed last session
> * A new teammate would need the same context to be productive"

### 무엇을 담고 무엇을 옮기는가 — 역할 분담의 핵심 문장

> "Keep it to facts Claude should hold in every session: build commands, conventions, project
> layout, "always do X" rules. If an entry is a multi-step procedure or only matters for one part of
> the codebase, move it to a [skill](/docs/en/skills) or a [path-scoped rule](#path-specific-rules)
> instead."

### 분량 — 수치 지침

> "**Size**: target under 200 lines per CLAUDE.md file. Longer files consume more context and reduce
> adherence. If your instructions are growing large, use [path-scoped rules](#path-specific-rules) so
> instructions load only when Claude works with matching files. You can also split content into
> [imports](#import-additional-files) for organization, though imported files still load and enter the
> context window at launch."

> "Files over 200 lines consume more context and may reduce adherence. Use [path-scoped
> rules](#path-specific-rules) to load instructions only when Claude works with matching files, or trim
> content that isn't needed in every session. Splitting into [`@path` imports](#import-additional-files)
> helps organization but doesn't reduce context, since imported files load at launch."

> "This limit applies only to `MEMORY.md`. CLAUDE.md files are loaded in full regardless of length,
> though shorter files produce better adherence."

(auto memory `MEMORY.md` 한정 하드 리밋:)

> "The first 200 lines of `MEMORY.md`, or the first 25KB, whichever comes first, are loaded at the
> start of every conversation. Content beyond that threshold is not loaded at session start."

### 구조 · 구체성 · 일관성

> "**Structure**: use markdown headers and bullets to group related instructions. Claude scans
> structure the same way readers do: organized sections are easier to follow than dense paragraphs."

> "**Specificity**: write instructions that are concrete enough to verify. For example:
>
> * "Use 2-space indentation" instead of "Format code properly"
> * "Run `npm test` before committing" instead of "Test your changes"
> * "API handlers live in `src/api/handlers/`" instead of "Keep files organized""

> "**Consistency**: if two rules contradict each other, Claude may pick one arbitrarily. Review your
> CLAUDE.md files, nested CLAUDE.md files in subdirectories, and [`.claude/rules/`] periodically to
> remove outdated or conflicting instructions."

### 룰 vs 스킬 — 로드 시점 기준의 역할 분담

> "Rules load into context every session or when matching files are opened. For task-specific
> instructions that don't need to be in context all the time, use [skills](/docs/en/skills) instead,
> which only load when you invoke them or when Claude determines they're relevant to your prompt."

> "Rules without [`paths` frontmatter](#path-specific-rules) are loaded at launch with the same
> priority as `.claude/CLAUDE.md`."

> "Rules without a `paths` field are loaded unconditionally and apply to all files. Path-scoped rules
> trigger when Claude reads files matching the pattern, not on every tool use."

`paths` frontmatter 예시(원문 그대로):

```markdown
---
paths:
  - "src/api/**/*.ts"
---

# API Development Rules

- All API endpoints must include input validation
- Use the standard error response format
- Include OpenAPI documentation comments
```

브레이스 확장 예산(수치):

> "a rule's whole `paths` list shares one budget of 1,000 expanded patterns and 4 MiB, and patterns
> without braces don't count against it."

### 무엇을 잘라내는가 — `/doctor` 의 트림 기준 (담지 말 것의 조작적 정의)

> "The [`/doctor`](/docs/en/commands#all-commands) checkup proposes trims for a checked-in CLAUDE.md:
> it cuts content Claude can derive from the codebase, such as directory layouts, dependency lists,
> and architecture overviews, and keeps pitfalls, rationale, and conventions that differ from tool
> defaults. The trim check requires Claude Code v2.1.206 or later."

### 지시가 안 지켜질 때의 디버그 순서

> "* Run `/context` and check the list under **Memory files** to verify your CLAUDE.md and
> CLAUDE.local.md files loaded. If a file is missing there, Claude can't see it. Use `/memory` to open
> and edit the files.
> * Check that the relevant CLAUDE.md is in a location that gets loaded for your session (...)
> * Make instructions more specific. "Use 2-space indentation" works better than "format code nicely."
> * Look for conflicting instructions across CLAUDE.md files. If two files give different guidance for
> the same behavior, Claude may pick one arbitrarily."

> "If the instruction is something that must run at a specific point, such as before every commit or
> after each file edit, write it as a [hook](/docs/en/hooks-guide) instead. Hooks execute as shell
> commands at fixed lifecycle events and apply regardless of what Claude decides to do."

### 임포트(@ 문법) — 컨텍스트를 줄이지 않는다

> "CLAUDE.md files can import additional files using `@path/to/import` syntax. Imported files are
> expanded and loaded into context at launch alongside the CLAUDE.md that references them."

> "Both relative and absolute paths are allowed. Relative paths resolve relative to the file
> containing the import, not the working directory. Imported files can recursively import other files,
> with a maximum depth of four hops."

> "Import parsing skips Markdown code spans and fenced code blocks. To mention a path in your
> CLAUDE.md without importing it, wrap it in backticks"

AGENTS.md 병존:

> "Claude Code reads `CLAUDE.md`, not `AGENTS.md`. If your repository already uses `AGENTS.md` for
> other coding agents, create a `CLAUDE.md` that imports it so both tools read the same instructions
> without duplicating them."

### 상주 비용을 안 쓰는 주석

> "Block-level HTML comments (`<!-- maintainer notes -->`) in CLAUDE.md files are stripped before the
> content is injected into Claude's context. Use them to leave notes for human maintainers without
> spending context tokens on them."

### 설정 vs CLAUDE.md 의 역할 경계 (원문 표)

> "| Block specific tools, commands, or file paths | Managed settings: `permissions.deny` |
> | Enforce sandbox isolation | Managed settings: `sandbox.enabled` |
> | Environment variables and API provider routing | Managed settings: `env` |
> | Authentication method and organization lock | Managed settings: `forceLoginMethod`, `forceLoginOrgUUID` |
> | Code style and quality guidelines | Managed CLAUDE.md |
> | Data handling and compliance reminders | Managed CLAUDE.md |
> | Behavioral instructions for Claude | Managed CLAUDE.md |"

### 준수율/희석

명시적 "dilution" 어휘는 없으나 **저하 인과는 두 번 직접 서술됨**:
"Longer files consume more context and **reduce adherence**" / "shorter files produce **better
adherence**".

---

## 4. code.claude.com/docs/en/best-practices — "Best practices for Claude Code"

URL: https://code.claude.com/docs/en/best-practices (원 요청 anthropic.com/engineering 에서 308)

섹션 헤딩: `Give Claude a way to verify its work` / `Explore first, then plan, then code` / `Provide
specific context in your prompts` / `Configure your environment`(Write an effective CLAUDE.md ·
Configure permissions · Use CLI tools · Connect MCP servers · Set up hooks · Create skills · Create
custom subagents · Install plugins) / `Communicate effectively` / `Manage your session` / `Automate
and scale` / `Avoid common failure patterns` / `Develop your intuition`

### 전제 — 컨텍스트가 차면 성능이 떨어진다

> "Most best practices are based on one constraint: Claude's context window fills up fast, and
> performance degrades as it fills."

> "This matters since LLM performance degrades as context fills. When the context window is getting
> full, Claude may start "forgetting" earlier instructions or making more mistakes. The context window
> is the most important resource to manage."

### 담을 것 / 뺄 것 — 원문 표 (이 리서치의 핵심 표)

> "| ✅ Include | ❌ Exclude |
> | ---------------------------------------------------- | -------------------------------------------------- |
> | Bash commands Claude can't guess | Anything Claude can figure out by reading code |
> | Code style rules that differ from defaults | Standard language conventions Claude already knows |
> | Testing instructions and preferred test runners | Detailed API documentation (link to docs instead) |
> | Repository etiquette (branch naming, PR conventions) | Information that changes frequently |
> | Architectural decisions specific to your project | Long explanations or tutorials |
> | Developer environment quirks (required env vars) | File-by-file descriptions of the codebase |
> | Common gotchas or non-obvious behaviors | Self-evident practices like "write clean code" |"

### 분량 · 프루닝 기준

> "There's no required format for CLAUDE.md files, but keep it short and human-readable."

> "Keep it concise. For each line, ask: *"Would removing this cause Claude to make mistakes?"* If
> not, cut it. Bloated CLAUDE.md files cause Claude to ignore your actual instructions!"

**수치 없음** — 이 문서에는 줄 수·토큰 수치가 없다(수치는 #1 과 #3 이 소유: 200줄).

### 준수율 저하의 진단 신호 · 튜닝

> "If Claude keeps doing something you don't want despite having a rule against it, the file is
> probably too long and the rule is getting lost. If Claude asks you questions that are answered in
> CLAUDE.md, the phrasing might be ambiguous. Treat CLAUDE.md like code: review it when things go
> wrong, prune it regularly, and test changes by observing whether Claude's behavior actually shifts."

> "You can tune instructions by adding emphasis (e.g., "IMPORTANT" or "YOU MUST") to improve
> adherence. Check CLAUDE.md into git so your team can contribute. The file compounds in value over
> time."

### 실패 패턴 — "The over-specified CLAUDE.md"

> "* **The over-specified CLAUDE.md.** If your CLAUDE.md is too long, Claude ignores half of it
> because important rules get lost in the noise.
>   > **Fix**: Ruthlessly prune. If Claude already does something correctly without the instruction,
>   > delete it or convert it to a hook."

동일 절의 다른 실패 패턴(참고):

> "* **The trust-then-verify gap.** Claude produces a plausible-looking implementation that doesn't
> handle edge cases.
>   > **Fix**: Always provide verification (tests, scripts, screenshots). If you can't verify it, don't
>   > ship it."

### 상주 vs 온디맨드 역할 분담

> "Run `/context` to confirm Claude loaded the file. CLAUDE.md is loaded every session, so only
> include things that apply broadly. For domain knowledge or workflows that are only relevant
> sometimes, use [skills](/docs/en/skills) instead. Claude loads them on demand without bloating every
> conversation."

### 프로즈 vs 훅

> "Use hooks for actions that must happen every time with zero exceptions."

> "[Hooks](/docs/en/hooks-guide) run scripts automatically at specific points in Claude's workflow.
> Unlike CLAUDE.md instructions which are advisory, hooks are deterministic and guarantee the action
> happens."

### 위치

> "* **Home folder (`~/.claude/CLAUDE.md`)**: applies to all Claude sessions
> * **Project root (`./CLAUDE.md`)**: check into git to share with your team
> * **Project root (`./CLAUDE.local.md`)**: personal project-specific notes; add this file to your
> `.gitignore` so it isn't shared with your team
> * **Parent directories**: useful for monorepos where both `root/CLAUDE.md` and `root/foo/CLAUDE.md`
> are pulled in automatically
> * **Child directories**: Claude pulls in child CLAUDE.md files on demand when it reads a file in
> those directories"

### 예시 CLAUDE.md (원문 그대로 — 분량 감각의 기준선)

> ```markdown
> # Code style
> - Use ES modules (import/export) syntax, not CommonJS (require)
> - Destructure imports when possible (eg. import { foo } from 'bar')
>
> # Workflow
> - Be sure to typecheck when you're done making a series of code changes
> - Prefer running single tests, and not the whole test suite, for performance
> ```

### 독립 리뷰의 과잉 지시 경고 (이 리포의 리뷰 레인과 직결)

> "A reviewer prompted to find gaps will usually report some, even when the work is sound, because
> that is what it was asked to do. Chasing every finding leads to over-engineering: extra abstraction
> layers, defensive code, and tests for cases that can't happen. Tell the reviewer to flag only gaps
> that affect correctness or the stated requirements, and treat the rest as optional."

---

## 5. platform.claude.com — "Skill authoring best practices"

URL: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices (302 경유)

섹션 헤딩: `Core principles`(Concise is key · Set appropriate degrees of freedom · Test with all
models you plan to use) / `Skill structure`(Naming conventions · Writing effective descriptions ·
Progressive disclosure patterns · Avoid deeply nested references · Structure longer reference files
with table of contents) / `Workflows and feedback loops` / `Content guidelines` / `Common patterns` /
`Evaluation and iteration` / `Anti-patterns to avoid` / `Advanced: Skills with executable code` /
`Technical notes` / `Checklist for effective Skills`

### 점진적 공개 — 무엇이 항상 로드되고 무엇이 안 되는가

> "Not every token in your Skill has an immediate cost. At startup, only the metadata (name and
> description) from all Skills is pre-loaded. Claude reads SKILL.md only when the Skill becomes
> relevant, and reads additional files only as needed. However, being concise in SKILL.md still
> matters: once Claude loads it, every token competes with conversation history and other context."

> "1. **Metadata pre-loaded:** At startup, the name and description from all Skills' YAML frontmatter
> are loaded into the system prompt
> 2. **Files read on-demand:** Claude uses bash Read tools to access SKILL.md and other files from the
> filesystem when needed
> 3. **Scripts executed efficiently:** Utility scripts can be executed through bash without loading
> their full contents into context. Only the script's output consumes tokens
> 4. **No context penalty for large files:** Reference files, data, or documentation don't consume
> context tokens until actually read"

> "**Bundle comprehensive resources:** Include complete API docs, extensive examples, large datasets;
> no context penalty until accessed"

### 컨텍스트는 공공재

> "The [context window](/docs/en/build-with-claude/context-windows) is a public good. Your Skill
> shares the context window with everything else Claude needs to know, including:
>
> * The system prompt
> * Conversation history
> * Other Skills' metadata
> * Your actual request"

### "모델이 이미 아는 것은 담지 마라" — 원문

> "**Default assumption:** Claude is already very smart
>
> Only add context Claude doesn't already have. Challenge each piece of information:
>
> * "Does Claude really need this explanation?"
> * "Can I assume Claude knows this?"
> * "Does this paragraph justify its token cost?""

> "The concise version assumes Claude already has information about PDFs and how libraries work."

간결/장황 예시의 토큰 수치:

> "**Good example: Concise** (approximately 50 tokens)" / "**Bad example: Too verbose**
> (approximately 150 tokens)"

모델별 테스트 기준에서:

> "* **Claude Opus** (powerful reasoning): Does the Skill avoid over-explaining?"

### 수치 예산

> "* Keep SKILL.md body under 500 lines for optimal performance
> * Split content into separate files when approaching this limit"

> "Keep SKILL.md body under 500 lines for optimal performance. If your content exceeds this, split it
> into separate files using the progressive disclosure patterns described earlier."

> "For reference files longer than 100 lines, include a table of contents at the top. This ensures
> Claude can see the full scope of available information even when previewing with partial reads."

frontmatter 상한:

> "`name`: Maximum 64 characters" / "`description`: Maximum 1,024 characters"

참조 깊이:

> "**Keep references one level deep from SKILL.md**. All reference files should link directly from
> SKILL.md to ensure Claude reads complete files when needed."

### SKILL.md 본문 vs 번들 파일 — 무엇을 어디에 두나

> "SKILL.md serves as an overview that points Claude to detailed materials as needed, like a table of
> contents in an onboarding guide."

> "For Skills with multiple domains, organize content by domain to avoid loading irrelevant context.
> When a user asks about sales metrics, Claude only needs to read sales-related schemas, not finance or
> marketing data. This keeps token usage low and context focused."

> "* **Overreliance on certain sections:** If Claude repeatedly reads the same file, consider whether
> that content should be in the main SKILL.md instead
> * **Ignored content:** If Claude never accesses a bundled file, it might be unnecessary or poorly
> signaled in the main instructions"

> "If workflows become large or complicated with many steps, consider pushing them into separate
> files and tell Claude to read the appropriate file based on the task at hand."

### 자유도 — 언제 절차를 못 박고 언제 모델을 믿는가

> "Match the level of specificity to the task's fragility and variability."

> "**High freedom** (text-based instructions):
>
> Use when:
>
> * Multiple approaches are valid
> * Decisions depend on context
> * Heuristics guide the approach"

> "**Medium freedom** (pseudocode or scripts with parameters):
>
> Use when:
>
> * A preferred pattern exists
> * Some variation is acceptable
> * Configuration affects behavior"

> "**Low freedom** (specific scripts, few or no parameters):
>
> Use when:
>
> * Operations are fragile and error-prone
> * Consistency is critical
> * A specific sequence must be followed"

> "**Analogy:** Think of Claude as a robot exploring a path:
>
> * **Narrow bridge with cliffs on both sides:** There's only one safe way forward. Provide specific
> guardrails and exact instructions (low freedom). Example: database migrations that must run in exact
> sequence.
> * **Open field with no hazards:** Many paths lead to success. Give general direction and trust
> Claude to find the best route (high freedom). Example: code reviews where context determines the best
> approach."

### 규칙이 안 먹힐 때의 처방 (강조어 승격)

> "Claude A might suggest reorganizing to make rules more prominent, using stronger language such as
> "MUST filter" instead of "always filter," or restructuring the workflow section."

### 안티패턴

> "### Avoid offering too many options
>
> Don't present multiple approaches unless necessary"

> "### Avoid time-sensitive information
>
> Don't include information that will become outdated"

> "Choose one term and use it throughout the Skill" (Use consistent terminology)

### 근거 우선 — 문서보다 eval 먼저

> "**Create evaluations BEFORE writing extensive documentation.** This ensures your Skill solves real
> problems rather than documenting imagined ones."

> "1. **Identify gaps:** Run Claude on representative tasks without a Skill. Document specific
> failures or missing context
> 2. **Create evaluations:** Build three scenarios that test these gaps
> 3. **Establish baseline:** Measure Claude's performance without the Skill
> 4. **Write minimal instructions:** Create just enough content to address the gaps and pass evaluations
> 5. **Iterate:** Execute evaluations, compare against baseline, and refine"

> "This approach ensures you're solving actual problems rather than anticipating requirements that may
> never materialize."

### 준수율/희석

**명시적 "instruction dilution" 서술은 해당 문서에 없음.** 가장 가까운 것은 위의 "context window
is a public good … every token competes with conversation history and other context" 와
"Overreliance/Ignored content" 관찰 항목이다.

---

## 6. 교차 정리 — 문서별로 어느 기준이 어디에 있는가 (SSOT 맵)

| 기준 | 어느 문서가 소유 | 수치/문구 |
|---|---|---|
| 200줄 상한 | #1, #3 | "under roughly 200 lines" / "target under 200 lines per CLAUDE.md file" |
| 길면 준수율 하락 (인과 명시) | #3, #4 | "Longer files consume more context and reduce adherence" / "Bloated CLAUDE.md files cause Claude to ignore your actual instructions!" |
| 담을 것/뺄 것 표 | #4 | ✅/❌ 7행 표 |
| aspirational rule 금지 | #1 | "Aspirational rules the team does not actually follow" |
| 모델이 이미 아는 것 금지 | #4, #5 | "Standard language conventions Claude already knows" / "Claude is already very smart" |
| 코드에서 유도되는 것 금지 | #1, #3, #4 | "obvious from the file tree" / `/doctor` 트림 / "Anything Claude can figure out by reading code" |
| 과잉 검증 지시 제거 | #2 | Opus 5 전용, "remove them … no loss in quality" |
| 상주 vs 온디맨드 분기 | #3, #4, #5 | 절차·부분 적용 → skill/path-scoped rule |
| 프로즈로 못 막는 것 → 훅/설정 | #3, #4 | "not a hard enforcement layer" / "hooks are deterministic" |
| 500줄 (SKILL.md 본문) | #5 | "under 500 lines for optimal performance" |
| 100줄 (참조 파일 TOC) | #5 | "longer than 100 lines, include a table of contents" |
| 200줄/25KB (auto memory) | #3 | `MEMORY.md` 한정 하드 컷 |
| 프루닝 판정 질문 | #4 | "Would removing this cause Claude to make mistakes?" |
| 변경 후 효과 확인 | #4, #5 | "test changes by observing whether Claude's behavior actually shifts" / eval-first |

## 7. 못 찾은 것 (추론으로 채우지 않음)

- **지시문 "개수"가 늘 때의 준수율 희석을 수치로 제시한 문서**: 5건 중 **없음**. #3/#4 는
  *파일 길이* ↔ adherence 인과만 말하고, 규칙 *개수* 축은 어느 문서도 계량하지 않는다.
- **rules 파일 개수/총량 상한**: 해당 문서들에 없음. #3 이 주는 유일한 수치 예산은 `paths`
  브레이스 확장(1,000 패턴 / 4 MiB)이고 이는 분량 가이드가 아니다.
- **`.claude/rules/` 파일 하나의 권장 줄 수**: 없음. CLAUDE.md 의 200줄만 존재.
- **#1 의 준수율/희석 언급**: 추출 결과상 없음(전문 미대조 — §증거 등급 주의 참조).
