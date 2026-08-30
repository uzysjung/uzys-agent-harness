import { describe, expect, it } from "vitest";
import { type AssetEntry, buildAssetSpec, buildManifest } from "../src/manifest.js";
import { DEFAULT_OPTIONS, TRACKS, type Track } from "../src/types.js";

/**
 * **우리 스킬은 전부 디렉터리 단위로 등록한다 (#409).**
 *
 * WHY: 등록 방식이 둘로 갈려 있었고(디렉터리 단위 vs 파일 단위), 파일 단위는 `spec-scaling`
 * 하나뿐이었다. 그 예외 하나가 실제로 사고를 냈다 —
 *   ① 스킬 경로를 다루는 코드가 "항상 디렉터리"를 가정해 뒤에 `/SKILL.md` 를 붙인다.
 *      파일 단위 항목에서는 `…/SKILL.md/SKILL.md` 라는 없는 경로가 되고, 없으면 0 을 반환하는
 *      계측 코드가 **조용히 0으로 셌다**(ADR-083, 상주 합계가 57 tok 적었다).
 *   ② 파일 단위는 그 파일만 복사한다. 나중에 `references/` 를 붙여도 **배포에서 조용히 빠진다**
 *      — 크래시가 없어 아무도 신고하지 않는 형태다.
 *
 * 통일 자체는 동작을 안 바꿨다(설치 산출물 11트랙 508파일 해시까지 동일). 이 게이트가 지키는
 * 것은 **예외가 다시 생기지 않는 것**이다.
 *
 * 대상은 **열거하지 않는다** — manifest 에서 derive 하므로 새 스킬이 자동으로 편입된다.
 */

/** 전 트랙 합집합의 스킬 엔트리. 트랙별로 다른 스킬이 깔리므로 합쳐야 전수가 된다. */
function skillEntries(): AssetEntry[] {
  const seen = new Map<string, AssetEntry>();
  for (const track of TRACKS as ReadonlyArray<Track>) {
    const spec = buildAssetSpec({ tracks: [track], options: DEFAULT_OPTIONS });
    for (const e of buildManifest(spec)) {
      if (e.target.startsWith(".claude/skills/")) seen.set(e.target, e);
    }
  }
  return [...seen.values()];
}

/** 규칙 위반 판정 — 탐지기 자기검증에도 같은 함수를 쓴다(검사와 카나리아가 갈리면 무의미). */
function violations(entries: ReadonlyArray<AssetEntry>): string[] {
  return entries
    .filter((e) => e.type !== "dir" || e.target.split("/").length !== 3)
    .map((e) => `${e.target} (type=${e.type ?? "file"}, source=${e.source})`);
}

describe("스킬 등록 방식 통일 (#409)", () => {
  const entries = skillEntries();

  it("전제 확인 — 검사할 스킬 엔트리가 실제로 있다 (0건 통과 방지)", () => {
    expect(
      entries.length,
      "manifest 에서 `.claude/skills/` 엔트리를 하나도 못 찾았다 — 0건이면 아래 검사가 " +
        "전부 그냥 통과한다. 게이트가 죽은 것이지 위반이 없는 게 아니다.",
    ).toBeGreaterThan(10);
  });

  it("탐지기 자기검증 — 파일 단위 등록이 잡힌다 (canary)", () => {
    const canary = [
      { source: "skills/x/SKILL.md", target: ".claude/skills/x/SKILL.md", type: "file" },
      { source: "skills/y", target: ".claude/skills/y", type: "dir" },
    ] as unknown as AssetEntry[];
    const found = violations(canary);
    expect(found).toHaveLength(1);
    expect(found[0]).toContain(".claude/skills/x/SKILL.md");
  });

  it("음성 대조 — 디렉터리 단위만 있으면 0건", () => {
    const clean = [
      { source: "skills/y", target: ".claude/skills/y", type: "dir" },
    ] as unknown as AssetEntry[];
    expect(violations(clean)).toEqual([]);
  });

  it("우리 스킬은 전부 `.claude/skills/<id>` 디렉터리 단위다", () => {
    expect(
      violations(entries),
      "파일 단위로 등록된 스킬이 있다. 디렉터리 단위로 바꿔라 — 파일 단위는\n" +
        "  ① 경로를 다루는 코드가 '항상 디렉터리'를 가정해 조용히 틀리고(ADR-083 에서 실제로 났다)\n" +
        "  ② 나중에 붙인 references/ 가 배포에서 조용히 빠진다.\n" +
        "위반:",
    ).toEqual([]);
  });
});
