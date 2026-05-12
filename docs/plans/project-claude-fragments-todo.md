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

## Phase C — 트랙 분해

- [ ] **C1** CSR 계열 (3 트랙)
  - [ ] csr-fastapi/{stack,workflow,active-rules,agents,skills,plugins,commands,boundaries}.md
  - [ ] csr-fastify/...
  - [ ] csr-supabase/... (+ supabase 인증 섹션)
- [ ] **C2** Non-dev 계열 (4 트랙)
  - [ ] data/...
  - [ ] executive/...
  - [ ] growth-marketing/...
  - [ ] project-management/...
- [ ] **C3** SSR 계열 (2 트랙)
  - [ ] ssr-htmx/...
  - [ ] ssr-nextjs/...
- [ ] **C4** csr-supabase 옵션 섹션 (`supabase-auth.md`) 통합 방식 결정 + 적용
- [ ] **C5** C1-C4 각 트랙 단일 머지 결과 ↔ 기존 .md 본문 sanity check

## Phase D — manifest & install 통합

- [ ] **D1** `src/manifest.ts:261` single-track 가드 제거
- [ ] **D2** manifest entry → 머지 모듈 호출 (patch entry 메커니즘)
- [ ] **D3** `src/commands/install.ts` 로그 `merged from N tracks`
- [ ] **D4** `bash tests/test-harness.sh` 147/147 PASS 확인

## Phase E — 정리

- [ ] **E1** `templates/project-claude/*.md` 11 트랙 + full.md 삭제 (= `_base.md`만 잔존)
- [ ] **E2** 필요 시 README/USAGE 1줄 sync

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
