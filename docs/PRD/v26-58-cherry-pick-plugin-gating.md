# v26.58.0 — Cherry-pick × Plugin Gating

> **Status**: Approved (사용자 가이드 2026-05-17)
> **Type**: Refactor + BREAKING
> **Supersedes**: ADR-016 부분 (cherry-pick 항상 install → plugin install 시 skip)
> **Predecessor**: v26.57.1
> **북극성**: cherry-pick 은 plugin 의 fallback. plugin 깔리면 cherry-pick 은 의미 없음.

---

## 1. Context (Why)

### 발견된 문제

v26.55.0 (ADR-016) 의 `withEcc=true` 시:
- **A. cherry-pick 복사** — `templates/agents/{code-reviewer, ...}.md` 등 22개 → `.claude/` 복사
- **B. ECC plugin install** — `ecc@ecc` from `affaan-m/everything-claude-code` 외부 plugin

두 가지가 같은 옵션에 묶임 → **사용자 mental model 깨짐**:

> 사용자: "ECC plugin 설치하면 저절로 되는 거 아닌가? 왜 cherry-pick 도 복사하지?"

정확한 답: **맞음. plugin install 만 하면 code-reviewer / security-review / continuous-learning-v2 등 다 작동**. cherry-pick 복사는 history 누적.

### 진짜 의미

cherry-pick 의 본래 역할 = **plugin OFF 시에도 가치 있는 것 미리 templates 에 정제 복사**. plugin 시대 (v26.42.0 addy-agent-skills opt-in / v26.55.0 ECC opt-in) 가 오면서 본래 의미 흐려짐.

### 의도된 새 모델

| plugin 상태 | cherry-pick 처리 |
|---|---|
| OFF (default) | cherry-pick **install** (plugin 없으니 fallback 으로 가치) |
| ON | cherry-pick **skip** (plugin 으로 갈음. 중복 방지) |

즉 **opposite 의 gating** — 이전과 정반대.

---

## 2. PRD (What)

### Goals

1. cherry-pick 22개의 plugin OFF 가치 명확히 평가
2. plugin install 여부에 따라 cherry-pick install 동적 결정 (manifest gating)
3. 설계 명시 — ADR 작성. 다음 cycle 에서 잊지 않도록

### Non-Goals

- ECC plugin 자체 변경
- prune-ecc.sh 의 89-KEEP 정책 변경 (별도 검토)
- 코드 자체 정리 (`templates/agents/code-reviewer.md` 파일은 유지 — gating 으로만 결정)

### AC (Acceptance Criteria)

#### AC1 — Cherry-pick 분류 완료

cherrypicks.lock 의 22개 → 3 카테고리:
- **C1. plugin 으로 완전 대체 가능** (plugin ON 시 cherry-pick skip — 단순 중복)
- **C2. plugin OFF 시 default 가치 (cli=claude 단독 사용자)** (plugin OFF 시만 install)
- **C3. modified=true 또는 트랙 분기 valid** (특수 case — plugin ON 이어도 cherry-pick 유지 필요)

분류 결과를 docs/PRD/v26-58-cherry-pick-classification.md (또는 본 파일 부록) 에 표로 명시.

#### AC2 — Manifest gating 로직

`src/manifest.ts` 의 `*_ECC` 매핑 (ADR-016 추가) 의 `applies` 함수 변경:

| 현재 (v26.55.0) | 신규 (v26.58.0) |
|---|---|
| `applies: (s) => Boolean(s.withEcc)` | C1: `applies: () => false` (제거 or unused 표시) |
| 동일 | C2: `applies: (s) => !s.withEcc` (plugin OFF 시만 install) |
| 동일 | C3: `applies: (s) => Boolean(s.withEcc)` (그대로) |

`AssetSpec.withEcc` 의미가 **opposite**:
- 이전: "ECC opt-in → cherry-pick 도 같이 install"
- 신규: "ECC plugin opt-in → cherry-pick 은 skip (plugin 으로 갈음)"

#### AC3 — addy plugin 동일 로직

addy agent-skills (`withAddyAgentSkills`) 도 동일 패턴 — cherry-pick 0개라 영향 없지만, **설계 일관성** 위해 manifest 에 동일 패턴 적용 (future-proof).

#### AC4 — install 출력 정확성

Phase 1 출력에 "ECC opt-in 시 / OFF 시" 매핑 명시:
- OFF: "cherry-pick fallback 적용. code-reviewer 등 4 agents + 11 skills 복사"
- ON: "ECC plugin 사용. cherry-pick skip"

#### AC5 — ADR 명시

ADR-019 작성 — supersedes ADR-016 부분. 미래 cycle 에서 같은 실수 안 하도록.

#### AC6 — 회귀 0 + 신규 test

- AssetSpec.withEcc=true 시 cherry-pick (C1, C2) install **안 됨**
- AssetSpec.withEcc=false 시 C2 install **됨**, C3 install **안 됨**
- modified 인 continuous-learning-v2 (C3) 별도 검증

---

## 3. Plan (How) — 3 Phase

### Phase 1 — 분류 (READ-ONLY)

**Task 1.1**: cherrypicks.lock 22개 vs ECC marketplace cover 매핑 검증

각 cherry-pick 에 대해:
- ECC plugin 의 어디에 있는지 (path)
- 89 KEEP 리스트 안에 있는지 (`scripts/prune-ecc.sh` 의 KEEP_ITEMS 변수)
- plugin OFF 시 default 가치 등급 (high/med/low)
- 트랙 매핑 의의

결과 표 — 본 PRD 부록 §6.

**Task 1.2**: addy agent-skills 의 skill 목록 vs 우리 cherry-pick 비교

addy 출처 cherry-pick = 0개 확인. 단 미래 cherry-pick 가능성 평가.

**Task 1.3**: 분류 합의

각 cherry-pick → C1 / C2 / C3 분류 확정. PRD §6 표 update.

### Phase 2 — 설계 + 코드

**Task 2.1**: `src/manifest.ts`
- `*_ECC` 매핑의 `applies` 함수 의미 변경
- C1: 매핑 자체 제거 또는 `applies: () => false` (코드 cleanup)
- C2: `applies: (s) => !s.withEcc` (opt-out)
- C3: `applies: (s) => Boolean(s.withEcc)` (그대로 또는 별도 옵션)

**Task 2.2**: `src/installer.ts`
- manifestSpec 의 `withEcc` field 의미 update 주석

**Task 2.3**: `src/commands/install.ts` — Phase 1 출력 description 정정
- "withEcc=true 시 cherry-pick skip" / "withEcc=false 시 cherry-pick fallback 적용"

**Task 2.4**: `docs/decisions/ADR-019-cherry-pick-plugin-gating.md` 작성
- ADR-016 (ECC opt-in gating) 의 의미 정정 명시
- supersede 표시 + Migration 안내

**Task 2.5**: `docs/specs/v26-58-cherry-pick-plugin-gating.md` — 본 PRD 의 SPEC 측면 (구현 디테일)

### Phase 3 — Tests + 검증

**Task 3.1**: tests/manifest.test.ts
- `withEcc=true` + cherry-pick (C1, C2) → manifest 에 매핑 없음 확인
- `withEcc=false` + cherry-pick (C2) → 매핑 있음 확인
- `withEcc=true/false` + C3 (continuous-learning-v2) → 별도 분기 확인

**Task 3.2**: tests/installer-11-track.test.ts
- 통합 — `withEcc=true` 시 실제 .claude/agents/code-reviewer.md 안 복사 확인
- `withEcc=false` 시 복사 확인

**Task 3.3**: 사용자 환경 검증
- /tmp/test-v26.58-ux 임시 디렉토리
- 시나리오 A — withEcc=true → cherry-pick 0 + ECC plugin 1 ✓
- 시나리오 B — withEcc=false → cherry-pick N (C2 만) ✓
- 시나리오 C — modified cherry-pick (continuous-learning-v2) 양쪽 모두 ✓

**Task 3.4**: PR/머지/tag/release

### 작업 의존성

```
Phase 1 (분류) → Phase 2 (코드) → Phase 3 (test) → PR
       ↓
   사용자 합의 (C1/C2/C3 분류 표 검증)
```

---

## 4. Todo (체크리스트)

### Phase 1 — 분류 (1-2 시간)

- [ ] 1.1 cherrypicks.lock 22개 ECC plugin 안 path 매핑 확인
- [ ] 1.2 89 KEEP list 와 cherry-pick 22개 교집합 확인 (이미 일부 — security-reviewer / silent-failure-hunter / build-error-resolver / e2e-testing / agent-introspection-debugging / nextjs-turbopack 6개 KEEP 누락 의심)
- [ ] 1.3 각 cherry-pick → C1/C2/C3 분류
- [ ] 1.4 PRD §6 부록 표 갱신
- [ ] 1.5 사용자 합의 (분류 표 검증, 필요 시 컨펌)

### Phase 2 — 설계 + 코드 (2-3 시간)

- [ ] 2.1 src/manifest.ts — `applies` 함수 의미 변경 (opt-out pattern)
- [ ] 2.2 src/installer.ts — 주석 update
- [ ] 2.3 src/commands/install.ts — Phase 1 출력 description 정정
- [ ] 2.4 docs/decisions/ADR-019 작성
- [ ] 2.5 docs/specs/v26-58 SPEC 측면 작성 (구현 디테일)

### Phase 3 — Tests + 검증 (1-2 시간)

- [ ] 3.1 tests/manifest.test.ts — opt-out gating 검증
- [ ] 3.2 tests/installer-11-track.test.ts — 통합
- [ ] 3.3 build + 임시 디렉토리 + 사용자 검증
- [ ] 3.4 PR + 머지 + tag v26.58.0 + release

### 사용자 환경 검증 시나리오

| # | 시나리오 | 명령 | 기대 |
|---|---|---|---|
| A | withEcc=true | Step 3 에서 `ecc-plugin` 체크 | cherry-pick (C1, C2) 0, plugin 1 |
| B | withEcc=false | Step 3 default | cherry-pick (C2) N, plugin 0 |
| C | continuous-learning-v2 (modified) | 양쪽 | 양쪽 모두 install |

---

## 5. Verification

### 회귀 test

- 579 tests pass baseline 유지
- 신규 test: opt-out gating 3-4 case

### 사용자 가시성

Phase 1 출력에 명확히:
```
✓ agents (4)
    use   SOD reviewer (opus) + data-analyst · strategist · plan-checker
    note  ECC plugin 미설치 → cherry-pick fallback (code-reviewer 등 4 추가)
    files reviewer, data-analyst, strategist, plan-checker, code-reviewer, ...
```

또는 plugin ON 시:
```
✓ agents (4)
    use   SOD reviewer (opus) + data-analyst · strategist · plan-checker
    note  ECC plugin 사용 → cherry-pick skip (plugin 의 code-reviewer 등 활용)
    files reviewer, data-analyst, strategist, plan-checker
```

### 사용자 검증 시나리오 (위 §4 의 A/B/C)

---

## 6. 부록 — Cherry-pick 분류 표 (Phase 1 결과 채울 자리)

> **상태**: Phase 1 에서 갱신. 현재는 1차 추정.

| ID | ECC plugin path | 89 KEEP? | OFF 가치 | 트랙 매핑 | 분류 |
|---|---|---|---|---|---|
| ecc-code-reviewer | agents/code-reviewer.md | ✓ (`code-reviewer`) | 높음 | 모든 dev | **C2** (OFF default) |
| ecc-security-reviewer | agents/security-reviewer.md | **✗** (KEEP 은 `security-review` 만) | 높음 | 모든 dev | **C2** (KEEP 누락 확인 필요) |
| ecc-silent-failure-hunter | agents/silent-failure-hunter.md | **✗** | 중간 | dev | C2 |
| ecc-build-error-resolver | agents/build-error-resolver.md | **✗** | 중간 | dev | C2 |
| ecc-cl-v2 (MODIFIED) | skills/continuous-learning-v2/ | ✓ | 높음 | 모든 | **C3** (modified — 양쪽 install) |
| ecc-strategic-compact | skills/strategic-compact/ | ✓ | 높음 | 모든 | **C1** 또는 C2 (사용 빈도) |
| ecc-deep-research | .agents/skills/deep-research/ | ✓ | 높음 | 모든 (executive 포함) | C2 |
| ecc-market-research | .agents/skills/market-research/ | ✓ | 중간 | executive | C2 |
| ecc-eval-harness | .agents/skills/eval-harness/ | ✓ | 중간 | dev | C2 |
| ecc-verification-loop | .agents/skills/verification-loop/ | ✓ | 중간 | dev | C2 |
| ecc-e2e-testing | .agents/skills/e2e-testing/ | **✗** (KEEP `e2e`/`e2e-runner` 만) | 높음 | ui | C2 |
| ecc-agent-introspection-debugging | .agents/skills/agent-introspection-debugging/ | **✗** | 낮음 | dev | C1 or C2 |
| ecc-python-patterns | skills/python-patterns/ | ✓ | 중간 | data/csr-fastapi | C2 |
| ecc-python-testing | skills/python-testing/ | ✓ | 중간 | data/csr-fastapi | C2 |
| ecc-nextjs-turbopack | skills/nextjs-turbopack/ | **✗** | 중간 | ssr-nextjs | C2 |
| ecc-investor-materials | skills/investor-materials/ | ✓ | 높음 | executive | C2 |
| ecc-investor-outreach | skills/investor-outreach/ | ✓ | 높음 | executive | C2 |
| ecc-cmd-e2e | .opencode/commands/e2e.md | ✓ | 중간 | dev | C2 |
| ecc-cmd-eval | .opencode/commands/eval.md | ✓ | 중간 | dev | C2 |
| ecc-cmd-harness-audit | .opencode/commands/harness-audit.md | ✓ | 중간 | dev | C2 |
| gsd-gates-taxonomy | get-shit-done/references/gates.md | (별개 source) | 높음 | 모든 | (검토 필요) |
| alirezarezvani-karpathy-gate-hook (MODIFIED) | hooks/karpathy-gate.sh | (별개) | 높음 | dev | **C3** (modified) |

> **1차 분류 추정**: C1 (완전 중복) = 1-2개, C2 (OFF default) = 18-19개, C3 (modified or 트랙 분기 critical) = 2개 (cl-v2 + karpathy-gate).

> **Phase 1 에서 정확히 확정**.

---

## 7. 위험 + 결정 사항

### 위험

- **BREAKING**: 기존 `withEcc=true` 사용자가 v26.58.0 update 시 cherry-pick C1 항목 빠짐. plugin 으로 갈음되므로 functional 무영향이지만 사용자 mental model 충격
- **89 KEEP 누락 6개** (security-reviewer / silent-failure-hunter / build-error-resolver / e2e-testing / agent-introspection-debugging / nextjs-turbopack): plugin 으로 ON 했어도 prune 시 제외됨. **추가 작업**: KEEP list 갱신 (scripts/prune-ecc.sh) 또는 cherry-pick 유지 (C2 로)

### 사용자 컨펌 필요 결정

Phase 1 합의 단계에서:
- Cherry-pick 분류 표 (§6) 의 C1/C2/C3 분류 확정
- 89 KEEP 누락 6개 처리 방향 (KEEP 추가 vs cherry-pick 유지)

---

## 8. 새 세션 시작 가이드

### 새 세션 prompt template

```
v26.58.0 cycle 진행. PRD: docs/PRD/v26-58-cherry-pick-plugin-gating.md

요약:
- cherry-pick (22개) 의 plugin install 여부에 따른 동적 gating
- 이전 ADR-016 의 의미 정정 (cherry-pick = plugin fallback)
- BREAKING: withEcc=true 시 cherry-pick C1/C2 skip (plugin 으로 갈음)

진행 시작점:
1. PRD §6 부록 표 검증 (Phase 1.1~1.5) — cherrypicks.lock 22개 분류 확정
2. 사용자 컨펌 필수 (C1/C2/C3 분류 + 89 KEEP 누락 6개 처리)
3. Phase 2 (manifest 코드) → Phase 3 (tests + release)

세션 첫 명령:
- cat docs/PRD/v26-58-cherry-pick-plugin-gating.md  # 전체 plan 재확인
- cat .dev-references/cherrypicks.lock | jq '.cherrypicks[]'  # 22개 cherry-pick
- grep KEEP_ITEMS -A 20 scripts/prune-ecc.sh  # 89 KEEP list

배경:
사용자 핵심 통찰 (2026-05-17): "ECC plugin install 만 하면 code-reviewer 등 작동.
templates 의 cherry-pick 복사는 중복." → 본 cycle 의 의도.
```

### 의존성 / 선행 조건

- v26.57.1 까지 머지 완료 (현재 상태)
- /tmp/test-v26.58-ux 디렉토리 검증용 준비

### 관련 ADR / SPEC

- ADR-016 (v26.55.0) — supersede 대상
- ADR-019 (v26.58.0) — 본 cycle 신규
- cherrypicks.lock — 22개 cherry-pick manifest
- scripts/prune-ecc.sh — 89 KEEP 정책 (재검토 후속)

---

## 9. Changelog

- 2026-05-17: 초안. 사용자 가이드 (4 호소 + ECC cherry-pick 의미 정확화) 기반.
