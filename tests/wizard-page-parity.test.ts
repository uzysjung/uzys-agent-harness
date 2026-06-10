import { describe, expect, it } from "vitest";
import { CATEGORIES, type Category } from "../src/categories.js";
import { EXTERNAL_ASSETS } from "../src/external-assets.js";
import { INSTALL_TARGET_PAGES } from "../src/prompts.js";

/**
 * v26.78.1 회귀 가드 (no-false-ship): wizard Step 3 의 페이지 목록(INSTALL_TARGET_PAGES)이
 * 카테고리 전체를 덮어야 한다. v26.78.0 에서 `understanding` 카테고리가 페이지 하드코딩에서
 * 누락 → 신규 자산 3종이 wizard 에서 선택 불가, agent-browser 가 무인지 설치됨 (출하 거짓 광고).
 *
 * 이 테스트가 검증하는 WHY: 카테고리가 페이지에 없으면 해당 자산은 어떤 wizard 화면에도
 * 렌더되지 않으므로, "wizard 에서 선택 가능"이라는 광고가 거짓이 된다. 자산을 추가하면서
 * 새 카테고리를 만들면 반드시 페이지에도 배치해야 함을 강제한다.
 */
describe("wizard page parity (v26.78.1 — no-false-ship guard)", () => {
  it("every Category appears in exactly one wizard page", () => {
    const counts = new Map<Category, number>();
    for (const page of INSTALL_TARGET_PAGES) {
      for (const cat of page.cats) counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }
    for (const cat of CATEGORIES) {
      expect(counts.get(cat), `category "${cat}" must appear on exactly one wizard page`).toBe(1);
    }
  });

  it("includes the understanding category (v26.78.0 regression site)", () => {
    const allCats = INSTALL_TARGET_PAGES.flatMap((p) => p.cats);
    expect(allCats).toContain("understanding");
  });

  it("pages reference no category outside CATEGORIES (no orphan/typo)", () => {
    const known = new Set<string>(CATEGORIES);
    for (const page of INSTALL_TARGET_PAGES) {
      for (const cat of page.cats) {
        expect(known.has(cat), `page references unknown category "${cat}"`).toBe(true);
      }
    }
  });

  it("every asset's category is reachable from a wizard page", () => {
    const pageCats = new Set<string>(INSTALL_TARGET_PAGES.flatMap((p) => p.cats));
    for (const asset of EXTERNAL_ASSETS) {
      expect(
        pageCats.has(asset.category),
        `asset "${asset.id}" (category "${asset.category}") is not on any wizard page → unselectable`,
      ).toBe(true);
    }
  });
});
