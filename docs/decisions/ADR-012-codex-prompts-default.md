# ADR-012: Codex slash prompts default for cli=codex

- **Status**: Superseded by ADR-020 (2026-05-18, v26.64.0)
- **Date**: 2026-05-15
- **PR**: TBD (v26.46.0)
- **Supersedes**: 없음
- **Superseded by**: ADR-020 — `cli=codex` 시 자동 글로벌 default ON 동작 폐기. 모든 install Default=Project, Global 은 명시 opt-in.
- **Related**: ADR-002 (D16 정신 명시 — codex hook gap), ADR-004 (opencode 글로벌 미수정 원칙), ADR-013 (Wizard back nav 같은 PR)

## Context

`withCodexPrompts` 는 v0.7.0 도입 시 **opt-in** (`--with-codex-prompts` 명시 또는 interactive 체크박스). D16 정책 — 사용자 글로벌 (`~/.codex/`) 영역 침범은 명시 동의 필요.

문제:
1. Codex 사용자가 본 harness 설치 시 99% 의 경우 `/uzys-spec` 등 slash 를 원함 — opt-in 강제는 잉여 절차.
2. `withCodexPrompts` 가 interactive 옵션 list 의 1 항목 차지 — 카테고리 grouping (Phase C MVP) 에서 출처 라벨 의미 모호 ("본 프로젝트" 라벨이지만 글로벌 침범 강조 필요).
3. ADR-008 D16 의 의도 = "global 영역 무단 침범 금지". 그러나 `cli=codex` 명시 자체가 "Codex 와 연동" 의도 표명 — Codex prompts 글로벌 복사는 그 의도의 직접 귀결.

## Decision

`cli` 에 `codex` 포함 시 `withCodexPrompts` **default ON**. opt-out 은 `--no-codex-prompts`.

### 변경 동작

```ts
// commands/install.ts
withCodexPrompts:
  options.noCodexPrompts === true
    ? false
    : options.withCodexPrompts === true || validated.cli.includes("codex")
```

| 입력 | 결과 |
|---|---|
| `--cli claude` (codex 없음) | `withCodexPrompts: false` (의미 없음) |
| `--cli codex` | **`withCodexPrompts: true` (default ON)** |
| `--cli claude --cli codex --no-codex-prompts` | `withCodexPrompts: false` (opt-out) |
| `--cli claude --with-codex-prompts` (codex 없음) | `false` + stderr warning (cli 누락) |
| `--with-codex-prompts` (명시 + codex 있음) | `true` (legacy 호환) |

### Interactive 변경

- `OPTION_DEFS` 에서 `withCodexPrompts` entry **제거**. Step 2 옵션 list 에 안 보임.
- `cli` 선택 후 `cli.includes("codex")` 자동 평가 → `options.withCodexPrompts = true`.

## Alternatives

- **(a) D16 정책 유지 + opt-in 강제.** 기각: Codex 사용자 99% 가 매번 동일 선택. 잉여.
- **(b) cli=codex 시 prompt 한 번 더 ("Install Codex slash globally? [Y/n]").** 기각: 추가 step UX 부담. cli 선택 자체가 의도 표명.
- **(c) `~/.codex/prompts/` 가 아니라 project-scope (`.codex/prompts/`) 로 변경.** 기각: Codex 의 slash 인식 메커니즘이 글로벌 기반. Project-scope 는 Codex 자체 미지원.

## Consequences

### 긍정
- Codex 사용자 UX 단순화 — 매번 토글 안 함.
- `OPTION_DEFS` list 가 줄어 Step 2 가독성 ↑.
- `cli=codex` 의 의도와 결과 일치.

### 부정 (BREAKING)
- 기존 사용자가 `--cli claude --cli codex` 했을 때 이제 자동 글로벌 복사 — 무의식적 글로벌 침범 가능.
- D16 정책의 부분적 완화 — `cli=codex` 명시 = global 동의 로 해석.

### 완화
- `--no-codex-prompts` flag — 명시 opt-out.
- Release notes / CHANGELOG / USAGE.md migration 명시.
- `~/.codex/prompts/uzys-*.md` 6 파일 만 영향 — 작은 범위.

## Notes

본 변경의 사유 = 사용자 verbatim feedback (2026-05-15): "Codex slash commands [본 프로젝트] 기본으로 들어가야 하는 것 아님? 선택 처리할 거리는 아닌 것 같은데."
