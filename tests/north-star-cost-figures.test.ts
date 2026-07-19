import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { residentCost } from "../src/context-cost.js";
import { buildManifest } from "../src/manifest.js";

// NORTH_STAR 가 광고하는 1차 NSM 수치 ↔ 실제 계측의 정합 게이트.
//
// 왜 필요한가: 이 수치는 `npm run cost:report` 가 파일에서 derive 하는데 NORTH_STAR 는 그것을
// **수기로 옮겨 적는다**. 같은 사실이 두 곳에 있으면 한쪽만 갱신되고, 그게 이미 3번 일어났다 —
// v26.117.0 최초 계측 · ADR-045 에서 +246 갱신 · 그리고 v26.121.0 에서 CL-v2 description 을
// 정직화하느라 110자 늘리면서 **수치 정정 커밋 자신이** 새 stale(5,440 vs 실측 5,467)을 낳았다.
//
// "실측"이라는 단어를 달고 틀린 값을 광고하는 것은 no-false-ship 위반이고, 이 문서는 제품의
// 차별화 주장이 걸린 곳이라 특히 그렇다. 규약(프로즈)으로 2번 실패했으므로 게이트로 내린다
// (recurrence-prevention 사다리: 기록 → 룰 → 구조).
//
// 왜 tolerance 를 두지 않는가: 근사 허용은 "조금 틀린 것은 괜찮다"를 제도화한다. 수치가
// 바뀌었으면 문서도 바뀌어야 한다 — 그 강제가 이 게이트의 전부다.

const TRACK = "tooling";
const northStar = readFileSync(new URL("../docs/NORTH_STAR.md", import.meta.url), "utf8");

/** cost:report 와 동일한 경로로 실측한다 (scripts/context-cost-report.mjs 참조). */
function measured() {
  const spec = { tracks: [TRACK], cli: ["claude"], options: {} } as Parameters<
    typeof buildManifest
  >[0];
  return residentCost(buildManifest(spec).filter((e) => e.applies(spec)));
}

/** "~5,467" / "~574" 처럼 쉼표가 있을 수도 없을 수도 있는 표기를 숫자로. */
function statedFigure(label: string): number {
  const m = new RegExp(`${label}\\s*~([\\d,]+)`).exec(northStar);
  if (!m?.[1])
    throw new Error(
      `NORTH_STAR 에서 "${label}" 수치를 못 찾았다 — 표기가 바뀌었으면 이 게이트도 같이 고쳐라`,
    );
  return Number(m[1].replace(/,/g, ""));
}

describe("NORTH_STAR 상주 비용 수치 ↔ 실측", () => {
  const r = measured();

  it("총합이 실측과 일치한다", () => {
    // 이 줄이 빨간불이면 고칠 곳은 테스트가 아니라 NORTH_STAR 다: npm run cost:report 를 돌려
    // 나온 값을 옮겨 적어라. 자산의 frontmatter 를 한 글자만 고쳐도 여기가 움직인다.
    // 총합만 표기가 다르다(`**상주 ~5,467 tokens/세션**`) — 내역용 helper 와 패턴을 공유하지 않는다.
    const m = /상주\s*\*{0,2}~([\d,]+)\s*tokens/.exec(northStar);
    if (!m?.[1])
      throw new Error(
        "NORTH_STAR 에서 상주 총합 표기를 못 찾았다 — 표기가 바뀌었으면 이 게이트도 같이 고쳐라",
      );
    expect(Number(m[1].replace(/,/g, ""))).toBe(r.total);
  });

  it("표면별 내역 4개가 각각 실측과 일치한다", () => {
    // 총합만 재면 두 표면이 반대로 움직여 상쇄될 때 통과한다 — 내역까지 고정해야 가드다.
    expect(statedFigure("rules")).toBe(r.rules);
    expect(statedFigure("CLAUDE\\.md")).toBe(r.projectClaudeMd);
    expect(statedFigure("agent descriptors")).toBe(r.agentDescriptors);
    expect(statedFigure("skill descriptors")).toBe(r.skillDescriptors);
  });

  it("실측 수치를 실제로 읽고 있다 (시어터 방지)", () => {
    // 위 단언들이 0 == 0 으로 통과하는 상태를 막는다. residentCost 가 빈 계획을 받거나
    // 정규식이 아무것도 못 잡으면 이 테스트가 먼저 죽는다.
    expect(r.total).toBeGreaterThan(1000);
    expect(r.rules).toBeGreaterThan(0);
    expect(r.skillDescriptors).toBeGreaterThan(0);
    expect(r.agentDescriptors).toBeGreaterThan(0);
    expect(r.projectClaudeMd).toBeGreaterThan(0);
  });
});
