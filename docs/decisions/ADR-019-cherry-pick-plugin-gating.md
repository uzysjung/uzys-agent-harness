# ADR-019: Cherry-pick × Plugin opt-out gating (C1/C2/C3 분류 체계)

- **Status**: Accepted
- **Date**: 2026-05-17
- **PR**: (pending v26.58.0)
- **Supersedes**: ADR-016 의 cherry-pick gating 의미 (opposite 방향 정정)

## Context

v26.55.0 (ADR-016) 의 `withEcc=true` 시 두 가지가 함께 발생:
- **A. cherry-pick 복사** — `templates/agents/{code-reviewer, ...}.md` 등 → `.claude/` 복사
- **B. ECC plugin install** — `ecc@ecc` from `affaan-m/everything-claude-code` 외부 plugin

이 두 가지가 같은 옵션에 묶이면서 mental model 깨짐. ECC plugin 단독으로 충분 (`ecc@ecc` install 만으로 code-reviewer / security-review / continuous-learning-v2 등 작동) — **cherry-pick 은 plugin 의 fallback** 으로 작동해야 의미가 명확해진다.

### 발견된 모델 불일치

| 의도 (ADR-016 작성 시) | 실제 (사용 후 검증) |
|---|---|
| ECC 사용자에게 cherry-pick + plugin 둘 다 보장 | plugin 단독으로 충분, cherry-pick 은 중복 |
| `withEcc=true` 시 cherry-pick 도 install (보강) | plugin OFF 사용자 (cli=claude only) 에게 fallback 으로 가치 |

→ cherry-pick gating 의미를 **opposite** 으로 정정: plugin OFF 시 fallback, plugin ON 시 skip.

## Decision

### 1. opt-out gating (BREAKING vs ADR-016)

`AssetSpec.withEcc` 의 의미를 v26.58.0 부터 **"ECC plugin 사용 의사"** 로 정의.

| `withEcc` 값 | cherry-pick (C2) | ECC plugin |
|---|---|---|
| `false` (default) | install (fallback) | install 안 함 |
| `true` | skip | install (`ecc@ecc`) |

### 2. C1/C2/C3 분류 체계 (SSOT)

본 ADR 이 분류 정책의 SSOT. 항목 표는 `docs/PRD/v26-58-cherry-pick-plugin-gating.md §6`.

| 분류 | 정의 | manifest 적용 | 예시 |
|---|---|---|---|
| **C1** | plugin 으로 완전 중복 — 매핑 자체 삭제 | (해당 항목 없음) | — |
| **C2** | plugin OFF 시 fallback 가치 — opt-out gating | `applies: (s) => !s.withEcc && <track>` | code-reviewer, security-reviewer, strategic-compact, e2e-testing 등 19개 |
| **C3** | modified=true 또는 별개 source — plugin 무관 항상 install | `applies: <track only>` (withEcc 무관) | continuous-learning-v2 (modified), gsd-gates-taxonomy (별개), karpathy-gate-hook (modified+별개) |

### 3. 89 KEEP 누락 6개 처리

`scripts/prune-ecc.sh` 의 KEEP_ITEMS 에 다음 6개 추가:
- `security-reviewer`, `silent-failure-hunter`, `build-error-resolver`
- `e2e-testing`, `agent-introspection-debugging`, `nextjs-turbopack`

**이유**: 본 6개가 C2 로 분류되어 `withEcc=false` 시는 cherry-pick 으로 install 되지만, `withEcc=true` 시 plugin cache prune 단계에서 사라지는 구멍이 있었음. KEEP 추가로 plugin ON 사용자도 보존.

총 KEEP: 92 → 98건.

## Alternatives

| 안 | 거부 사유 |
|---|---|
| C1 강제 분류 (단순 중복 항목 별도 분리) | 22개 전부 plugin OFF 시 가치 있음 → C1 후보 자체 없음 |
| C2 항목 항상 install (양쪽 보장) | plugin ON 시 cherry-pick + plugin 중복. 본 cycle 의 "갈음" 원칙 위반 |
| 89 KEEP 추가 없이 별도 cycle 로 처리 | `withEcc=true` 사용자가 6개 손실. UX 손상 |
| `withEcc` 옵션 의미를 반전시키지 않고 새 옵션 (`--with-cherry-pick`) 도입 | 옵션 폭증. 사용자 mental model 더 복잡 |

## Consequences

### Positive

- cherry-pick 의 의미가 명확: "plugin OFF 사용자를 위한 fallback"
- `withEcc` 한 옵션으로 plugin + cherry-pick 동시 토글 (mental model 단순)
- C1/C2/C3 분류로 manifest 매핑 정책이 코드 주석 + ADR + PRD 표 셋이 동기화
- KEEP 6개 추가로 plugin ON 사용자도 손실 없음

### Negative — BREAKING

- v26.55.0~v26.57.1 의 `withEcc=true` 사용자가 update 시:
  - cherry-pick C2 19개가 `.claude/` 에서 prune 됨 (Update mode 의 orphan prune)
  - 실제 기능은 plugin 으로 그대로 작동 → functional 무영향
  - 단 mental model 충격 (예: `.claude/agents/code-reviewer.md` 가 사라지면 사용자가 "잃었다" 고 느낄 수 있음)
- BREAKING 명시는 CHANGELOG 와 install 출력 description 으로 cover

### Known Limitations (본 cycle scope 밖)

- `templates/skills/market-research`, `templates/skills/nextjs-turbopack`, `templates/skills/investor-materials`, `templates/skills/investor-outreach` 4개는 manifest 매핑이 Track-only (withEcc 무관). PRD §6 분류상은 C2 이지만 ADR-016 작성 시 매핑 누락. 본 cycle 은 PRD AC2 명시한 `*_ECC` 변수만 변경 — follow-up cycle 에서 일관성 정정.
- `templates/hooks/karpathy-gate.sh` 는 manifest 의 `ALWAYS_HOOKS` 에 등록 안 됨 (cherrypicks.lock 에는 있음). 별도 cycle 검토 대상.

## Operations — 새 cherry-pick 추가 시 절차

새 cherry-pick 을 `cherrypicks.lock` 에 추가할 때:

1. **분류 결정**:
   - 본 cherry-pick 이 ECC plugin 안에도 존재하는가?
     - **No** → C3 (별개 source, 항상 install)
     - **Yes, but modified** → C3 (modified=true, plugin 으로 갈음 불가)
     - **Yes, modified=false, plugin 단독으로 충분** → C2 (plugin OFF 시 fallback)
     - 만약 plugin OFF 사용자에게도 가치 0 이라면 → C1 (cherry-pick 자체 불필요, lock 에서 제거)
2. **manifest 변경**:
   - C2 → 적절한 `*_ECC` 변수에 추가. `applies: (s) => !s.withEcc && <track>`
   - C3 → 별도 매핑 (예: `MODIFIED_COMMON_SKILL_DIRS`). `applies: <track only>`
3. **89 KEEP 검토** (C2 만):
   - `scripts/prune-ecc.sh` 의 KEEP_ITEMS 에 본 cherry-pick 의 plugin path basename 포함 여부 확인. 누락 시 추가.
4. **PRD §6 표 갱신**:
   - `docs/PRD/v26-58-cherry-pick-plugin-gating.md §6` 에 행 추가.
5. **tests/manifest.test.ts**:
   - `withEcc=true` 시 매핑 결과 0, `withEcc=false` 시 1 검증 (C2) / 양쪽 1 검증 (C3).

## Migration (v26.55.0~v26.57.1 → v26.58.0)

- `withEcc=true` 로 install 한 사용자:
  - update 실행 시 cherry-pick C2 19개가 orphan prune 됨
  - ECC plugin 은 그대로 (functional 무영향)
  - 6개 (security-reviewer / silent-failure-hunter / build-error-resolver / e2e-testing / agent-introspection-debugging / nextjs-turbopack) 는 KEEP 추가로 plugin cache 에 보존
- `withEcc=false` (default) 사용자:
  - cherry-pick C2 19개 그대로 유지 (변동 없음)
  - C3 cl-v2 가 새로 always install — 단 cherry-pick 자체는 v26.55.0 시점부터 templates 에 존재했음. 매핑만 변경됨

## Related

- ADR-016 (v26.55.0) — cherry-pick gating 도입. 본 ADR 이 의미 정정.
- ADR-009 (v26.42.0) — addy agent-skills opt-in.
- `docs/PRD/v26-58-cherry-pick-plugin-gating.md` — 본 cycle PRD.
- `.dev-references/cherrypicks.lock` — cherry-pick 22개 manifest.
- `scripts/prune-ecc.sh` — KEEP 98개 정책.
