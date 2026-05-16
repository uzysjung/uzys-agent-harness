# SPEC: Step 4 Category Navigator (Phase C UX)

> **Status**: Draft (2026-05-16)
> **Predecessor**: v26.47.0 (Phase C full — 32+ asset 단일 multiselect)
> **Trigger**: 32 asset 한 화면에 길어서 사용자가 어느 위치인지 인지 어려움. 카테고리 단위 진행률 가시화 + 카테고리별 sub-prompt.

---

## 1. Objective

Step 4 (External Assets) 를 2-tier 구조로 재구성:
- **(a) Category navigator** — 카테고리 list (선택/총 자산 카운트 표시) + "Proceed →"
- **(b) Sub-prompt** — 선택한 카테고리의 자산 multiselect

## 2. AC

- **AC1**: Step 4 가 single multiselect → 2-tier (navigator + sub-prompt)
- **AC2**: Navigator 는 7 카테고리 + "Proceed →" 표시. 각 카테고리에 `[N/M ✓]` 진행률
- **AC3**: 카테고리 선택 → sub-prompt 진입 → multiselect → ENTER → navigator 복귀
- **AC4**: Navigator 의 "Proceed →" 선택 → confirm step 진행
- **AC5**: Navigator ESC = back to cli step (기존 wizard back nav 패턴)
- **AC6**: Sub-prompt ESC = back to navigator (수정 안 함, 기존 카테고리 유지)
- **AC7**: 사용자 선택 결과는 preset 추천과 비교 → `forceInclude`/`forceExclude` 계산 (기존 로직 유지)
- **AC8**: Preset 변경 시 (Step 1 back) selections reset (기존 동작 유지)
- **AC9**: vitest 회귀 0 + 신규 test

## 3. 구현

### `prompts.ts`

```ts
// 기존 selectExternalAssets 유지 (직접 호출 가능 — non-interactive 또는 fallback)
// 신규:
selectAssetCategory: (state: CategoryNavigatorState) => Promise<Category | "proceed" | null>;
selectAssetsInCategory: (
  category: Category,
  initialChecked: ReadonlyArray<string>,
) => Promise<ReadonlyArray<string> | null>;
```

### `interactive.ts`

```ts
} else if (step === "assets") {
  // 2-tier navigator
  const recommended = recommendedExternalAssets(tracks ?? []);
  const allSelected: Set<string> = assetSelections
    ? new Set(assetSelections)
    : new Set(recommended);
  while (true) {
    const cat = await prompts.selectAssetCategory({ tracks, allSelected });
    if (cat === null) {
      // ESC at navigator = back to cli
      step = "cli";
      break;
    }
    if (cat === "proceed") {
      assetSelections = [...allSelected];
      step = "confirm";
      break;
    }
    // category 선택 → sub-prompt
    const categoryAssets = EXTERNAL_ASSETS.filter((a) => a.category === cat).map((a) => a.id);
    const initial = categoryAssets.filter((id) => allSelected.has(id));
    const result = await prompts.selectAssetsInCategory(cat, initial);
    if (result === null) continue; // ESC at sub = stay at navigator
    // result 의 selected = category 내 새 선택 → allSelected 갱신
    for (const id of categoryAssets) {
      if (result.includes(id)) allSelected.add(id);
      else allSelected.delete(id);
    }
  }
  if (step === "confirm") {
    // 진행
  }
} else { ...
```

## 4. Non-Goals
- External Asset 의 condition/source 변경 없음
- CLI flag (`--with` / `--without`) 변경 없음
- Phase A-C MVP 의 다른 step (tracks/options/cli/confirm) 변경 없음

## 5. 위험
- clack select 의 마지막 항목 "Proceed →" 가 hint X 라 시각적 강조 어려움 → 간단한 separator 표기
- Sub-prompt ESC 시 사용자 입력 보존 여부 (현재 SPEC: 보존 안 함, sub 진입 직전 상태)
- Navigator state 의 [N/M ✓] 갱신 — 매 iteration 재계산 (작은 비용)

## 6. Changelog
- 2026-05-16: 초안. 자동 진행 (사용자 "계속 진행해").
