import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { residentCost } from "../src/context-cost.js";
import { buildAssetSpec, buildManifest } from "../src/manifest.js";
import { DEFAULT_OPTIONS, TRACKS, type Track } from "../src/types.js";

/**
 * 상주 컨텍스트 비용의 **성장** 게이트 (v26.136.0).
 *
 * 이미 있던 것과 없던 것을 먼저 갈라 두자 — 안 그러면 이 파일이 중복이 된다:
 *   - `npm run cost:report` = 지금 얼마인가 (표시)
 *   - `north-star-cost-figures.test.ts` = 문서에 적힌 수치가 정확한가 (정합)
 *   - **이 파일** = 얼마나 늘었는가 (성장)
 *
 * 앞의 둘은 상주 비용이 무한히 커지는 것을 못 막는다. 늘어난 만큼 문서를 고치면 양쪽 다
 * 초록불이기 때문이다. 실측이 그 구멍을 확인해 줬다 — 이 리포 `.claude/rules` 는 도입 이후
 * 2.7배가 됐고 그동안 두 게이트는 계속 통과했다.
 *
 * 규율: 상주 비용은 **오르지 않는 것이 기본값**이다. 올리려면 `npm run cost:baseline` 로
 * baseline 을 갱신해 **같은 커밋에 증가를 명시**해야 한다. 조용한 증가를 막는 것이 전부다.
 *
 * v26.140.0 — 축이 둘이 됐다. **1차 = 항목 수(items)**, 부수 = 토큰.
 * 토큰은 실측상 금전적으로 무의미했지만(ADR-051) 항목 수는 교차참조·모순·drift·유지보수 비용을
 * 직접 끌고 온다. 토큰 ratchet 을 없애지 않고 **나란히** 두는 이유: 한 축만 두면 다른 축으로
 * 새는 리팩터링(룰 10개를 1개 초대형 파일로 합치기 = items 감소, tokens 그대로)이 지표상
 * 개선으로 보인다. 두 축이 서로의 굿하트 구멍을 막는다.
 */
interface BaselineEntry {
  items: number;
  tokens: number;
}

interface Baseline {
  tracks: Record<string, BaselineEntry>;
}

const baseline = JSON.parse(
  readFileSync(new URL("../context-cost-baseline.json", import.meta.url), "utf8"),
) as Baseline;

/** cost:report · NORTH_STAR 게이트와 **같은 경로**로 잰다 (계측 경로가 갈리면 수치가 갈린다). */
function measure(track: string): BaselineEntry {
  // spec 을 손으로 조립하지 않는다 — installer 와 **같은 derive**(`buildAssetSpec`)를 부른다.
  // 손조립이던 동안 `selectedInternalSkills` 가 비어 번들 스킬 11종이 계측에서 통째로 빠졌다(#320).
  const spec = buildAssetSpec({ tracks: [track as Track], options: DEFAULT_OPTIONS });
  const r = residentCost(buildManifest(spec).filter((e) => e.applies(spec)));
  return { items: r.items.total, tokens: r.total };
}

/**
 * 축별 라벨/단위/과대 허용치 — 두 축의 단언을 한 벌로 유지한다 (한쪽에만 검사가 붙는 비대칭 방지).
 *
 * **허용치가 축마다 다른 이유: 단위가 다르면 허용치도 달라야 한다.**
 * 토큰은 연속량이다 — 문장 몇 개를 다듬으면 수십이 움직이므로 비율(10%) 여유가 필요하다.
 * 개수는 이산량이다 — 자산 하나가 곧 1이라 같은 10% 를 주면 `full` 이 47 → 51 까지 통과하고,
 * 그건 정당화 없이 자산 4개가 들어올 여지다. 즉 비율 허용치는 개수 축을 사실상 무검사로 만든다.
 * 그래서 개수만 절대 허용치 `+1` (반올림/경계 1건까지만 눈감아 준다).
 */
const AXES = [
  {
    key: "items" as const,
    label: "상주 항목 수",
    unit: "개",
    cap: (actual: number): number => actual + 1,
    capLabel: "실측 +1",
  },
  {
    key: "tokens" as const,
    label: "상주 토큰",
    unit: " tok",
    cap: (actual: number): number => Math.ceil(actual * 1.1),
    capLabel: "실측 +10%",
  },
];

describe("상주 컨텍스트 비용 ratchet", () => {
  // 트랙 목록을 여기에 적지 않는다 — TRACKS 에서 derive 한다. 게이트가 커버 목록을 따로 들면
  // 그 목록이 두 번째 하드코딩 사본이 되고, 목록에 없는 트랙이 다음 서식지가 된다.
  it.each([...TRACKS])("track=%s 의 baseline 이 두 축을 다 기록한다", (track) => {
    const recorded = baseline.tracks[track];
    expect(
      recorded,
      `baseline 에 track=${track} 이 없다. 새 트랙이 게이트를 그냥 지나가면 안 된다 — ` +
        "`npm run cost:baseline` 을 돌려 등재하라.",
    ).toBeDefined();
    // 스키마가 스칼라(구 형식)로 되돌아가거나 한 축이 빠지면 그 축의 상한 비교가 `undefined`
    // 와의 비교로 무력화된다 — 토큰 검사를 조용히 잃는 것이 이 마이그레이션의 최대 위험이라
    // 존재/타입을 명시적으로 문다.
    for (const axis of AXES) {
      expect(
        typeof recorded?.[axis.key],
        `baseline.tracks.${track}.${axis.key} 가 숫자가 아니다 — 스키마가 어긋나면 상한 검사가 ` +
          "조용히 통과한다. `npm run cost:baseline` 으로 재생성하라.",
      ).toBe("number");
    }
  });

  it.each(
    TRACKS.flatMap((track) => AXES.map((axis) => [track, axis.label, axis] as const)),
  )("track=%s 의 %s 가 baseline 을 넘지 않는다", (track, _label, axis) => {
    const recorded = baseline.tracks[track]?.[axis.key];
    const actual = measure(track)[axis.key];
    expect(
      actual,
      `track=${track} ${axis.label}이 ${recorded}${axis.unit} → ${actual}${axis.unit} 로 늘었다 ` +
        `(+${actual - (recorded ?? 0)}${axis.unit}). 상주는 설치한 전원이 매 세션 무는 비용이라 ` +
        "오르지 않는 것이 기본값이다. 이 증가가 정당하면 `npm run cost:baseline` 로 갱신해 " +
        "**같은 커밋에** 담아라 — 룰 대신 게이트/훅으로 착지시킬 수 있는지 먼저 확인할 것 " +
        "(recurrence-prevention Level 1 pre-flight).",
    ).toBeLessThanOrEqual(recorded ?? 0);
  });

  // 위 단언만 있으면 baseline 을 크게 불려 두는 것으로 게이트를 무력화할 수 있다.
  // 기존 descriptor 예산 테스트가 쓰는 것과 같은 정직성 대조다.
  it.each(
    TRACKS.flatMap((track) => AXES.map((axis) => [track, axis.label, axis] as const)),
  )("track=%s 의 %s baseline 이 실측보다 부풀려져 있지 않다", (track, _label, axis) => {
    const recorded = baseline.tracks[track]?.[axis.key] ?? 0;
    const actual = measure(track)[axis.key];
    expect(
      recorded,
      `${axis.label} baseline(${recorded}${axis.unit})이 실측(${actual}${axis.unit}) 대비 허용치` +
        `(${axis.capLabel})를 넘는다 — 여유를 미리 확보해 두면 그만큼의 증가가 게이트를 그냥 ` +
        "통과한다. `npm run cost:baseline` 로 실측에 맞춰라.",
    ).toBeLessThanOrEqual(axis.cap(actual));
  });

  it("최소 트랙조차 무료가 아니다 — 이 숫자가 곧 설치자가 무는 하한", () => {
    const floorTokens = Math.min(...TRACKS.map((t) => measure(t).tokens));
    const floorItems = Math.min(...TRACKS.map((t) => measure(t).items));
    // 값 자체를 단언하지 않는다(그건 위 ratchet 의 일). 여기서 지키는 건 **하한이 존재하고
    // 계측된다**는 사실이다 — 0 이 나오면 계측이 죽은 것이지 비용이 없는 게 아니다.
    expect(floorTokens).toBeGreaterThan(0);
    expect(floorItems).toBeGreaterThan(0);
  });
});
