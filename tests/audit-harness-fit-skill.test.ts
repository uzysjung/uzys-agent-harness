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

// ADR-064 — audit-harness-fit 스킬의 계약.
//
// **2026-08-30 재판정(#361)에서 성격이 바뀌었다: 21블록 → 7블록.** 걷어낸 14개는 전부
// SKILL.md 본문의 **낱말**을 읽었다 — 트리거 문구(한국어 4·영어 3) · Do NOT 절이 부르는 스킬
// 이름 · 5단계 헤딩 순서 · 판정 근거 3종 · Stage 3 범주 목록 · 성공 기준 절의 형태 · 로그 0줄
// 가드 · RELOCATE 표 · APPLY 절 · 워크드 예시 · references 의 인용 구절.
//
// **왜 걷었나 — 이미 채택된 룰이 금지하는 형태다.** `.claude/rules/change-management.md`
// §자산은 자기 변경 요청 없이 건드리지 않는다 가 *"문장의 의미를 무는 자동 검사는 만들지
// 마라(3회 우회 실측)"* 로 못박는다. 문구 검사는 양쪽으로 틀린다: 같은 뜻으로 다시 쓰면
// 🔴(정당한 개정 차단), 낱말을 남긴 채 옆 문장을 뒤집으면 🟢. 자산 본문의 뜻은
// `npm run assets:history` 로 이력을 읽어 사람·에이전트가 판정한다.
//
// **`description` 1,024자 상한 블록도 함께 걷었다 — 중복이 됐다.** #333(PR #395)에서
// `tests/frontmatter-yaml.test.ts` 가 `SKILL.md` **전수**를 글롭으로 검사하게 됐다. 이 파일에만
// 붙어 있던 것이 27종 무검사를 만든 원인이었으므로, 사본을 남기면 같은 형태가 반복된다.
//
// **남긴 7개는 뜻을 안 읽는다**: 100줄 초과 참조 파일의 TOC·출처 URL 실재(형식) · 배포물이
// 리포 전용 경로를 안 담는가(부재 대조) · 두 사본 바이트 동일 · 인용이 원장에 문자 대조로
// 실재하는가(+그 탐지기의 헛통과 차단) · 카탈로그 배선 2.
// 특히 인용 대조는 **날조를 잡은 실적이 있다** — 아래 그 게이트의 주석이 그 사고를 기록한다.

const read = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

const tpl = read("../templates/skills/audit-harness-fit/SKILL.md");
const criteria = read("../templates/skills/audit-harness-fit/references/official-criteria.md");

describe("audit-harness-fit — 참조 파일의 형식과 이식성", () => {
  // 공식 스킬 작성 기준: 100줄 넘는 참조 파일에는 TOC. 줄 수와 헤딩 실재만 보므로 문면 개정과
  // 무관하다 — 인용 *내용*의 정합은 아래 원장 대조 게이트가 훨씬 강하게 맡는다.
  it("100줄 초과 참조 파일에 TOC 와 출처 URL 이 있다", () => {
    expect(criteria.split("\n").length).toBeGreaterThan(100);
    expect(criteria).toMatch(/^## Contents$/m);
    expect(criteria).toMatch(/https:\/\/code\.claude\.com\/docs\/en\/(memory|permissions)/);
    expect(criteria).toMatch(/https:\/\/platform\.claude\.com\/docs\/en\//);
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
