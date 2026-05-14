# ADR-014: Phase C Full — UserOverride Model for External Assets

- **Status**: Accepted
- **Date**: 2026-05-15
- **PR**: TBD (v26.47.0)
- **Supersedes**: 없음
- **Related**: ADR-010 (Category-based pivot), ADR-013 (Wizard back nav), `docs/specs/category-installer-phase-c-full.md`

## Context

Category-based installer 의 Phase A-C MVP (v26.43-45.0) 까지 — 사용자가 카테고리/출처 인지 가능, 옵션 키 (OPTION_DEFS) 토글 가능. 그러나 **External Assets (32+) 직접 toggle 불가**. preset condition 으로 자동 매핑.

원본 사용자 mockup (2026-05-14):
- shadcn-ui, supabase-cli 등을 사용자가 ✓ 풀어 제외하거나 추가 ✓ 가능해야 함
- preset 추천 ✓ 미리 체크 + 자유 토글

이는 SPEC R5 — Step 2 = "추천 ✓ 미리 체크 + unchecked 가능" 의 핵심.

## Decision

**`UserOverride` 모델 신설** — `InstallSpec` 에 optional `userOverride: { forceInclude, forceExclude }`.

### 평가 우선순위

```
forceExclude > forceInclude > condition (any-track | has-dev-track | option)
```

### 흐름

1. Step 1: Preset 선택 (기존)
2. Step 2: Options multiselect (OPTION_DEFS — Phase C MVP)
3. Step 3: CLI multiselect (기존)
4. **Step 4 (신규): External Assets multiselect** — preset 추천 ✓ 미리 체크
5. Step 5: Confirm
6. `computeUserOverride(presets, selected)` → `recommended - selected = forceExclude`, `selected - recommended = forceInclude`

### CLI flags

```bash
# 신규 (Phase C full)
--with <asset-id>      # repeatable, forceInclude
--without <asset-id>   # repeatable, forceExclude

# 예시
npx claude-harness install --preset csr-supabase --without netlify-cli --with railway-skills
```

기존 `--with-uzys-harness`, `--with-gsd` 등 옵션-키 flag 는 보존 (별개 layer — OPTION_DEFS).

## Alternatives

- **(a) `ExternalAssetCondition` 자체에 user-override case 추가.** 기각: condition 평가가 spec 외부 데이터 (사용자 입력) 에 의존하면 condition 의 "static rule" 의미 손상.
- **(b) Single override field (`disabledAssets`).** 기각: forceInclude 케이스 표현 불가 (condition 미매칭 자산을 추가).
- **(c) OPTION_DEFS 와 External Assets 모델 통합.** 기각: 옵션 키 (withGsd, withTauri 등) 와 자산 id 는 별도 의미. 통합 시 메타데이터 혼란.

## Consequences

### 긍정
- 사용자 자율성 ↑ — preset 강제 매핑에서 자유.
- 출처 라벨 + 직접 toggle = mockup 의 완전 실현.
- Backward compatible — `userOverride` optional. 미제공 시 기존 condition 만 평가.

### 부정
- Interactive flow 4 → 5 step 증가 — UX 단계 늘어남.
- 32+ asset 화면 길이 — clack groupMultiselect scrollable 의존.
- Test 다수 mock 갱신 (`selectExternalAssets` 신규).

### 완화
- Step 5 (assets) 도 ESC = back to cli (wizard back nav, ADR-013 패턴).
- 추천 ✓ 미리 체크 = 사용자가 ENTER 만 누르면 기존 동작 동등.
- `computeUserOverride` 의 diff 가 빈 set 이면 `userOverride: undefined` — installer pipeline 영향 0.

## Notes

- `recommendedExternalAssets` 함수는 v26.44.0 Phase B 에서 이미 land (preset → 추천 자산 id 매핑). 본 Phase C full 이 그 결과를 Step 4 의 initialValues 로 활용.
- `installer.ts` 의 `filterApplicableAssets` 호출에 `userOverride` 전달. `shouldInstallAsset` 가 우선순위 평가.
- `external-installer.ts` 의 `runExternalInstall` ctx 에 `userOverride` 추가 — Phase α 모델 확장의 마지막 layer.

## OQ 해소 (SPEC OQ 1-4)

- **OQ1** (`--with-*` vs `--with <id>` 충돌): 별개 layer 로 처리. `--with-uzys-harness` (OPTION_DEFS) ≠ `--with uzys-harness` (External Asset id). 양립 가능.
- **OQ2** (화면 길이): clack groupMultiselect scrollable. 추가 처리 X.
- **OQ3** (preset 변경 시 Step 4 갱신): Wizard back nav (ADR-013) 으로 back-to-tracks → Step 4 재진입 시 새 preset 의 추천으로 자동 갱신.
- **OQ4** (`--without` 범위): External Asset id 만. OPTION_DEFS 옵션 끄기는 기존 `--no-codex-prompts` 등 별개 flag.
