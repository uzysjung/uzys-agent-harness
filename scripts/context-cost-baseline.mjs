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
import {
  buildAssetSpec,
  buildManifest,
  DEFAULT_OPTIONS,
  INTERNAL_BUNDLED_SKILL_IDS,
  residentCost,
  TRACKS,
} from "../dist/trust-tier-drift.js";

const OUT = fileURLToPath(new URL("../context-cost-baseline.json", import.meta.url));

// ADR-083 — 축을 갈라 기록한다. `directive` 만 ratchet 이고, `firing` 은 추이 기록 +
// **스킬별** 상한(아래 skillDescriptors)이 맡는다. 총합을 하나로 두면 스킬을 추가할 때마다
// 빨간불이 뜨고, 그건 좋은 일을 하면 나빠지는 지표다.
const tracks = {};
for (const track of TRACKS) {
  // installer 와 같은 derive (#320) — 손조립 spec 은 번들 스킬 descriptor 를 통째로 빠뜨린다.
  const spec = buildAssetSpec({ tracks: [track], options: DEFAULT_OPTIONS });
  const r = residentCost(buildManifest(spec).filter((e) => e.applies(spec)));
  tracks[track] = {
    directive: { items: r.directive.items, tokens: r.directive.tokens },
    firing: { items: r.firing.items, tokens: r.firing.tokens },
  };
}

// 스킬별 descriptor 상한.
//
// **모집단은 번들 스킬 전체다** — 트랙 기본 설치분만 모으면 opt-in 스킬 3종이 상한 밖에 남고,
// 그것을 고른 설치자에게는 상한 없이 커질 수 있다(독립 리뷰 MEDIUM). `selectedInternalSkills`
// 에 전부 넣어 한 번에 잰다.
const skillDescriptors = {};
{
  const spec = buildAssetSpec({ tracks: [...TRACKS], options: DEFAULT_OPTIONS });
  const all = { ...spec, selectedInternalSkills: INTERNAL_BUNDLED_SKILL_IDS };
  const r = residentCost(buildManifest(all).filter((e) => e.applies(all)));
  for (const [id, tok] of Object.entries(r.perSkillDescriptor)) {
    skillDescriptors[id] = Math.max(skillDescriptors[id] ?? 0, tok);
  }
}

writeFileSync(
  OUT,
  `${JSON.stringify(
    {
      $comment:
        "상주 컨텍스트 비용 상한(ratchet, ADR-083). 조용한 증가를 막는 것이 이 파일의 전부다. 갱신: npm run cost:baseline",
      axes: {
        directive:
          "우리가 항상 읽히게 넣은 지시문 = 룰 + CLAUDE.md 2종(하네스 앵커 + 프로젝트 스캐폴드). **여기가 감축 대상이고 ratchet 이 무는 축이다.** 올리려면 사유를 커밋 본문에 남긴다.",
        firing:
          "스킬·에이전트가 발화하려고 상주시키는 descriptor. **총합에는 ratchet 을 걸지 않는다** — 자산을 추가하면 늘고, 그건 선택이지 악화가 아니다. 대신 아래 skillDescriptors 가 기존 스킬의 조용한 증가만 막는다.",
        skillDescriptors:
          "스킬 id → descriptor 토큰 상한(전 트랙 최대). 여기 없는 id = 새 스킬이라 비교 대상이 없다(red 안 난다). 기존 스킬을 키우려면 발화 정확도상 필요한 이유를 커밋에 적고 갱신한다.",
      },
      units: { tokens: "tokens/session (chars/4 근사 — 실측이 아니라 규약값)" },
      tracks,
      skillDescriptors,
    },
    null,
    2,
  )}\n`,
  "utf8",
);

const rows = Object.entries(tracks).sort((a, b) => b[1].directive.tokens - a[1].directive.tokens);
console.log(`▸ context-cost baseline 갱신 → ${OUT}\n`);
console.log("  track                 지시문(ratchet)      발화 표면(기록)");
for (const [track, v] of rows)
  console.log(
    `  ${track.padEnd(20)} ${String(v.directive.items).padStart(3)}개 ~${String(v.directive.tokens).padStart(5)}` +
      `      ${String(v.firing.items).padStart(3)}개 ~${String(v.firing.tokens).padStart(5)}`,
  );
console.log(`\n  스킬 descriptor 상한: ${Object.keys(skillDescriptors).length}종 기록`);
