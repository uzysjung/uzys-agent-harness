import { describe, expect, it } from "vitest";
import {
  DEV_PLUS_PM_TRACKS,
  DEV_TRACKS,
  EXECUTIVE_STYLE_TRACKS,
  EXTERNAL_ASSETS,
  filterApplicableAssets,
  shouldInstallAsset,
} from "../src/external-assets.js";
import { DEFAULT_OPTIONS, type OptionFlags, TRACKS, type Track } from "../src/types.js";

const NO_OPTIONS: OptionFlags = { ...DEFAULT_OPTIONS };

describe("external-assets EXTERNAL_ASSETS catalog", () => {
  it("contains 30 distinct asset ids (no duplicates)", () => {
    const ids = EXTERNAL_ASSETS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("polars-K-Dense");
    expect(ids).toContain("anthropic-data-plugin");
    expect(ids).toContain("railway-skills");
    expect(ids).toContain("ecc-plugin");
    expect(ids).toContain("ecc-prune");
    expect(ids).toContain("trailofbits-skills");
    expect(ids).toContain("gsd-orchestrator");
    expect(ids).toContain("business-growth-skills");
  });

  it("every asset has description + condition + method", () => {
    for (const a of EXTERNAL_ASSETS) {
      expect(a.id).toBeTruthy();
      expect(a.description).toBeTruthy();
      expect(a.condition).toBeDefined();
      expect(a.method).toBeDefined();
    }
  });
});

describe("shouldInstallAsset — track conditions", () => {
  it("any-track condition matches when at least one track is in the set", () => {
    const polars = EXTERNAL_ASSETS.find((a) => a.id === "polars-K-Dense");
    if (!polars) throw new Error("polars asset missing");
    expect(shouldInstallAsset(polars, { tracks: ["data"], options: NO_OPTIONS })).toBe(true);
    expect(shouldInstallAsset(polars, { tracks: ["full"], options: NO_OPTIONS })).toBe(true);
    expect(shouldInstallAsset(polars, { tracks: ["tooling"], options: NO_OPTIONS })).toBe(false);
  });

  it("has-dev-track matches any non-executive track", () => {
    const findSkills = EXTERNAL_ASSETS.find((a) => a.id === "find-skills");
    if (!findSkills) throw new Error("find-skills missing");
    expect(shouldInstallAsset(findSkills, { tracks: ["tooling"], options: NO_OPTIONS })).toBe(true);
    expect(shouldInstallAsset(findSkills, { tracks: ["csr-fastapi"], options: NO_OPTIONS })).toBe(
      true,
    );
    expect(shouldInstallAsset(findSkills, { tracks: ["executive"], options: NO_OPTIONS })).toBe(
      false,
    );
  });

  it("option flag conditions match flag=true only", () => {
    const ecc = EXTERNAL_ASSETS.find((a) => a.id === "ecc-plugin");
    if (!ecc) throw new Error("ecc-plugin missing");
    expect(shouldInstallAsset(ecc, { tracks: ["tooling"], options: NO_OPTIONS })).toBe(false);
    expect(
      shouldInstallAsset(ecc, {
        tracks: ["tooling"],
        options: { ...NO_OPTIONS, withEcc: true },
      }),
    ).toBe(true);
  });

  it("ecc-prune fires when withPrune=true (separate from withEcc)", () => {
    const prune = EXTERNAL_ASSETS.find((a) => a.id === "ecc-prune");
    if (!prune) throw new Error("ecc-prune missing");
    // withPrune이 자체적으로 trigger (ecc-prune is gated on withPrune flag)
    expect(
      shouldInstallAsset(prune, {
        tracks: ["tooling"],
        options: { ...NO_OPTIONS, withPrune: true },
      }),
    ).toBe(true);
  });

  it("Trail of Bits is gated on --with-tob", () => {
    const tob = EXTERNAL_ASSETS.find((a) => a.id === "trailofbits-skills");
    if (!tob) throw new Error("trailofbits missing");
    expect(shouldInstallAsset(tob, { tracks: ["tooling"], options: NO_OPTIONS })).toBe(false);
    expect(
      shouldInstallAsset(tob, {
        tracks: ["tooling"],
        options: { ...NO_OPTIONS, withTob: true },
      }),
    ).toBe(true);
  });

  // v26.39.2 fix — marketplace.json 사실 검증 (사용자 보고 #4)
  it("Trail of Bits pluginId matches actual marketplace.json (differential-review@trailofbits)", () => {
    const tob = EXTERNAL_ASSETS.find((a) => a.id === "trailofbits-skills");
    if (!tob) throw new Error("trailofbits missing");
    expect(tob.method.kind).toBe("plugin");
    if (tob.method.kind !== "plugin") throw new Error("not plugin");
    // marketplace name = "trailofbits/skills" (URL form, claude plugin marketplace add)
    expect(tob.method.marketplace).toBe("trailofbits/skills");
    // pluginId 형식: <pluginName>@<marketplaceName-from-marketplace.json>
    // marketplace.json 의 "name": "trailofbits" → pluginId 의 @ 뒤가 "trailofbits"
    expect(tob.method.pluginId).toBe("differential-review@trailofbits");
  });

  it("GSD orchestrator is gated on --with-gsd", () => {
    const gsd = EXTERNAL_ASSETS.find((a) => a.id === "gsd-orchestrator");
    if (!gsd) throw new Error("gsd missing");
    expect(shouldInstallAsset(gsd, { tracks: ["tooling"], options: NO_OPTIONS })).toBe(false);
    expect(
      shouldInstallAsset(gsd, {
        tracks: ["tooling"],
        options: { ...NO_OPTIONS, withGsd: true },
      }),
    ).toBe(true);
  });
});

describe("filterApplicableAssets", () => {
  it("returns 0 assets for executive-only track without any options", () => {
    const apps = filterApplicableAssets(EXTERNAL_ASSETS, {
      tracks: ["executive"] as Track[],
      options: NO_OPTIONS,
    });
    // executive 한정 자산만 — Anthropic document-skills + c-level + finance + GSD(GSD는 옵션 gated)
    const ids = apps.map((a) => a.id);
    expect(ids).toContain("anthropic-document-skills");
    expect(ids).toContain("c-level-skills");
    expect(ids).toContain("finance-skills");
    expect(ids).not.toContain("gsd-orchestrator"); // option-gated
    expect(ids).not.toContain("addy-agent-skills"); // option-gated (v26.42.0+)
    expect(ids).not.toContain("polars-K-Dense"); // data|full
  });

  it("data track gets 5 data-specific assets + dev baselines", () => {
    const apps = filterApplicableAssets(EXTERNAL_ASSETS, {
      tracks: ["data"] as Track[],
      options: NO_OPTIONS,
    });
    const ids = apps.map((a) => a.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "polars-K-Dense",
        "dask-K-Dense",
        "python-resource-management",
        "python-performance-optimization",
        "anthropic-data-plugin",
        "find-skills",
        "agent-browser",
      ]),
    );
    expect(ids).not.toContain("addy-agent-skills"); // option-gated (v26.42.0+)
    expect(ids).not.toContain("railway-skills"); // not in data
  });

  it("full track activates everything except option-gated", () => {
    const apps = filterApplicableAssets(EXTERNAL_ASSETS, {
      tracks: ["full"] as Track[],
      options: NO_OPTIONS,
    });
    const ids = apps.map((a) => a.id);
    // 옵션 gated 4건은 제외 (ecc, prune, tob, gsd)
    expect(ids).not.toContain("ecc-plugin");
    expect(ids).not.toContain("trailofbits-skills");
    // Track 매트릭스의 모든 다른 자산은 포함
    expect(ids).toContain("polars-K-Dense");
    expect(ids).toContain("railway-skills");
    expect(ids).toContain("vercel-cli");
    expect(ids).toContain("anthropic-document-skills");
  });

  it("option flags add to base track set", () => {
    const apps = filterApplicableAssets(EXTERNAL_ASSETS, {
      tracks: ["tooling"] as Track[],
      options: { ...NO_OPTIONS, withEcc: true, withTob: true, withGsd: true },
    });
    const ids = apps.map((a) => a.id);
    expect(ids).toContain("ecc-plugin");
    expect(ids).toContain("trailofbits-skills");
    expect(ids).toContain("gsd-orchestrator");
  });
});

// v0.8.1 — reviewer MEDIUM-3 fix: TRACKS partition invariants.
describe("Track partition invariants — v0.8.1 SSOT", () => {
  it("TRACKS = DEV_TRACKS ∪ EXECUTIVE_STYLE_TRACKS (disjoint, exhaustive)", () => {
    const dev = new Set<Track>(DEV_TRACKS);
    const exec = new Set<Track>(EXECUTIVE_STYLE_TRACKS);
    // disjoint: no overlap
    for (const t of dev) expect(exec.has(t)).toBe(false);
    // exhaustive: dev ∪ exec = TRACKS
    const union = new Set<Track>([...dev, ...exec]);
    expect(union.size).toBe(TRACKS.length);
    for (const t of TRACKS) expect(union.has(t)).toBe(true);
  });

  it("DEV_PLUS_PM_TRACKS = DEV_TRACKS + project-management (8 + 1 = 9)", () => {
    expect(DEV_PLUS_PM_TRACKS.length).toBe(DEV_TRACKS.length + 1);
    expect(DEV_PLUS_PM_TRACKS).toContain("project-management");
    for (const t of DEV_TRACKS) expect(DEV_PLUS_PM_TRACKS).toContain(t);
  });

  it("product-skills condition uses DEV_PLUS_PM_TRACKS (no inline duplication)", () => {
    const ps = EXTERNAL_ASSETS.find((a) => a.id === "product-skills");
    if (!ps) throw new Error("product-skills missing");
    expect(ps.condition.kind).toBe("any-track");
    if (ps.condition.kind !== "any-track") throw new Error("not any-track");
    expect([...ps.condition.tracks].sort()).toEqual([...DEV_PLUS_PM_TRACKS].sort());
  });
});

describe("v26.47.0 — shouldInstallAsset userOverride (Phase C full)", () => {
  it("forceExclude > condition: 매칭 자산도 강제 제외", () => {
    const polars = EXTERNAL_ASSETS.find((a) => a.id === "polars-K-Dense");
    if (!polars) throw new Error("polars missing");
    // data track 에서 추천이지만 사용자가 unchecked
    expect(
      shouldInstallAsset(polars, {
        tracks: ["data"] as Track[],
        options: NO_OPTIONS,
        userOverride: { forceInclude: [], forceExclude: ["polars-K-Dense"] },
      }),
    ).toBe(false);
  });

  it("forceInclude > condition: 미매칭 자산도 강제 포함", () => {
    const polars = EXTERNAL_ASSETS.find((a) => a.id === "polars-K-Dense");
    if (!polars) throw new Error("polars missing");
    // tooling track 은 폴라스 추천 X — 사용자가 명시 추가
    expect(
      shouldInstallAsset(polars, {
        tracks: ["tooling"] as Track[],
        options: NO_OPTIONS,
        userOverride: { forceInclude: ["polars-K-Dense"], forceExclude: [] },
      }),
    ).toBe(true);
  });

  it("forceExclude > forceInclude (동시 명시 시 exclude 우선)", () => {
    const polars = EXTERNAL_ASSETS.find((a) => a.id === "polars-K-Dense");
    if (!polars) throw new Error("polars missing");
    expect(
      shouldInstallAsset(polars, {
        tracks: ["data"] as Track[],
        options: NO_OPTIONS,
        userOverride: {
          forceInclude: ["polars-K-Dense"],
          forceExclude: ["polars-K-Dense"],
        },
      }),
    ).toBe(false);
  });

  it("userOverride 미제공 시 기존 condition 만 평가 (backward compat)", () => {
    const polars = EXTERNAL_ASSETS.find((a) => a.id === "polars-K-Dense");
    if (!polars) throw new Error("polars missing");
    expect(shouldInstallAsset(polars, { tracks: ["data"] as Track[], options: NO_OPTIONS })).toBe(
      true,
    );
  });
});
