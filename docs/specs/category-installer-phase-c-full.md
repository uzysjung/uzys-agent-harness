# SPEC: Category-installer Phase C 완전판 — External Assets 직접 Toggle + Preset Pre-check

> **Status**: Draft (2026-05-14)
> **Predecessor**: v26.45.0 (Phase C MVP — OPTION_DEFS 카테고리 grouping 만)
> **Trigger**: 사용자 원본 mockup (2026-05-14) 의 완전 실현. MVP 는 OPTION_DEFS(~10개) 만 카테고리 그룹화. 32+ External Asset 직접 toggle + Preset pre-check 는 보류.

---

## 1. Objective

Step 2 UI 에 **모든 External Asset 직접 toggle** + **Preset 기반 추천 ✓ pre-check**.

### 사용자 원본 mockup (재참조)

```
Step 1: Preset 선택
  [x] csr-supabase

Step 2: Skills (preset 추천 미리 체크, 자유 토글)
  🎨 Frontend
    [✓] shadcn-ui              [shadcn/ui]              ← preset 추천
    [✓] web-design-guidelines  [vercel-labs]            ← preset 추천
    [✓] react-best-practices   [vercel-labs]            ← preset 추천
    [✓] impeccable             [pbakaus]                ← preset 추천
    (none)
  🗄️  Backend
    [✓] supabase-agent-skills  [supabase]               ← preset 추천
    [✓] supabase-cli           [supabase]               ← preset 추천
    [✓] vercel-cli             [vercel]                 ← preset 추천
    [✓] netlify-cli            [netlify]                ← preset 추천
    [✓] postgres-best-practices[supabase]               ← preset 추천
    [ ] railway-skills         [railwayapp]
    [ ] next-skills            [vercel-labs]
  📊 Data
    [ ] anthropic-data-plugin  [anthropics]
    ...
  💼 Business
    ...
  🛡️  Dev Tools
    [✓] playwright-skill       [testdino-hq]            ← preset 추천 (dev tracks)
    [✓] find-skills            [vercel-labs]            ← preset 추천
    ...
    [ ] trail-of-bits          [trailofbits]
  🔄 Workflow
    [ ] uzys-harness           [본 프로젝트]
    [ ] addy-agent-skills      [addyosmani]
    [ ] superpowers            [obra / Anthropic 공식]
    [ ] gsd-orchestrator       [get-shit-done-cc]
  📦 ECC Suite
    [ ] ecc-plugin             [affaan-m]
    [ ] ecc-prune              [본 프로젝트]
```

`[✓]` = preset 의 condition 매칭 결과 (recommendedExternalAssets) → 미리 체크.
`[ ]` = condition 미매칭 또는 option-gated → 사용자 명시 선택.
**사용자가 어떤 ✓ 도 풀어서 제외 가능, 어떤 [ ] 도 켜서 추가 가능**.

## 2. 판단 기준 (불변)

### 완료 조건 (AC)

- **AC1**: Step 2 가 32+ External Asset 모두 표시 (현재 MVP 는 OPTION_DEFS 10 만).
- **AC2**: 7 카테고리별 grouping + 정확한 출처 라벨 (Phase A 메타데이터 활용).
- **AC3**: Preset 1+ 선택 시 `recommendedExternalAssets(presets)` 결과가 Step 2 의 initial check 상태.
- **AC4**: 사용자 unchecked 자산은 install 시 **제외** (현재 condition 만 따르던 동작 BREAKING).
- **AC5**: 사용자 checked but condition 미매칭 자산은 install 시 **포함** (예: `csr-supabase` preset 인데 railway-skills 강제 추가).
- **AC6**: CLI flag `--with <asset-id>` / `--without <asset-id>` repeatable. 기존 `--with-*` (단일 옵션) 도 호환.
- **AC7**: `shouldInstallAsset` 로직 확장 — condition + user-override. 우선순위 명시.
- **AC8**: 기존 단일 preset install (`--preset csr-supabase`) 시 추가 변경 없으면 자산 set 동등 (회귀 0). user-override 명시 시에만 차이.
- **AC9**: vitest 회귀 0 + 신규 user-override 단위 테스트 6+ case.

### 판정 절차

1. 11 preset 각각 → 추천 ✓ 자산 set 검증 (기존 condition 결과와 일치).
2. user-override → install 결과 자산 set 검증 (3 시나리오: only-remove, only-add, mix).
3. CLI flag matrix — `--preset` × `--with` × `--without` 조합.

## 3. Architecture 변경

### 3.1 `ExternalAssetCondition` 모델 확장

신규 user-override layer (`InstallContext.userOverride`):

```ts
// installer.ts
export interface InstallContext {
  ...
  userOverride?: {
    /** 사용자가 명시 추가한 asset id (condition 결과와 무관하게 포함). */
    forceInclude: ReadonlyArray<string>;
    /** 사용자가 명시 제거한 asset id (condition 결과와 무관하게 제외). */
    forceExclude: ReadonlyArray<string>;
  };
}
```

### 3.2 `shouldInstallAsset` 로직

```ts
// external-assets.ts
export function shouldInstallAsset(
  asset: ExternalAsset,
  ctx: { tracks: ReadonlyArray<Track>; options: OptionFlags; userOverride?: UserOverride },
): boolean {
  // 우선순위: forceExclude > forceInclude > condition
  if (ctx.userOverride?.forceExclude.includes(asset.id)) return false;
  if (ctx.userOverride?.forceInclude.includes(asset.id)) return true;
  return evaluateCondition(asset.condition, ctx);
}
```

### 3.3 Interactive Step 2 UI

```ts
// prompts.ts (신규 함수)
selectExternalAssets: (
  presets: ReadonlyArray<Track>,
  options: OptionFlags,
) => Promise<{ forceInclude: string[]; forceExclude: string[] } | null>;
```

구현:
1. `EXTERNAL_ASSETS` 전체를 카테고리별로 그룹화
2. `recommendedExternalAssets(presets)` 결과를 initialValues 로 (= [✓] 미리 체크)
3. clack `groupMultiselect` 호출
4. 결과 set 과 recommended set 의 diff 로 forceInclude/forceExclude 계산:
   - `recommended - result` → forceExclude (사용자가 추천에서 제외)
   - `result - recommended` → forceInclude (사용자가 추가 선택)

### 3.4 CLI Flag

```bash
# 기존 (보존)
npx claude-harness install --preset csr-supabase

# 신규 (Phase C 완전판)
npx claude-harness install --preset csr-supabase --without netlify-cli --with railway-skills
# = csr-supabase 추천에서 netlify-cli 제거 + railway-skills 추가
```

cac 라이브러리의 `repeatable: true` 활용.

## 4. 결정 일람

### 4.1 In Scope

- 모든 External Asset (32+) Step 2 직접 toggle
- Preset 기반 pre-check
- forceInclude / forceExclude 모델
- CLI `--with <id>` `--without <id>` repeatable
- Interactive Step 2 redesign (`selectExternalAssets` 신규)
- 단위 테스트 (user-override 우선순위, diff 계산, edge case)

### 4.2 Non-Goals

- 기존 `--with-uzys-harness` 등 옵션-키 flag 제거 (보존 — 동의어로 매핑)
- Track preset 자체 변경 (11 식별자 그대로)
- Option-gated 자산 (uzys-harness/superpowers/addy/gsd) 의 OptionFlags 제거 — 동기화 layer
- 자산 분류/출처 라벨 변경 (Phase A 메타데이터 그대로)

### 4.3 DO NOT CHANGE

- `templates/CLAUDE.md`, `templates/project-claude/_base.md`
- 11 preset 이름
- 32+ External Asset id (라벨/출처만 보존)
- Phase A categories.ts / SOURCE_LABELS

### 4.4 Open Questions

- **OQ1**: 기존 `--with-uzys-harness` 등 9개 옵션-키 flag 과 신규 `--with <id>` 가 동시 지원 — 충돌 처리? (예: `--with-uzys-harness --without uzys-harness`)
- **OQ2**: Interactive Step 2 가 32+ 자산 list 표시 시 화면 길이 — 카테고리 collapse/expand 지원? 단일 화면 vs 카테고리별 분할 prompt?
- **OQ3**: Preset 변경 시 (예: csr-supabase → csr-fastapi) Step 2 의 pre-check 가 자동 갱신? 또는 매번 처음부터?
- **OQ4**: `--without <id>` 가 OPTION_DEFS 의 옵션 (예: `withGsd`) 도 제어 가능? 또는 External Asset id 만?

## 5. Phase 분해

- **Phase α — UserOverride 모델** : `installer.ts` + `external-assets.ts` `shouldInstallAsset` 확장. 단위 테스트.
- **Phase β — Interactive Step 2 신규** : `selectExternalAssets` prompt 함수. `recommendedExternalAssets` 결과 활용. diff 계산.
- **Phase γ — CLI flag** : `--with <id>` `--without <id>` repeatable. OPTION_DEFS flag 와 매핑/충돌 처리.
- **Phase δ — Migration & 문서** : Release notes (BREAKING), README/USAGE/CHANGELOG, ADR.
- **Phase ε — Review & Ship**.

순차 의존: α → β/γ 병렬 → δ → ε.

## 6. 위험 & 완화

| 위험 | 영향 | 완화 |
|---|---|---|
| preset semantics 변경 (자동 매핑 → 추천) | 기존 사용자 install 결과 변할 수 있음 | AC8 — 추가 override 없으면 동등. release notes 명시 |
| 32+ 자산 화면 길이 | UX 저하 | OQ2 해소 — 카테고리별 prompt 분할 검토 |
| forceInclude/forceExclude 충돌 | 동시 명시 시 동작 모호 | 우선순위 명시 (`forceExclude > forceInclude > condition`) — Architecture §3.2 |
| 옵션-키 flag 와 신규 flag 동시 — alias mapping | OPTION_DEFS withUzysHarness ↔ asset id uzys-harness | OQ1 해소 — alias mapping 명시 |
| 테스트 다수 fixture 갱신 | 회귀 위험 | AC9 강제, snapshot 도입 검토 |

## 7. Self-Audit Hooks

각 Phase 완료 시 5항목 실행. commit body 1줄 기록.

---

## Changelog

- 2026-05-14: 초안. 사용자 결정 (2026-05-14) — Phase C MVP land 후 완전판 SPEC 만 별도 작성, 구현 결정 보류. OQ 1-4 미해소.
