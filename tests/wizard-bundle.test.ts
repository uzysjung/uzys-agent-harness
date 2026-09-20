import { describe, expect, it } from "vitest";
import { DEV_METHOD_SKILL_IDS, EXTERNAL_ASSETS } from "../src/external-assets.js";
import { buildPageGroups, INSTALL_TARGET_PAGES } from "../src/prompts.js";

/**
 * #421 ② (사용자 결정 2026-09-20, ADR-092) — 방법론 스킬은 개별 행이다. ADR-028 의 번들 행
 * ("uzys 하네스 방법론 N종")은 하나만 빼고 싶어도 못 빼고 각각의 설명이 없어 되돌렸다.
 */
describe("wizard 렌더: 방법론 스킬 개별 행 (ADR-092)", () => {
  const rendered = () =>
    INSTALL_TARGET_PAGES.flatMap((p) => buildPageGroups(p.cats, new Set<string>()).flatItems);

  it("방법론 스킬 각각이 자기 행으로 렌더되고 설명(hint)이 붙는다", () => {
    const items = rendered();
    for (const id of DEV_METHOD_SKILL_IDS) {
      const row = items.find((i) => i.value === `asset:${id}`);
      expect(row, `방법론 스킬 ${id} 가 어떤 페이지에도 개별 행으로 없다`).toBeDefined();
      expect(
        row?.hint,
        `${id} 행에 설명이 없다 — 이름만으로는 체크를 풀지 말지 판단할 수 없다`,
      ).toBeTruthy();
    }
  });

  it("번들 행은 더 없다 — 있으면 같은 스킬이 두 번 보인다", () => {
    expect(rendered().some((i) => i.value.startsWith("bundle:"))).toBe(false);
  });

  it("모든 카탈로그 자산이 어느 페이지엔가 개별 행으로 도달한다 (누락 0)", () => {
    const values = new Set(rendered().map((i) => i.value));
    for (const a of EXTERNAL_ASSETS) {
      expect(
        values,
        `자산 "${a.id}" 가 어떤 wizard 페이지에도 렌더되지 않음 → 선택 불가`,
      ).toContain(`asset:${a.id}`);
    }
  });
});

describe("wizard 페이지 행수 상한 (ADR-028)", () => {
  const MAX_ROWS = 30;

  it.each(
    INSTALL_TARGET_PAGES.map((p) => [p.label, p] as const),
  )(`%s: 표시 행수 ≤ ${MAX_ROWS}`, (_label, page) => {
    // 렌더 수식을 재구현하지 않고 buildPageGroups 의 **실제 출력**을 센다 (SOD 리뷰 Nit #1).
    //   초안은 `cat === "workflow" ? 1 : 0` 로 번들 위치를 재차 하드코딩했다 — 번들이 옮겨지면
    //   게이트 수식이 렌더와 조용히 갈려 "≤30" 수치가 허구가 되면서도 green 을 유지한다.
    const { groups } = buildPageGroups(page.cats, new Set<string>());
    const rows = Object.values(groups).reduce((n, items) => n + items.length + 1, 0); // + 헤더
    expect(
      rows,
      `${page.label} 가 ${rows}행 — 상한 ${MAX_ROWS} 초과. 페이지를 더 쪼개거나 묶을 것 (터미널 스크롤 발생)`,
    ).toBeLessThanOrEqual(MAX_ROWS);
  });
});
