# Anthropic 공식 문서 — 훅 vs permissions vs 프롬프트 지시 vs 스킬 판정 기준

수집일: 2026-08-02. 모든 인용은 **원문 verbatim(영어)** + 출처 URL.
추론으로 채운 내용 없음. 못 찾은 항목은 "해당 문서에 없음"으로 명시.

## 0. 도메인 이동 (중요 — 요청 URL 전부 301/308)

| 요청 URL | 실제 위치 | 상태 |
|---|---|---|
| `docs.claude.com/en/docs/claude-code/hooks-guide` | `code.claude.com/docs/en/hooks-guide` | 301 |
| `docs.claude.com/en/docs/claude-code/hooks` | `code.claude.com/docs/en/hooks` | 301 |
| `docs.claude.com/en/docs/claude-code/settings` | `code.claude.com/docs/en/settings` | 301 |
| `docs.claude.com/en/docs/claude-code/iam` | permissions 문서는 `code.claude.com/docs/en/permissions` | iam 경로 대신 permissions 사용 |
| `anthropic.com/engineering/claude-code-best-practices` | `code.claude.com/docs/en/best-practices` | 308 |

추가로 읽은 공식 페이지(요청 목록 밖이지만 이 질문의 **1차 SSOT**):
- `code.claude.com/docs/en/features-overview` — "Extend Claude Code: Understand when to use CLAUDE.md, Skills, subagents, hooks, MCP, and plugins"
- `code.claude.com/docs/en/security`
- `claude.com/blog/steering-claude-code-skills-hooks-rules-subagents-and-more` (docs 가 직접 링크하는 Anthropic 블로그)

---

## 1. 훅의 존재 이유로 공식 문서가 내세우는 것

### 1-1. 결정론(determinism) — LLM 의 선택에 맡기지 않는다

> "Hooks are user-defined shell commands. Claude Code runs them at specific points in its lifecycle, which gives you deterministic control: certain actions always happen rather than relying on the LLM to choose to run them. Use hooks to enforce project rules, automate repetitive tasks, and integrate Claude Code with your existing tools."
> — https://code.claude.com/docs/en/hooks-guide (문서 첫 문단)

> "For decisions that require judgment rather than deterministic rules, you can also use [prompt-based hooks](#prompt-based-hooks) or [agent-based hooks](#agent-based-hooks) that use a Claude model to evaluate conditions."
> — https://code.claude.com/docs/en/hooks-guide

레퍼런스 쪽 정의(결정론 프레이밍 없이 기계적으로만 정의):

> "Hooks are user-defined shell commands, HTTP endpoints, or LLM prompts that execute automatically at specific points in Claude Code's lifecycle. Use this reference to look up event schemas, configuration options, JSON input/output formats, and advanced features like async hooks, HTTP hooks, and MCP tool hooks."
> — https://code.claude.com/docs/en/hooks

### 1-2. "advisory 가 아니라 guarantee" (best-practices 의 핵심 문장)

> "### Set up hooks
> Use hooks for actions that must happen every time with zero exceptions."
> — https://code.claude.com/docs/en/best-practices (Tip 박스)

> "[Hooks](/docs/en/hooks-guide) run scripts automatically at specific points in Claude's workflow. Unlike CLAUDE.md instructions which are advisory, hooks are deterministic and guarantee the action happens."
> — https://code.claude.com/docs/en/best-practices

> "Claude can write hooks for you. Try prompts like *"Write a hook that runs eslint after every file edit"* or *"Write a hook that blocks writes to the migrations folder."* Edit `.claude/settings.json` directly to configure hooks by hand, and run `/hooks` to browse what's configured."
> — https://code.claude.com/docs/en/best-practices

### 1-3. features-overview 의 결정론/컨텍스트 대비표 (Hook vs Skill 탭 전문)

> | Aspect           | Hook                                                                              | Skill                                                                 |
> | ---------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
> | **Runs**         | A shell command, HTTP request, LLM prompt, or subagent                            | Instructions Claude reads and follows                                 |
> | **Triggered by** | [Lifecycle events](/docs/en/hooks#hook-events) such as `PostToolUse` or `SessionStart` | You typing `/<name>`, or Claude matching the description to your task |
> | **Determinism**  | Always fires on its event; the trigger is guaranteed                              | Claude interprets the instructions; outcome can vary                  |
> | **Context cost** | Zero unless the hook returns output                                               | Description loads each session; full content loads when used          |
> | **Best for**     | Linting after edits, blocking unsafe commands, logging, notifications             | Workflows that need reasoning, reference material, multi-step tasks   |
>
> — https://code.claude.com/docs/en/features-overview

---

## 2. 공식이 권장하는 훅 사용 사례 목록

### 2-1. hooks-guide 의 "What you can automate" 총론 + 실제 예제 섹션 제목 전량

> "Hooks let you run code at key points in Claude Code's lifecycle: format files after edits, block commands before they execute, send notifications when Claude needs input, inject context at session start, and more."
> — https://code.claude.com/docs/en/hooks-guide §What you can automate

같은 페이지의 예제 섹션(= 공식이 실제로 제시하는 use case 목록), 제목 verbatim:

1. "Get notified when Claude needs input" (`Notification`)
2. "Auto-format code after edits" (`PostToolUse` + `Edit|Write` → Prettier)
3. "Block edits to protected files" (`PreToolUse` + exit 2)
4. "Re-inject context after compaction" (`SessionStart` + `compact` matcher)
5. "Audit configuration changes" (`ConfigChange`)
6. "Reload environment when directory or files change" (`SessionStart` + `CwdChanged` / `FileChanged` + `CLAUDE_ENV_FILE`)
7. "Auto-approve specific permission prompts" (`PermissionRequest`)

3번 예제의 설명 verbatim:

> "Prevent Claude from modifying sensitive files like `.env`, `package-lock.json`, or anything in `.git/`. Claude receives feedback explaining why the edit was blocked, so it can adjust its approach."
> — https://code.claude.com/docs/en/hooks-guide

### 2-2. features-overview 의 기능 선택표 — Hook 행

> | **Hook** | Script, HTTP request, prompt, or subagent triggered by events | Automation that must run on every matching event | Run ESLint after every file edit |
> — https://code.claude.com/docs/en/features-overview §Match features to your goal

같은 표의 CLAUDE.md 행(대비용):

> | **CLAUDE.md** | Persistent context loaded every conversation | Project conventions, "always do X" rules | "Use pnpm, not npm. Run tests before committing." |

### 2-3. "언제 무엇을 추가하는가" 트리거 표 (Build your setup over time)

> | Trigger                                                                          | Add                                                                                            |
> | :------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------- |
> | Claude gets a convention or command wrong twice                                  | Add it to [CLAUDE.md](/docs/en/memory)                                                              |
> | You keep typing the same prompt to start a task                                  | Save it as a user-invocable [skill](/docs/en/skills)                                                |
> | You paste the same playbook or multi-step procedure into chat for the third time | Capture it as a [skill](/docs/en/skills)                                                            |
> | You keep copying data from a browser tab Claude can't see                        | Connect that system as an [MCP server](/docs/en/mcp)                                                |
> | Claude reads many files to find where a symbol is defined or used                | Install a [code intelligence plugin](/docs/en/discover-plugins#code-intelligence) for your language |
> | A side task floods your conversation with output you won't reference again       | Route it through a [subagent](/docs/en/sub-agents)                                                  |
> | **You want something to happen every time without asking**                       | **Write a [hook](/docs/en/hooks-guide)**                                                            |
> | A second repository needs the same setup                                         | Package it as a [plugin](/docs/en/plugins)                                                          |
>
> — https://code.claude.com/docs/en/features-overview (강조는 발췌자 표시, 원문 텍스트는 그대로)

바로 뒤 문장:

> "The same triggers tell you when to update what you already have. A repeated mistake or a recurring review comment is a CLAUDE.md edit, not a one-off correction in chat. A workflow you keep tweaking by hand is a skill that needs another revision."
> — https://code.claude.com/docs/en/features-overview

### 2-4. 검증 게이트로서의 Stop 훅 (best-practices)

> "* **As a deterministic gate**: a [Stop hook](/docs/en/hooks#stop) runs your check as a script and blocks the turn from ending until it passes. Claude Code overrides the hook and ends the turn after 8 consecutive blocks."
> — https://code.claude.com/docs/en/best-practices §Give Claude a way to verify its work

> "Each step trades setup for attention. The prompt version works on any task today. The `/goal` and Stop hook versions are what let an unattended run finish correctly without you."
> — https://code.claude.com/docs/en/best-practices

---

## 3. 훅 대신 permissions(allow/deny/ask) 로 하라는 경계 — **명시적으로 있다**

### 3-1. 가장 직접적인 문장: hard allow/deny 는 permission system 으로

> "The filter also fails open, running your hook regardless of pattern, when the Bash command can't be parsed. Because the filter is best-effort, use the [permission system](/docs/en/permissions) rather than a hook to enforce a hard allow or deny."
> — https://code.claude.com/docs/en/hooks-guide §Filter by tool name and arguments with the `if` field

(문맥: 훅의 `if` 필드가 permission rule 문법을 쓰지만 best-effort 라는 설명. `if` 는 **훅 실행 필터**이지 경계가 아니다.)

### 3-2. permissions 문서의 allow/ask/deny 정의 + 평가 순서

> "* **Allow** rules let Claude Code use the specified tool without manual approval.
> * **Ask** rules prompt for confirmation whenever Claude Code tries to use the specified tool.
> * **Deny** rules prevent Claude Code from using the specified tool."
> — https://code.claude.com/docs/en/permissions §Manage permissions

> "Rules are evaluated in order: deny, then ask, then allow. The first match in that order determines the outcome, and rule specificity doesn't change the order."
> — https://code.claude.com/docs/en/permissions

> "Deny rules behave differently depending on whether they name a tool or scope a pattern within one. A bare tool name like `Bash` removes the tool from Claude's context entirely, so Claude never sees it. ... A scoped rule like `Bash(rm *)` leaves the tool available and blocks matching calls when Claude attempts them."
> — https://code.claude.com/docs/en/permissions

### 3-3. **프롬프트/CLAUDE.md 는 경계가 아니다** — permissions 문서의 Note

> "Permission rules are enforced by Claude Code, not by the model. Instructions in your prompt or `CLAUDE.md` shape what Claude tries to do, but they don't change what Claude Code allows. To grant or revoke access, use `/permissions`, the rules described here, a [permission mode](/docs/en/permission-modes), or a [PreToolUse hook](#extend-permissions-with-hooks)."
> — https://code.claude.com/docs/en/permissions §Manage permissions (Note 박스)

→ 강제 수단으로 **셋만** 인정: permission rules / permission mode / PreToolUse 훅. 프롬프트는 셋 밖.

### 3-4. 훅과 permission 의 우선순위 — 훅은 조일 수만 있고 풀 수는 없다

> "`PreToolUse` hooks fire before any permission-mode check, in every [permission mode](/docs/en/permission-modes), including `dontAsk`. A hook that returns `permissionDecision: "deny"` blocks the tool even in `bypassPermissions` mode or with `--dangerously-skip-permissions`. This lets you enforce policy that users can't bypass by changing their permission mode."
> — https://code.claude.com/docs/en/hooks-guide §Hooks and permission modes

> "The reverse is not true: a hook returning `"allow"` doesn't bypass deny rules from settings, and it can't suppress the prompt for connector tools your organization set to `ask` or MCP tools marked `requiresUserInteraction`. **Hooks can tighten restrictions but not loosen them past what permission rules allow.**"
> — https://code.claude.com/docs/en/hooks-guide (원문 강조 없음, 마지막 문장 verbatim)

permissions 쪽 대응 서술:

> "Hook decisions don't bypass permission rules. Claude Code evaluates deny and ask rules regardless of what a PreToolUse hook returns: a matching deny rule blocks the call, and a matching ask rule still prompts even when the hook returned `"allow"` or `"ask"`. This preserves the deny-first precedence described in [Manage permissions](#manage-permissions), including deny rules set in managed settings."
> — https://code.claude.com/docs/en/permissions §Extend permissions with hooks

> "A blocking hook also takes precedence over allow rules. A hook that exits with code 2 stops the tool call before permission rules are evaluated, so the block applies even when an allow rule would otherwise let the call proceed. To run all Bash commands without prompts except for a few you want blocked, add `"Bash"` to your allow list and register a PreToolUse hook that rejects those specific commands."
> — https://code.claude.com/docs/en/permissions §Extend permissions with hooks

> "Returning `"allow"` skips the interactive prompt but doesn't override [permission rules](/docs/en/permissions#manage-permissions). If a deny rule matches the tool call, the call is blocked even when your hook returns `"allow"`. ... This means deny rules from any settings scope, including [managed settings](/docs/en/settings#settings-files), always take precedence over hook approvals."
> — https://code.claude.com/docs/en/hooks-guide §Structured JSON output

### 3-5. 세 수단을 나란히 놓고 고르게 하는 유일한 표 (permissions §Bash Warning)

Bash 인자 제약 패턴이 취약하다는 경고 뒤, 공식이 제시하는 대안 3종 verbatim:

> "For more reliable URL filtering, consider:
> * **Restrict Bash network tools**: use deny rules to block `curl`, `wget`, and similar commands, then use the WebFetch tool with `WebFetch(domain:github.com)` permission for allowed domains
> * **Use PreToolUse hooks**: implement a hook that validates URLs in Bash commands and blocks disallowed domains
> * **Add CLAUDE.md guidance**: describe your allowed curl patterns in `CLAUDE.md`. This shapes what Claude tries but doesn't enforce a boundary, so pair it with one of the options above"
> — https://code.claude.com/docs/en/permissions §Bash > (Warning 박스)

→ CLAUDE.md 는 **단독 사용 금지**로 명시("doesn't enforce a boundary, so pair it with one of the options above").

> "Bash permission patterns that try to constrain command arguments are fragile."
> — 같은 Warning 박스 첫 문장

### 3-6. permission rule 이 아예 못 잡는 영역 → sandbox 로 위임

> "Read and Edit deny rules apply to Claude's built-in file tools and to file commands Claude Code recognizes in Bash, such as `cat`, `head`, `tail`, and `sed`. They don't apply to arbitrary subprocesses that read or write files indirectly, like a Python or Node script that opens files itself. For OS-level enforcement that blocks all processes from accessing a path, [enable the sandbox](/docs/en/sandboxing)."
> — https://code.claude.com/docs/en/permissions §Read and Edit (Warning)

> "* **Permissions** control which tools Claude Code can use and which files or domains it can access. ...
> * **Sandboxing** provides OS-level enforcement that restricts the Bash tool's filesystem and network access. It applies only to Bash commands and their child processes."
> — https://code.claude.com/docs/en/permissions §How permissions interact with sandboxing

### 3-7. 훅으로도 못 덮는 구멍 — Bash 경유 파일 변경

> "Claude can also create or modify files by running shell commands through the `Bash` tool. If your hook must see every file change, such as for compliance scanning or audit logging, add a [`Stop`](/docs/en/hooks#stop) hook that scans the working tree once per turn. For per-call coverage instead, also match `Bash` and have your script list modified and untracked files with `git status --porcelain`."
> — https://code.claude.com/docs/en/hooks-guide §Filter hooks with matchers (Note)

---

## 4. SessionStart 류 컨텍스트 주입 훅에 대한 공식 입장

### 4-1. 레퍼런스의 SessionStart 정의 — **정적 컨텍스트면 CLAUDE.md 를 쓰라**

> "Runs when Claude Code starts a new session or resumes an existing session. Useful for loading development context like existing issues or recent changes to your codebase, or setting up environment variables. **For static context that doesn't require a script, use [CLAUDE.md](/docs/en/memory) instead.**"
> — https://code.claude.com/docs/en/hooks §SessionStart (강조는 발췌자)

### 4-2. hooks-guide 도 같은 경계를 반복

> "For injecting context on every session start, consider using [CLAUDE.md](/docs/en/memory) instead. For environment variables, see [`CLAUDE_ENV_FILE`](/docs/en/hooks#persist-environment-variables) in the reference."
> — https://code.claude.com/docs/en/hooks-guide §Re-inject context after compaction

→ 공식이 SessionStart 훅을 **권장하는 경우는 compaction 후 재주입**과 **스크립트가 필요한 동적 컨텍스트**(git log, 이슈 목록, env)로 한정된다:

> "When Claude's context window fills up, compaction summarizes the conversation to free space. This can lose important details. Use a `SessionStart` hook with a `compact` matcher to re-inject critical context after every compaction."
> — https://code.claude.com/docs/en/hooks-guide

> "Any text your command writes to stdout is added to Claude's context. This example reminds Claude of project conventions and recent work."
> — 같은 절

> "You can replace the `echo` with any command that produces dynamic output, like `git log --oneline -5` to show recent commits."
> — 같은 절

### 4-3. 주입 텍스트의 재개(resume) 동작 — stale 경고

> "Claude Code saves the injected text in the session transcript. For mid-session events like `PostToolUse` or `UserPromptSubmit`, when you resume with `--continue` or `--resume`, Claude Code replays the saved text rather than re-running the hook for past turns, so values like timestamps or commit SHAs become stale. `SessionStart` hooks run again on resume with `source` set to `"resume"`, or `"fork"` if you added `--fork-session`, so they can refresh their context."
> — https://code.claude.com/docs/en/hooks

### 4-4. 주입 메커니즘 (exit 0 stdout / additionalContext)

> "**Exit 0**: the hook reports no objection and the action proceeds normally. For a `PreToolUse` hook this doesn't approve the tool call: the normal [permission flow](/docs/en/permissions) still applies. For `UserPromptSubmit`, `UserPromptExpansion`, and `SessionStart` hooks, anything you write to stdout is added to Claude's context."
> — https://code.claude.com/docs/en/hooks-guide §Hook output

> "For `UserPromptSubmit` hooks, use `hookSpecificOutput.additionalContext` instead to inject text into Claude's context. Nest `additionalContext` inside `hookSpecificOutput`; if you place it at the top level of the JSON, Claude Code silently ignores it."
> — https://code.claude.com/docs/en/hooks-guide

> "Command hooks communicate through stdout, stderr, and exit codes only. They can't trigger `/` commands or tool calls. Text returned via `additionalContext` is injected as a system reminder that Claude reads as plain text."
> — https://code.claude.com/docs/en/hooks-guide §Limitations

### 4-5. SessionStart 는 차단할 수 없다

> "**Exit 2**: Claude Code blocks the action. ... Some events can't be blocked: for `SessionStart`, `Setup`, `Notification`, and others, exit 2 shows stderr to the user and execution continues."
> — https://code.claude.com/docs/en/hooks-guide §Hook output

---

## 5. 훅의 비용 / 위험

### 5-1. 보안 — **현재 문서에서 "Security considerations" 절을 찾지 못했다** (중요)

- hooks-guide 의 §Learn more 는 여전히 링크한다:
  > "* [Security considerations](/docs/en/hooks#security-considerations): review before deploying hooks in shared or production environments"
  > — https://code.claude.com/docs/en/hooks-guide
- 그런데 대상 페이지 `https://code.claude.com/docs/en/hooks` 를 **3회 서로 다른 방식으로 조회**(전체 추출 / 키워드 스윕 / `.md` 원문 요청)했으나 해당 절이 없다. `.md` 조회 결과 최상위 `##` 헤딩은 다음뿐:
  `Hooks reference` / `Hook lifecycle` / `Configuration` / `Hook input and output` / `Hook events`.
- 키워드 스윕 결과: `"own risk"` **0건**, `"malicious"` 0건, `"credentials"` 0건, `"sensitive"` 0건, `"snapshot"` 0건, `"path traversal"` 0건, `"quote shell variables"` 0건.
- **판정: 예전 판의 "USE AT YOUR OWN RISK / Security Best Practices / Configuration Safety" 문구를 이번 조회로는 확인하지 못함. 인용 불가 — 해당 문서에 없음(2026-08-02 조회 기준). 앵커 링크만 남아 있다(끊어진 앵커로 보임).**

security 페이지에서 훅 언급은 **딱 한 줄**:

> "* Audit or block settings changes during sessions with [`ConfigChange` hooks](/docs/en/hooks#configchange)"
> — https://code.claude.com/docs/en/security §Team security

security 페이지의 관련 원칙(훅 특정은 아님):

> "Claude Code only has the permissions you grant it. You're responsible for reviewing proposed code and commands for safety before approval."
> — https://code.claude.com/docs/en/security §User responsibility

### 5-2. 관리자 통제 = 훅이 위험 표면으로 취급된다는 간접 증거

> "`allowManagedHooksOnly` | (Managed settings only) Only managed hooks, SDK hooks, and hooks from plugins force-enabled in managed settings `enabledPlugins` are loaded. User, project, and all other plugin hooks are blocked."
> — https://code.claude.com/docs/en/settings §Available settings

> "Enterprise administrators can use `allowManagedHooksOnly` to block user, project, and plugin hooks. Hooks from plugins force-enabled in managed settings `enabledPlugins` are exempt, so administrators can distribute vetted hooks through an organization marketplace."
> — https://code.claude.com/docs/en/hooks

> "`allowedHttpHookUrls` | Allowlist of URL patterns that HTTP hooks may target. Supports `*` as a wildcard. When set, hooks with non-matching URLs are blocked. Undefined = no restrictions, empty array = block all HTTP hooks. Arrays merge across settings sources."
> — https://code.claude.com/docs/en/settings

> "`strictPluginOnlyCustomization` | Block skills, agents, hooks, and MCP servers from user and project sources, so they can only come from plugins or managed settings. `true` locks all four surfaces; an array such as `["skills", "hooks"]` locks only the named ones."
> — https://code.claude.com/docs/en/permissions §Managed-only settings

> "`disableAllHooks` | Disable all [hooks](/docs/en/hooks) and any custom [status line](/docs/en/statusline)"
> — https://code.claude.com/docs/en/settings

> "To disable hooks, set `"disableAllHooks": true` in your settings file. Hooks configured in managed settings still run unless `disableAllHooks` is also set there."
> — https://code.claude.com/docs/en/hooks-guide

### 5-3. 실행 시간 / 타임아웃

> "* Hook timeouts vary by type. Override per hook with the `timeout` field in seconds.
>   * `command`, `http`, `mcp_tool`: 10 minutes. `UserPromptSubmit` lowers these to 30 seconds, and `MessageDisplay` lowers them to 10 seconds.
>   * `prompt`: 30 seconds.
>   * `agent`: 60 seconds.
>   * [`SessionEnd`](/docs/en/hooks#sessionend) hooks of any type share a 1.5-second budget. If your settings set a longer per-hook `timeout`, Claude Code raises the budget to match, up to 60 seconds."
> — https://code.claude.com/docs/en/hooks-guide §Limitations

> "Defaults: 600 for `command`, `http`, and `mcp_tool`; 30 for `prompt`; 60 for `agent`."
> — https://code.claude.com/docs/en/hooks

> "All matching hooks run in parallel, and identical handlers are deduplicated automatically. Command hooks are deduplicated by command string and `args`, and HTTP hooks are deduplicated by URL."
> — https://code.claude.com/docs/en/hooks

### 5-4. 컨텍스트 비용 = 0 (훅의 최대 이점으로 공식이 내세우는 축)

> | **Hooks** | On trigger | Nothing (runs externally) | Zero, unless hook returns additional context |
> — https://code.claude.com/docs/en/features-overview §Context cost by feature

> "**What loads:** Nothing by default. Hooks execute outside the main conversation.
> **Context cost:** Zero, unless the hook returns output that gets added as messages to your conversation."
> — https://code.claude.com/docs/en/features-overview (Hooks 탭)

> "Hooks are ideal for side effects (linting, logging) that don't need to affect Claude's context."
> — 같은 탭 Tip

### 5-5. 복잡도 · 함정 (Limitations 절 전문)

> "* Command hooks communicate through stdout, stderr, and exit codes only. They can't trigger `/` commands or tool calls. ...
> * `PostToolUse` hooks can't undo actions since the tool has already executed.
> * `PermissionRequest` hooks fire when Claude Code is about to ask you for permission. ...
> * `Stop` hooks fire whenever Claude finishes responding, not only at task completion. They don't fire on user interrupts. API errors fire [StopFailure](/docs/en/hooks#stopfailure) instead.
> * When multiple `PreToolUse` hooks return [`updatedInput`](/docs/en/hooks#pretooluse) to rewrite a tool's arguments, the last one to finish takes effect. Since hooks run in parallel, the order is non-deterministic. Avoid having more than one hook modify the same tool's input."
> — https://code.claude.com/docs/en/hooks-guide §Limitations

> "When multiple hooks match the same event, every hook's command runs to completion before Claude Code merges the results. One hook returning `deny` doesn't stop sibling hooks from executing. Don't rely on one hook's `deny` to suppress side effects in another hook."
> — https://code.claude.com/docs/en/hooks-guide §Combine results from multiple hooks

> "After all matching hooks finish, Claude Code combines their outputs. For `PreToolUse` permission decisions, the most restrictive answer applies, in the order `deny`, `defer`, `ask`, `allow`."
> — 같은 절

> "Exit code 0 with no output means the hook has no decision to report, so the tool call continues through the normal [permission flow](/docs/en/permissions). The hook can deny the call, but staying silent doesn't approve it."
> — https://code.claude.com/docs/en/hooks

> "Claude Code overrides a Stop hook after it blocks eight times in a row without progress."
> — https://code.claude.com/docs/en/hooks-guide §Stop hook hits the block cap

> "Keep the matcher as narrow as possible. Matching on `.*` or leaving the matcher empty would auto-approve every permission prompt, including file writes and shell commands."
> — https://code.claude.com/docs/en/hooks-guide §Auto-approve specific permission prompts

> "Agent hooks are experimental. Behavior and configuration may change in future releases. For production workflows, prefer [command hooks](/docs/en/hooks#command-hook-fields)."
> — https://code.claude.com/docs/en/hooks-guide (Warning)

> "**Hooks** merge: all registered hooks fire for their matching events regardless of source."
> — https://code.claude.com/docs/en/features-overview §Understand how features layer

---

## 6. 훅 vs 프롬프트 지시 — 우선순위 비교 발언 (직접 인용)

### 6-1. features-overview — 가장 명시적인 문장

> "**Put guardrails in hooks.** An instruction like "never edit `.env`" in CLAUDE.md or a skill is a request, not a guarantee. A `PreToolUse` hook that blocks the edit is enforcement. If a rule must hold every time, make it a hook rather than a prompt instruction."
> — https://code.claude.com/docs/en/features-overview (Hook vs Skill 탭)

> "**Use a hook** when the action must happen the same way every time and doesn't need Claude to think. For example: format on save, reject `rm -rf /`, post a Slack message when a session ends."
> — 같은 탭

> "**Use a skill** when Claude should decide how to apply the steps, or when the content is knowledge rather than a script. For example: a `/release` checklist, your API style guide, a debugging playbook."
> — 같은 탭

> "**Hook output lands in context.** A `PostToolUse` hook that runs your linter feeds results back as text Claude reads; a `/fix-lint` skill tells Claude how to resolve them."
> — 같은 탭

### 6-2. best-practices — 프롬프트 룰을 훅으로 "전환하라"

> "* **The over-specified CLAUDE.md.** If your CLAUDE.md is too long, Claude ignores half of it because important rules get lost in the noise.
>   > **Fix**: Ruthlessly prune. If Claude already does something correctly without the instruction, delete it or convert it to a hook."
> — https://code.claude.com/docs/en/best-practices §Avoid common failure patterns

> "Keep it concise. For each line, ask: *"Would removing this cause Claude to make mistakes?"* If not, cut it. Bloated CLAUDE.md files cause Claude to ignore your actual instructions!"
> — https://code.claude.com/docs/en/best-practices §Write an effective CLAUDE.md

> "If Claude keeps doing something you don't want despite having a rule against it, the file is probably too long and the rule is getting lost. If Claude asks you questions that are answered in CLAUDE.md, the phrasing might be ambiguous. Treat CLAUDE.md like code: review it when things go wrong, prune it regularly, and test changes by observing whether Claude's behavior actually shifts."
> — 같은 절

> "You can tune instructions by adding emphasis (e.g., "IMPORTANT" or "YOU MUST") to improve adherence."
> — 같은 절

> "Run `/context` to confirm Claude loaded the file. CLAUDE.md is loaded every session, so only include things that apply broadly. For domain knowledge or workflows that are only relevant sometimes, use [skills](/docs/en/skills) instead. Claude loads them on demand without bloating every conversation."
> — 같은 절

### 6-3. CLAUDE.md vs Rules vs Skills 적재 대비표 (지연 로드 = `paths` frontmatter)

> | Aspect       | CLAUDE.md                           | `.claude/rules/`                                   | Skill                                    |
> | ------------ | ----------------------------------- | -------------------------------------------------- | ---------------------------------------- |
> | **Loads**    | Every session                       | Every session, or when matching files are opened   | On demand, when invoked or relevant      |
> | **Scope**    | Whole project                       | Can be scoped to file paths                        | Task-specific                            |
> | **Best for** | Core conventions and build commands | Language-specific or directory-specific guidelines | Reference material, repeatable workflows |
>
> "**Use rules** to keep CLAUDE.md focused. Rules with [`paths` frontmatter](/docs/en/memory#path-specific-rules) only load when Claude works with matching files, saving context."
> — https://code.claude.com/docs/en/features-overview (CLAUDE.md vs Rules vs Skills 탭)

> "**Rule of thumb:** Keep CLAUDE.md under 200 lines. If it's growing, move reference content to skills or split into [`.claude/rules/`](/docs/en/memory#organize-rules-with-claude/rules/) files."
> — 같은 페이지 (CLAUDE.md vs Skill 탭)

### 6-4. Anthropic 블로그 (docs 가 §Compare similar features 에서 직접 링크)

출처: https://claude.com/blog/steering-claude-code-skills-hooks-rules-subagents-and-more
섹션 구성: "The seven methods for delivering instructions / CLAUDE.md files / Rules / Skills / Subagents / Hooks / Output styles / Appending the system prompt / When to use each method / Getting started with Claude Code customization"

확보한 verbatim 단문 (전문 재현은 도구 측에서 거부됨 — 아래는 확보된 그대로):

> "Claude will follow the instruction most of the time, but when under pressure, in a long session or an ambiguous situation...the model can fail"

> "A real guardrail needs to be deterministic, and the enforcement methods are hooks and permissions"

> "If the behavior should happen reliably, like running prettier after every edit or posting to Slack on completion, use a hook"

> "The model choosing to run a formatter is different from the formatter running automatically"

> "A `PreToolUse` hook can inspect a call and exit with code 2 to block it"

> "Procedures belong in skills. CLAUDE.md is for facts Claude should hold all the time"

> "They have low context cost because they are code that the harness runs rather than instructions to Claude"

> "Hooks have low context costs because the configuration or instruction lives outside the main context window"

> "Managed settings...are admin-deployed, cannot be overridden by a user's local config"

⚠ 위 블로그 인용은 요약 모델이 각 인용을 짧게 잘라 반환한 것이다(생략부호 `...` 포함분 있음). 문장 전체 맥락이 필요하면 원문 재확인 필요.

---

## 7. 요청 항목별 커버리지 표 (못 찾은 것 명시)

| 요청 항목 | 결과 | 근거 위치 |
|---|---|---|
| 훅의 존재 이유(deterministic vs 프롬프트) | **확보** | §1 (hooks-guide 첫 문단, best-practices, features-overview) |
| 권장 사용 사례 목록 | **확보** | §2 (guide 예제 7종, features-overview 표 2개) |
| permissions 로 하라는 경계 | **확보 — 명시적 문장 있음** | §3-1 "use the permission system rather than a hook to enforce a hard allow or deny" |
| SessionStart 컨텍스트 주입 입장 | **확보 — "정적이면 CLAUDE.md 를 쓰라"** | §4-1, §4-2 |
| 훅의 보안 고려사항 | **해당 문서에 없음** (앵커 링크만 잔존, 본문 미발견) | §5-1 |
| 훅의 실행 시간·타임아웃 | **확보** | §5-3 |
| 훅의 복잡도·함정 | **확보** | §5-5 |
| 훅 vs 프롬프트 우선순위 문장 | **확보 — "make it a hook rather than a prompt instruction"** | §6-1 |
| `iam` 문서 | **경로 없음** — permissions 문서로 대체 | §0 |

---

## 8. 이 문서로 도출되는 판정 기준 (공식 문장에만 근거)

각 기준마다 근거 인용의 §번호를 붙였다. 공식 문서에 없는 규칙은 넣지 않았다.

1. **되돌릴 수 없거나 반드시 매번 성립해야 하는 규칙 → 훅** (§1-2 "zero exceptions", §6-1 "must hold every time").
2. **hard allow/deny 경계 → 훅이 아니라 permissions** (§3-1). 훅의 `if` 필터는 파싱 실패 시 fail-open 이다.
3. **훅과 permissions 는 대체재가 아니라 방향이 다르다** — 훅은 조이기만 가능(§3-4). deny 는 어떤 훅 allow 도 이긴다.
4. **프롬프트/CLAUDE.md 는 강제 수단 목록에서 제외돼 있다**(§3-3). 단독으로 쓰지 말고 다른 수단과 pair (§3-5).
5. **판단이 필요한 절차 → 스킬**, 생각이 필요 없는 반복 → 훅 (§6-1).
6. **정적 세션 컨텍스트 → CLAUDE.md, 동적/compaction 후 재주입 → SessionStart 훅** (§4-1·4-2).
7. **컨텍스트 상주 비용 회피가 목적이면 훅이 0** (§5-4) — 단 stdout 을 뱉는 순간 0 이 아니다.
8. **CLAUDE.md 가 길어져 룰이 묻히면, 그 룰은 훅으로 전환 대상**(§6-2).
9. **훅에도 사각지대가 있다** — Bash 경유 파일 변경은 matcher 로 안 잡히고 `Stop` 훅 스캔이 필요(§3-7). 프로세스 레벨은 sandbox 소관(§3-6).
10. **훅 도입은 조직 통제 표면을 늘린다** — 관리자는 `allowManagedHooksOnly`·`strictPluginOnlyCustomization`·`disableAllHooks` 로 사용자·프로젝트 훅을 통째로 차단할 수 있다(§5-2).
