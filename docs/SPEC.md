# SPEC: Phase 1 Finalization & Phase 2 Entry Readiness

> **Status**: Draft (2026-04-23)
> **Predecessor**: `docs/archive/phase-4b/SPEC.md` (Ship 완료, v26.2.1)
> **Trigger**: v27.0~v27.17 — 18개 버전이 SPEC 없이 진행됨. NORTH_STAR Phase 1 종료 + Phase 2 진입 조건 충족 필요.
>
> **📌 현행화 노트 (2026-05-31, 현재 v26.70.3)**: 본 SPEC 은 Foundation(v26.38) 시점의 Persistent Anchor 로 **의도적으로 보존**된다 (DO NOT CHANGE 본문). 이후 v26.39~v26.70.3 진행 내역은 ▸ 시계열 `CHANGELOG.md` ▸ feature 단위 `docs/PRD/` + `docs/specs/` ▸ 목표/방향 `docs/NORTH_STAR.md` ▸ 현재 상태/할 일 `docs/todo.md` 를 참조.

---

## 1. Objective

NORTH_STAR.md §4 "Phase 1 Foundation" 종료를 **측정 가능하게** 선언하고, "Phase 2 Adoption Loop" 진입 조건을 충족한다.

**3가지 결과**:

1. **Foundation 마무리**: Phase 4b 이월 항목(D1/D2/D4) 소화 + v27.17 dogfood 재실행으로 current-state 품질 확인.
2. **HITO baseline 확보**: v27.14 설치된 `hito-counter.sh`로 실사용 1주일+ 데이터 수집 + 집계 방법 확정.
3. **Phase 2 진입 체크리스트 통과**: NORTH_STAR 진입 조건 항목별 Pass/Fail 기록.

## 2. 판단 기준 (불변)

NORTH_STAR §5 4-gate(Trend / Persona / Capability / Lean)를 **모든 범위 항목에 적용**. 4/4 미만 → 제외.

### 완료 조건 (AC)
- **AC1**: Phase 4b 이월 3개(D1 README, D2 USAGE, D4 CONTRIBUTING) 전부 반영 + 커밋.
- **AC2**: v27.17 기준 dogfood 시나리오 실행 → 리포트 + CRITICAL/HIGH 0.
- **AC3**: HITO 로그 **연속 7일 이상** 수집 + 집계 스크립트 + baseline 수치 기록.
- **AC4**: Phase 2 진입 체크리스트(§5) 모든 항목 Pass.
- **AC5**: `requirements-trace.md`에 v27.0~v27.17 트레이스 표 추가.

### 판정 절차
1. 항목마다 4-gate 기록.
2. 산출물은 **파일/수치/커밋 SHA**로 검증 (에이전트 자기주장 불가).
3. 미달 항목은 Non-Goals로 이월하거나 범위 수정 CR.

## 3. 결정 일람

### 3.1 포함 (In Scope)

| ID | 작업 | 근거 | 4-gate |
|----|------|------|--------|
| **F1** | README.md 보강 — deep-research/market-research, common tools, .mcp.json, sync-cherrypicks 반영 | Phase 4b D1 이월 | Trend(설치 UX), Persona(시니어), Capability(docs), Lean(기존 확장). 4/4 |
| **F2** | USAGE.md 보강 — common tools 시나리오, .mcp.json/settings.json 사용법, sync-cherrypicks 절차 | Phase 4b D2 이월 | 4/4 |
| **F3** | CONTRIBUTING.md sync 절차 — cherry-pick drift 대응, sync-cherrypicks.sh 워크플로우 | Phase 4b D4 이월 | 4/4 |
| **F4** | v27.17 dogfood 재실행 — Phase 1~5 (16 시나리오) + interactive 라우터 추가 시나리오 | 최근 dogfood = v26.14.1 (13개 버전 뒤처짐) | 4/4 |
| **F5** | HITO 집계 스크립트 — `.claude/evals/hito-*.log` 파싱 + 일일/주간 카운트 + per-feature 집계 방법 | v27.14 hito-counter.sh만 존재. 집계 누락 | 4/4 |
| **F6** | HITO 7일 baseline 기록 — 실사용 세션 1주일 로그 + 분석 리포트 | NORTH_STAR NSM 측정 시작 | 4/4 |
| **F7** | Phase 2 Entry Checklist — NORTH_STAR §4 Phase 2 진입 조건을 체크리스트로 분해 | 게이트 명시화 | 4/4 |
| **F8** | requirements-trace.md 확장 — v27.0~v27.17 커밋별 요구사항/4-gate 트레이스 | 사후 추적성 회복 | 4/4 |

### 3.2 제외 (Non-Goals)

- **새 Track / 새 skill 번들 추가** — Foundation 마무리 단계. 추가는 Phase 2+
- **Phase 3 Self-Improvement 작업** — instinct → Rule 자동 승격 파이프라인
- **Multi-user / Team harness** — NORTH_STAR Phase 4 (탐색 단계)
- **외부 early adopter 영입 활동** — Phase 2 본작업. 본 SPEC은 진입 준비만
- **setup-harness.sh 구조 개편** — v27.17 interactive 라우터로 정리됨. 추가 리팩터 금지
- **CLAUDE.md 본문 수정** — 명시적 지시 없이는 제안만 (P10 주기 외)

### 3.3 DO NOT CHANGE

- `docs/NORTH_STAR.md` §1~5 (Statement, NSM, Boundaries, Phase Roadmap, 4-gate)
- `~/.claude/` 전역 (D16 보호)
- `tests/test-harness.sh` 147 assertions (현 상태 PASS 유지)
- `templates/hooks/hito-counter.sh` 로직 (집계 스크립트에서 읽기만)
- `docs/archive/phase-4b/` (역사 기록)

### 3.4 판단 보류 (Open Questions)

- **OQ1**: HITO baseline "7일" 기준 충분한가? — 세션이 드물면 데이터 부족. 최소 세션 수(예: 10회) 기준 추가 필요?
- **OQ2**: Phase 2 "외부 사용자 첫 설치 성공" 조건 — 본 SPEC에 포함(F7 체크리스트)하나 실제 영입은 제외. 진입 선언 시 이 조건 **이월 허용**할지 여부.
- **OQ3**: v27.17 interactive 라우터 dogfood 시나리오 — 기존 16 시나리오 외 몇 개 추가? (최소 Install/Update/Add 분기 3개)

## 4. Phase 분해

- **Phase A — Docs Finalization** (F1, F2, F3): 이월 문서 3종.
- **Phase B — Dogfood v27.17** (F4): 실행 + 리포트.
- **Phase C — HITO Infrastructure** (F5): 집계 스크립트.
- **Phase D — HITO Measurement** (F6): 7일 수집. **경과 시간 필요** — 다른 Phase 병행.
- **Phase E — Phase 2 Readiness** (F7, F8): 체크리스트 + 추적성.
- **Phase F — Review & Ship**: `/uzys:review` → `/uzys:ship` → v26.38.0 태그 (Foundation 완료 선언).

병렬 관계:
- A, B, C는 병렬 가능.
- D는 A/B/C 완료 후 시작(측정 대상 안정화).
- E는 D 7일 경과 후 작성.

## 5. Phase 2 Entry Checklist (F7 산출물 초안)

| # | 조건 | 측정 방법 | Target |
|---|------|---------|--------|
| 1 | 9 Track clean install 성공률 | E2E test-harness + 실측 dogfood | ≥ 95% (NSM 2차 지표) |
| 2 | test-harness PASS | `bash tests/test-harness.sh` | 147/147 (현재값 유지) |
| 3 | HITO baseline 수집 | `.claude/evals/hito-*.log` 7일+ | 수집 완료 + 집계치 기록 |
| 4 | 글로벌 미수정 | `git status ~/.claude/` diff | 0 변경 |
| 5 | 외부 사용자 첫 설치 | 실측 or 이월 사유 | Pass or 이월 CR |
| 6 | Phase 4b D1/D2/D4 이월 소화 | git log + 파일 diff | 완료 |
| 7 | v27.17 dogfood CRITICAL/HIGH | 리포트 | 0 |

## 6. Self-Audit Hooks

각 Phase 완료 시 CLAUDE.md P11 Self-Audit 5항목 실행. 결과 `docs/dogfood/phase-1-final-YYYY-MM-DD.md`에 기록.

---

## Changelog

- 2026-04-23: 초안 작성. 근거 — NORTH_STAR Phase 1 종료 + Phase 2 진입 조건 요구. v27.0~v27.17 18개 버전 SPEC 공백 해소.
