# templates/codex/ — Codex CLI 배포 템플릿

> **Linked SPEC**: `docs/specs/codex-compat.md` Phase B
> **Linked ADR**: `docs/decisions/ADR-002-codex-hook-gap.md` v2
> **Codex Version**: 0.124.0+ (`codex_hooks=stable, multi_agent=stable, plugins=stable` 전제)

## 목적

Claude Code SSOT(`templates/`, `.claude/`)에서 Codex CLI 프로젝트로 **포맷 변환**하여 설치할 때 사용되는 템플릿 집합. 변환 로직은 `scripts/claude-to-codex.sh` (Phase C)에서 구현.

## 디렉토리 레이아웃

```
templates/codex/
├── README.md                        # 본 파일
└── config.toml.template             # 프로젝트 .codex/config.toml (hooks + mcp + sandbox)
```

`AGENTS.md` 의 템플릿은 이 디렉터리에 없다 — Codex · OpenCode · Antigravity 가 같은 파일을 읽으므로 템플릿 하나
(`templates/AGENTS.md.template`)를 깔린 CLI 집합으로 렌더한다(`src/agents-md-render.ts` · #642 · ADR-103).

훅 스크립트는 이 디렉터리에 없다 — 설치기가 `templates/hooks/session-start.sh` 를 포팅해
`<project>/.codex/hooks/` 에 놓는다(`src/codex/transform.ts` `HOOK_NAMES`). 자리표시자 사본을 두면
설치본에 안 나가는 파일이 리포에 남아 배선을 오독하게 한다(#438).

## 설치 대상 경로 (`setup-harness.sh --cli=codex` 실행 후)

| 템플릿 | 대상 경로 |
|--------|-----------|
| `../AGENTS.md.template` (세 CLI 공용) | `<project>/AGENTS.md` |
| `config.toml.template` | `<project>/.codex/config.toml` |
| `templates/hooks/session-start.sh` (포팅) | `<project>/.codex/hooks/session-start.sh` |
| 사용자 `~/.codex/config.toml`에 trust 등록 추가 | (D4 opt-in 확인) |

## Hook Event 매핑 (Claude → Codex)

| Claude | Codex event | Blockable | 제약 |
|--------|--------------------------|-----------|------|
| `SessionStart` | `SessionStart` (PascalCase + 중첩 `[[hooks.SessionStart.hooks]]`, #627) | ❌ | flat `session_start` 는 현행 codex-cli 가 무음 무시 · `timeout = 10`(초) 상한 — 빼면 Codex 기본 10분 |
| `UserPromptSubmit` | `user_prompt_submit` | ✅ (exit 2) | matcher 무시 |
| `PreToolUse` (Skill) | `pre_tool_use` matcher="Skill" | ✅ | **Bash 툴 한정 발화 (Issue #16732)** |
| `PreToolUse` (Write) | — | — | **Codex `sandbox_mode`로 이관** (ADR-002 v2 D3) |
| `PostToolUse` | `post_tool_use` | ❌ | Bash 한정 |
| `Stop` | `stop` | ✅ | — |

stdin JSON 필드(`session_id`, `cwd`, `tool_name`, `tool_input`, `hook_event_name`)는 Claude ↔ Codex 공통 → **shell 스크립트 본체 재사용**.

## 미구현 (후속 Phase)

- `setup-harness.sh --cli=codex` 경로 — Phase D
- Trust entry 확인 프롬프트 — Phase D
- `--cli=codex` dogfood 검증 — Phase F

## DO NOT CHANGE

- `.claude/` (Claude SSOT) — 절대 수정 금지
- `~/.codex/` 글로벌 — `setup-harness.sh`가 opt-in 확인 후에만 trust 등록
- `templates/AGENTS.md.template` 과 본 디렉토리 `config.toml.template` 의 플레이스홀더 토큰 (변환 모듈 계약)
