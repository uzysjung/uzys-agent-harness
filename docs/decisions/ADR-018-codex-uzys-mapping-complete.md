# ADR-018: Codex 매핑 전체 (skill/prompt/global) 를 withUzysHarness 와 묶음

- **Status**: Accepted
- **Date**: 2026-05-17
- **PR**: (pending v26.57.0)
- **Extends**: ADR-017 (이전엔 global `~/.codex/prompts/uzys-*` 만 묶음)

## Context

ADR-017 (v26.56.0) 에서 `~/.codex/prompts/uzys-*.md` (global) 만 `withUzysHarness` 와 묶었다. 사용자 검증 (2026-05-17) 에서 추가 모순 발견:

```
Step 3 선택:
  withUzysHarness = false  (사용자가 토글 안 함)
  cli = claude + codex     (codex 포함)

Phase 1 결과:
  .claude/commands/uzys/  → 안 깔림 ✓ (예상)
  ~/.codex/prompts/uzys-* → 안 깔림 ✓ (ADR-017 적용됨)

Phase 3 (Codex artifacts) 결과:
  .agents/skills/uzys-*/SKILL.md  → **6 개 깔림** ✘ (모순)
  .codex/prompts/uzys-*.md         → **6 개 깔림** ✘ (모순)
```

`runCodexTransform` 이 cli=codex 만 보고 무조건 uzys-* skill/prompt 생성. ADR-017 의 의도 (withUzysHarness=false → uzys 산출물 0) 와 불일치.

uzys-* 슬래시는 본 harness 의 6-Gate 워크플로우 산출물. 4 위치 (project/global × claude/codex) 모두 같은 conditional 가져야 함.

## Decision

Codex 의 모든 uzys-* 매핑을 `withUzysHarness` 와 묶음:

| 위치 | 산출물 | 조건 |
|---|---|---|
| `.claude/commands/uzys/*.md` (project) | 7 slash commands | `withUzysHarness` (기존 매핑) |
| `.agents/skills/uzys-*/SKILL.md` (project) | 6 Codex skill files | **신규**: `cli=codex && withUzysHarness` |
| `.codex/prompts/uzys-*.md` (project) | 6 Codex prompt files | **신규**: `cli=codex && withUzysHarness` |
| `~/.codex/prompts/uzys-*` (global) | 6 markdown copy | `cli=codex && withUzysHarness` (ADR-017) |

구현:
- `CodexTransformParams` 에 `withUzysHarness?: boolean` 추가 (default false — 안전)
- `runCodexTransform` 의 step 4 (skills) + step 5 (prompts) 를 `if (withUzysHarness)` gating
- AGENTS.md / config.toml / hooks 는 codex baseline 으로 유지 (cli=codex 기본 매핑)
- `installer.ts` 가 `spec.options.withUzysHarness` 를 codex transform 에 전달

## Alternatives

| 안 | 거부 사유 |
|---|---|
| ADR-017 만 유지 (global 만 묶고 project 는 안 묶음) | 사용자 검증으로 모순 확인. 4 위치 일관성 필수 |
| `cli=codex` 만으로 uzys 산출물 — uzys-harness 무관 | 기존 ADR-017 결정과 충돌. 위치별 다른 조건 = 사용자 mental model 깨짐 |
| codex transform 의 uzys 부분을 별도 함수로 분리 + caller 가 결정 | 같은 결정. 호출 caller (installer.ts) 가 같은 spec 로 결정하므로 분리 불필요 |

## Consequences

### Positive
- 4 위치 (claude project + codex skill + codex prompt + codex global) 모두 같은 토글 1번으로 일관 처리
- `cli=codex` 단독 사용 (uzys-harness 없이) 시 codex 의 uzys-* artifacts 0 — D16 (글로벌) + project 양쪽 모두 보호
- 사용자 mental model 단순화: "uzys-* 슬래시 원하면 withUzysHarness 한 곳에서 결정"

### Negative — BREAKING
- 기존 `cli=codex` 사용자 (uzys-harness 안 켰던 사람) 가 v26.57.0 update 시 `.agents/skills/uzys-*` + `.codex/prompts/uzys-*` 도 안 깔림
- Update mode 의 prune 가 이전 install 의 uzys 디렉토리 자동 정리하지 않음 — 사용자 수동 정리 필요 (또는 후속 cycle 에 prune 추가)

### Migration
- README + CHANGELOG 안내 — Codex uzys 슬래시 원하면 `--with-uzys-harness` 명시
- 호환 옵션 `--with-codex-prompts` 는 여전히 작동 (codex global 만, project skills/prompts 는 별도 옵션 없음)

## Verification

Test (tests/codex/transform.test.ts):
- `withUzysHarness=true` → skillFiles 6 + promptFiles 6
- `withUzysHarness=false` → skillFiles 0 + promptFiles 0 + 디렉토리 미생성
- default (param 누락) → withUzysHarness=false 동작
