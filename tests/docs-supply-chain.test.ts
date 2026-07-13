import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// WHY: unscoped `agent-harness` 는 npm 에 실재하는 제3자 패키지다
//   (`agent-harness@0.0.1`, maintainer quuu — 본 프로젝트와 무관, 2025-08 게시).
//   안내 문서가 `npx agent-harness` 로 표기하면 사용자가 복붙 시 제3자 코드를 실행한다
//   = 공급망 hijack. "보안 vetting 큐레이터" 를 wedge 로 내세우는 제품의 자기배신이라
//   게시 전 0건이어야 한다. 정답은 항상 scoped: `npx -y @uzysjung/agent-harness`.
//   출처: 2026-06-13 전체 서비스 감사 SUPPLY-1 / UX-1 (service-audit-roadmap.md).
//
//   이 테스트가 실패하면 = 누군가 안내 문서에 scope 를 빠뜨렸다는 뜻.
//   "광고 ≠ 실동작" drift 재발 차단 (no-false-ship: derive 또는 가드 없이 머지 금지).

// 사용자가 그대로 복붙할 수 있는 "설치 안내" 표면.
const GUIDE_FILES = [
  "README.md",
  "README.ko.md",
  "docs/USAGE.md",
  "docs/WORKFLOWS.md",
  "docs/COMPATIBILITY.md",
];

// `npx [-y] agent-harness …` 에서 패키지명이 바로 `agent-harness`(=제3자) 인 경우.
// scoped 정답 `npx -y @uzysjung/agent-harness` 는 `@` 때문에 매칭되지 않는다.
const BARE_NPX = /npx\s+(?:-y\s+)?agent-harness\b/g;

describe("문서 공급망 안전 (audit SUPPLY-1)", () => {
  for (const rel of GUIDE_FILES) {
    it(`${rel}: scope 없는 'npx agent-harness' 0건 — 제3자 quuu 패키지 실행 차단`, () => {
      const text = readFileSync(rel, "utf-8");
      const hits = text.match(BARE_NPX) ?? [];
      expect(
        hits,
        `${rel} 에 scope 누락 안내 발견: ${JSON.stringify(hits)} — 'npx -y @uzysjung/agent-harness' 로 교체할 것`,
      ).toEqual([]);
    });
  }
});

// WHY: 릴리즈 커밋 관례가 `package.json` bump만 하고 CHANGELOG 를 갱신하지 않아 v26.88.1 이후
//   7릴리즈(v26.89~95)가 미기록으로 drift 했다 (#196 에서 소급 backfill). 근본 차단은 구조적
//   게이트여야 한다 — no-false-ship: "주석/체크리스트 경고는 차단 수단으로 인정하지 않는다".
//   이 테스트는 현재 배포 버전(package.json)에 대응하는 CHANGELOG 항목이 없으면 `npm run ci` 를
//   실패시킨다. 릴리즈 커밋이 버전을 bump 하는 순간 로컬 게이트가 CHANGELOG 항목을 강제 → drift
//   재발이 구조적으로 불가능해진다. (`[Unreleased]` 는 항목이 아니므로 통과시키지 않는다.)
describe("CHANGELOG 현행성 게이트 (drift 재발 차단)", () => {
  it("package.json 현재 버전에 대응하는 CHANGELOG 항목이 존재한다", () => {
    const version = (JSON.parse(readFileSync("package.json", "utf-8")) as { version: string })
      .version;
    const changelog = readFileSync("CHANGELOG.md", "utf-8");
    const header = `## [v${version}]`;
    expect(
      changelog.includes(header),
      `CHANGELOG.md 에 '${header}' 항목이 없음 — 릴리즈 전 이 버전의 변경 내역을 [Unreleased] 아래에 추가하거나 버전 헤더로 승격할 것 (릴리즈 커밋이 package.json 만 bump 하면 이 게이트가 막는다).`,
    ).toBe(true);
  });
});
