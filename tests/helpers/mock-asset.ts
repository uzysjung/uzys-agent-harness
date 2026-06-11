import type { ExternalAsset } from "../../src/external-assets.js";

/**
 * v26.53.0 — Test mock factory. ExternalAsset 의 category/source 는 placeholder.
 *
 * Mock 을 사용하는 test 는 install method/condition 라우팅을 검증할 뿐,
 * category/source semantics 는 미사용. 본 helper 는 placeholder 명시 + boilerplate 제거.
 *
 * 실제 자산 (EXTERNAL_ASSETS) 의 category/source 검증은 `tests/external-assets.test.ts` 가 수행.
 */
export function createMockAsset(
  overrides: Partial<ExternalAsset> & Pick<ExternalAsset, "id" | "condition" | "method">,
): ExternalAsset {
  return {
    description: overrides.id,
    category: "dev-tools",
    source: "uzys",
    // v26.79.0 — tier 는 mock 라우팅 검증에 무관한 placeholder. 실 tier 검증은
    //   tests/external-assets.test.ts (catalog) 가 수행. overrides 로 덮어쓰기 가능.
    tier: "vetted",
    ...overrides,
  };
}
