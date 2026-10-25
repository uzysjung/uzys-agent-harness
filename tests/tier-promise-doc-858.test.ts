/**
 * #858 — 티어 약속("⚠ experimental 은 미리 체크하지 않는다")을 적은 문서 줄이 **코드가 만드는 예외**를 이름으로 든다.
 *
 * 트랙 표(`templates/track-mcp-map.tsv`)가 기본으로 까는 MCP 서버 중 experimental 티어인 것은 그 트랙에서 체크된 채
 * 시작하고 `--with` 없이 깔린다(ADR-101 · #709 가 의도한 특례, 배지 `⚠ experimental (default on your tracks)`).
 * 약속 줄이 그 예외를 안 들면 문서가 기본 트랙 설치에서 거짓이 된다. 예외 목록은 손으로 적지 않고 코드에서 뽑는다 —
 * 새 experimental 기본 행이 생기면 문서에 이름이 없어 여기서 빨간불이 켜진다.
 *
 * 문장의 뜻을 판정하지 않는다(change-management "문장의 의미를 무는 자동 검사는 만들지 마라"). 약속 줄을 고정 문구로
 * 찾아, 코드가 아는 예외 id 와 화면 배지 이름이 그 줄에 **있는지**만 본다.
 */

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { trackDefaultMcpAssetIds } from "../src/cli-transforms.js";
import { assetTrustTier } from "../src/external-assets.js";
import { TRACKS } from "../src/types.js";

const ROOT = resolve(__dirname, "..");
const BADGE = "⚠ experimental (default on your tracks)";

/** 어느 트랙에서든 기본으로 깔리는 experimental 자산 id. */
const experimentalDefaults = [
  ...new Set(TRACKS.flatMap((t) => trackDefaultMcpAssetIds(ROOT, [t]))),
].filter((id) => assetTrustTier(id) === "experimental");

function promiseLine(file: string, anchor: RegExp): string {
  const lines = readFileSync(join(ROOT, file), "utf8")
    .split(/\r?\n/)
    .filter((l) => anchor.test(l));
  expect(
    lines,
    `${file} 에서 티어 약속 줄을 못 찾았다 — 문구가 바뀌었으면 anchor 를 고친다`,
  ).toHaveLength(1);
  return lines[0] ?? "";
}

describe("#858 — 티어 약속 줄이 experimental 트랙 기본 MCP 예외를 이름으로 든다", () => {
  it("모집단이 살아 있다 — 코드가 아는 예외가 하나 이상(railway-mcp-server)", () => {
    expect(experimentalDefaults).toContain("railway-mcp-server");
  });

  for (const [file, anchor] of [
    ["docs/USAGE.md", /Never pre-checked/],
    ["docs/TRACKS.md", /never pre-checked/],
  ] as const) {
    it(`${file} — 약속 줄에 예외 id 와 배지 이름이 있다`, () => {
      const line = promiseLine(file, anchor);
      for (const id of experimentalDefaults) expect(line, `${file}: ${id}`).toContain(id);
      expect(line).toContain(BADGE);
    });
  }
});
