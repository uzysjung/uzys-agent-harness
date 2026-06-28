import { describe, expect, it } from "vitest";
import {
  assetTrustTier,
  DEV_METHOD_SKILL_IDS,
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

describe("Trust Tier (v26.71.0, PRD v26-71; v26.79.0 SSOT derive)", () => {
  // v26.79.0 — tier 는 이제 ExternalAsset.tier 필수 필드 (컴파일러가 누락 차단).
  //   TRUST_TIER 는 거기서 derive. 따라서 검증해야 할 WHY 가 바뀌었다:
  //   "라벨 누락"(컴파일 에러로 불가)이 아니라 → derive 가 lossless 한가 (중복 id 금지).
  it("자산 id 는 유일 — 중복 시 TRUST_TIER derive(Object.fromEntries)가 tier 를 silent drop", () => {
    const ids = EXTERNAL_ASSETS.map((a) => a.id);
    const dups = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dups).toEqual([]);
    // derive 가 전 자산을 1:1 반영 (key 수 === 자산 수).
    expect(Object.keys(TRUST_TIER)).toHaveLength(EXTERNAL_ASSETS.length);
  });

  it("TRUST_TIER 는 각 자산의 tier 필드를 정확히 반영 (derive 정합)", () => {
    for (const a of EXTERNAL_ASSETS) {
      expect(TRUST_TIER[a.id]).toBe(a.tier);
    }
  });

  // v26.80.0 (Phase P — 보안 wedge): npm/npx-run 자산은 전부 정확 semver pin.
  //   WHY: vetting 은 시점 검증인데 @latest/unpinned 는 미래 코드 실행 — hijacked vetted
  //   repo 가 사용자에게 직행하는 구멍 (ADR-021 "지속 검증되는 큐레이션" 주장과 모순).
  //   bump 는 A2 자산 audit 주기에 Docker 검증 후 (COMPATIBILITY.md §pinning).
  it("npm/npx-run 자산은 전부 정확 semver pinned — @latest/range/이름 인라인 금지", () => {
    for (const a of EXTERNAL_ASSETS) {
      const m = a.method;
      if (m.kind !== "npm" && m.kind !== "npx-run") continue;
      expect(m.version, `${a.id} version 은 정확 semver`).toMatch(/^\d+\.\d+\.\d+$/);
      // pkg/cmd 는 bare 이름 — "@latest"/"@1.2.3" 인라인 재발 금지 (scoped @scope/ 는 허용).
      const name = m.kind === "npm" ? m.pkg : m.cmd;
      expect(name, `${a.id} 이름에 버전 인라인 금지`).not.toMatch(/@(latest|next|\d)/);
    }
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

  it("T3 experimental 은 star<1000 5개 (next-skills/railway/playwright/ADR/revealjs)", () => {
    const t3 = EXTERNAL_ASSETS.filter((a) => assetTrustTier(a.id) === "experimental")
      .map((a) => a.id)
      .sort();
    expect(t3).toEqual([
      "architecture-decision-record",
      "next-skills",
      "playwright-skill",
      "railway-skills",
      "revealjs",
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
  it("contains 58 distinct asset ids (no duplicates)", () => {
    const ids = EXTERNAL_ASSETS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(58);
    // v26.91.0 — coreyhaines31/marketingskills (opt-in 번들). 기존 marketing-skills(alirezarezvani)
    //   와 동시 존재 — id 가 달라(하이픈 유무) 충돌 없음. 둘 다 카탈로그에 있어야 병존이 깨지지 않음.
    expect(ids).toContain("marketingskills");
    expect(ids).toContain("marketing-skills");
    expect(ids).toContain("polars-K-Dense");
    expect(ids).toContain("anthropic-data-plugin");
    expect(ids).toContain("railway-skills");
    expect(ids).toContain("ecc-plugin");
    expect(ids).toContain("ecc-prune");
    expect(ids).toContain("trailofbits-skills");
    expect(ids).toContain("gsd-orchestrator");
    expect(ids).toContain("business-growth-skills");
    // v26.87.0 — dev-method skills (uzys 1st-party, internal).
    for (const id of DEV_METHOD_SKILL_IDS) expect(ids).toContain(id);
  });

  // v26.87.0 — dev-method skills (uzys 1st-party, internal templates). Promise=Impl:
  //   official tier + has-dev-track condition + internal method = repo-bundled, core on
  //   dev tracks, NOT a github source (those repos don't exist → false-ship). drift 시 fail.
  it("dev-method skills: 6 internal/official/has-dev-track, dev-tools×3 + workflow×3", () => {
    const byId = (id: string) => EXTERNAL_ASSETS.find((a) => a.id === id);
    const expectedCategory: Record<string, "dev-tools" | "workflow"> = {
      "multi-persona-review": "dev-tools",
      "gap-analysis-e2e": "dev-tools",
      "ultracode-service-audit": "dev-tools",
      "asis-tobe-decision": "workflow",
      "compaction-handoff": "workflow",
      "northstar-roadmap": "workflow",
    };
    expect([...DEV_METHOD_SKILL_IDS].sort()).toEqual(Object.keys(expectedCategory).sort());
    for (const id of DEV_METHOD_SKILL_IDS) {
      const a = byId(id);
      if (!a) throw new Error(`${id} missing`);
      expect(assetTrustTier(id)).toBe("official");
      expect(a.source).toBe("uzys");
      expect(a.condition.kind).toBe("has-dev-track");
      // internal method (repo-bundled) — NOT a github skill source (would crash at install).
      expect(a.method.kind).toBe("internal");
      if (a.method.kind !== "internal") throw new Error("not internal");
      expect(a.method.key).toBe(id);
      expect(a.category).toBe(expectedCategory[id]);
    }
  });

  // WHY core-on-dev-tracks: official tier (not experimental) + has-dev-track → installs by
  //   default on any dev track, but forceExclude (wizard uncheck / --without) must drop it.
  it("dev-method skills install by default on dev tracks, droppable via forceExclude", () => {
    const audit = EXTERNAL_ASSETS.find((a) => a.id === "ultracode-service-audit");
    if (!audit) throw new Error("ultracode-service-audit missing");
    // tooling = dev track → default install.
    expect(shouldInstallAsset(audit, { tracks: ["tooling"], options: NO_OPTIONS })).toBe(true);
    // executive (non-dev) → not installed.
    expect(shouldInstallAsset(audit, { tracks: ["executive"], options: NO_OPTIONS })).toBe(false);
    // dev track but user unchecks in wizard / --without → dropped.
    expect(
      shouldInstallAsset(audit, {
        tracks: ["tooling"],
        options: NO_OPTIONS,
        userOverride: { forceInclude: [], forceExclude: ["ultracode-service-audit"] },
      }),
    ).toBe(false);
  });

  it("every asset has description + condition + method", () => {
    for (const a of EXTERNAL_ASSETS) {
      expect(a.id).toBeTruthy();
      expect(a.description).toBeTruthy();
      expect(a.condition).toBeDefined();
      expect(a.method).toBeDefined();
    }
  });

  // v26.78.0 — Understanding 카테고리 (에이전트 인지 증강). Promise=Impl: 광고한 plugin 설치법
  // 이 실제 정의대로인지 회귀 가드 (pluginId drift 시 fail).
  it("Understanding category: 3 new plugins + agent-browser, exact methods", () => {
    const byId = (id: string) => EXTERNAL_ASSETS.find((a) => a.id === id);
    const understanding = EXTERNAL_ASSETS.filter((a) => a.category === "understanding").map(
      (a) => a.id,
    );
    expect(understanding.sort()).toEqual(
      ["agent-browser", "agentmemory", "claude-video", "understand-anything"].sort(),
    );
    expect(byId("claude-video")?.method).toEqual({
      kind: "plugin",
      marketplace: "bradautomates/claude-video",
      pluginId: "watch@claude-video",
    });
    expect(byId("understand-anything")?.method).toEqual({
      kind: "plugin",
      marketplace: "Lum1104/Understand-Anything",
      pluginId: "understand-anything@understand-anything",
    });
    expect(byId("agentmemory")?.method).toEqual({
      kind: "plugin",
      marketplace: "rohitg00/agentmemory",
      pluginId: "agentmemory@agentmemory",
    });
    // 3종은 opt-in. 기본 설치 아님 (v26.81.0 ADR-022 — option flag → opt-in condition).
    for (const id of ["claude-video", "understand-anything", "agentmemory"]) {
      expect(byId(id)?.condition.kind).toBe("opt-in");
    }
    // 전부 vetted (star≥1000).
    for (const id of ["claude-video", "understand-anything", "agentmemory"]) {
      expect(assetTrustTier(id)).toBe("vetted");
    }
  });

  // v26.85.0 — Visual & Media 카테고리 (코드-퍼스트 제작). Promise=Impl: 광고한 설치법 = 정의.
  //   좌표는 Docker 실설치 검증(실 claude 2.1.177) PASS 값 — drift(rename/삭제) 시 fail.
  //   no-false-ship surface parity: opt-in(자동 미설치) + forceInclude(--with/wizard)로만 설치.
  it("Visual & Media category: 9 assets, opt-in + forceInclude reachable, exact methods", () => {
    const byId = (id: string) => EXTERNAL_ASSETS.find((a) => a.id === id);
    const vm = EXTERNAL_ASSETS.filter((a) => a.category === "visual-media").map((a) => a.id);
    expect(vm.sort()).toEqual(
      [
        "frontend-slides",
        "gsap-skills",
        "marp-slide",
        "mermaid-diagrams",
        "remotion",
        "ppt-master",
        "ppt-generation",
        "web-video-presentation",
        "revealjs",
      ].sort(),
    );
    expect(byId("frontend-slides")?.method).toEqual({
      kind: "plugin",
      marketplace: "zarazhangrui/frontend-slides",
      pluginId: "frontend-slides@frontend-slides",
    });
    expect(byId("gsap-skills")?.method).toEqual({
      kind: "plugin",
      marketplace: "greensock/gsap-skills",
      pluginId: "gsap-skills@gsap-skills",
    });
    expect(byId("marp-slide")?.method).toEqual({
      kind: "skill",
      source: "softaworks/agent-toolkit",
      skill: "marp-slide",
    });
    expect(byId("mermaid-diagrams")?.method).toEqual({
      kind: "skill",
      source: "softaworks/agent-toolkit",
      skill: "mermaid-diagrams",
    });
    // remotion --skill = remotion-best-practices (Docker 실측 — dir `remotion` ≠ frontmatter name).
    expect(byId("remotion")?.method).toEqual({
      kind: "skill",
      source: "remotion-dev/skills",
      skill: "remotion-best-practices",
    });
    // Issue #176 프레젠테이션 4종 (Docker 4/4 PASS — skills@1.5.11 add <src> --agent claude-code --skill).
    expect(byId("ppt-master")?.method).toEqual({
      kind: "skill",
      source: "hugohe3/ppt-master",
      skill: "ppt-master",
    });
    expect(byId("ppt-generation")?.method).toEqual({
      kind: "skill",
      source: "bytedance/deer-flow",
      skill: "ppt-generation",
    });
    expect(byId("web-video-presentation")?.method).toEqual({
      kind: "skill",
      source: "ConardLi/garden-skills",
      skill: "web-video-presentation",
    });
    expect(byId("revealjs")?.method).toEqual({
      kind: "skill",
      source: "ryanbbrown/revealjs-skill",
      skill: "revealjs",
    });
    // 전부 opt-in (자동 미설치). tier: vetted 8 + experimental 1 (revealjs ★347 <1000, opt-in).
    for (const id of vm) {
      expect(byId(id)?.condition.kind).toBe("opt-in");
    }
    for (const id of vm.filter((i) => i !== "revealjs")) {
      expect(assetTrustTier(id)).toBe("vetted");
    }
    expect(assetTrustTier("revealjs")).toBe("experimental");
    // surface parity — condition-only 미설치, forceInclude(--with / wizard 체크) 시 설치.
    const fs = byId("frontend-slides");
    if (!fs) throw new Error("frontend-slides missing");
    expect(shouldInstallAsset(fs, { tracks: ["full"], options: NO_OPTIONS })).toBe(false);
    expect(
      shouldInstallAsset(fs, {
        tracks: ["full"],
        options: NO_OPTIONS,
        userOverride: { forceInclude: ["frontend-slides"], forceExclude: [] },
      }),
    ).toBe(true);
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

  // v26.81.0 (ADR-022) — flag 게이팅 → opt-in(forceInclude) 게이팅으로 의미 전환.
  //   WHY: condition 만으론 절대 미설치(무단 설치 금지), --with <id>/wizard 체크로만 활성.
  it("opt-in conditions never match by themselves — forceInclude only", () => {
    const ecc = EXTERNAL_ASSETS.find((a) => a.id === "ecc-plugin");
    if (!ecc) throw new Error("ecc-plugin missing");
    expect(shouldInstallAsset(ecc, { tracks: ["tooling"], options: NO_OPTIONS })).toBe(false);
    expect(
      shouldInstallAsset(ecc, {
        tracks: ["tooling"],
        options: NO_OPTIONS,
        userOverride: { forceInclude: ["ecc-plugin"], forceExclude: [] },
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

  it("Trail of Bits is gated on `--with trailofbits-skills` (opt-in)", () => {
    const tob = EXTERNAL_ASSETS.find((a) => a.id === "trailofbits-skills");
    if (!tob) throw new Error("trailofbits missing");
    expect(shouldInstallAsset(tob, { tracks: ["tooling"], options: NO_OPTIONS })).toBe(false);
    expect(
      shouldInstallAsset(tob, {
        tracks: ["tooling"],
        options: NO_OPTIONS,
        userOverride: { forceInclude: ["trailofbits-skills"], forceExclude: [] },
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

  it("GSD orchestrator is gated on `--with gsd-orchestrator` (opt-in)", () => {
    const gsd = EXTERNAL_ASSETS.find((a) => a.id === "gsd-orchestrator");
    if (!gsd) throw new Error("gsd missing");
    expect(shouldInstallAsset(gsd, { tracks: ["tooling"], options: NO_OPTIONS })).toBe(false);
    expect(
      shouldInstallAsset(gsd, {
        tracks: ["tooling"],
        options: NO_OPTIONS,
        userOverride: { forceInclude: ["gsd-orchestrator"], forceExclude: [] },
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

    // v26.81.0 (ADR-022) — `--with <id>` (forceInclude) 로만 활성
    for (const a of [wshobson, openspec, bmad]) {
      expect(
        shouldInstallAsset(a, {
          tracks: ["tooling"],
          options: NO_OPTIONS,
          userOverride: { forceInclude: [a.id], forceExclude: [] },
        }),
      ).toBe(true);
    }

    // 검증된 설치 메서드 (Promise=Impl — 변조 시 회귀 fail)
    expect(wshobson.method).toEqual({
      kind: "plugin",
      marketplace: "wshobson/agents",
      pluginId: "full-stack-orchestration@claude-code-workflows",
    });
    // v26.80.0 — version pinned (vetting 시점 코드만 실행). bump 는 A2 audit 주기 + Docker 검증.
    expect(openspec.method).toEqual({ kind: "npm", pkg: "@fission-ai/openspec", version: "1.4.1" });
    expect(bmad.method).toEqual({
      kind: "npx-run",
      cmd: "bmad-method",
      version: "6.9.0",
      // v26.75.1 — --directory . 필수(없으면 비대화형 hang, Docker realcli 검출)
      args: ["install", "--directory", ".", "--tools", "claude-code", "--yes"],
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

  it("forceInclude (--with <id>) adds opt-in assets to base track set", () => {
    // v26.81.0 (ADR-022) — 옵션 플래그 → forceInclude 의미 전환 (동일 의도: 기본셋 + opt-in 추가).
    const apps = filterApplicableAssets(EXTERNAL_ASSETS, {
      tracks: ["tooling"] as Track[],
      options: NO_OPTIONS,
      userOverride: {
        forceInclude: ["ecc-plugin", "trailofbits-skills", "gsd-orchestrator"],
        forceExclude: [],
      },
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
