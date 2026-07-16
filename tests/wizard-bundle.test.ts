import { describe, expect, it } from "vitest";
import type { Category } from "../src/categories.js";
import { DEV_METHOD_SKILL_IDS, EXTERNAL_ASSETS } from "../src/external-assets.js";
import { recommendedExternalAssets } from "../src/preset-recommend.js";
import {
  buildPageGroups,
  collapseDevMethodBundle,
  DEV_METHOD_BUNDLE_CATEGORY,
  DEV_METHOD_BUNDLE_VALUE,
  expandDevMethodBundle,
  INSTALL_TARGET_PAGES,
} from "../src/prompts.js";
import type { Track } from "../src/types.js";

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
   * all-or-none 불변식 — 이 설계의 안전성 전체가 여기 걸려 있다.
   *
   * 접기는 "멤버가 하나라도 있으면 번들 체크"이므로, **부분집합이 접기에 도달하면** 펼치기가
   * 나머지를 **조용히 추가**한다 = 사용자가 고르지 않은 자산 설치(no-false-ship 위반).
   *
   * v26.99.0 초안은 이를 `condition.kind` 가 전부 같은지로 단언했다 — **프록시였고 불충분했다**
   * (SOD 리뷰 Important #1). `recommendedExternalAssets` 는 **2축**으로 거른다:
   *   ① condition (`filterApplicableAssets`)  ② `tier !== "experimental"` (preset-recommend.ts:29)
   * 그래서 `tier: experimental` + `has-dev-track` 인 dev-method 가 생기면 condition 단언은
   * **통과**하면서 recommended 는 진부분집합이 되고 → 접기가 experimental 자산을 강제 설치한다
   * (T3 opt-in 정책 우회 — PRD v26-71 R6/AC4).
   *
   * → 프록시 대신 **실제 생산자**를 단언한다: recommended ∩ members ∈ {∅, 전체}.
   *   축이 몇 개든, 앞으로 필터가 추가되든 참인 진짜 속성.
   */
  it("불변식: recommended ∩ 방법론멤버 ∈ {∅, 전체} — 부분집합이면 접기가 자산을 조용히 추가", () => {
    const memberIds = new Set<string>(DEV_METHOD_SKILL_IDS);
    // dev 트랙(방법론 추천됨) + non-dev 트랙(추천 안 됨) 양쪽에서 확인.
    for (const tracks of [["tooling"], ["csr-supabase"], ["executive"], []] as Track[][]) {
      const rec = recommendedExternalAssets(tracks).filter((id) => memberIds.has(id));
      expect(
        rec.length === 0 || rec.length === DEV_METHOD_SKILL_IDS.length,
        `tracks=[${tracks.join(",")}] 에서 recommended 가 방법론 ${rec.length}/${DEV_METHOD_SKILL_IDS.length} 개 = 부분집합 → ` +
          "접기(anyMember→체크) + 펼치기(→전체)가 사용자가 고르지 않은 자산을 설치한다. " +
          "원인 후보: 멤버 간 condition 불일치, 또는 tier=experimental 멤버(preset-recommend 가 거름).",
      ).toBe(true);
    }
  });
});

/**
 * WHY (SOD 리뷰 Important #2): `buildPageGroups` 는 **dev-method 8종을 wizard 에서 도달 가능하게
 * 만드는 유일한 코드**인데 테스트가 하나도 닿지 않았다. 8종은 자기 카테고리(dev-tools·workflow)에서
 * 필터링되고 번들 row 로만 대표되므로, `wizard-page-parity`("자산의 카테고리가 페이지에 있다")는
 * 이 8종에 대해 **더 이상 도달성을 증명하지 않는다**(비논리). 번들 row 블록을 지우면 8종이
 * **어디서도 선택 불가**가 되는데 parity·행수·collapse/expand 테스트가 전부 통과하고 CI 는 green —
 * v26.78.0 거짓출하("wizard 에서 선택 가능"이 거짓)의 정확한 재현. 그래서 렌더를 직접 단언한다.
 */
describe("wizard 렌더: 번들 row 도달성 (ADR-028)", () => {
  const render = (cats: ReadonlyArray<Category>) => buildPageGroups(cats, new Set<string>());

  it("번들 row 가 실제로 렌더된다 — 8종의 유일한 wizard 도달 경로", () => {
    const { flatItems } = render([DEV_METHOD_BUNDLE_CATEGORY]);
    const row = flatItems.find((i) => i.value === DEV_METHOD_BUNDLE_VALUE);
    expect(row, "번들 row 미렌더 → 방법론 8종이 wizard 어디서도 선택 불가").toBeDefined();
  });

  it("번들 row 가 구성원 id 를 전부 노출한다 — 접기가 '무엇이 설치되는지'를 숨기지 않는다", () => {
    const { flatItems } = render([DEV_METHOD_BUNDLE_CATEGORY]);
    const row = flatItems.find((i) => i.value === DEV_METHOD_BUNDLE_VALUE);
    for (const id of DEV_METHOD_SKILL_IDS) expect(row?.hint ?? "").toContain(id);
  });

  it("어느 페이지에서도 방법론 멤버가 개별 row 로 렌더되지 않는다 (= 8행 압축 성립)", () => {
    for (const page of INSTALL_TARGET_PAGES) {
      const { flatItems } = render(page.cats);
      for (const id of DEV_METHOD_SKILL_IDS) {
        expect(
          flatItems.map((i) => i.value),
          `${page.label} 에 개별 row \`asset:${id}\` 잔존 → 번들과 중복 표시`,
        ).not.toContain(`asset:${id}`);
      }
    }
  });

  it("번들 구성원을 제외한 모든 자산은 여전히 개별 row 로 도달 가능 (누락 0)", () => {
    const rendered = new Set(
      INSTALL_TARGET_PAGES.flatMap((p) => render(p.cats).flatItems.map((i) => i.value)),
    );
    const members = new Set<string>(DEV_METHOD_SKILL_IDS);
    for (const a of EXTERNAL_ASSETS) {
      if (members.has(a.id)) continue;
      expect(
        rendered,
        `자산 "${a.id}" 가 어떤 wizard 페이지에도 렌더되지 않음 → 선택 불가`,
      ).toContain(`asset:${a.id}`);
    }
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
