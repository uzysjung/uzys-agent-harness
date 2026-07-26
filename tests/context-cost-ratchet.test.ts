import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { residentCost } from "../src/context-cost.js";
import { buildManifest } from "../src/manifest.js";
import { type InstallSpec, TRACKS } from "../src/types.js";

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
 */
interface Baseline {
  tracks: Record<string, number>;
}

const baseline = JSON.parse(
  readFileSync(new URL("../context-cost-baseline.json", import.meta.url), "utf8"),
) as Baseline;

/** cost:report · NORTH_STAR 게이트와 **같은 경로**로 잰다 (계측 경로가 갈리면 수치가 갈린다). */
function measure(track: string): number {
  const spec = { tracks: [track], cli: ["claude"], options: {} } as unknown as InstallSpec;
  return residentCost(buildManifest(spec).filter((e) => e.applies(spec))).total;
}

describe("상주 컨텍스트 비용 ratchet", () => {
  // 트랙 목록을 여기에 적지 않는다 — TRACKS 에서 derive 한다. 게이트가 커버 목록을 따로 들면
  // 그 목록이 두 번째 하드코딩 사본이 되고, 목록에 없는 트랙이 다음 서식지가 된다.
  it.each([...TRACKS])("track=%s 의 상주 비용이 baseline 을 넘지 않는다", (track) => {
    const recorded = baseline.tracks[track];
    expect(
      recorded,
      `baseline 에 track=${track} 이 없다. 새 트랙이 게이트를 그냥 지나가면 안 된다 — ` +
        "`npm run cost:baseline` 을 돌려 등재하라.",
    ).toBeDefined();

    const actual = measure(track);
    expect(
      actual,
      `track=${track} 상주 비용이 ~${recorded} → ~${actual} 로 늘었다 (+${actual - (recorded ?? 0)}). ` +
        "상주는 설치한 전원이 매 세션 무는 비용이라 오르지 않는 것이 기본값이다. " +
        "이 증가가 정당하면 `npm run cost:baseline` 로 갱신해 **같은 커밋에** 담아라 — " +
        "룰 대신 게이트/훅으로 착지시킬 수 있는지 먼저 확인할 것 (recurrence-prevention Level 1 pre-flight).",
    ).toBeLessThanOrEqual(recorded ?? 0);
  });

  // 위 단언만 있으면 baseline 을 크게 불려 두는 것으로 게이트를 무력화할 수 있다.
  // 기존 descriptor 예산 테스트가 쓰는 것과 같은 정직성 대조다.
  it.each([...TRACKS])("track=%s 의 baseline 이 실측보다 부풀려져 있지 않다", (track) => {
    const recorded = baseline.tracks[track] ?? 0;
    const actual = measure(track);
    expect(
      recorded,
      `baseline(~${recorded})이 실측(~${actual})보다 10% 넘게 높다 — 여유를 미리 확보해 두면 ` +
        "그만큼의 증가가 게이트를 그냥 통과한다. `npm run cost:baseline` 로 실측에 맞춰라.",
    ).toBeLessThanOrEqual(Math.ceil(actual * 1.1));
  });

  it("최소 트랙조차 무료가 아니다 — 이 숫자가 곧 설치자가 무는 하한", () => {
    const floor = Math.min(...TRACKS.map((t) => measure(t)));
    // 값 자체를 단언하지 않는다(그건 위 ratchet 의 일). 여기서 지키는 건 **하한이 존재하고
    // 계측된다**는 사실이다 — 0 이 나오면 계측이 죽은 것이지 비용이 없는 게 아니다.
    expect(floor).toBeGreaterThan(0);
  });
});
