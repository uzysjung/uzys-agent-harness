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

두 가지가 같은 옵션에 묶임 → **사용자 mental model 깨짐**.

초기 설계 의도 (ADR-016 작성 시): ECC 사용자에게 cherry-pick fallback + plugin 둘 다 보장.
실제: plugin 단독으로 충분 (`ecc@ecc` install 만으로 code-reviewer / security-review / continuous-learning-v2 등 작동 — 60 agents + 230 skills 가 cache 에서 활성). → cherry-pick 복사는 **중복**.

> **본 PRD 의 `withEcc` 정의 (v26.58 신규 의미)**: "ECC plugin opt-in (즉 `ecc@ecc` 외부 plugin 설치 요청)". 이전 ADR-016 의미 (cherry-pick 도 같이 install) 와 **opposite**. 본 문서 본문에서는 항상 v26.58 신규 의미로 사용.

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

1. cherry-pick 22개의 plugin OFF 가치 명확히 평가 (C1/C2/C3 분류 확정)
2. plugin install 여부에 따라 cherry-pick install 동적 결정 (manifest gating, opt-out 패턴)
3. ADR-019 작성 — ADR-016 의 cherry-pick 매핑 부분 supersede 명문화

### Non-Goals

- ECC plugin 자체 변경
- `scripts/prune-ecc.sh` 의 89-KEEP 정책 갱신 — 별도 cycle (본 cycle 에서는 손대지 않음). **89 KEEP 누락 6 cherry-pick (security-reviewer / silent-failure-hunter / build-error-resolver / e2e-testing / agent-introspection-debugging / nextjs-turbopack) 는 본 cycle 에서 C2 (plugin OFF 시 install) 로 처리하여 누락 영향 최소화**
- `templates/` 의 cherry-pick 파일 자체 삭제 (gating 으로만 결정 — 파일은 유지)

### AC (Acceptance Criteria)

#### AC1 — Cherry-pick 분류 완료

cherrypicks.lock 의 22개 → 3 카테고리:
- **C1. plugin 으로 완전 대체 가능** (plugin ON 시 cherry-pick skip — 단순 중복)
- **C2. plugin OFF 시 default 가치 (cli=claude 단독 사용자)** (plugin OFF 시만 install)
- **C3. modified=true 또는 트랙 분기 valid** (특수 case — plugin ON 이어도 cherry-pick 유지 필요)

분류 결과를 docs/PRD/v26-58-cherry-pick-classification.md (또는 본 파일 부록) 에 표로 명시.

#### AC2 — Manifest gating 로직

`src/manifest.ts` 의 `*_ECC` 매핑 (ADR-016 추가) 의 `applies` 함수 변경:

| 분류 | 현재 (v26.55.0) | 신규 (v26.58.0) |
|---|---|---|
| **C1** (완전 중복) | `applies: (s) => Boolean(s.withEcc)` | **매핑 자체 삭제** (코드 cleanup, 단일 선택) |
| **C2** (OFF default) | 동일 | `applies: (s) => !s.withEcc` (plugin OFF 시만 install) |
| **C3** (modified or 특수) | 동일 | `applies: (s) => true` 또는 트랙 조건 (cherry-pick 항상 install, plugin 무관) |

#### AC3 — addy plugin manifest 주석 일관성

`templates/` 에 addy 출처 cherry-pick = 0개. 단 manifest 의 `withAddyAgentSkills` 관련 매핑이 있다면 C1/C2/C3 패턴 적용. 신규 cherry-pick 추가 시 동일 패턴 유지하도록 manifest 상단 주석 1줄 (`// cherry-pick opt-out pattern: withXxx=true → skip cherry-pick (plugin 으로 갈음)`) 추가.

#### AC4 — install 출력 정확성

Phase 1 출력에 "ECC opt-in 시 / OFF 시" 매핑 명시:
- OFF: "cherry-pick fallback 적용. code-reviewer 등 4 agents + 11 skills 복사"
- ON: "ECC plugin 사용. cherry-pick skip"

#### AC5 — ADR 명시

ADR-019 작성 — supersedes ADR-016 부분. 미래 cycle 에서 같은 실수 안 하도록.

#### AC6 — 회귀 0 + 신규 test

- 기존 579 tests pass 유지 (회귀 0)
- 신규 test 3-4 case:
  - `withEcc=true` → cherry-pick (C1, C2) 매핑 결과 install 안 됨
  - `withEcc=false` → C2 install 됨, C3 (modified) 도 install 됨
  - `withEcc=true` → C3 (modified, continuous-learning-v2) 의 install 정책 (양쪽 install vs plugin only) 별도 검증

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

**Task 2.5**: ~~별도 SPEC 작성~~ — 본 PRD 가 SPEC 역할 통합. 별도 docs/specs/ 파일 X.

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
- [ ] 1.2 **검증**: 89 KEEP list 와 cherry-pick 22개 교집합. 다음 6개 의심 → KEEP 안에 없는지 grep 으로 확정: `security-reviewer`, `silent-failure-hunter`, `build-error-resolver`, `e2e-testing`, `agent-introspection-debugging`, `nextjs-turbopack` (KEEP 의 `security-review`, `e2e`/`e2e-runner` 와 이름 차이 주의)
- [ ] 1.3 각 cherry-pick → C1/C2/C3 분류
- [ ] 1.4 PRD §6 부록 표 갱신
- [ ] 1.5 사용자 합의 (분류 표 검증, 필요 시 컨펌)

### Phase 2 — 설계 + 코드 (2-3 시간)

- [ ] 2.1 src/manifest.ts — `applies` 함수 의미 변경 (opt-out pattern)
- [ ] 2.2 src/installer.ts — 주석 update
- [ ] 2.3 src/commands/install.ts — Phase 1 출력 description 정정
- [ ] 2.4 docs/decisions/ADR-019 작성
- [ ] ~~2.5 별도 SPEC~~ — 본 PRD 가 SPEC 통합. skip.

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

## 6. 부록 — Cherry-pick 분류 표 (DRAFT)

> ⚠️ **DRAFT — Phase 1.3 (사용자 합의 전) 까지 수정 금지**. 본 표는 1차 추정이며 새 세션이 확정된 결과로 오인하면 안 됨.
> `?` = Phase 1 에서 확정. ECC 22개 + 별개 source 2개 (gsd, alirezarezvani) **= 분류 대상 24개 전체**.

| ID | source path | 89 KEEP? | OFF 가치 | 트랙 매핑 | 분류 (DRAFT) |
|---|---|---|---|---|---|
| ecc-code-reviewer | ecc/agents/code-reviewer.md | ✓ | 높음 | 모든 dev | C2 |
| ecc-security-reviewer | ecc/agents/security-reviewer.md | ✗ (KEEP=`security-review`) | 높음 | 모든 dev | C2 |
| ecc-silent-failure-hunter | ecc/agents/silent-failure-hunter.md | ? | 중간 | dev | C2 |
| ecc-build-error-resolver | ecc/agents/build-error-resolver.md | ? | 중간 | dev | C2 |
| ecc-cl-v2 (MODIFIED) | ecc/skills/continuous-learning-v2/ | ✓ | 높음 | 모든 | **C3** (modified) |
| ecc-strategic-compact | ecc/skills/strategic-compact/ | ✓ | 높음 | 모든 | ? |
| ecc-deep-research | ecc/.agents/skills/deep-research/ | ✓ | 높음 | 모든 (executive 포함) | C2 |
| ecc-market-research | ecc/.agents/skills/market-research/ | ✓ | 중간 | executive | C2 |
| ecc-eval-harness | ecc/.agents/skills/eval-harness/ | ✓ | 중간 | dev | C2 |
| ecc-verification-loop | ecc/.agents/skills/verification-loop/ | ✓ | 중간 | dev | C2 |
| ecc-e2e-testing | ecc/.agents/skills/e2e-testing/ | ✗ (KEEP=`e2e`/`e2e-runner`) | 높음 | ui | C2 |
| ecc-agent-introspection-debugging | ecc/.agents/skills/agent-introspection-debugging/ | ? | 낮음 | dev | ? |
| ecc-python-patterns | ecc/skills/python-patterns/ | ✓ | 중간 | data/csr-fastapi | C2 |
| ecc-python-testing | ecc/skills/python-testing/ | ✓ | 중간 | data/csr-fastapi | C2 |
| ecc-nextjs-turbopack | ecc/skills/nextjs-turbopack/ | ? | 중간 | ssr-nextjs | C2 |
| ecc-investor-materials | ecc/skills/investor-materials/ | ✓ | 높음 | executive | C2 |
| ecc-investor-outreach | ecc/skills/investor-outreach/ | ✓ | 높음 | executive | C2 |
| ecc-cmd-e2e | ecc/.opencode/commands/e2e.md | ✓ | 중간 | dev | C2 |
| ecc-cmd-eval | ecc/.opencode/commands/eval.md | ✓ | 중간 | dev | C2 |
| ecc-cmd-harness-audit | ecc/.opencode/commands/harness-audit.md | ✓ | 중간 | dev | C2 |
| gsd-gates-taxonomy | gsd/get-shit-done/references/gates.md | N/A (별개 source) | 높음 | 모든 | ? |
| alirezarezvani-karpathy-gate-hook (MODIFIED) | hooks/karpathy-gate.sh | N/A (별개) | 높음 | dev | **C3** (modified) |

> **1차 추정 (확정 X)**: C1=0-2개, C2=18-20개, C3=2개 (cl-v2 + karpathy-gate 확정). Phase 1.3 합의 후 확정.

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

세션 첫 명령 (macOS BSD / Linux GNU 양쪽 호환):
- cat docs/PRD/v26-58-cherry-pick-plugin-gating.md         # 전체 plan 재확인
- cat .dev-references/cherrypicks.lock                      # 22 cherry-pick (jq 미설치 환경 호환)
- grep -A 20 "KEEP_ITEMS=" scripts/prune-ecc.sh             # 89 KEEP list

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
