import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  assetTrustTier,
  DEV_METHOD_SKILL_IDS,
  EXTERNAL_ASSETS,
  INTERNAL_BUNDLED_SKILL_IDS,
  shouldInstallAsset,
} from "../src/external-assets.js";
import { DEFAULT_OPTIONS, TRACKS } from "../src/types.js";

// ADR-064 — audit-harness-fit 스킬의 본문 계약.
//
// WHY 본문에 게이트를 다는가: 이 스킬의 가치는 "감사하라"는 지시가 아니라 **무엇으로 판정하느냐**에
// 있다. 판정 근거(공식 기준 인용 · 차단 로그 · 계측)와 가드(로그 0줄 ≠ 무죄 · 세대 린트 목록)가
// 빠지면 남는 것은 취향 감사이고, 그건 폐기 확정된 전신 스킬(harness-health-audit)이 실패한 지점
// 그대로다. 카탈로그 배선만 검사하면 "스킬 설치됨" 보고가 빈 껍데기를 가리킬 수 있다.
//
// 대상은 **배포 사본**(templates/)이다 — 사용자에게 나가는 것이 그쪽이고, 개발 사본은 byte-동일
// 단언으로 함께 묶는다.

const read = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

const tpl = read("../templates/skills/audit-harness-fit/SKILL.md");
const criteria = read("../templates/skills/audit-harness-fit/references/official-criteria.md");
const frontmatter = tpl.split("---")[1] ?? "";
const body = tpl.slice(tpl.indexOf("\n# "));

/**
 * 산문 구절 단언은 **줄바꿈을 넘어야** 한다 — markdown 은 100열에서 접히고 YAML folded scalar 는
 * 파싱 시 줄바꿈이 공백이 된다. 원문 그대로 `toContain` 하면 그 접힘 위치 하나로 게이트가
 * 빨간불이 되고, 그러면 다음 사람이 계약 대신 줄바꿈을 맞추게 된다. 인용부호(`> `)도 같은 이유로 벗긴다.
 */
const flat = (s: string): string => s.replace(/^\s*>\s?/gm, " ").replace(/\s+/g, " ");

describe("audit-harness-fit — 트리거 계약 (descriptor 가 실제로 발화하는가)", () => {
  it("frontmatter 슬라이스가 비어 있지 않다 (헛통과 차단)", () => {
    expect(frontmatter).toMatch(/name:\s*audit-harness-fit/);
    expect(frontmatter.length).toBeGreaterThan(400);
  });

  // 한국어 사용자가 실제로 치는 말이 descriptor 에 없으면 스킬은 있는데 안 뜬다 —
  //   설치는 됐는데 도달하지 않는 거짓출하의 가장 흔한 형태다.
  it.each([
    "하네스 정리",
    "밥값",
    "CLAUDE.md 다이어트",
    "상주 컨텍스트",
  ])("한국어 트리거 %s 를 싣는다", (phrase) => {
    expect(frontmatter).toContain(phrase);
  });

  it.each([
    "harness audit",
    "trim my CLAUDE.md",
    "earning their keep",
  ])("영어 트리거 %s 를 싣는다", (phrase) => {
    expect(flat(frontmatter).toLowerCase()).toContain(phrase.toLowerCase());
  });

  // 경계가 없으면 인접 스킬 둘과 라우팅이 흔들린다 (재발 대응 · 제품 문서↔코드 drift).
  it("Do NOT 절이 인접 두 스킬로 경계를 넘긴다", () => {
    const doNot = frontmatter.slice(frontmatter.indexOf("Do NOT"));
    expect(doNot, "Do NOT 절 미발견").not.toBe("");
    expect(doNot).toContain("recurrence-prevention");
    expect(doNot).toContain("audit-service-gaps");
  });
});

describe("audit-harness-fit — 5단계와 판정 근거", () => {
  it("5단계가 선언된 순서대로 본문에 있다", () => {
    const stages = ["INVENTORY", "EVIDENCE", "VERDICT", "RELOCATE", "APPLY"];
    const positions = stages.map((s) => body.indexOf(`## Stage ${stages.indexOf(s) + 1} — ${s}`));
    for (const [i, at] of positions.entries()) {
      expect(at, `${stages[i]} 단계 헤딩 부재`).toBeGreaterThan(-1);
    }
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  // 판정 3근거 = 이 스킬이 전신(판단 프레임 기반)과 갈리는 지점. 하나라도 빠지면 취향 감사로 회귀한다.
  it("판정 근거 3종과 '취향은 근거가 아니다'가 함께 있다", () => {
    expect(body).toMatch(/Published criteria/);
    expect(body).toMatch(/Block and correction logs/);
    expect(body).toMatch(/Measurement/);
    expect(body).toMatch(/Opinion is not one of the three/);
    // 근거가 없을 때의 처분까지 있어야 실행 가능하다 — 없으면 "근거 없음"이 삭제로 흐른다.
    expect(body).toMatch(/unjudged/);
  });

  // 이 리포의 차단 로그는 이번 사이클에 태어나 누적 표본이 없다. "0줄 = 안전"으로 읽으면
  //   감사 첫 실행이 곧 오판이 된다.
  it("로그 0줄을 무죄로 쓰지 말라는 가드가 있다", () => {
    expect(body).toMatch(/zero lines is not an acquittal/i);
    expect(body).toMatch(/no sample/);
    // 반대 방향의 비대칭도 — 로그 1줄이 '올바른 차단'을 뜻하지는 않는다.
    expect(body).toMatch(/false positive/i);
  });

  // Opus 5 세대 린트 4종. 목록이 줄면 "옛 세대용 스캐폴딩 제거"라는 이 스킬의 절반이 사라진다.
  it.each([
    /verification instructions/i,
    /double-check/i,
    /only report high-severity/i,
    /not to think or not to reason|thinking tags/i,
  ])("세대 린트 항목 %s 를 싣는다", (pattern) => {
    expect(body).toMatch(pattern);
  });

  // RELOCATE 목적지 3방향 — 절차→스킬 · 강제→훅/permissions · 사실→코드/테스트.
  it("RELOCATE 표가 세 목적지를 전부 가리킨다", () => {
    const relocate = (body.split("## Stage 4 — RELOCATE")[1] ?? "").split("## Stage 5")[0] ?? "";
    expect(relocate, "RELOCATE 절 슬라이스가 비었다").not.toBe("");
    expect(relocate).toMatch(/\*\*Skill\*\*/);
    expect(relocate).toMatch(/\*\*Hook\*\*/);
    expect(relocate).toMatch(/\*\*Permission rule\*\*/);
    expect(relocate).toMatch(/\*\*Code, test/);
    // 훅은 조일 수만 있고 풀 수 없다 — 이 방향을 잃으면 훅/permissions 가 대체재로 오독된다.
    expect(relocate).toMatch(/tighten .* never loosen|tighten what permission rules allow/);
  });

  // 적용은 승인 뒤. 그리고 "줄었다"는 효과의 증거가 아니다.
  it("APPLY 가 제안 기본 + 미검증 명시를 요구한다", () => {
    const apply = (body.split("## Stage 5 — APPLY")[1] ?? "").split("\n---")[0] ?? "";
    expect(apply).toMatch(/proposal.*not an edit|Default output is a \*\*proposal\*\*/);
    expect(apply).toMatch(/unverified/);
    expect(apply).toMatch(/smaller token count is not evidence/i);
  });

  it("워크드 예시가 수치와 함께 있다 (지침만 있고 예시가 없으면 판정이 안 재현된다)", () => {
    const example = flat((body.split("## Worked example")[1] ?? "").split("## Output")[0] ?? "");
    expect(example, "워크드 예시 절이 비었다").not.toBe("");
    expect(example).toMatch(/1,100/);
    expect(example).toMatch(/535/);
    expect(example).toMatch(/dead wiring/i);
  });
});

describe("audit-harness-fit — 인용 원천과 이식성", () => {
  it("references 가 원문 인용 + 출처 URL 을 싣는다", () => {
    const quoted = flat(criteria);
    expect(quoted).toContain("Would removing this cause Claude to make mistakes?");
    expect(quoted).toContain("legacy harness scaffolding");
    expect(quoted).toContain("hooks are deterministic and guarantee the action happens");
    expect(criteria).toMatch(/https:\/\/code\.claude\.com\/docs\/en\/(memory|permissions)/);
    expect(criteria).toMatch(/https:\/\/platform\.claude\.com\/docs\/en\//);
    // 100줄 초과 참조 파일에는 TOC (공식 스킬 작성 기준).
    expect(criteria.split("\n").length).toBeGreaterThan(100);
    expect(criteria).toMatch(/^## Contents$/m);
    // 공식 문서에 없는 것을 기준으로 지어내지 않는다 — 이 절이 빠지면 인용의 증거 등급이 사라진다.
    expect(criteria).toMatch(/What the documentation does not say/);
  });

  // 낯선 프로젝트에서 돌아야 한다 — 이 리포의 npm 스크립트·리서치 경로에 기대면 그 순간 이식 불가.
  it("이 리포 전용 도구·경로에 의존하지 않는다", () => {
    for (const text of [tpl, criteria]) {
      expect(text).not.toMatch(/npm run (cost:report|cost:baseline|ci\b)/);
      expect(text).not.toMatch(/docs\/research\//);
      expect(text).not.toMatch(/docs\/decisions\//);
    }
  });

  it("repo-local .claude 복사본이 템플릿과 byte-동일 (silent drift 가드)", () => {
    expect(read("../.claude/skills/audit-harness-fit/SKILL.md")).toBe(tpl);
    expect(read("../.claude/skills/audit-harness-fit/references/official-criteria.md")).toBe(
      criteria,
    );
  });
});

/**
 * 인용 정합 게이트 — **날조된 인용을 잡는다**.
 *
 * WHY 별개 게이트인가: 위의 `toContain` 단언들은 **훼손·삭제만** 잡고 *추가*는 못 잡는다.
 * 검증 레인이 실제로 없는 문장("Never keep more than seven rule files…")을 진짜 출처 번호를 달아
 * 두 사본에 주입했는데 24/24 초록이었다 — 같은 파일이 20줄 아래에서 정면으로 부정하는 문장인데도
 * 통과했다. 이 스킬이 전신과 갈리는 유일한 지점이 "판정은 인용·로그·계측으로만"이므로, 인용의
 * 추적성이 깨지면 산출물의 근거가 통째로 사라진다.
 *
 * 대조 대상은 **리포 안의 리서치 원장**(`docs/research/rules-hooks-value-audit-2026-08-02/`)이다.
 * 이 경로는 배포되지 않으므로 배포 사본의 이식성 단언(`docs/research/` 금지)과 충돌하지 않는다 —
 * 게이트만 이 리포에 남고 스킬은 깨끗하게 나간다.
 */
describe("audit-harness-fit — references 인용이 원장에 실재하는가", () => {
  const LEDGER = "../docs/research/rules-hooks-value-audit-2026-08-02";

  /**
   * 원장과 참조 파일은 같은 문장을 다른 폭으로 접어 싣는다. 그 차이만 지우고 **글자는 남긴다**:
   * ⓐ 표 구분행(`| :--- |`) 제거 — 참조 파일은 안 싣고 원장은 싣는다
   * ⓑ 중첩 인용부호(`>   > `)까지 벗기기 — 한 겹만 벗기면 본문에 `>` 가 남는다
   * ⓒ 스마트따옴표 통일 · `[text](url)` → `[text]` (참조 파일은 URL 을 본문에서 뺀다)
   * ⓓ `**` 제거 — 원장의 강조 일부는 원문이 아니라 **발췌자 표시**다(원장이 그렇게 명기한다)
   * ⓔ 표 셀 패딩과 줄바꿈 접힘을 공백 하나로 — 접힘을 못 넘으면 게이트가 장식이 된다
   */
  const normalize = (s: string): string =>
    s
      .split("\n")
      .filter((l) => !/^\s*>?\s*\|[\s:|-]+\|\s*$/.test(l))
      .join("\n")
      .replace(/^\s*(?:>\s*)+/gm, " ")
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "[$1]")
      .replace(/\*\*/g, "")
      .replace(/\s*\|\s*/g, " | ")
      .replace(/\s+/g, " ")
      .trim();

  const ledger = normalize(
    readdirSync(fileURLToPath(new URL(LEDGER, import.meta.url)))
      .filter((f) => f.endsWith(".md"))
      .map((f) => read(`${LEDGER}/${f}`))
      .join("\n\n"),
  );

  /** 연속된 `>` 줄 = 인용 한 덩어리. 덩어리째 대조해야 문장 잘라 붙이기가 걸린다. */
  const quoteBlocks = (): Array<{ line: number; text: string }> => {
    const out: Array<{ line: number; text: string }> = [];
    let cur: string[] = [];
    let start = 0;
    for (const [i, l] of criteria.split("\n").entries()) {
      if (l.startsWith(">")) {
        if (cur.length === 0) start = i + 1;
        cur.push(l);
      } else if (cur.length > 0) {
        out.push({ line: start, text: cur.join("\n") });
        cur = [];
      }
    }
    if (cur.length > 0) out.push({ line: start, text: cur.join("\n") });
    return out;
  };

  /** 원장에 없어도 되는 인용. **비어 있는 것이 정상**이고, 채울 때는 사유를 함께 적는다. */
  const ALLOWED_WITHOUT_LEDGER: readonly string[] = [];

  it("원장을 실제로 읽는다 (헛통과 차단)", () => {
    expect(ledger.length).toBeGreaterThan(20000);
    expect(quoteBlocks().length).toBeGreaterThan(40);
  });

  it("blockquote 전량이 원장에서 문자 대조로 추적된다", () => {
    const unmatched = quoteBlocks()
      .map(({ line, text }) => ({
        line,
        // 인용부호와 꼬리의 출처 표기(`" — (2)`)는 참조 파일 쪽 편집이라 벗기고 본문만 대조한다.
        text: normalize(text)
          .replace(/^"/, "")
          .replace(/"\s*[—-]\s*\(\d+(?:,\s*\d+)*\)\s*$/, "")
          .replace(/"$/, "")
          .trim(),
      }))
      .filter(({ text }) => !ledger.includes(text))
      .filter(({ text }) => !ALLOWED_WITHOUT_LEDGER.includes(text))
      .map(({ line, text }) => `official-criteria.md:${line}  ${text.slice(0, 120)}`);

    expect(
      unmatched,
      `원장에 없는 인용이다 — 원문에서 재확보해 원장에 편입하거나 (summary) 로 강등하라:\n${unmatched.join("\n")}`,
    ).toEqual([]);
  });
});

describe("audit-harness-fit — 카탈로그 배선", () => {
  const asset = EXTERNAL_ASSETS.find((a) => a.id === "audit-harness-fit");

  it("internal · official · uzys · any-track 전 트랙", () => {
    if (!asset) throw new Error("audit-harness-fit 가 카탈로그에 없다");
    expect(assetTrustTier("audit-harness-fit")).toBe("official");
    expect(asset.source).toBe("uzys");
    expect(asset.category).toBe("workflow");
    expect(asset.condition.kind).toBe("any-track");
    expect(asset.method.kind).toBe("internal");
    if (asset.method.kind !== "internal") throw new Error("not internal");
    expect(asset.method.key).toBe("audit-harness-fit");
    // 하네스는 전 트랙에 상주층을 깐다 — 감사 루프가 일부 트랙에만 있으면 비대칭이다.
    for (const t of TRACKS) {
      expect(
        shouldInstallAsset(asset, { tracks: [t], options: { ...DEFAULT_OPTIONS } }),
        `track=${t} 에서 미설치`,
      ).toBe(true);
    }
  });

  it("번들 목록에는 있고 DEV_METHOD 에는 없다", () => {
    // 번들에서 빠지면 카탈로그엔 보이는데 파일이 안 깔린다(manifest dir copy 대상 밖).
    expect(INTERNAL_BUNDLED_SKILL_IDS).toContain("audit-harness-fit");
    // DEV_METHOD 는 has-dev-track 불변식 위에 서 있다 — any-track 이 섞이면 wizard 번들이
    //   부분집합이 되어 사용자가 안 고른 자산을 설치한다.
    expect(DEV_METHOD_SKILL_IDS).not.toContain("audit-harness-fit");
  });
});
