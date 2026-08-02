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
 *
 * v26.140.0 — 트랙당 값이 스칼라(토큰)에서 `{ items, tokens }` 로 바뀌었다. 1차 축은 **items**
 * (개수), tokens 는 부수 표시값이자 기존 ratchet 유지분이다. 둘 다 상한이며 어느 한쪽만 넘어도
 * 게이트가 막는다 — 토큰 검사를 스키마 변경으로 조용히 잃는 것이 이 마이그레이션의 최대 위험이라
 * `tests/context-cost-ratchet.test.ts` 가 두 키의 **존재와 타입**을 각각 단언한다.
 *
 * resident-cost-display: none — 이 스크립트는 사용자에게 상주 비용을 **표시하는 표면이 아니다**.
 * 방금 쓴 JSON 을 개발자에게 되읽어 주는 확인용 echo 라 표시 계약(`formatResidentCost*` 경유)의
 * 대상이 아니다. 면제는 이렇게 파일 안에서 스스로 밝힌다 (기본값 = 검사,
 * tests/context-cost-display-parity.test.ts).
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildManifest, residentCost, TRACKS } from "../dist/trust-tier-drift.js";

const OUT = fileURLToPath(new URL("../context-cost-baseline.json", import.meta.url));

const tracks = {};
for (const track of TRACKS) {
  const spec = { tracks: [track], cli: ["claude"], options: {} };
  const r = residentCost(buildManifest(spec).filter((e) => e.applies(spec)));
  tracks[track] = { items: r.items.total, tokens: r.total };
}

writeFileSync(
  OUT,
  `${JSON.stringify(
    {
      $comment:
        "상주 컨텍스트 비용 상한(ratchet). 값을 올리려면 그 증가를 정당화하는 커밋에서 함께 올린다 — 조용한 증가를 막는 것이 이 파일의 전부다. 갱신: npm run cost:baseline",
      units: {
        items:
          "상주 항목 수 (rules + skills + agents + CLAUDE.md 2종: 하네스 앵커 루트 `CLAUDE-uzys-harness.md` + 프로젝트 스캐폴드 루트 `CLAUDE.md`) — 1차 축",
        tokens: "tokens/session (chars/4 근사 — 실측이 아니라 규약값) — 부수 표시값",
      },
      tracks,
    },
    null,
    2,
  )}\n`,
  "utf8",
);

const rows = Object.entries(tracks).sort((a, b) => b[1].items - a[1].items);
console.log(`▸ context-cost baseline 갱신 → ${OUT}\n`);
for (const [track, v] of rows)
  console.log(`  ${track.padEnd(20)} ${String(v.items).padStart(3)}개  ~${v.tokens} tok`);
