# PRD Index — 목표 기준

> PRD = feature 단위 요구사항 **스냅샷** (작성 시점 고정, 히스토리성). 목표/방향은 [`../NORTH_STAR.md`](../NORTH_STAR.md), 시계열은 [`../../CHANGELOG.md`](../../CHANGELOG.md), 현재 상태는 [`../todo.md`](../todo.md) 가 SSOT.

각 PRD 는 작성 당시 목표를 기록하며, 구현 후에도 **변경하지 않고 보존**한다 (의사결정 추적용). 후속 변경은 ADR(`../decisions/`) + CHANGELOG 로 추적.

## PRD 목록

| PRD | 목표 (작성 시점) | 상태 | 관련 |
|-----|-----------------|------|------|
| [`v26-58-cherry-pick-plugin-gating.md`](v26-58-cherry-pick-plugin-gating.md) | ECC cherry-pick 과 plugin 의 중복 설치 방지 — `withEcc` opt-out gating | ✅ 반영 (v26.58.0) | ADR-019 |
| [`v26-64-project-scope-only.md`](v26-64-project-scope-only.md) | 모든 install 자산 default project scope, global 명시 opt-in. install log + uninstall | ✅ 반영 (v26.64.0) | ADR-020 |
| [`v26-66-antigravity-cli-support.md`](v26-66-antigravity-cli-support.md) | Antigravity(Google) 를 4번째 CliBase 로 지원 — `.agents/` 산출 | ✅ 반영 (v26.66~70) | — |
| [`v26-71-vetted-curation-recommendation.md`](v26-71-vetted-curation-recommendation.md) | 검증 Trust Tier(T1/T2/T3) 명문화 + 권장 자산 배지·우선정렬 (적극 어필) | 🔨 Accepted — SPEC/Build 대기 | NORTH_STAR 세 기둥 ② |

## 현재 목표 (Phase 2 — Adoption Loop)

신규 PRD 가 아직 없는 열린 목표는 [`../todo.md`](../todo.md) "열린 목표" 섹션과 [`../phase-2-backlog.md`](../phase-2-backlog.md) 참조:

- **P2-01** 외부 사용자 첫 설치 성공 (NSM HITO ≤ 3/feature 자가 측정)
- **P2-02** NSM per-feature 자동화 Step 2
- **P2-04** Dependency major bump

새 feature 착수 시 `/uzys:spec` 으로 SPEC 작성 → 필요 시 본 디렉토리에 PRD 추가.
