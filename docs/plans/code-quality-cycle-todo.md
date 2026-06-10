# Todo — Code Quality Cycle

> Plan: [`code-quality-cycle-plan.md`](code-quality-cycle-plan.md) · 작성 2026-06-11 · 기준 `e0742b4`(v26.78.0)
> 각 Phase = 독립 feature branch + PR + 사용자 머지 동의. 1차 게이트 = 로컬 `npm run ci`.
> **공통 룰**: `.claude/rules/no-false-ship.md` — 출하 보고는 경로별 검증 증거 필수.

## Phase H — v26.78.1 hotfix (최우선, patch)

- [x] H-1a `src/prompts.ts` pages 에 `understanding` 추가 (Page 1, 27개 ≤ 30) — 모듈 스코프 `INSTALL_TARGET_PAGES` 승격
- [x] H-1b pages cats 합집합 = CATEGORIES exhaustiveness 가드 (`assertPagesCoverAllCategories`, 모듈 로드 시 throw)
- [x] H-1c wizard-parity 단위 테스트 (`tests/wizard-page-parity.test.ts`, 4 tests — 카테고리·자산 전수 도달)
- [x] H-2 `report.karpathyHook` Summary `HOOK` 행 렌더 (`wired` / `skipped — <reason>`)
- [x] H-3a Summary CLI 행을 `spec.cli` derive (`CLI_SUMMARY_LABELS`, antigravity 포함, claude prepend 버그 fix)
- [x] H-3b antigravity 산출물 행 렌더 + `formatCliPhaseTitle` antigravity + `--cli` help 텍스트 수정
- [x] H-V `npm run ci` exit 0 (677 tests, branches 88.02) → Docker `scenario-antigravity-render` PASS → `--help` antigravity 노출
- [ ] H-ship PR → 머지 동의 → 태그 v26.78.1 → `gh run watch` green
- [x] H-D CHANGELOG v26.78.1 + Surface Parity 매트릭스 (PR 본문)

## Phase S — 카탈로그 SSOT (v26.79.0)

- [ ] S-1 `ExternalAsset.tier` 필수 필드화 + `TRUST_TIER` derive 전환 (41 entries)
- [ ] S-2 gen-compatibility 카테고리 하드코딩 → `trust-tier-drift.ts` re-export 순회 (기존 import 방식 확인 후)
- [ ] S-3 죽은 `failureMode`/`aborted` 메커니즘 + 관련 테스트 삭제
- [ ] S-4 (선택) EMPTY_USER_OVERRIDE / formatSkippedReport 정리, marketplace-add stderr 전파
- [ ] S-V `npm run ci` + COMPATIBILITY.md 재생성 diff 무변화 검증 → PR → 태그

## Phase P — 버전 pinning (v26.80.0, 보안 wedge)

- [ ] P-1 `@latest`/버전 미지정 npm·npx-run 자산 전수 pin (Docker 로 pinned 버전 설치 검증)
- [ ] P-2 회귀 테스트: npm/npx-run method 에 unpinned 금지 단언
- [ ] P-3 COMPATIBILITY.md pinned 버전 + bump 정책(A2 audit 연동) + 잔여 리스크 명시
- [ ] P-V `npm run ci` + Docker scenario-workflow-scope 재실행 → PR → 태그

## Phase O — OptionFlags 폐기 (ADR-022, 사용자 승인 게이트)

- [ ] O-1 규칙 발효: 신규 자산 OptionFlags 금지 (forceInclude + `--with <asset-id>`) — plan 머지로 즉시
- [ ] O-2 ADR-022 작성 (Proposed) → **사용자 결정 대기**
- [ ] O-3 (Accepted 시) 11 asset-flag → alias 전환 + deprecation window
- [ ] O-S3 (독립) toOptionFlags / spec build / formatOptions 를 DEFAULT_OPTIONS 키 순회로 collapse

## Phase R — 렌더 분리 (인접 minor 동승 가능)

- [ ] R-1 `commands/install.ts` 렌더러 → `install-render.ts` 추출 (955줄 → cap 이하, 동작 변경 0)
- [ ] R-2 recommended+override merge 중복 단일화 (`preset-recommend.ts`)
