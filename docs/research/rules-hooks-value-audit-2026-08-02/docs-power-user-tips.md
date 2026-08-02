# Anthropic 공식 문서 — "Claude Code Power User Tips" (support.claude.com 14554000)

수집일: 2026-08-02 (audit-harness-fit 사이클에서 추가 — 본 디렉터리의 기존 2편과 같은 감사의
출처 (2)). URL: https://support.claude.com/en/articles/14554000-claude-code-power-user-tips

**증거 등급 주의**: 기존 문서의 #1 과 동일한 한계 — **WebFetch 요약 모델이 추출한 인용만
확보**했고 전문 렌더링을 눈으로 대조하지 않았다. 인용은 도구가 verbatim 으로 표시한 것을
그대로 옮겼다. 이 한계를 붙여서 쓸 것.

## 섹션 구조 (도구 보고)

Working in Parallel / Planning Before Building / Prompting Effectively / Learning With Claude /
CLAUDE.md and Memory / Verification — the #1 Tip / Commands, Skills, and Subagents / Hooks /
Permissions and Safety / Scheduled and Recurring Tasks / Mobile and Remote Control /
Tool Integrations (MCP) / Customizing Your Environment / SDK and Multi-Repo Work

## CLAUDE.md — 축적 루프

> "Share a single `CLAUDE.md` file at your repo root, checked into git, with the whole team
> contributing."

> "anytime Claude does something incorrectly, add it to `CLAUDE.md` so it knows not to repeat
> the mistake."

> "After every correction, end with: 'Update your `CLAUDE.md` so you don't make that mistake
> again.'"

> "Claude is very good at writing rules for itself."

## Hooks — 결정론 계층

> "Hooks let you deterministically run logic at points in the agent lifecycle."

이벤트별 용도 (도구가 표로 추출 — 각 셀은 verbatim 표시):

| 이벤트 | 용도 |
|---|---|
| `SessionStart` | "Dynamically load context each time you start Claude" |
| `PreToolUse` | "Log every bash command the model runs" |
| `PostToolUse` | "Auto-format code after Write/Edit to prevent CI failures" |
| `PermissionRequest` | "Route permission prompts to Slack, WhatsApp, or Opus for review" |
| `Stop` | "Run deterministic checks on long tasks" |
| `PostCompact` | "Re-inject critical instructions after context compression" |

## Permissions — 권장 강제층

> "Run `/permissions` to pre-allow common safe commands and check them into your team's
> `.claude/settings.json`."

> "This is the **recommended alternative** to skipping permissions entirely — you get fewer
> prompts while keeping an auditable allowlist."

> "Full wildcard syntax is supported—try `'Bash(bun run *)'` or `'Edit(/docs/**)'`."

## Skills — 상주→온디맨드 강등 기준

> "If you do something more than once a day, turn it into a skill."

> "Skills are checked into `.claude/skills/<name>/SKILL.md` and shared with the team"

## 컨텍스트 위생

> "Offload individual tasks to subagents to keep your main agent's context window clean and
> focused."
