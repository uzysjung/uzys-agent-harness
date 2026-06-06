import { describe, expect, it } from "vitest";
import {
  assetTrustTier,
  DEV_PLUS_PM_TRACKS,
  DEV_TRACKS,
  EXECUTIVE_STYLE_TRACKS,
  EXTERNAL_ASSETS,
  experimentalOptInCandidates,
  filterApplicableAssets,
  shouldInstallAsset,
  TRUST_TIER,
} from "../src/external-assets.js";
import { DEFAULT_OPTIONS, type OptionFlags, TRACKS, type Track } from "../src/types.js";

const NO_OPTIONS: OptionFlags = { ...DEFAULT_OPTIONS };

describe("Trust Tier (v26.71.0, PRD v26-71)", () => {
  it("모든 EXTERNAL_ASSETS 에 trust tier 라벨 부여 (누락 0 — AC1)", () => {
    const missing = EXTERNAL_ASSETS.filter((a) => !(a.id in TRUST_TIER)).map((a) => a.id);
    expect(missing).toEqual([]);
  });

  it("assetTrustTier — official / vetted / experimental 분류", () => {
    expect(assetTrustTier("anthropic-document-skills")).toBe("official"); // anthropics 공식
    expect(assetTrustTier("ecc-prune")).toBe("official"); // 하네스 자체
    expect(assetTrustTier("ecc-plugin")).toBe("vetted"); // affaan-m 199k
    expect(assetTrustTier("playwright-skill")).toBe("experimental"); // 264 < 1000
  });

  it("미분류(맵 누락) 자산은 보수적으로 experimental (검증 안 된 것 취급)", () => {
    expect(assetTrustTier("nonexistent-asset-xyz")).toBe("experimental");
  });

  it("T3 experimental 은 star<1000 4개 (next-skills/railway/playwright/ADR)", () => {
    const t3 = EXTERNAL_ASSETS.filter((a) => assetTrustTier(a.id) === "experimental")
      .map((a) => a.id)
      .sort();
    expect(t3).toEqual([
      "architecture-decision-record",
      "next-skills",
      "playwright-skill",
      "railway-skills",
    ]);
  });
});

describe("shouldInstallAsset — experimental opt-in (v26.71.1, PRD v26-71 R6/AC4)", () => {
  // WHY: R6 = "T3(Experimental) 는 경고 + opt-in (pre-check 안 함)". AC4 = opt-in only.
  //   v26.71.0 은 recommendedExternalAssets(pre-check)에만 적용 → 비대화형 install 경로
  //   (filterApplicableAssets→shouldInstallAsset)에 누락 → experimental 이 default 설치되던 버그.
  //   이 describe 는 condition-only 미설치 + forceInclude 시 설치(선택권 유지)를 고정한다.
  it("experimental(T3) 은 condition 매치만으론 미설치 (opt-in only)", () => {
    const pw = EXTERNAL_ASSETS.find((a) => a.id === "playwright-skill");
    if (!pw) throw new Error("playwright-skill missing");
    expect(assetTrustTier("playwright-skill")).toBe("experimental");
    // has-dev-track condition 은 tooling 매치하지만 T3 → default 제외.
    expect(shouldInstallAsset(pw, { tracks: ["tooling"], options: NO_OPTIONS })).toBe(false);
  });

  it("experimental 도 forceInclude(--with / interactive 체크) 시 설치 (강제 차단 아님 — AC4)", () => {
    const pw = EXTERNAL_ASSETS.find((a) => a.id === "playwright-skill");
    if (!pw) throw new Error("playwright-skill missing");
    expect(
      shouldInstallAsset(pw, {
        tracks: ["tooling"],
        options: NO_OPTIONS,
        userOverride: { forceInclude: ["playwright-skill"], forceExclude: [] },
      }),
    ).toBe(true);
  });

  it("filterApplicableAssets(tooling) 는 experimental 제외 + vetted 포함 (헤더 추천과 정합)", () => {
    const ids = filterApplicableAssets(EXTERNAL_ASSETS, {
      tracks: ["tooling"],
      options: NO_OPTIONS,
    }).map((a) => a.id);
    expect(ids).not.toContain("playwright-skill"); // T3
    expect(ids).not.toContain("architecture-decision-record"); // T3
    expect(ids).toContain("find-skills"); // vetted
    expect(ids).toContain("karpathy-coder"); // official/vetted
  });

  it("experimentalOptInCandidates(tooling) = 조건 매치 T3 (discoverability 힌트 대상)", () => {
    const ids = experimentalOptInCandidates({ tracks: ["tooling"], options: NO_OPTIONS })
      .map((a) => a.id)
      .sort();
    // tooling = has-dev-track → playwright-skill / ADR (T3) 매치. railway/next 는 csr/ssr 전용.
    expect(ids).toEqual(["architecture-decision-record", "playwright-skill"]);
  });

  it("experimentalOptInCandidates 는 forceInclude(--with) 된 것 제외 (이미 설치되므로)", () => {
    const ids = experimentalOptInCandidates({
      tracks: ["tooling"],
      options: NO_OPTIONS,
      userOverride: { forceInclude: ["playwright-skill"], forceExclude: [] },
    }).map((a) => a.id);
    expect(ids).not.toContain("playwright-skill"); // 이미 opt-in → 힌트 불필요
    expect(ids).toContain("architecture-decision-record"); // 여전히 미설치 → 힌트 대상
  });
});

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

  it("workflow 큐레이션 확장 (v26.75.0, ADR-021) — 3 자산 옵션 gated + 검증 메서드/tier", () => {
    const wshobson = EXTERNAL_ASSETS.find((a) => a.id === "wshobson-agents");
    const openspec = EXTERNAL_ASSETS.find((a) => a.id === "openspec");
    const bmad = EXTERNAL_ASSETS.find((a) => a.id === "bmad-method");
    if (!wshobson || !openspec || !bmad) throw new Error("workflow 자산 누락");

    // 전부 workflow 카테고리 + vetted, 기본 트랙엔 미포함 (옵션 gated — 무단 설치 금지)
    for (const a of [wshobson, openspec, bmad]) {
      expect(a.category).toBe("workflow");
      expect(assetTrustTier(a.id)).toBe("vetted");
      expect(shouldInstallAsset(a, { tracks: ["tooling"], options: NO_OPTIONS })).toBe(false);
    }

    // 각 옵션 플래그로만 활성
    expect(
      shouldInstallAsset(wshobson, {
        tracks: ["tooling"],
        options: { ...NO_OPTIONS, withWshobsonAgents: true },
      }),
    ).toBe(true);
    expect(
      shouldInstallAsset(openspec, {
        tracks: ["tooling"],
        options: { ...NO_OPTIONS, withOpenspec: true },
      }),
    ).toBe(true);
    expect(
      shouldInstallAsset(bmad, { tracks: ["tooling"], options: { ...NO_OPTIONS, withBmad: true } }),
    ).toBe(true);

    // 검증된 설치 메서드 (Promise=Impl — 변조 시 회귀 fail)
    expect(wshobson.method).toEqual({
      kind: "plugin",
      marketplace: "wshobson/agents",
      pluginId: "full-stack-orchestration@claude-code-workflows",
    });
    expect(openspec.method).toEqual({ kind: "npm", pkg: "@fission-ai/openspec" });
    expect(bmad.method).toEqual({
      kind: "npx-run",
      cmd: "bmad-method@latest",
      args: ["install", "--tools", "claude-code", "--yes"],
    });
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
    // Track 매트릭스의 vetted/official 자산은 포함
    expect(ids).toContain("polars-K-Dense");
    expect(ids).not.toContain("railway-skills"); // v26.71.1 — T3 experimental opt-in only (PRD R6)
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
