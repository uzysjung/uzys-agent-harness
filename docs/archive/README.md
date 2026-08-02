# Archive — 지도

완료·폐기된 계획 산출물을 격리해 둔 곳. **현행 SSOT 는 여기에 없다** — 현행은
`docs/SPEC.md` · `docs/specs/` · `docs/todo.md` · `docs/plans/` · `docs/decisions/` 다
(`.claude/rules/doc-governance.md` §현행 vs archive).

여기 있는 문서는 **그 시점의 기록**이다. 현재 동작의 근거로 인용하지 말 것 — 인용하면
"완료분을 미완으로 박제"하거나 폐기된 절차를 되살리게 된다.

| 디렉터리 | 무엇 | 종료 시점 |
|---|---|---|
| `phase1-foundation/` | 초기 기반 구축 plan/todo | — |
| `phase-4b/` | Phase 4b plan/spec/todo | — |
| `c2-install-matrix/` | C2 fresh-env 설치 매트릭스 CI (`install-matrix.yml` 신설) plan/todo | #131 (2026-05-31) 머지로 완료. 미체크로 남아 있던 "머지 후 dispatch" 항목은 실제로는 충족 — 매트릭스가 태그마다 돌고 있다 |
| `spec-foundation-v26.38.md` | **직전 `docs/SPEC.md`** — Foundation(v26.38) 시점의 Persistent Anchor. `DO NOT CHANGE 본문` 으로 보존돼 있었다 | 2026-07-29 사용자 승인으로 **내용 그대로 이동**. 옮긴 이유는 본문이 *"현재 목표로 읽지 말 것"* 이라 적혀 있는데 SessionStart 훅이 매 세션 "이걸 먼저 읽어라"고 안내해 **안내가 자기부정 문서를 지목**하고 있었기 때문이다. 내용 불변은 `tests/spec-anchor-preserved.test.ts` 가 해시로 고정한다 |
