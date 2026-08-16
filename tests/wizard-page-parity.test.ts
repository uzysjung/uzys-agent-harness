import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BASELINE_KINDS } from "../src/baseline-targets.js";
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

/**
 * 2026-08-16 (ADR-074) — 트랙 baseline 페이지 전수 가드.
 *
 * 위 카테고리 가드와 **같은 실패 모드, 다른 축**이다. 저쪽은 `EXTERNAL_ASSETS` 의 Category 가
 * 어느 페이지에도 없는 상태를 막고, 이쪽은 `BaselineKind` 가 그런 상태가 되는 것을 막는다.
 *
 * 왜 필요한가: 이 가드를 넣기 전에 baseline 페이지 **2개를 통째로 지우고** 전체 스위트를
 * 돌렸더니 25개가 전부 초록이었다. 데이터 계층(`listBaselineTargets`)과 설치 계층
 * (`runInstall` + `baselineExclude`)은 각자 테스트가 있는데, 그 둘을 잇는 **화면**이 사라져도
 * 아무도 안 문다 — 사용자에게는 기능이 통째로 없는 것과 같은데 CI 는 green 이다.
 * v26.78.0 이 `understanding` 카테고리로 당한 것과 같은 형태다.
 */
describe("트랙 baseline 페이지 parity (ADR-074)", () => {
  it("모든 BaselineKind 가 정확히 한 페이지에 배치된다", () => {
    const counts = new Map<string, number>(BASELINE_KINDS.map((k) => [k, 0]));
    for (const page of INSTALL_TARGET_PAGES) {
      for (const kind of page.baseline ?? []) {
        counts.set(kind, (counts.get(kind) ?? 0) + 1);
      }
    }
    for (const kind of BASELINE_KINDS) {
      expect(
        counts.get(kind),
        `BaselineKind "${kind}" 가 위저드 페이지에 ${counts.get(kind)}번 등장한다 — ` +
          "0이면 그 종류는 화면에서 선택 불가(기능이 사라진 것과 같다), 2 이상이면 중복 렌더다.",
      ).toBe(1);
    }
  });

  it("페이지가 알 수 없는 baseline 종류를 가리키지 않는다 (오타 가드)", () => {
    const known = new Set<string>(BASELINE_KINDS);
    for (const page of INSTALL_TARGET_PAGES) {
      for (const kind of page.baseline ?? []) {
        expect(known.has(kind), `페이지가 알 수 없는 baseline 종류 "${kind}" 를 가리킨다`).toBe(
          true,
        );
      }
    }
  });

  it("전제 확인 — baseline 을 배치한 페이지가 실제로 존재한다 (게이트 자기검증)", () => {
    // 위 두 테스트는 `page.baseline ?? []` 를 돈다. 필드가 어디에도 없으면 첫 테스트만 red 가
    // 되고 둘째는 조용히 통과하므로, 배치 자체가 있다는 것을 별도로 고정한다.
    expect(
      INSTALL_TARGET_PAGES.filter((p) => (p.baseline ?? []).length > 0).length,
    ).toBeGreaterThan(0);
  });

  /**
   * 문서가 말하는 페이지 수 = 코드의 페이지 수 (독립 리뷰 F6).
   *
   * `docs/USAGE.md` 는 이 PR 이 페이지를 5→7 로 늘린 뒤에도 "5 pages" 라고 적고 있었고,
   * **아무 테스트도 그걸 안 물었다** — 위 세 가드는 전부 코드끼리만 대조한다. `ship-checklist`
   * 의 Surface Parity 는 "문서 표기"를 도달 경로로 세므로, 여기가 그 경로의 게이트다.
   */
  it("USAGE.md 의 페이지 수가 INSTALL_TARGET_PAGES 와 같다", () => {
    const usage = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../docs/USAGE.md"),
      "utf8",
    );
    const stated = usage.match(/Install items\s+(\d+) pages/)?.[1];
    expect(stated, "USAGE.md 의 `Install items  <N> pages` 표기를 못 찾았다").toBeDefined();
    expect(Number(stated)).toBe(INSTALL_TARGET_PAGES.length);
  });

  it("USAGE.md 가 `--without baseline:` 를 적는다 (플래그 표면 parity)", () => {
    // ADR-074 결정 4 — 위저드에서 되는 것이 플래그로 안 되면 표면 비대칭이다. 플래그가 있는데
    // 문서에 없으면 사용자에게는 없는 것과 같으므로, 같은 자리에서 함께 문다.
    const usage = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../docs/USAGE.md"),
      "utf8",
    );
    expect(usage).toContain("--without baseline:");
    for (const kind of BASELINE_KINDS) expect(usage).toContain(`\`${kind}\``);
  });
});
