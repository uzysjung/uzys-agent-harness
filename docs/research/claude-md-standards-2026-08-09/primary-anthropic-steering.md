# Anthropic — "Steering Claude Code: when to use CLAUDE.md, skills, hooks, and subagents" (1차 출처)

- **요청 URL**: https://claude.com/blog/steering-claude-code-skills-hooks-rules-subagents-and-more
- **실제 읽은 URL**: 같음 (HTTP 200, 575,133 bytes)
- **게시일 / 저자**: 원문 표기 `June 18, 2026` · `"This article was written by Michael Segner
  member of Anthropic staff."`
- **수집일**: 2026-08-09
- **수집 방식**: `curl` 로 HTML 직접 수신 후 자체 태그 제거 스크립트로 본문 추출.
  `.md` 원본 엔드포인트는 이 도메인에 없다(404).
- **증거 등급**: **A− — 전문 확보(본문 350줄 상당), 자체 추출.** 탐지기 검증:
  알려진 양성 문구 `"Keep CLAUDE.md under 200 lines"` 가 원본 HTML 에서 1회 검출됨을 먼저
  확인한 뒤 추출본을 신뢰했다. 유실분은 **이미지 캡션·인터랙티브 타임라인 위젯**뿐이다
  (예: `"A map of events in a Claude Code session when a hook can fire."`).

**표기 규약**: `>` 인용문은 **원문 영문 그대로**다. 그 밖의 한국어 문장은 전부 우리 해설이며
인용이 아니다.

---

## 1. 전제 — 7가지 방법과 세 축

> "There are seven methods for instructing Claude's behavior: CLAUDE.md files, rules, skills,
> subagents, hooks, output styles, and appending the system prompt."

> "Each method controls:
>
> - When an instruction loads into context;
>
> - Whether it persists through long sessions (compaction behavior); and
>
> - How much authority it carries."

> "Each method trades context cost against authority. These methods influence Claude's behavior
> while two separate dials, which model and effort level you choose, control how capable it is and
> how hard it works."

**해설(인용 아님)**: **"compaction behavior"** 축은 이 저장소 원장에 없던 것이다. 기존
`docs-resident-criteria.md` 는 *로드 시점*과 *비용*만 다뤘다.

---

## 2. 원문 비교표 (전 8행 — 원문 그대로 옮김)

| Method | When it's loaded | Compaction behavior | Context cost | When to use |
|---|---|---|---|---|
| CLAUDE.md (root) | Session start; stays in context for the entire session | Memoized. Read once and cached for the session; cache cleared and re-read after compaction | High. Every line costs tokens whether relevant or not | Build commands, directory layout, monorepo structure, coding conventions, team norms |
| CLAUDE.md (subdirectory) | On-demand, when Claude reads a file under that subdirectory | Lost until that subdirectory is touched again | Low. Only consumes context when the relevant subdirectory is being worked on | Conventions specific to a subdirectory |
| Rules | Session start (user-level rules) or only when matching files are touched (path-scoped) | Re-injected on compaction | Medium. Always-on unless path-scoped | Specific constraints or conventions (e.g., all API handlers must validate input with Zod) |
| Skills | Name and description at session start; full body loads when the skill is invoked | Invoked skills re-injected up to a shared budget; oldest dropped first | Low. Full body loads only when invoked; subject to a shared token budget across invoked skills | Procedural workflows (deploy or release checklists) |
| Subagents | Name, description, and tool list at session start; body loads only when called via the Agent tool | Only the final message (summary plus metadata) returns to the main session | Low. Zero cost in main context until called; runs in its own isolated context window | Running work in parallel or side tasks that should run in isolation and return only a summary (deep search, log analysis, dependency audit) |
| Hooks | Fire on lifecycle events | Bypass compaction entirely | Low. Configuration lives outside main context; some output may return (e.g., blocking errors) | Deterministic automation: run linters, post to Slack on completion, block commands, back up chat history on PreCompact |
| Output styles | Session start; injected into the system prompt | Never compacted | High. Occupies context window, but overwrites default system prompt | Significant role changes (code assistant to general assistant) |
| Appending the system prompt | Session start; passed as a CLI flag | Never compacted; applies only to that invocation | Moderate. Cached after first request in a session | Tone, response length, formatting preferences |

---

## 3. CLAUDE.md — 담을 것 · 분량 · 성장 실패 모드

> "CLAUDE.md is a markdown file at the root of your project. It loads into context at session start
> and stays there for the entire session."

> "Build commands, directory layout, monorepo structure, coding conventions, and team norms all fit
> naturally here."

### 왜 커지는가 (원문)

> "In a shared repository, CLAUDE.md grows the way any unowned config file does: every team appends
> its own instructions and nothing gets deleted. The cost compounds at scale."

> "Every line loads into every session for every engineer working in the repo, whether it's
> relevant to their task or not. This consumes tokens and **dilutes adherence to the instructions
> that actually matter.** As the file grows, push team-specific conventions into path-scoped rules
> and procedures into skills, where they load only when relevant."

### 분량과 소유 (원문)

> "Tip: Keep CLAUDE.md under 200 lines, give it an owner, and review changes to it like code. The
> content itself should follow the same rules as any prompt: writing effective prompts means being
> explicit, explaining the why behind constraints, and showing examples."

> "Think of this file as giving Claude an overview of your codebase, or as an index pointing to
> other files where Claude can find more information as needed."

### 해설(인용 아님) — 이 절이 원장에 더하는 것

기존 원장은 200줄 수치와 *"reduce adherence"* 인과를 이미 갖고 있었다. **새로운 것은 셋**이다:

1. **"dilutes adherence" 어휘가 처음으로 명시됐다.** 기존 원장 §7 은 "희석을 계량한 문서 없음"
   이라고 적어 두었는데, *계량*은 여전히 없지만 **어휘와 인과 주장은 이제 1차 출처에 있다.**
2. **"give it an owner, and review changes to it like code"** — 분량 규율의 처방이 "짧게 써라"가
   아니라 **소유자 + 코드리뷰**라는 거버넌스다.
3. **"explaining the why behind constraints"** — 지시문에 *이유*를 쓰라고 명시한다. 밀도 논변이
   가장 먼저 자르는 것이 이유 문장인데, 공식 권고는 반대다.

### 조직 배포 · 제외 (원문)

> "In monorepos, give each team's directory its own subdirectory CLAUDE.md so teams only load their
> own conventions, and developers can use the `claudeMdExcludes` setting to skip files from teams
> whose code they never touch."

> "For standards that must apply to every repository in the organization — security policies,
> compliance requirements — a centrally managed CLAUDE.md can be deployed to developer machines via
> MDM or config management, and it can't be excluded by individual settings."

---

## 4. Rules — 스코프 없는 룰의 정체

> "Rules are markdown files in `.claude/rules/` that give Claude specific constraints or
> conventions."

> "Unscoped rules behave like CLAUDE.md in that they are always loaded at session start and get
> re-injected on compaction. This can waste tokens by loading context even when it's not relevant
> for the task at hand."

> "Path-scoped rules allow you to load rule instructions only when they are relevant by adding a
> `paths` field that controls when they load."

> "For example: a rule scoped to `src/api/**` stays out of context during a docs-only session. It
> would only be loaded whenever Claude reads files within that `src/api/` directory."

원문 예시:

> ```
> ---
> paths:
> - "src/api/**"
> - "**/*.handler.ts"
> ---
> All API handlers must validate input with Zod before processing.
> ```

룰이냐 하위 CLAUDE.md 냐:

> "Tip: A file-specific constraint, like "migrations are append-only," fits best as a rule placed
> in your `paths:` frontmatter. Reach for a path scoped rule over a nested CLAUDE.md file when the
> instruction regards a cross-cutting concern or file that appears in multiple (but not all)
> corners of the codebase."

가장 날카로운 한 줄은 §6 에 있다:

> "An unscoped rule is mechanically identical to putting the content in CLAUDE.md: always loaded,
> always costing tokens."

**해설(인용 아님)**: 이 저장소의 배포 룰 7종 중 `paths:` 를 쓰는 것은 1종
(`cli-development` = `**/*.sh`)이고, 개발 사본 `.claude/rules/` 는 7종 전부 무조건 상주다
(CLAUDE.md §함정 3). 공식 문장에 따르면 **나머지는 "CLAUDE.md 에 붙여 넣은 것과 기계적으로
동일"** 하다. 즉 룰 파일로 나눠 둔 것 자체는 상주 비용을 **한 토큰도** 줄이지 않는다.

---

## 5. Skills · Subagents · Hooks — 역할 분담

### Skills

> "Skills live in `.claude/skills/` as folders of instructions, scripts, and resources that Claude
> loads dynamically. Each skill has a SKILL.md file with a name, description, and body."

> "Only the name and description load at session start; the full body loads when Claude invokes the
> skill, either through a slash command (`/code-review`) or by auto-matching the task."

> "On compaction, Claude Code re-injects invoked skills up to a total budget across all invoked
> skills. If you've invoked many skills during a session, the oldest ones drop first."

> "Tip: Instructions that are procedural, like deploy workflows, release checklists, or review
> processes, belong in a skill rather than in CLAUDE.md."

### Subagents

> "Subagents are similar to skills in that the name, description, and tool list load at session
> start, but the larger context within the body of the agent doesn't auto-invoke."

> "The subagent then runs in its own fresh context window, and the only thing that returns to your
> main session is the subagent's final message (often the aggregated result of many subtasks) plus
> metadata."

> "Tip: That isolation is one of the main reasons to reach for a subagent instead of a skill. Use a
> subagent when a side task like deep search, a log analysis pass, or a dependency audit would
> clutter your main conversation with intermediate results you won't reference again. Use a skill
> when you want the procedure to play out inside the main thread so you can see and steer each
> step."

### Hooks

> "Hooks are user-defined commands, HTTP endpoints, or LLM prompts that provide more deterministic
> control over Claude's behavior by firing on specific events in Claude's lifecycle like file
> edits, tool calls, or session start."

> "There are several types of hooks: command, HTTP, mcp_tool, prompt, and agent. All hooks are
> deterministically triggered. The first three execute deterministically while the latter two,
> prompt and agent, use Claude's judgment rather than a set of rules to determine the output."

> "Hooks have low context costs because the configuration or instruction lives outside the main
> context window."

> "Some hooks may have the output saved to the main context window. For example, a blocking hook's
> standard error is saved within context so Claude knows why the call was denied."

> "Tip: Use hooks for anything that should happen deterministically: running linters after edits,
> posting to Slack on completion, or blocking specific commands before they execute. A PreToolUse
> hook can inspect any tool call and exit code 2 to deny it."

> "They have low context cost because they are code that the harness runs rather than instructions
> to Claude that get loaded into context."

---

## 6. **핵심 절 — "When to use each method"** (다섯 개의 안티패턴, 원문 전체)

> "If you find yourself doing one of the following, you may want to consider an alternative
> location for your instructions:"

> "**"Every time X, always do Y" in CLAUDE.md.** If the behavior should happen reliably, like
> running prettier after every edit or posting to Slack on completion, use a hook in settings.json
> instead. The model choosing to run a formatter is different from the formatter running
> automatically."

> "**"Never do this" in CLAUDE.md.** When there's something that absolutely must not happen, an
> instruction is the wrong tool. Claude will follow the instruction most of the time, but when
> under pressure, in a long session or an ambiguous situation, or due to a prompt injection in a
> file accessed as part of the task, the model can fail to follow a prompted rule. A real guardrail
> needs to be deterministic, and the enforcement methods are hooks and permissions. A PreToolUse
> hook can inspect a call and exit with code 2 to block it. Managed settings go further: they are
> admin-deployed, cannot be overridden by a user's local config, and are the only way to enforce a
> deterministic, organization-wide guardrail."

> "**A 30-line procedure in CLAUDE.md.** Procedures belong in skills. CLAUDE.md is for facts Claude
> should hold all the time: build commands, monorepo layout, team conventions. A deployment runbook
> or a security review checklist should live in `.claude/skills/`, where the body loads only when
> invoked."

> "**An API-specific rule without paths.** If a rule only applies to `src/api/**`, scoping it with
> `paths:` keeps it out of context during unrelated work. An unscoped rule is mechanically
> identical to putting the content in CLAUDE.md: always loaded, always costing tokens."

> "**Writing personal preferences to a project-level CLAUDE.md file.** All file-based methods have
> a user-level counterpart loaded for every Claude Code session regardless of which repo you're in.
> Use local files for personal preferences (always use semantic commit messages). Keep
> project-level files for preferences that are team-wide but specific to a given codebase."

**해설(인용 아님)** — 이 다섯 항목이 이번 사이클의 **판정 체크리스트로 그대로 쓸 수 있는 유일한
공식 목록**이다. 이슈 #287 의 7원칙에 기계적으로 대면 다음이 걸린다:

| 안티패턴 | #287 에서 해당하는 곳 | 성격 |
|---|---|---|
| `"Never do this"` | 원칙 6 전체(승인 없는 파괴적·권한·공유상태 작업 금지) | **해당** — 공식 처방은 hooks + permissions |
| `"Every time X, always do Y"` | 원칙 5 "Run targeted checks first, then broaden" | 부분 해당 — 다만 조건부 판단이라 훅으로 환원되지 않는다 |
| 30줄 절차 | 원칙 5 의 독립 리뷰 2지점 | 부분 해당 — 절차 상세는 스킬로 내릴 수 있다 |
| `paths` 없는 룰 | 해당 없음(원칙은 전역이라 스코프가 없다) | 해당 없음 |
| 개인 취향 | 해당 없음 | 해당 없음 |

즉 **7원칙 중 "룰이 아닌 곳으로 내려야 한다"고 공식이 지목하는 것은 원칙 6 하나**다. 나머지는
판단 원칙이라 이 목록의 대상이 아니다. (원칙 6 을 지우라는 뜻이 아니다 — 공식 문장은 "지시로만
두면 보장되지 않는다"이지 "쓰지 말라"가 아니다. 처방은 **훅·권한과의 병행**이다.)

---

## 7. Output styles · 시스템 프롬프트 추가 — 지시가 많을수록 덜 지킨다

> "Because they sit in the system prompt, output styles carry the highest instruction-following
> weight of any method that we've covered so far and should be used judiciously."

> "By default, a custom output style drops all of this and Claude Code becomes more of a general
> assistant than a software engineer assistant."

> "Tip: Appending the system prompt is best for adding specific coding standards, output
> formatting, or domain-specific knowledge. Keep in mind that appending the system prompt has
> diminishing returns for adherence. **Generally, the more instructions you provide using this
> method, the less strictly Claude will follow them, particularly if any contradict.**"

**해설(인용 아님)**: 마지막 문장은 **개수 축의 희석을 명시한 첫 1차 출처 문장**이다. 기존 원장
§7 은 "규칙 *개수* 축은 어느 문서도 계량하지 않는다"고 적었는데, 계량은 여전히 없지만 **방향
주장은 이제 존재한다.** 단 적용 범위가 `--append-system-prompt` 로 한정돼 있음을 그대로 적어
둔다 — CLAUDE.md 에 대한 서술이 아니다. 그리고 조건절 `"particularly if any contradict"` 가
붙어 있어, 이 문장이 지목하는 실제 변수는 개수보다 **모순**이다.

---

## 8. 이 문서가 **안 주는** 것

- **담지 마라 목록** — 없다. 5개의 "다른 곳으로 옮겨라" 항목이 가장 가깝지만 이는 *배치*
  기준이지 *삭제* 기준이 아니다. (삭제 기준은 기존 원장의 best-practices ✅/❌ 표와
  `/doctor` 트림이 소유.)
- **원칙형 지시문에 대한 언급** — 없다. 이 글의 CLAUDE.md 용례는 전부 사실형(빌드 명령·레이아웃·
  컨벤션)이다. 이슈 #287 같은 **판단 원칙 문서**는 이 글의 분류 어디에도 명시적으로 매핑되지
  않는다 — 가장 가까운 것은 CLAUDE.md 행의 `"team norms"` 다.
- **여러 CLI 병존(AGENTS.md)** — 없다. (그 축은 `docs-resident-criteria.md` §3 이 소유:
  *"Claude Code reads CLAUDE.md, not AGENTS.md."*)
