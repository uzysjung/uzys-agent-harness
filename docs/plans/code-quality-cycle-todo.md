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
- [x] H-ship PR #154 머지 → 태그 v26.78.1 → publish/ci/install-matrix 3/3 green (npm 라이브)
- [x] H-D CHANGELOG v26.78.1 + Surface Parity 매트릭스 (PR 본문)

## Phase S — 카탈로그 SSOT (v26.79.0)

- [x] S-1 `ExternalAsset.tier` 필수 필드화 + `TRUST_TIER` derive 전환 (41 entries, dist 권위값 일괄 주입). 누락=컴파일에러/stale=불가능. 누락테스트→id유일+derive정합 테스트
- [x] S-2 gen-compatibility 카테고리 → `CATEGORIES` import + exhaustiveness 가드(throw). **계획 수정**: categories.ts 제목/순서 순회 대신 가드만(문서 짧은 제목/순서가 wizard 와 의도적 분리 → 출력 동일 AC 유지)
- [x] S-3 죽은 `failureMode`/`aborted` 메커니즘 + abort 테스트 삭제 (모든 실패 warn-skip 수렴)
- [x] S-4 (부분) EMPTY_USER_OVERRIDE 삭제. formatSkippedReport 는 public+테스트 보유라 보류, marketplace-add stderr 보류(저가치)
- [x] S-V `npm run ci` exit 0 (678 tests, branches 88.07) + COMPATIBILITY.md diff 무변화 + 가드 스모크 PASS. version 탐지 테스트로 coverage 복구
- [x] S-ship PR #155 머지 → 태그 v26.79.0 → 3/3 green (npm 라이브)
- 비고: external-assets.ts 802줄(cap 800 초과 유지) — 데이터/로직 분리는 별도 사이클. 헤더 cap 예외 주석

## Phase P — 버전 pinning (v26.80.0, 보안 wedge)

- [x] P-1 npm 5 + npx-run 2 자산 전수 pin — method 에 `version` **필수 필드**(컴파일러 강제), 설치 `pkg@version`. 버전은 Docker 에서 latest 실측(openspec 1.4.1/bmad 6.8.0/gsd 1.42.3/vercel 54.11.1/netlify 26.1.0/supabase 2.105.0/agent-browser 0.27.2)
- [x] P-2 회귀 테스트: 전 npm/npx-run 정확 semver + 이름 인라인(@latest/@버전) 금지 단언
- [x] P-3 COMPATIBILITY.md 표 pinned 버전 자동 표기(gen-compat) + §보안 ⑤ pinning 정책 + 잔여 리스크(plugin/skill pin 불가) 명시. install 라벨도 pinned 노출
- [x] P-V Docker `scenario-pinned-versions`(신규, run.sh 등록) — 설치 버전 == pin 정확 일치 + _bmad 산출물 PASS. **계획 수정**: scenario-workflow-scope(real claude 필요) 대신 Phase P 변경 경로(npm/npx)만 검증하는 전용 경량 시나리오 — plugin/skill 은 코드 무변경
- [x] P-ship PR #156 머지 (+#157 lock cleanup) → 태그 v26.80.0 → 3/3 green (npm 라이브)

## Phase O — 자산-결합 플래그 완전 삭제 (ADR-022, 2026-06-11 범위 확대)

- [x] O-1 규칙 발효: 신규 자산 OptionFlags 금지 — plan 머지(#153)로 즉시
- [x] O-2 ADR-022 작성 (Proposed) — **완전 삭제**(alias 없음, 사용자 결정) + 내부 자산 모델(withTauri/withUzysHarness → `kind:"internal"` 카탈로그) + README 비대화형 섹션 신설. `docs/decisions/ADR-022-asset-flag-removal.md`
- [x] O-3 (ADR-022 Accepted #158, v26.81.0 BREAKING) 구현 완료: 전용 플래그 13 삭제 → generic `--with <id>` 일원화(구 플래그 = Unknown option fail-loud), OptionFlags 19→6, `isAssetSelected` 게이팅(manifest/codex/antigravity transform), 내부 자산 2종(`tauri-desktop`/`uzys-harness` — kind:"internal"), VISIBLE_OPTION_DEFS 빈 배열化, gen-compat/verify-catalog internal 처리, Docker 시나리오 5종+dogfood+USAGE+README(비대화형 섹션 신설)+README.ko 동기 갱신, 재발 방지 테스트(banned flags)
- [x] O-V `npm run ci` exit 0 (673 tests, branches 88.48) + Docker e2e 2종 PASS(--with uzys-harness 내부자산 게이팅 / --with openspec·bmad opt-in) + 구 플래그 fail-loud 확인
- [x] O-ship ADR #158 Accepted + 구현 PR #159 머지 → 태그 v26.81.0 → 3/3 green (npm 라이브)

## Phase R — 렌더 분리 (v26.82.0, 순수 리팩터 — 동작 변경 0)

- [x] R-1 `commands/install.ts` 렌더러 → `install-render.ts` 추출 — 979줄 → 430(오케스트레이션) + 595(렌더), cap 800 최대 위반 해소. executeSpec 의 CLI artifacts 게이트 if 는 renderCliArtifacts 내부로 (출력 동일)
- [x] R-2 recommended+override merge 중복 단일화 — `preset-recommend.ts` `finalSelectedAssets`/`groupAssetsByCategory` (computeFinalAssets ↔ formatSummary 중복 제거, v26.62.4 주석 지목 위치)
- [x] R-3 `installer.ts` `runInstall` 276줄 → 65줄 — runUpdateInstall/buildManifestSpec/installClaudeBaseline/writeEnvironmentFiles/runCliTransforms/runExternalPhase/writeInstallLogSafe 블록 분해
- [x] R-V `npm run ci` exit 0 — 673 tests 기대값 무수정 green(동작 변경 0 증거) / branches 88.77(개선) / 렌더 테스트는 import 경로만 변경
- [ ] R-ship PR → 머지 동의 → 태그 v26.82.0 → `gh run watch` green
