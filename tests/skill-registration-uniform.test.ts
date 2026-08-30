import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { runInstall } from "../src/installer.js";
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

/**
 * 규칙 위반 판정 — 탐지기 자기검증에도 같은 함수를 쓴다(검사와 카나리아가 갈리면 무의미).
 *
 * **`source` 까지 본다** (독립 리뷰 MEDIUM 적발): `target`·`type` 만 보면
 * `{ source: "skills/x/SKILL.md", target: ".claude/skills/x", type: "dir" }` 가 통과하는데,
 * 그 형태에서 계측은 다시 0 이 된다 — 이 게이트가 막으려던 바로 그 상태다.
 */
function violations(entries: ReadonlyArray<AssetEntry>): string[] {
  return entries
    .filter(
      (e) =>
        e.type !== "dir" ||
        e.target.split("/").length !== 3 ||
        e.source.split("/").length !== 2 ||
        e.source.endsWith(".md"),
    )
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
      // target·type 은 멀쩡한데 source 만 파일을 가리키는 형태. 이것도 계측을 0 으로 만든다.
      { source: "skills/z/SKILL.md", target: ".claude/skills/z", type: "dir" },
      { source: "skills/y", target: ".claude/skills/y", type: "dir" },
    ] as unknown as AssetEntry[];
    const found = violations(canary);
    expect(found).toHaveLength(2);
    expect(found.join(" ")).toContain(".claude/skills/x/SKILL.md");
    expect(found.join(" ")).toContain("skills/z/SKILL.md");
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

/**
 * **설치 보고의 스킬 목록이 실제로 깔린 것과 같은가 (독립 리뷰 HIGH-2).**
 *
 * `installer.ts` 의 카테고리 집계가 `type === "dir"` 인 스킬만 센다. 그래서 통일 이전에는
 * `spec-scaling` 이 파일 단위라 **설치 화면의 `skills (N)` 에서 빠져 있었다** — 디렉터리는
 * 만들어지는데 보고에는 없는 상태다. 통일로 +1 이 됐고 그게 옳은 값인데, **그 수치를 무는
 * 테스트가 없었다.** 화면 숫자와 실제가 어긋나는 것은 이 저장소가 반복해서 겪은 형태다(#320 H1).
 */
describe("설치 보고 ↔ 실제 설치 (#409 HIGH-2)", () => {
  it.each([
    "tooling",
    "executive",
    "full",
  ] as ReadonlyArray<Track>)("track=%s — 보고된 스킬 목록 = 실제로 만들어진 스킬 디렉터리", (track) => {
    const projectDir = mkdtempSync(join(tmpdir(), "report-skills-"));
    try {
      const report = runInstall({
        harnessRoot: resolve(__dirname, ".."),
        projectDir,
        spec: { tracks: [track], options: DEFAULT_OPTIONS, cli: ["claude"], projectDir },
        mode: "add",
        runExternal: () => ({ attempted: [], succeeded: 0, skipped: 0, excludedByCli: [] }),
      } as never) as { categories?: { skills: string[] } };
      const reported = [...(report.categories?.skills ?? [])].sort();
      const installed = readdirSync(join(projectDir, ".claude", "skills"), {
        withFileTypes: true,
      })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .sort();
      expect(
        reported,
        `설치 화면이 ${reported.length}종이라 하는데 실제로 만들어진 것은 ${installed.length}종이다.\n` +
          "화면 숫자와 실제가 어긋나면 설치자가 받은 것을 잘못 안다.",
      ).toEqual(installed);
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });
});
