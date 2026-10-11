/**
 * #722 · #711 · #713 (ADR-106) — 위저드 3단계의 MCP 서버 항목.
 *
 * - chrome-devtools 는 웹 트랙에서 체크된 채(트랙 표 기본) · 그 밖의 트랙에서 미체크 — 체크하면 `--with chrome-devtools`
 * - github-mcp · vercel 은 어느 트랙에서도 미체크 — 체크하면 `--with <id>`
 * - #713 — 트랙 기본으로 체크된 experimental(railway)의 배지가 "opt-in" 이라 말하지 않는다
 */

import { describe, expect, it } from "vitest";
import { CATEGORIES } from "../src/categories.js";
import { computeUserOverride, initialTargetSelection } from "../src/interactive.js";
import { buildPageGroups } from "../src/prompts.js";
import { TRACKS, type Track } from "../src/types.js";

const WEB: Track[] = TRACKS.filter(
  (t) => t.startsWith("csr-") || t.startsWith("ssr-") || t === "full",
);

describe("위저드 3단계 — MCP 서버 항목의 체크 상태", () => {
  it.each(TRACKS.map((t) => [t]))("%s", (track) => {
    const initial = initialTargetSelection([track as Track], []);
    expect(initial.includes("asset:chrome-devtools")).toBe(WEB.includes(track as Track));
    expect(initial).not.toContain("asset:github-mcp");
    expect(initial).not.toContain("asset:vercel");
  });

  it("tooling 에서 chrome-devtools · github-mcp · vercel 을 체크하면 --with 로 낸다", () => {
    const initial = initialTargetSelection(["tooling"], [])
      .filter((t) => t.startsWith("asset:"))
      .map((t) => t.slice("asset:".length));
    const override = computeUserOverride(
      ["tooling"],
      [...initial, "chrome-devtools", "github-mcp", "vercel"],
    );
    expect([...(override?.forceInclude ?? [])].sort()).toEqual([
      "chrome-devtools",
      "github-mcp",
      "vercel",
    ]);
  });
});

describe("#713 — 트랙 기본으로 체크된 experimental 의 배지", () => {
  const label = (initial: ReadonlySet<string>, installed: ReadonlySet<string> = new Set()) =>
    buildPageGroups(CATEGORIES, initial, installed).flatItems.find(
      (i) => i.value === "asset:railway-mcp-server",
    )?.label ?? "";

  it("csr-fastapi(트랙 기본 · 체크) = default on your tracks · ssr-nextjs(미체크) = opt-in", () => {
    expect(label(new Set(initialTargetSelection(["csr-fastapi"], [])))).toContain(
      "⚠ experimental (default on your tracks)",
    );
    expect(label(new Set(initialTargetSelection(["ssr-nextjs"], [])))).toContain(
      "⚠ experimental (opt-in)",
    );
  });
});
