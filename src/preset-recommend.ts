/**
 * Preset → Step 2 의 추천 ✓ 자산 매핑 (v26.44.0).
 *
 * Step 1 에서 선택된 preset 들의 condition 을 만족하는 외부 자산(plugin/skill/npm/npx)
 * 의 id 를 반환한다. Step 2 multiselect 의 초기 체크 상태에 사용.
 *
 * Opt-in 자산은 추천에 포함 X — 사용자가 의식적으로 골라야 함.
 */

import { trackDefaultMcpAssetIds } from "./cli-transforms.js";
import { resolveBundleRoot } from "./context-cost.js";
import { assetTrustTier, EXTERNAL_ASSETS, filterApplicableAssets } from "./external-assets.js";
import { DEFAULT_OPTIONS, type InstallSpec, type Track } from "./types.js";

/**
 * preset 1개 또는 N개 선택 시 추천 ✓ 자산 id 의 안정 정렬 배열.
 * - DEFAULT_OPTIONS 로 호출 → option-gated 자산은 모두 false → 추천에서 제외.
 * - v26.71.0 (PRD v26-71 R6) — experimental(T3) 자산은 pre-check 제외 (opt-in). official/vetted 만 추천.
 * - 결과는 자산 id 알파벳 정렬 (deterministic).
 */
export function recommendedExternalAssets(presets: ReadonlyArray<Track>): ReadonlyArray<string> {
  if (presets.length === 0) {
    return [];
  }
  const apps = filterApplicableAssets(EXTERNAL_ASSETS, {
    tracks: presets,
    options: DEFAULT_OPTIONS,
  });
  return apps
    .filter((a) => assetTrustTier(a.id) !== "experimental")
    .map((a) => a.id)
    .sort();
}

/**
 * #709 리뷰 NOTE 7 — 트랙의 기본으로 깔리는 자산: 카탈로그 추천 ∪ **트랙 표가 기본으로 까는 고를 수 있는 MCP 서버**
 * (`railway-mcp-server` on csr-* · ssr-htmx · ssr-htmx-fastify · full 등). 뒤의 것은 experimental · opt-in 이라 카탈로그
 * 추천에 안 들지만 실제로 깔린다 — 미체크로 보이면 화면이 결과와 다르다. 체크를 풀면 추천 대비 빼기(`--without <id>`)라
 * `.mcp.json` · Codex · OpenCode 에서 모두 빠진다.
 *
 * #849 — 위저드 3단계 초기 체크 · 사용자 override 계산 · 확인 화면 / 설치 헤더 요약이 **이 하나**를 기준으로 쓴다.
 * 요약만 카탈로그 추천을 따로 세면 체크된 채 깔리는 MCP 가 개수와 목록에서 빠진다.
 */
export function trackDefaultAssets(tracks: ReadonlyArray<Track>): string[] {
  return [
    ...new Set([
      ...recommendedExternalAssets(tracks),
      ...trackDefaultMcpAssetIds(resolveBundleRoot(), tracks),
    ]),
  ];
}

/**
 * v26.82.0 (Phase R, S6) — 트랙 기본(`trackDefaultAssets`) + userOverride 적용 후 최종 선택 자산 id (정렬).
 * 이전엔 install.ts `computeFinalAssets` ↔ interactive.ts `formatSummary` 에 동일 merge 가
 * 중복 구현 (v26.62.4 주석이 본 위치를 통합 지점으로 지목). 우선순위: forceExclude > forceInclude.
 */
export function finalSelectedAssets(
  tracks: ReadonlyArray<Track>,
  userOverride?: InstallSpec["userOverride"],
): string[] {
  const selected = new Set(trackDefaultAssets(tracks));
  if (userOverride) {
    for (const id of userOverride.forceExclude) selected.delete(id);
    for (const id of userOverride.forceInclude) selected.add(id);
  }
  return [...selected].sort();
}

/**
 * v26.82.0 (Phase R, S6) — 자산 id 를 카테고리별로 묶어 정렬된 entries 반환 (출력 hierarchy 용).
 * install header ASSETS row 와 wizard confirm summary 가 공유.
 */
export function groupAssetsByCategory(assetIds: ReadonlyArray<string>): Array<[string, string[]]> {
  const map = new Map<string, string[]>();
  for (const id of assetIds) {
    const asset = EXTERNAL_ASSETS.find((a) => a.id === id);
    const cat = asset?.category ?? "other";
    const list = map.get(cat) ?? [];
    list.push(id);
    map.set(cat, list);
  }
  return [...map.entries()];
}
