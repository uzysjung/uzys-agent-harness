import { describe, expect, it } from "vitest";
import { DEV_METHOD_SKILL_IDS } from "../src/external-assets.js";
import { buildAssetSpec, buildManifest, resolveRules } from "../src/manifest.js";
import { recommendedExternalAssets } from "../src/preset-recommend.js";
import { hasDevTrack } from "../src/track-match.js";
import { DEFAULT_OPTIONS } from "../src/types.js";

/**
 * #456 (사용자 결정 2026-09-20, B) — `base` 트랙: 스택 무관하게 원칙·방법론·테스트 스킬만.
 * 대조군은 `tooling` — 같은 dev 트랙인데 스택(CLI 개발) 룰과 개발 도구 3종을 받는다.
 */
describe("base 트랙 (#456)", () => {
  const spec = (t: "base" | "tooling") => buildAssetSpec({ tracks: [t], options: DEFAULT_OPTIONS });

  it("공통 룰 5종만 — cli-development 는 안 받는다 (대조군 tooling 은 받는다)", () => {
    const base = resolveRules(spec("base"));
    expect(base).toEqual(
      ["git-policy", "change-management", "doc-governance", "test-policy", "ship-checklist"].sort(),
    );
    expect(resolveRules(spec("tooling"))).toContain("cli-development");
  });

  it("dev 트랙이다 — implementer 와 방법론 스킬 5종이 온다", () => {
    expect(hasDevTrack(["base"])).toBe(true);
    const targets = buildManifest(spec("base"))
      .filter((e) => e.applies(spec("base")))
      .map((e) => e.target);
    expect(targets).toContain(".claude/agents/implementer.md");
    expect(targets).toContain(".claude/agents/reviewer.md");
    for (const id of DEV_METHOD_SKILL_IDS) expect(targets).toContain(`.claude/skills/${id}`);
  });

  it("base 가 받는 자산은 tooling 이 받는 자산의 부분집합이고, 빠지는 것은 cli-development 뿐이다", () => {
    const of = (t: "base" | "tooling") =>
      new Set(
        buildManifest(spec(t))
          .filter((e) => e.applies(spec(t)))
          .map((e) => e.target),
      );
    const base = of("base");
    const tooling = of("tooling");
    for (const t of base) expect(tooling, `base 만 받는 자산 ${t}`).toContain(t);
    const onlyTooling = [...tooling].filter((t) => !base.has(t));
    expect(onlyTooling).toEqual([".claude/rules/cli-development.md"]);
  });

  it("외부 자산 기본 선택: 전 트랙 4종은 오고, UI 도구(frontend-design)는 UI 가 없는 트랙(base · data · tooling)에 안 온다 — 대조군 csr-fastapi 는 온다 · agent-browser 는 어디서도 기본이 아니다(#489)", () => {
    const base = recommendedExternalAssets(["base"]);
    for (const id of ["north-star", "gh-issue-workflow", "objective-brief", "audit-harness-fit"])
      expect(base).toContain(id);
    // #492 — 같이 재던 find-skills 가 은퇴했다. #709 (ADR-101) — 축이 "UI 가 있는 스택" 으로 좁아졌다: data · tooling 도 뺀다.
    for (const id of ["frontend-design"]) {
      for (const track of ["base", "data", "tooling"] as const)
        expect(
          recommendedExternalAssets([track]),
          `${id} 가 ${track} 기본 선택에 들어왔다`,
        ).not.toContain(id);
      expect(
        recommendedExternalAssets(["csr-fastapi"]),
        `대조군: csr-fastapi 가 ${id} 를 못 받는다`,
      ).toContain(id);
    }
    // #489 — agent-browser 는 opt-in: 스택 있는 dev 트랙에서도 기본 체크가 아니다.
    expect(recommendedExternalAssets(["tooling"])).not.toContain("agent-browser");
    // 스택 전용 자산 0 — tooling 과 비교해 base 에만 있는 것이 없다
    const tooling = new Set(recommendedExternalAssets(["tooling"]));
    for (const id of base) expect(tooling, `base 만 받는 외부 자산 ${id}`).toContain(id);
  });
});
