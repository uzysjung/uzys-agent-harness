import { execFileSync } from "node:child_process";
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

// WHY (v26.138.0 거짓출하): 위 게이트는 `package.json → CHANGELOG` **한 방향만** 본다. 그래서
//   PR #257 이 package.json 을 26.138.0 으로 bump 하고 CHANGELOG 항목까지 넣었지만 **태그를 안 밀어**
//   릴리즈 워크플로가 아예 안 돈 상태가 green 으로 통과했다 — npm 게시도 없이 "배포 완료 · npm 라이브"
//   로 보고됐다(코드는 v26.139.0 에 포함돼 살아 있으니 "동작한다"는 참, "배포됐다"가 거짓).
//   빠진 축은 반대 방향이다: **CHANGELOG 항목 → 태그 실재**. 계열 일부에만 있는 축은 빠진 쪽이
//   입증 책임을 진다(feedback_surface_symmetry, 4회차).
//   면제는 **표식이 있는 쪽** (no-false-ship: "기본값 = 검사"). 표식은 헤딩 **바로 다음 줄**에
//   단독으로 있어야 하고 사유가 비면 무효 — 산문에 같은 문자열이 섞여도 면제되지 않는다.
const RELEASE_HEADING = /^## \[(v\d+\.\d+\.\d+)\]/;
const NO_TAG_MARKER = /^<!--\s*release-tag:none\s+(\S.*?)\s*-->$/;

interface ChangelogTagAudit {
  readonly headings: readonly string[];
  readonly exempted: readonly string[];
  readonly matched: readonly string[];
  readonly missing: readonly string[];
  readonly tagCount: number;
}

function auditChangelogTags(changelog: string, tags: readonly string[]): ChangelogTagAudit {
  const tagSet = new Set(tags);
  const lines = changelog.split("\n");
  const headings: string[] = [];
  const exempted: string[] = [];
  const matched: string[] = [];
  const missing: string[] = [];
  for (const [i, line] of lines.entries()) {
    const version = RELEASE_HEADING.exec(line)?.[1];
    if (!version) continue;
    headings.push(version);
    if (tagSet.has(version)) {
      matched.push(version);
    } else if (NO_TAG_MARKER.test((lines[i + 1] ?? "").trim())) {
      exempted.push(version);
    } else {
      missing.push(version);
    }
  }
  return { headings, exempted, matched, missing, tagCount: tags.length };
}

// 탐지기 자기검증 — "빈 결과는 부재의 증거가 아니다" (cli-development.md).
//   GitHub Actions 기본 체크아웃은 `fetch-depth: 1` 이라 태그가 없거나(0개) 체크아웃한 태그
//   하나만 있다. 그 상태에서 위 audit 은 "전 릴리즈 미태그" 라는 **엉뚱한 결론**을 낸다.
//   판정 경계는 튜닝값이 아니라 두 모집단의 구분선이다: 정상 클론이면 헤딩의 90%+ 가 태그와
//   매칭되고(실측 164 중 152), 얕은 클론이면 0~1 건이다. 절반은 그 사이 어디에 둬도 같은
//   결론이 나오는 자리 — 실제 drift 로 절반이 깨지려면 릴리즈 80여 건이 통째로 미태그여야 한다.
function tagReadFailure(audit: ChangelogTagAudit): string | null {
  if (audit.headings.length === 0) {
    return "CHANGELOG.md 에서 '## [vX.Y.Z]' 릴리즈 헤딩을 한 건도 못 찾음 — 헤딩 포맷이 바뀌어 이 게이트가 지금 아무것도 보지 않는다";
  }
  if (audit.tagCount === 0) {
    return "git 태그를 0개 읽었다 — 태그 조회 실패 또는 얕은 클론. 이 검사는 지금 아무것도 보지 않는다";
  }
  if (audit.matched.length * 2 < audit.headings.length) {
    return `git 태그(${audit.tagCount}개)가 CHANGELOG 릴리즈 헤딩 ${audit.headings.length} 건 중 ${audit.matched.length} 건만 설명한다 — 태그 목록을 제대로 못 읽었다고 본다. 이 검사는 지금 아무것도 보지 않는다`;
  }
  return null;
}

function readGitTags(): string[] {
  try {
    return execFileSync("git", ["tag", "-l"], { encoding: "utf-8" }).split("\n").filter(Boolean);
  } catch {
    // 조회 실패 = 빈 목록. 아래 tagReadFailure 가 "신뢰 불가" 로 **실패**시킨다 (통과 아님).
    return [];
  }
}

const SHALLOW_CLONE_FIX =
  "얕은 클론이면 워크플로 체크아웃에 `fetch-depth: 0` (필요 시 `fetch-tags: true`) 이 필요하다.";

describe("CHANGELOG → 태그 역방향 게이트 (v26.138.0 거짓출하 차단)", () => {
  const changelog = readFileSync("CHANGELOG.md", "utf-8");

  it("모든 릴리즈 헤딩에 대응하는 git 태그가 실재한다 (미게시는 표식으로만 면제)", () => {
    const audit = auditChangelogTags(changelog, readGitTags());
    expect(tagReadFailure(audit), `탐지기 자기검증 실패 — ${SHALLOW_CLONE_FIX}`).toBeNull();
    expect(
      audit.missing,
      `CHANGELOG.md 에 항목이 있으나 git 태그가 없는 릴리즈: ${JSON.stringify(audit.missing)} — 태그를 안 밀면 릴리즈 워크플로가 돌지 않아 npm 게시가 없다(v26.138.0 전례). 태그를 밀거나, 게시되지 않은 버전이면 헤딩 **바로 다음 줄**에 단독으로 '<!-- release-tag:none <사유> -->' 를 넣을 것.`,
    ).toEqual([]);
  });

  // 음성 대조를 상시 테스트로 고정 — 태그를 못 읽는 상태가 '통과' 로 새면 게이트가 죽는다.
  it("태그 목록이 신뢰 불가면 통과가 아니라 실패로 판정한다 (얕은 클론)", () => {
    // null(=이상 없음) 을 그대로 두면 실패 메시지가 "null 은 toContain 불가" 로 나와 무엇이
    //   깨졌는지 안 보인다. 통과 판정을 명시 문자열로 바꿔 실패 이유가 화면에 남게 한다.
    const verdict = (audit: ChangelogTagAudit): string =>
      tagReadFailure(audit) ?? "(신뢰 가능 판정 — 게이트가 이 상태를 green 으로 흘린다)";

    expect(verdict(auditChangelogTags(changelog, [])), "태그 0개").toContain(
      "아무것도 보지 않는다",
    );
    // fetch-depth: 1 로 태그 ref 를 체크아웃한 상태 = 태그 1개만 보임.
    expect(verdict(auditChangelogTags(changelog, ["v26.139.0"])), "태그 1개(얕은 클론)").toContain(
      "아무것도 보지 않는다",
    );
    // 헤딩 포맷이 바뀌어 파서가 죽은 경우도 '깨끗함' 이 아니다.
    expect(
      verdict(auditChangelogTags("# 변경 이력\n\n## 26.139.0\n", ["v26.139.0"])),
      "릴리즈 헤딩 0건",
    ).toContain("아무것도 보지 않는다");
  });

  it("면제 표식은 헤딩 직후 단독 줄 + 사유 있음일 때만 유효", () => {
    const withNextLine = (marker: string): ChangelogTagAudit =>
      auditChangelogTags(`## [v9.9.9] — 사유 없는 예시\n${marker}\n`, ["v1.0.0"]);

    expect(
      withNextLine("<!-- release-tag:none 태그·npm 게시 없음 -->").exempted,
      "정상 표식이 면제되지 않음",
    ).toEqual(["v9.9.9"]);
    // 산문 안에 표식 문자열이 섞인 줄 — 면제 아님.
    expect(
      withNextLine("이 버전은 `<!-- release-tag:none 사유 -->` 표식으로 면제한다").missing,
      "산문 속 표식 문자열이 면제로 인정됨 — 가드가 느슨하다",
    ).toEqual(["v9.9.9"]);
    // 사유 없는 빈 표식 — 면제 아님 ("미검증에도 근거가 필요하다", no-false-ship).
    expect(
      withNextLine("<!-- release-tag:none -->").missing,
      "사유 없는 표식이 면제로 인정됨",
    ).toEqual(["v9.9.9"]);
    // 헤딩 직후가 아닌 위치(본문 한참 아래) — 면제 아님.
    expect(
      auditChangelogTags("## [v9.9.9] — 예시\n\n### 변경\n<!-- release-tag:none 사유 -->\n", [
        "v1.0.0",
      ]).missing,
      "헤딩 직후가 아닌 표식이 면제로 인정됨",
    ).toEqual(["v9.9.9"]);
    // 태그가 실재하면 표식이 있어도 면제 경로를 타지 않는다 (매칭이 우선).
    expect(
      auditChangelogTags("## [v9.9.9] — 예시\n<!-- release-tag:none 사유 -->\n", ["v9.9.9"]),
      "태그 실재분이 면제로 분류됨",
    ).toMatchObject({ matched: ["v9.9.9"], exempted: [] });
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
      // 2026-08-26 (#356) — 생성 블록을 영문화했다. 리터럴이라 문구가 바뀌면 같이 옮겨야 한다.
      text.includes(`assets **${total}**`),
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

  // WHY (v26.104.0, SOD 리뷰 I-1): COMPATIBILITY.md **서문**(수기, AUTO-GEN 블록 밖)의
  //   "49/61 🟢 · 12 자산 🟡 · dev-method 8종" 이 자산 추가 후에도 살아남았다 — 위 총계 게이트는
  //   생성 블록의 `자산 **N**` 문자열만 봐서 서문이 사각지대였다. 분자(🟢 수)는 검증 상태 수치라
  //   코드에서 derive 불가 — 분모·🟢+🟡 분해 합·dev-method 수만 코드 SSOT 와 대조한다.
  it("COMPATIBILITY.md 서문(수기)의 분모·🟢+🟡 분해 합·dev-method 수가 SSOT 와 일치", () => {
    const text = readFileSync("docs/COMPATIBILITY.md", "utf-8");
    const m = text.match(
      // 2026-08-26 (#356) — 서문을 영어로 다시 썼다. 어절 고정이라 문구가 바뀌면 이 정규식도
      //   같이 옮겨야 한다(패턴 미발견 = 실패이므로 조용히 새지는 않는다).
      /(\d+)\/(\d+) assets are 🟢[^\n]*?remaining (\d+) assets are 🟡[^\n]*?dev-method (\d+) skills/,
    );
    expect(
      m,
      "COMPATIBILITY.md 서문 총계 패턴 미발견 — 포맷 변경 시 본 게이트 갱신 필요",
    ).not.toBeNull();
    const green = Number((m as RegExpMatchArray)[1]);
    const denom = Number((m as RegExpMatchArray)[2]);
    const yellow = Number((m as RegExpMatchArray)[3]);
    const dm = Number((m as RegExpMatchArray)[4]);
    expect(denom, `서문 분모 ≠ EXTERNAL_ASSETS.length(${total})`).toBe(total);
    expect(
      green + yellow,
      `서문 🟢(${green})+🟡(${yellow}) 분해 합 ≠ 카탈로그 총계(${total})`,
    ).toBe(total);
    expect(
      dm,
      `서문 dev-method 수 ≠ DEV_METHOD_SKILL_IDS.length(${DEV_METHOD_SKILL_IDS.length})`,
    ).toBe(DEV_METHOD_SKILL_IDS.length);
  });

  // WHY (v26.115.0, 재발방지 패널): 위 방식은 "표면을 하나 놓칠 때마다 그 표면 전용 regex 를
  //   하나 추가"였고, 그래서 llms.txt 는 v26.110.0 사후분석에서 drift 표면으로 지목되고도
  //   게이트가 0건인 채로 남았다 — 5회 재발의 구조적 원인(패널 4인 중 3인이 독립 수렴).
  //   열거(enumeration)를 글롭(glob)으로 대체한다: 현행 사용자 도달 문서 전체를 훑어
  //   "N/M green|assets" 형태의 **살아있는 카탈로그 주장**을 찾고 분모를 SSOT 와 대조.
  //   새 문서가 생겨도 게이트 수정이 필요 없다 — 놓친 표면이 구조적으로 생길 수 없다.
  //   과거 기록(CHANGELOG·ADR·archive·plans 등)은 대상에서 제외하고, 현행 문서 안의 의도적
  //   과거 수치는 같은 줄에 `<!-- catalog-total:frozen -->` 를 달아 면제한다.
  it(`현행 사용자 도달 문서 전체(글롭)의 카탈로그 총계 분모가 ${total}`, () => {
    // tracked + 아직 add 안 된 신규 문서(untracked·non-ignored)를 모두 본다.
    //   `git ls-files` 만 쓰면 새 문서는 `git add` 전까지 게이트에 보이지 않아,
    //   "신규 표면이 stale 총계를 들고 등장" 시나리오가 통과한다 (mutation 으로 실증).
    const ls = (args: string[]): string[] =>
      execFileSync("git", ["ls-files", ...args, "*.md", "*.html", "*.txt"], {
        encoding: "utf-8",
      })
        .split("\n")
        .filter(Boolean);
    const files = [...new Set([...ls([]), ...ls(["--others", "--exclude-standard"])])]
      // 과거 기록·템플릿·테스트 자산은 현행 주장이 아니다. 단, 아래 두 문서는 과거 기록
      //   디렉토리에 살지만 **현행 주장**이다 (로드맵 = ship-checklist 가 SSOT 로 지정,
      //   제출 kit = 대외 홍보물). 히스토리 디렉토리를 통째로 포함하면 "49/58 green"
      //   (harness-audit 실측 기록) 같은 과거 수치가 대량 오탐이 되므로 이 둘만 되돌린다.
      .filter(
        (f) =>
          !/^(CHANGELOG|docs\/(decisions|archive|PRD|specs|plans|research|dev|dogfood|evals)\/|templates\/|test\/|\.github\/|\.claude\/|tasks\/)/.test(
            f,
          ),
      )
      .concat([
        "docs/plans/service-audit-roadmap.md",
        "docs/research/adoption-c2-submission-kit.md",
      ]);
    expect(files.length, "글롭이 문서를 하나도 못 찾음 — 경로 필터 오류").toBeGreaterThan(3);

    // 라이브 주장 형태 실측(5표면): "51/65 assets green" · "51/65 자산 green" · "51/65 green"
    //   · "카탈로그 51/65 🟢" · "🟢 검증 **51/65**". 검증/green/🟢/assets/자산 중 하나가
    //   분수 앞뒤 좁은 창에 있으면 카탈로그 주장으로 본다 (147/147 테스트 수 등은 제외).
    const claim =
      /(?:(?:green|assets|자산|카탈로그|검증)\W{0,4})(\d+)\s*\/\s*(\d+)|(\d+)\s*\/\s*(\d+)\**\W{0,3}(?:green|assets|자산|🟢)/g;
    const hits: string[] = [];
    for (const f of files) {
      const text = readFileSync(f, "utf-8");
      for (const line of text.split("\n")) {
        if (line.includes("catalog-total:frozen")) continue;
        // 형태 B — 로드맵/기획 문서의 "카탈로그(N)" · "현 N 자산" 계열 주장.
        for (const m of line.matchAll(/카탈로그\((\d+)\)|현 (\d+) 자산/g)) {
          hits.push(`${f}: ${m[0]}`);
          expect(
            Number(m[1] ?? m[2]),
            `${f} 의 카탈로그 총계 "${m[0]}" ≠ EXTERNAL_ASSETS.length(${total}) — SSOT 동기화 누락`,
          ).toBe(total);
        }
        for (const m of line.matchAll(claim)) {
          const denom = Number(m[2] ?? m[4]);
          hits.push(`${f}: ${m[0]}`);
          expect(
            denom,
            `${f} 의 카탈로그 총계 분모 "${m[0]}" ≠ EXTERNAL_ASSETS.length(${total}) — 자산 추가/제거 후 문서 미갱신 (의도적 과거 수치면 같은 줄에 <!-- catalog-total:frozen -->)`,
          ).toBe(total);
        }
      }
    }
    // 게이트 theater 방지: 주장이 0건이면 패턴이 죽은 것이다 (harness-health-audit A3).
    expect(
      hits.length,
      "카탈로그 총계 주장을 한 건도 못 찾음 — 문서 포맷이 바뀌어 게이트가 무력화됐다",
    ).toBeGreaterThanOrEqual(4);
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
