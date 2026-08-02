<!--
GitHub Issue body 템플릿 (gh-issue-workflow skill)
- 5섹션 모두 채울 필요는 없으나, 비어있으면 그 줄을 지운다 (placeholder 남기지 말 것).
- BDD 매핑: 전제(Given) → 적용 대상(When) → AC(Then).
- 방향성 상태로 작업 가능 여부가 결정된다 (OPEN = 작업 차단, "YYYY-MM-DD 확정" = 작업 가능).
- Labels (3-축, 권장):
  - type: bug | feature | refactor | docs | infra
  - 상태: decision-pending(방향성 OPEN) | ready(확정) | in-progress(PR open) | blocked(전제 미충족)
  - 우선순위: P0 | P1 | P2 (선택)
- GitHub Project 연계 (선택): docs/SPEC.md에 `github_project: <URL>` 명시 시 자동 add.
-->

## 배경

[왜 이 작업이 필요한가. 1-3 문장. 사용자가 발견한 증상, 도달하려는 상태, 비즈니스 맥락.]

## 전제 (Given)

[이 작업을 시작하기 전에 충족돼야 하는 조건. 다른 issue / 외부 의존성 / 의사결정 결과 / 인프라 상태. 미충족 시 작업 차단.]

- [ ] [전제 조건 1 — 예: Issue #N 완료]
- [ ] [전제 조건 2 — 예: Stripe 계정 발급]
- [ ] [전제 조건 3 — 예: DB 스키마 v3 마이그레이션]

전제 미충족 시 → 차단 사유 명시 + 충족시킬 책임자/순서 기록.

## 방향성 (OPEN | YYYY-MM-DD 확정)

[현재 의사결정 상태. `OPEN` = 사용자 결정 대기, `YYYY-MM-DD 확정` = 결정 완료.]

- 옵션 A: [설명]
- 옵션 B: [설명]
- **선택 (확정 시)**: [선택지 + 근거]

방향성이 OPEN이면 본 issue로 작업 진행 금지. AI agent는 사용자 결정 대기.

## 적용 대상 / Acceptance Criteria (When → Then)

[변경 범위 + 측정 가능한 완료 조건.]

- [ ] [AC 1 — 예: `/admin/activity-logs` 페이지 11 이상 페이지 정상 작동 (When 사용자 11 클릭 → Then 11페이지 데이터 표시)]
- [ ] [AC 2 — 예: 디자인 시스템 토큰 사용 (When 페이지 렌더 → Then 색상/간격이 design system과 일치)]
- [ ] [AC 3]

AC는 검증 가능해야 함 — pass/fail 명확.

## 후속 작업 (Next)

[본 issue 완료 후 분기되는 작업. 새 issue 번호 또는 잠정 설명.]

- [ ] [후속 1 — 예: Issue #N으로 분리]
- [ ] [후속 2]

후속 작업이 없으면 이 섹션 통째로 삭제.

---

<!-- PR 머지 시 본 issue 자동 close되도록 PR body에 `Closes #<this-issue-number>` 추가 -->
