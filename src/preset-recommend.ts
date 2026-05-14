/**
 * Preset → Step 2 의 추천 ✓ 자산 매핑 (v26.44.0).
 *
 * Step 1 에서 선택된 preset 들의 condition 을 만족하는 외부 자산(plugin/skill/npm/npx)
 * 의 id 를 반환한다. Step 2 multiselect 의 초기 체크 상태에 사용.
 *
 * Option-gated 자산은 추천에 포함 X — 사용자가 의식적으로 토글해야 함
 * (uzys-harness, superpowers, addy-agent-skills, gsd-orchestrator, ECC suite 등).
 */

import { EXTERNAL_ASSETS, filterApplicableAssets } from "./external-assets.js";
import { DEFAULT_OPTIONS, type Track } from "./types.js";

/**
 * preset 1개 또는 N개 선택 시 추천 ✓ 자산 id 의 안정 정렬 배열.
 * - DEFAULT_OPTIONS 로 호출 → option-gated 자산은 모두 false → 추천에서 제외.
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
  return apps.map((a) => a.id).sort();
}
