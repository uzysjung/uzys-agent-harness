# Todo: project-claude Section-Fragment 머지 구조

> **Linked plan**: `docs/plans/project-claude-fragments-plan.md`
> **Linked SPEC**: `docs/specs/project-claude-fragments.md`

---

## Phase A — 설계 & PoC ✅

- [x] **A1** `templates/project-claude/_base.md` 작성
  - [x] 헤더 + 안내문 (track-list + tagline 마커)
  - [x] 8 섹션 INSERT 마커 + tagline 마커 (총 9개, R5)
- [x] **A2** `templates/project-claude/fragments/tooling/*.md` 8개 (plugins 제외, tagline 포함)
  - [x] tagline.md
  - [x] stack.md
  - [x] workflow.md
  - [x] active-rules.md
  - [x] agents.md
  - [x] skills.md
  - [x] commands.md
  - [x] boundaries.md
- [x] **A3** `src/project-claude-merge.ts` — single/multi/full/옵션 섹션/tagline 모두 구현 (Phase B 일부 선행)
- [x] **A4** PoC: `mergeProjectClaude(['tooling'])` 본문 동등 확인. 헤더 부가정보(`(6-Gate)`, `(10개)`) 누락은 경미 손실 수용

## Phase B — 머지 로직 완성 ✅

- [x] **B1** Multi-track concat + `### <Track>` 소제목 (A3에서 선행 구현)
- [x] **B2** `TRACK_DISPLAY_NAMES` const 11 트랙 (A3)
- [x] **B3** 'full' 자동 union — FULL_EXPANSION 10 트랙 (A3)
- [x] **B4** 옵션 섹션 stripMarkerLine 처리 (A3)
- [x] **B5** `tests/project-claude-merge.test.ts` 6 test PASS / 전체 529/529 회귀 0

## Phase C — 트랙 분해 ✅

- [x] **C1** CSR 계열 (3 트랙) — sub-agent 일괄
- [x] **C2** Non-dev 계열 (4 트랙) — sub-agent 일괄
- [x] **C3** SSR 계열 (2 트랙) — sub-agent 일괄
- [x] **C4** csr-supabase supabase-auth.md = 9번째 INSERT 마커 (R6)
- [x] **C5** sanity check: csr-fastapi/csr-supabase/data/executive 머지 결과 OK

## Phase D — manifest & install 통합 ✅

- [x] **D1** `src/manifest.ts` single-track 가드 + project-claude entry 제거
- [x] **D2** `installer.ts`에 `mergeProjectClaude` 호출 + writeFileSync(CLAUDE.md)
- [x] **D3** `install.ts` 로그 `CLAUDE.md (root) merged from N tracks`
- [x] **D4** vitest 529/529 PASS (test-harness.sh는 현재 repo에 부재 — plan 오기재)

## Phase E — 정리 ✅

- [x] **E1** `templates/project-claude/*.md` 11개(tooling/csr-*/ssr-*/data/executive/full/etc) 모두 삭제. `_base.md` + `fragments/` 만 잔존
- [ ] **E2** README/USAGE sync (필요 시) — Phase F 직전 결정

## Phase F — Review & Ship

- [ ] **F1** `/uzys:review` (5축 리뷰, CRITICAL 0)
- [ ] **F2** `/uzys:ship` (security scan + npm audit + smoke test)
- [ ] **F3** PR merge + 태그

---

## 완료 조건 (Plan-level)

- [ ] SPEC AC1~AC8 모두 Pass
- [ ] vitest 신규 테스트 100% PASS
- [ ] test-harness 147 assertion 회귀 0
- [ ] 4 시나리오 (single/dual/triple/full) 머지 결과 수동 검증
