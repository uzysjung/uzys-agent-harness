#!/usr/bin/env node
/**
 * 상주 컨텍스트 비용 baseline 갱신 — `npm run cost:baseline`.
 *
 * 왜 필요한가: `npm run cost:report` 는 **지금 얼마인가**를 보여주고, NORTH_STAR 정합 게이트는
 * 문서에 적힌 수치가 **정확한가**를 지킨다. 둘 다 통과하면서 상주 비용이 무한히 커질 수 있다 —
 * 늘어난 만큼 문서를 고치면 양쪽 다 초록불이기 때문이다. 이 파일은 **얼마나 늘었는가**를 잡는다.
 *
 * 트랙 목록은 `TRACKS` 에서 derive 한다. 새 트랙이 생겨도 baseline 이 자동으로 그 트랙을 요구하므로
 * (게이트가 커버 목록을 따로 들고 있지 않다) 열거 사본이 생기지 않는다.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildManifest, residentCost, TRACKS } from "../dist/trust-tier-drift.js";

const OUT = fileURLToPath(new URL("../context-cost-baseline.json", import.meta.url));

const tracks = {};
for (const track of TRACKS) {
  const spec = { tracks: [track], cli: ["claude"], options: {} };
  const r = residentCost(buildManifest(spec).filter((e) => e.applies(spec)));
  tracks[track] = r.total;
}

writeFileSync(
  OUT,
  `${JSON.stringify(
    {
      $comment:
        "상주 컨텍스트 비용 상한(ratchet). 값을 올리려면 그 증가를 정당화하는 커밋에서 함께 올린다 — 조용한 증가를 막는 것이 이 파일의 전부다. 갱신: npm run cost:baseline",
      unit: "tokens/session (chars/4 근사 — 실측이 아니라 규약값)",
      tracks,
    },
    null,
    2,
  )}\n`,
  "utf8",
);

const rows = Object.entries(tracks).sort((a, b) => b[1] - a[1]);
console.log(`▸ context-cost baseline 갱신 → ${OUT}\n`);
for (const [track, total] of rows) console.log(`  ${track.padEnd(20)} ~${total}`);
