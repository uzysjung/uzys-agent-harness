# templates/codex/hooks/ — Codex Hook 스크립트

> **Linked**: `docs/decisions/ADR-002-codex-hook-gap.md` v2 D1~D5
> **Transform**: `scripts/claude-to-codex.sh` (Phase C)가 `.claude/hooks/*.sh`를 대부분 그대로 포팅

## Hook 매핑 요약

| Codex event (snake_case) | 스크립트 | 원본 (Claude) | 상태 |
|--------------------------|----------|---------------|------|
| `session_start` | `session-start.sh` | `.claude/hooks/session-start.sh` | Phase C 포팅 예정 |
| `user_prompt_submit` | `hito-counter.sh` | `.claude/hooks/hito-counter.sh` | Phase C 포팅 예정 |
| `post_tool_use` | `uncommitted-check.sh` | `.claude/hooks/uncommitted-check.sh` | Phase C 포팅 예정 |
| ❌ (hook 사용 안 함) | ❌ | `.claude/hooks/protect-files.sh` | **Codex sandbox로 이관 (ADR-002 v2 D3)** |

## stdin/stdout 호환

Claude Code hook 스크립트가 stdin에서 읽는 필드는 Codex에서도 동일 이름으로 제공됨. 본체 수정 불필요:

- stdin 공통: `session_id, transcript_path, cwd, permission_mode, hook_event_name` (PascalCase)
- stdin 이벤트별: `tool_name, tool_input, tool_use_id, prompt, source, model`
- stdout: `systemMessage, additionalContext, updatedInput, decision (allow|deny|ask), reason, continue`
- exit 0 = 성공 / exit 2 = blockable 차단 (stderr → reason) / 기타 = non-blocking error

## 치명적 제약 — Issue #16732

`pre_tool_use` / `post_tool_use` 가 Bash 툴에만 발화. ApplyPatch(파일 쓰기)에 대해선 fire 안 함.

**영향**:
- `uncommitted-check.sh` — 파일 저장 후 감지가 필요한 경우 ApplyPatch 이후 상태는 못 잡음. Bash 커밋/저장 경로는 잡힘. Codex `stop` 이벤트(turn 종료) 추가 등록으로 보완 가능 (Phase C 설계 옵션)

## 미구현

- 각 `.sh` 스크립트 본체 — Phase C에서 `.claude/hooks/`에서 포팅
- 포팅 과정에서 Codex 전용 env var(`CODEX_HOME` 등) 대응 필요 시 wrapper 추가

## 보안

Codex `sandbox_mode = "workspace-write"` + `approval_policy = "on-request"` 가 파일 쓰기 1차 방어. Hook 스크립트는 보조 역할.
