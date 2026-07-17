import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  assetCliSupport,
  DEV_METHOD_SKILL_IDS,
  EXTERNAL_ASSETS,
  INTERNAL_BUNDLED_SKILL_IDS,
} from "../src/external-assets.js";
import { CLI_BASES } from "../src/types.js";

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

// WHY: 2026-07-14 harness-audit 가 카탈로그 총계 drift 를 여러 표면에서 발견 —
//   index.html "49/58"(실측 61), roadmap "58 자산", COMPATIBILITY "51/61". ship-checklist 의
//   "SSOT 동기화" 체크박스는 8+ 릴리즈 동안 지켜지지 않아 drift 가 48→58→61 로 반복됐다.
//   no-false-ship: "체크박스 경고 ≠ 차단 수단". 이 게이트는 사용자-도달 문서의 카탈로그 총계(분모)를
//   EXTERNAL_ASSETS.length 에서 derive 해 대조한다 — 자산 추가/제거 후 문서(또는 gen:compat)를
//   갱신하지 않으면 `npm run ci` 가 실패한다.
describe("카탈로그 총계 문서 동기화 게이트 (audit 2026-07-14 drift 차단)", () => {
  const total = EXTERNAL_ASSETS.length;

  it(`COMPATIBILITY.md 자동생성 블록이 '자산 ${total}' 반영 (gen:compat 최신)`, () => {
    const text = readFileSync("docs/COMPATIBILITY.md", "utf-8");
    expect(
      text.includes(`자산 **${total}**`),
      `docs/COMPATIBILITY.md 가 자산 ${total} 를 반영하지 않음 — 'npm run gen:compat' 재실행 필요`,
    ).toBe(true);
  });

  // WHY (v26.102.0, ADR-031 / SOD 리뷰 F6): 총계 게이트는 CLI 열이 통째로 stale 해도 green
  //   이었다 — 실제로 생성기만 커밋되고 재생성 문서가 빠진 채 "정직화 완료" 를 주장할 뻔했다.
  //   각 자산 행의 CLI 도달 라벨을 assetCliSupport(코드 SSOT)에서 derive 해 문서와 전수 대조:
  //   gen:compat 미재실행·수동 편집 어느 쪽의 drift 도 `npm run ci` 가 막는다.
  it("COMPATIBILITY.md 각 자산 행의 CLI 도달 라벨이 assetCliSupport 와 전수 일치", () => {
    const text = readFileSync("docs/COMPATIBILITY.md", "utf-8");
    const bundledOverride = new Set<string>(INTERNAL_BUNDLED_SKILL_IDS);
    for (const asset of EXTERNAL_ASSETS) {
      // 번들 스킬은 전용 override 라벨(4-CLI 상세 표기) — 도달 검증은 transform 테스트 담당.
      if (bundledOverride.has(asset.id)) continue;
      const row = text.split("\n").find((l) => l.startsWith(`| \`${asset.id}\` |`));
      expect(row, `COMPATIBILITY.md 에 자산 행 없음: ${asset.id}`).toBeDefined();
      const support = assetCliSupport(asset);
      const expectedReach =
        support.length === CLI_BASES.length
          ? `${CLI_BASES.length}-CLI`
          : support.length === 1 && support[0] === "claude"
            ? "Claude Code"
            : support.join("+");
      expect(
        row as string,
        `${asset.id}: CLI 열이 도달 범위(${expectedReach})와 불일치 — 'npm run gen:compat' 재실행 또는 derive 로직 확인`,
      ).toContain(`| ${expectedReach} (`);
    }
  });

  it(`index.html trust-tier 카드의 카탈로그 총계 분모가 ${total}`, () => {
    const text = readFileSync("index.html", "utf-8");
    const m = text.match(/(\d+)\s*\/\s*(\d+)\s+green/);
    expect(
      m,
      "index.html 'X/Y green' 총계 패턴 미발견 — 포맷 변경 시 본 게이트 갱신 필요",
    ).not.toBeNull();
    expect(
      Number((m as RegExpMatchArray)[2]),
      `index.html 카탈로그 총계 분모 ≠ EXTERNAL_ASSETS.length(${total})`,
    ).toBe(total);
  });

  // WHY (v26.98.0): 위 2 게이트는 index.html·COMPATIBILITY 만 봤다. 그래서 harness-health-audit
  //   추가(59→60) 시 README·로드맵·제출 kit 의 총계가 stale 로 남았는데도 `npm run ci` 가 green
  //   이었다 — 게이트가 커버하지 않는 표면이 곧 drift 서식지. no-false-ship: "동일 목록이 2곳 이상
  //   하드코딩되면 derive 단일화 또는 exhaustiveness 테스트 없이 머지 금지". 사용자 도달 문서
  //   (README = 첫 인상, 제출 kit = 대외 홍보, 로드맵 = ship-checklist 가 SSOT 로 명시)까지 확장한다.
  //   패턴 `N/M assets` · `카탈로그(M)` 형태의 분모가 EXTERNAL_ASSETS.length 와 어긋나면 fail.
  it.each([
    ["README.md", /(\d+)\s*\/\s*(\d+)\s+assets green/],
    ["docs/research/adoption-c2-submission-kit.md", /(\d+)\s*\/\s*(\d+)\s+assets/],
  ])(`%s 의 카탈로그 총계 분모가 ${total}`, (file, pattern) => {
    const text = readFileSync(file, "utf-8");
    const m = text.match(pattern as RegExp);
    expect(m, `${file}: 총계 패턴 미발견 — 포맷 변경 시 본 게이트 갱신 필요`).not.toBeNull();
    expect(
      Number((m as RegExpMatchArray)[2]),
      `${file} 카탈로그 총계 분모 ≠ EXTERNAL_ASSETS.length(${total}) — 자산 추가/제거 후 문서 미갱신`,
    ).toBe(total);
  });

  it(`로드맵(ship-checklist SSOT)에 stale 카탈로그 총계 없음`, () => {
    const text = readFileSync("docs/plans/service-audit-roadmap.md", "utf-8");
    // 살아있는 작업 지칭에 쓰인 총계만 대상 — "카탈로그(N)" / "현 N 자산" / "N 전수".
    const live = [...text.matchAll(/카탈로그\((\d+)\)|현 (\d+) 자산|(\d+) 자산 각각/g)];
    expect(
      live.length,
      "로드맵 총계 패턴 미발견 — 포맷 변경 시 본 게이트 갱신 필요",
    ).toBeGreaterThan(0);
    for (const m of live) {
      const n = Number(m[1] ?? m[2] ?? m[3]);
      expect(
        n,
        `로드맵 stale 총계 "${m[0]}" ≠ ${total} — ship-checklist 의 로드맵 SSOT 동기화 누락`,
      ).toBe(total);
    }
  });

  // WHY (v26.98.0, SOD 리뷰 Important #1): 위 게이트들은 **문서만** 본다. 그래서
  //   `external-assets.ts:164` 헤더 주석의 "61 자산 … dev-method skills 6종"이 살아남았다 —
  //   78줄 아래 :242 의 동일 문자열은 고쳐졌는데도. 카탈로그를 정의하는 파일 자신의 주석이
  //   카탈로그 수를 틀리게 말하는 상태이고, 하필 ADR-027 이 자기증명 근거로 삼는 파일이다.
  //   소스 주석은 사용자에게 도달하진 않지만 **다음 기여자가 읽는 1차 정보**이므로 drift 원천.
  //   no-false-ship: "동일 목록이 2곳 이상 하드코딩 → derive 또는 exhaustiveness 테스트".
  it(`src/external-assets.ts 주석의 자산 총계·dev-method 수가 실제와 일치`, () => {
    const text = readFileSync("src/external-assets.ts", "utf-8");
    const devMethodCount = DEV_METHOD_SKILL_IDS.length;

    // "N 자산 매트릭스" 헤더 — 카탈로그 총계 단언.
    const totals = [...text.matchAll(/(\d+) 자산 매트릭스/g)];
    const header = totals[0];
    expect(
      header,
      "'N 자산 매트릭스' 헤더 미발견 — 포맷 변경 시 본 게이트 갱신 필요",
    ).toBeDefined();
    expect(totals.length, "'N 자산 매트릭스' 헤더가 2곳 이상 — SSOT 위반").toBe(1);
    expect(
      Number((header as RegExpExecArray)[1]),
      `external-assets.ts 주석 "${(header as RegExpExecArray)[0]}" ≠ EXTERNAL_ASSETS.length(${total})`,
    ).toBe(total);

    // "dev-method skills N종" / "방법론 skill N종" — dev-method 수 단언.
    const dm = [...text.matchAll(/dev-method skills (\d+)종|방법론 skill (\d+)종/g)];
    expect(
      dm.length,
      "dev-method 수 주석 미발견 — 포맷 변경 시 본 게이트 갱신 필요",
    ).toBeGreaterThan(0);
    for (const m of dm) {
      expect(
        Number(m[1] ?? m[2]),
        `external-assets.ts 주석 "${m[0]}" ≠ DEV_METHOD_SKILL_IDS.length(${devMethodCount})`,
      ).toBe(devMethodCount);
    }
  });
});

// WHY: adoption-c2-submission-kit 이 README 정정(51/61·plugin Claude-first)을 안 따라가
//   "every install method ... verified by real install ... not a static table" 과장을 박제했다
//   (2026-07-14 audit kit-overclaim). 게시 자료의 첫 문장이 곧 반례가 되지 않도록 grep 가드.
describe("게시 kit 과장 차단 (audit 2026-07-14 kit-overclaim)", () => {
  it("adoption kit: 'every install method ... verified by real install' 과장 0건", () => {
    const text = readFileSync("docs/research/adoption-c2-submission-kit.md", "utf-8");
    expect(
      /every install method\s+(?:is\s+)?verified by real install/i.test(text),
      "kit 에 'every install method verified by real install' 과장 잔존 — COMPATIBILITY 실측과 모순",
    ).toBe(false);
  });
});
