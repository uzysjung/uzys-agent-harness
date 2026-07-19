# Plan — 현재 사이클

> **갱신**: 2026-05-31 (v26.70.3 기준)
> **목표 anchor**: [`docs/NORTH_STAR.md`](NORTH_STAR.md) · **할 일/상태**: [`docs/todo.md`](todo.md) · **이력**: [`CHANGELOG.md`](../CHANGELOG.md)
> **Foundation(v26.38) 계획 원본**: [`docs/archive/phase1-foundation/plan.md`](archive/phase1-foundation/plan.md)

---

## Status: idle

활성 작업 사이클이 없다. Foundation(v26.38) 이후 v26.70.3 까지의 진행은 feature 단위로 `docs/specs/`, `docs/PRD/`, `docs/decisions/` 에 분산 기록되어 있으며, 시계열 요약은 `CHANGELOG.md` 에 있다.

새 feature 착수 시 본 파일과 `docs/todo.md` 를 해당 사이클 내용으로 **직접 갱신**한다. 규모가 커지면 `docs/plans/<name>-plan.md` 로 분리한다 (`spec-scaling` 스킬).

> v26.122.0 정정: 이 자리에 `/uzys:spec` → `/uzys:plan` 이 두 파일을 자동 재생성한다고 적혀 있었으나, 그 커맨드들은 ADR-023(2026-06-26)에서 삭제됐다. 갱신은 수동이다.

## 다음 방향 (Phase 2 — Adoption Loop)

NORTH_STAR 1차 NSM(**Context Cost per Install + Justified Asset Ratio** — ADR-043) 달성이 본업. 우선순위는 `docs/phase-2-backlog.md` 참조. **HITO 는 v26.115.0 에서 폐기**(3개월 수집·1회 사용·수정 근거 0건) — 관련 백로그 항목(P2-01(c)·P2-02)도 함께 폐기.
