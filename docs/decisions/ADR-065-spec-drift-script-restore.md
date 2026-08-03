# ADR-065: spec-drift-check 를 훅이 아니라 스크립트로 복원

- Status: Proposed
- Date: 2026-08-03
- PR: #TBD
- Supersedes: ADR-060 의 **spec-drift-check 삭제 결정만** (부분 — 정비의 나머지 결정은 현행 유지)

## Context

이슈 #275 에서 사용자가 spec-drift-check.sh 의 유용성을 재론했다. 재검토 실측:

- **제거 판정("미배선 + 무동작")은 훅 축에서 옳았다.** 제거 직전까지 `templates/settings.json`
  어느 이벤트에도 등록된 적이 없어 자동 발화 경로가 0이었다. 유일한 호출 경로는 배포판
  ship-checklist 의 프로즈 한 줄.
- **그러나 배포판에서는 유일한 실행형 drift 탐지기였다.** 이 리포의 대체 게이트
  (`tests/spec-drift-backlog-exemption.test.ts`)는 npm 게시물 밖이라 설치받는 프로젝트에
  도달하지 않는다. 제거 후 배포판 doc-governance 는 "게이트는 기본 제공되지 않는다"는
  프로즈만 남았다.
- **수동 호출 축의 유용성은 이력이 실증한다.** #237(v26.122.0)에서 이 게이트가 실제로 물었고
  (상시 차단 → `ship-gate:ignore` 면제 표식으로 수리), 그 면제 로직(fail-closed·단독 줄
  표식)은 mutation 검증까지 마친 자산이다.

## Decision

`templates/scripts/spec-drift-check.sh` 로 복원한다 — **훅이 아니라 명시 호출 스크립트로.**

- 설치 타깃 = `.uzys-agent-harness/spec-drift-check.sh` (protect-branch.sh 전례와 같은
  CLI 중립 슬롯 — 문서 drift 는 4개 CLI 공통 관심사라 `.claude/` 아래가 아니다).
- `settings.json` 에 등록하지 않는다 — 미등록이 정직한 상태다. 호출 지점은 배포판
  ship-checklist 의 SPEC/PRD 정합성 항목(`exit 2` 시 차단)과 doc-governance 검증 게이트 절.
- #237 의 면제 로직(`ship-gate:ignore` 구간·fail-closed·단독 줄 표식)을 그대로 보존한다.
- 도달 경로는 manifest derive 대조 테스트로 잠근다(`protect-branch-surface` 전례) — 룰
  문안과 테스트에 경로를 각각 적으면 두 번째 하드코딩 사본이 된다.

## Alternatives

- **훅으로 재배선(Stop/PreToolUse 등)** — 기각. ship 시점 검사를 턴 단위 이벤트에 걸면
  소음이고, 애초 죽은 원인이 "배선 없는 훅 라벨"이었다.
- **현상 유지(제거 상태)** — 기각. 배포판 손실이 실재하고 사용자가 유용성을 판단했다(#275).
- **이 리포 TS 게이트 확장만** — 기각. 배포판에 나가지 않아 #275 의 문제를 풀지 못한다.

## 적용 범위

배포판만: `templates/scripts/` 신규 1파일 · `src/manifest.ts` 엔트리 1개 · 배포판 룰 2종
(ship-checklist·doc-governance) 문안 · 도달 경로/행동 테스트. **이 리포 자체의 게이트는 변경
없음** — `tests/spec-drift-backlog-exemption.test.ts` 가 계속 물고, 주석만 사실에 동기화한다
("훅을 되살리지 말라"는 문구가 이 복원과 충돌하지 않게 — 복원된 것은 훅이 아니다).

## Consequences

- 배포판 스크립트 자산 2종째(protect-branch.sh 다음). `uninstall` 은 `.uzys-agent-harness/`
  통째 삭제로 함께 제거된다(기존 계약, 감수).
- 스크립트가 보는 문서 레이아웃(SPEC/todo 후보 경로) 밖의 프로젝트에서는 여전히 프로즈만
  작동한다 — 이 한계는 doc-governance 문안에 명시한다(제거 전과 동일한 정직성 계약).
- 다음 릴리즈에 포함. CHANGELOG 는 릴리즈 커밋에서 기록.
