import { describe, expect, it } from "vitest";
import { DEV_METHOD_SKILL_IDS, EXTERNAL_ASSETS } from "../src/external-assets.js";
import {
  collapseDevMethodBundle,
  DEV_METHOD_BUNDLE_VALUE,
  expandDevMethodBundle,
  INSTALL_TARGET_PAGES,
} from "../src/prompts.js";

const members = () => DEV_METHOD_SKILL_IDS.map((id) => `asset:${id}`);

/**
 * WHY (v26.99.0, ADR-028): dev-method 8종은 전부 has-dev-track = 기본 설치다. 사실상 선택이
 * 아닌데 wizard 체크박스 8행을 점유해 진짜 선택(서드파티 큐레이션)을 밀어냈다(사용자 지적
 * 2026-07-16). 이를 단일 번들 row 로 접되, **표현 계층에서만** 접는다 — 제출 시 개별 asset id
 * 로 펼쳐 downstream(computeUserOverride·installer·설치 보고)이 8종을 그대로 보게 한다.
 *
 * 이 테스트가 지키는 계약: 접기/펼치기가 **자산을 추가하거나 잃지 않는다**. 깨지면 사용자가
 * 고른 것과 설치되는 것이 달라진다 — 이 프로젝트가 가장 경계하는 "광고 ≠ 실동작"(no-false-ship).
 */
describe("dev-method 번들 접기/펼치기 (ADR-028)", () => {
  it("round-trip: 접었다 펼치면 원래 자산 집합이 보존된다", () => {
    const input = [...members(), "asset:karpathy-coder", "option:withPrune"];
    const restored = expandDevMethodBundle(collapseDevMethodBundle(input));
    expect(new Set(restored)).toEqual(new Set(input));
  });

  it("접기: 8종이 1개 번들 row 로 줄어든다 (비-멤버는 불변)", () => {
    const collapsed = collapseDevMethodBundle([...members(), "asset:karpathy-coder"]);
    expect(collapsed).toContain(DEV_METHOD_BUNDLE_VALUE);
    expect(collapsed).toContain("asset:karpathy-coder");
    // 멤버는 개별로 남지 않는다 — 남으면 wizard 에 8행이 그대로 보인다(= 압축 실패).
    for (const m of members()) expect(collapsed).not.toContain(m);
    expect(collapsed).toHaveLength(2);
  });

  it("펼치기: 번들 체크 → 8종 전부 설치 대상", () => {
    const expanded = expandDevMethodBundle([DEV_METHOD_BUNDLE_VALUE, "asset:karpathy-coder"]);
    for (const m of members()) expect(expanded).toContain(m);
    expect(expanded).not.toContain(DEV_METHOD_BUNDLE_VALUE);
  });

  it("해제 시맨틱: 번들 미체크 → 8종 전부 제외 (사용자 확정 2026-07-16)", () => {
    // 체크박스 1개 = 의미 1개. 개별 예외는 --with/--without 로만.
    const expanded = expandDevMethodBundle(["asset:karpathy-coder"]);
    for (const m of members()) expect(expanded).not.toContain(m);
    expect(expanded).toEqual(["asset:karpathy-coder"]);
  });

  it("번들 없는 입력은 손대지 않는다 (non-dev 트랙 = 방법론 미추천)", () => {
    const input = ["asset:c-level-skills", "asset:finance-skills"];
    expect(collapseDevMethodBundle(input)).toEqual(input);
    expect(expandDevMethodBundle(input)).toEqual(input);
  });

  /**
   * all-or-none 불변식. 접기는 "멤버가 하나라도 있으면 번들 체크"로 동작하므로, 8종이 서로 다른
   * condition 을 갖게 되면 recommended 가 부분집합이 되고 → 접기가 나머지를 **조용히 추가**한다
   * (사용자가 고르지 않은 자산 설치 = no-false-ship 위반). 조건이 같은 한 부분집합은 생기지 않는다.
   * 이 테스트는 그 전제를 코드로 못박는다 — 누군가 dev-method 하나의 condition 을 바꾸면 즉시 실패.
   */
  it("불변식: dev-method 8종은 모두 같은 condition(has-dev-track) — 부분선택 불가", () => {
    const conds = DEV_METHOD_SKILL_IDS.map((id) => {
      const a = EXTERNAL_ASSETS.find((x) => x.id === id);
      if (!a) throw new Error(`dev-method 자산 누락: ${id}`);
      return a.condition.kind;
    });
    expect(
      new Set(conds),
      "dev-method condition 이 갈리면 번들 접기가 자산을 조용히 추가한다",
    ).toEqual(new Set(["has-dev-track"]));
  });
});

/**
 * WHY (v26.99.0): prompts.ts 는 "페이지당 옵션 ≤ ~30" 을 clack groupMultiselect 의 maxItems
 * 한계 회피 근거로 명시한다. 그런데 Dev 단일 페이지가 37행(옵션 32 + 헤더 5)으로 자기 제약을
 * 위반하고 있었다 — 터미널을 넘겨 스크롤이 생기는 것이 사용자가 보고한 "선택 row 가 너무 많다"의
 * 실제 메커니즘이었다. 자산이 늘수록 재발하므로 수치를 게이트로 못박는다(주석 경고 ≠ 차단 수단).
 */
describe("wizard 페이지 행수 상한 (ADR-028)", () => {
  const MAX_ROWS = 30;

  it.each(
    INSTALL_TARGET_PAGES.map((p) => [p.label, p] as const),
  )(`%s: 표시 행수 ≤ ${MAX_ROWS}`, (_label, page) => {
    let rows = 0;
    for (const cat of page.cats) {
      const devMethod = new Set<string>(DEV_METHOD_SKILL_IDS);
      const assets = EXTERNAL_ASSETS.filter((a) => a.category === cat && !devMethod.has(a.id));
      const bundleRow = cat === "workflow" ? 1 : 0;
      const items = assets.length + bundleRow;
      if (items === 0) continue;
      rows += items + 1; // + 카테고리 헤더
    }
    expect(
      rows,
      `${page.label} 가 ${rows}행 — 상한 ${MAX_ROWS} 초과. 페이지를 더 쪼개거나 묶을 것 (터미널 스크롤 발생)`,
    ).toBeLessThanOrEqual(MAX_ROWS);
  });
});
