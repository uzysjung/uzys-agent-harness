import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * REFERENCE.md 행 단위 카탈로그 정합 게이트 (2026-08-02 최종 리뷰 HIGH-1).
 *
 * 기존 `docs-supply-chain` 게이트는 카탈로그 **총계(숫자)** 만 대조해서, 총계 숫자가 없는
 * REFERENCE.md 는 공허하게 통과했다 — 그 사각으로 삭제 자산 12행(10 + 표기명이 다른
 * polars/dask)이 살아있는 설치 명령과 함께 광고를 계속했다. 이 게이트는 숫자가 아니라
 * **설치 명령**에서 식별자를 derive 해 카탈로그 원문과 대조한다 — 열거 사본을 만들지 않는다.
 */
const ROOT = join(__dirname, "..");
const reference = readFileSync(join(ROOT, "docs", "REFERENCE.md"), "utf8");
const catalogSrc = readFileSync(join(ROOT, "src", "external-assets.ts"), "utf8");

/** 설치 명령 → 카탈로그가 알아야 하는 식별자 목록. */
function extractIdentifiers(md: string): Array<{ line: number; kind: string; ident: string }> {
  const found: Array<{ line: number; kind: string; ident: string }> = [];
  md.split("\n").forEach((l, i) => {
    // 역사 서술(취소선·ADR 언급 삭제 고지)은 광고가 아니다.
    if (l.includes("~~") || l.includes("삭제")) return;
    const skill = l.match(/npx skills add\s+\S+\s+--skill\s+([a-zA-Z0-9_-]+)/);
    if (skill?.[1]) found.push({ line: i + 1, kind: "skill", ident: skill[1] });
    const bareAdd = skill ? null : l.match(/npx skills add\s+([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)/);
    if (bareAdd?.[1]) found.push({ line: i + 1, kind: "source", ident: bareAdd[1] });
    const plugin = l.match(/claude plugin install\s+([a-zA-Z0-9_-]+@[a-zA-Z0-9_-]+)/);
    if (plugin?.[1]) found.push({ line: i + 1, kind: "plugin", ident: plugin[1] });
  });
  return found;
}

describe("REFERENCE.md 의 설치 명령은 전부 현행 카탈로그에 실재해야 한다", () => {
  const idents = extractIdentifiers(reference);

  it("탐지기가 살아 있다 — 추출 0건이면 이 게이트 전체가 공허 통과다", () => {
    expect(idents.length).toBeGreaterThan(5);
  });

  it("추출된 식별자마다 카탈로그의 해당 필드 문법으로 존재한다", () => {
    // 부분 문자열 includes 는 안 된다 — 삭제 자산 이름이 주석·역사 서술에 남아 있으면
    // 공허 통과한다 (이 게이트의 1차 변이가 실제로 그렇게 살아남았다). 필드 문법으로 좁힌다.
    const needle = (x: { kind: string; ident: string }): string =>
      x.kind === "skill"
        ? `skill: "${x.ident}"`
        : x.kind === "plugin"
          ? `pluginId: "${x.ident}"`
          : `source: "${x.ident}"`;
    const missing = idents.filter((x) => !catalogSrc.includes(needle(x)));
    expect(
      missing,
      missing
        .map(
          (m) =>
            `REFERENCE.md:${m.line} 의 ${m.kind} "${m.ident}" 가 카탈로그에 없다 — ` +
            "삭제된 자산의 광고 잔존이거나 문서 오타다",
        )
        .join("\n"),
    ).toEqual([]);
  });
});
