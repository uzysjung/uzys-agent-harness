# ADR-017: Codex Prompts 자동 활성화를 withUzysHarness 와 묶음

- **Status**: Accepted
- **Date**: 2026-05-17
- **PR**: (pending v26.56.0)
- **Supersedes**: ADR-012 (Codex Prompts default — 부분 정정)

## Context

ADR-012 (v26.46.0) 에서 `cli=codex` 시 `codexPrompts` 자동 활성화 결정. 의도: Codex 사용자가 `/uzys-spec` 등 슬래시를 손쉽게 사용.

사용자 검증 (2026-05-17) 에서 모순 발견:

```
Step 3 선택:
  withUzysHarness = false  (사용자가 토글 안 함)
  cli = claude + codex     (codex 포함)

결과:
  Phase 1: .claude/commands/uzys/ 안 깔림  ← uzys-harness OFF
  Phase 3: ~/.codex/prompts/uzys-* 6 깔림   ← codexPrompts auto ON

→ Codex 에선 /uzys-spec 작동, Claude 엔 /uzys:spec 없음. 불일치.
```

`uzys-*` 슬래시 자체가 본 harness 의 6-Gate 워크플로우 산출물이라, `withUzysHarness=false` 이면 codexPrompts 도 의미 없음. 단독 codex prompts 가 global 에 깔리면:
- 사용자가 `.claude/commands/uzys/` 가 없는 프로젝트에서 `/uzys-spec` 만 보고 작동 기대 → 혼란
- D16 (global 영역 보호) 위반 — uzys 의도 없는 사용자에게 global cache 오염

## Decision

`codexPrompts` 자동 활성화 조건:
- **기존**: `cli.includes("codex")`
- **신규**: `cli.includes("codex") && withUzysHarness === true`

사용자 명시 `--with-codex-prompts` 는 여전히 작동 (legacy override, 강제 활성화).

`--no-codex-prompts` 는 그대로 (강제 비활성화).

## Alternatives

| 안 | 거부 사유 |
|---|---|
| 기존 유지 (`cli=codex` → 자동 ON) | 위 불일치 — 사용자 보고로 명시 확인 |
| `cli=codex` 시 무조건 ON + uzys 없으면 `~/.codex/prompts/` 만 skip (Phase 3 안 출력) | 자산 매핑이 옵션 1개 더 늘어남. 복잡도 증가 |
| `cli=codex` + `withUzysHarness` 둘 다 켰을 때 Step 3 에 codex-prompts 자산 명시 노출 | 옵션 폭증. 사용자 의도는 "uzys 켰으면 codex 도 자동" |

## Consequences

### Positive
- Codex 와 Claude 양쪽의 `/uzys-*` 슬래시 일관성 보장
- D16 (global 영역 opt-in) 정신 회복
- uzys-harness 토글 1번으로 양쪽 CLI 슬래시 동시 활성화

### Negative — BREAKING
- 기존 사용자가 `cli=codex` 만 켜고 `withUzysHarness=false` 였다면 v26.56.0 update 시 `~/.codex/prompts/uzys-*` 자동 복사 안 됨
- Migration: README 안내 — Codex 슬래시 원하면 `--with-uzys-harness` 또는 `--with-codex-prompts` 명시

### Migration
- Update mode 에서 `withUzysHarness=false` + 이미 깔린 `~/.codex/prompts/uzys-*` 가 있으면 prune 여부? 본 ADR 에선 prune 안 함 (D16 — global 영역 자동 삭제 금지). 사용자 수동 정리
