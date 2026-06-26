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
├── AGENTS.md.template               # 프로젝트 AGENTS.md (CLAUDE.md에서 생성)
├── config.toml.template             # 프로젝트 .codex/config.toml (hooks + mcp + sandbox)
└── hooks/                           # Shell 스크립트 (.claude/hooks/ 재사용 가능)
    ├── README.md                    # 포팅 상태 + Event 매핑
    ├── hito-counter.sh              # user_prompt_submit
    ├── session-start.sh             # session_start
    └── uncommitted-check.sh         # post_tool_use (Bash 한정)
```

## 설치 대상 경로 (`setup-harness.sh --cli=codex` 실행 후)

| 템플릿 | 대상 경로 |
|--------|-----------|
| `AGENTS.md.template` | `<project>/AGENTS.md` |
| `config.toml.template` | `<project>/.codex/config.toml` |
| `hooks/*.sh` | `<project>/.codex/hooks/*.sh` |
| 사용자 `~/.codex/config.toml`에 trust 등록 추가 | (D4 opt-in 확인) |

## Hook Event 매핑 (Claude → Codex)

| Claude | Codex event (snake_case) | Blockable | 제약 |
|--------|--------------------------|-----------|------|
| `SessionStart` | `session_start` | ❌ | — |
| `UserPromptSubmit` | `user_prompt_submit` | ✅ (exit 2) | matcher 무시 |
| `PreToolUse` (Skill) | `pre_tool_use` matcher="Skill" | ✅ | **Bash 툴 한정 발화 (Issue #16732)** |
| `PreToolUse` (Write) | — | — | **Codex `sandbox_mode`로 이관** (ADR-002 v2 D3) |
| `PostToolUse` | `post_tool_use` | ❌ | Bash 한정 |
| `Stop` | `stop` | ✅ | — |

stdin JSON 필드(`session_id`, `cwd`, `tool_name`, `tool_input`, `hook_event_name`)는 Claude ↔ Codex 공통 → **shell 스크립트 본체 재사용**.

## 미구현 (후속 Phase)

- `AGENTS.md.template` 본문 — CLAUDE.md에서 변환 (Phase C)
- `hooks/*.sh` 본체 — `.claude/hooks/` 에서 포팅 (Phase C)
- `setup-harness.sh --cli=codex` 경로 — Phase D
- Trust entry 확인 프롬프트 — Phase D
- `--cli=codex` dogfood 검증 — Phase F

## DO NOT CHANGE

- `.claude/` (Claude SSOT) — 절대 수정 금지
- `~/.codex/` 글로벌 — `setup-harness.sh`가 opt-in 확인 후에만 trust 등록
- 본 디렉토리 `AGENTS.md.template`과 `config.toml.template`의 플레이스홀더 토큰 (Phase C 변환 스크립트 계약)
