/**
 * Track 매트릭스 검증 — 11 Track × external asset 매핑 (v0.5.0).
 *
 * SPEC: docs/specs/new-tracks-pm-growth.md AC3 (이전 docs/specs/cli-rewrite-completeness.md F4, AC2)
 *
 * 각 Track에 대해 runExternalInstall이 정확히 어떤 자산 ID들을 호출하는지 검증.
 * 실제 spawn은 mock으로 차단 (no real `claude plugin install`).
 *
 * 매핑 출처: src/external-assets.ts (bash setup-harness.sh@911c246~1 등가).
 */
import type { SpawnSyncReturns } from "node:child_process";
import { describe, expect, it, vi } from "vitest";
import { EXTERNAL_ASSETS } from "../src/external-assets.js";
import { type ExternalInstallerDeps, runExternalInstall } from "../src/external-installer.js";
import { DEFAULT_OPTIONS, type OptionFlags, type Track } from "../src/types.js";

type SpawnFn = NonNullable<ExternalInstallerDeps["spawn"]>;

function ok(): SpawnSyncReturns<string> {
  return { pid: 0, output: [], stdout: "", stderr: "", status: 0, signal: null };
}

function makeMockSpawn(): SpawnFn & { mock: { calls: Array<Parameters<SpawnFn>> } } {
  return vi.fn(() => ok()) as unknown as SpawnFn & {
    mock: { calls: Array<Parameters<SpawnFn>> };
  };
}

function runForTrack(
  tracks: Track[],
  options: Partial<OptionFlags> = {},
  // v26.81.0 (ADR-022) — 자산 opt-in 은 forceInclude(--with <id>) 로 전달.
  forceInclude: string[] = [],
): { ids: string[]; spawnCallCount: number } {
  const spawn = makeMockSpawn();
  const report = runExternalInstall(
    {
      tracks,
      options: { ...DEFAULT_OPTIONS, ...options },
      cli: ["claude"],
      ...(forceInclude.length > 0 ? { userOverride: { forceInclude, forceExclude: [] } } : {}),
    },
    { spawn, log: () => {}, warn: () => {}, assets: EXTERNAL_ASSETS },
  );
  return {
    ids: report.attempted.map((r) => r.asset.id),
    spawnCallCount: spawn.mock.calls.length,
  };
}

describe("Track matrix — assets called per track", () => {
  it("tooling: dev baseline + dev-tools + v0.5.0 dev assets (product-skills + karpathy-coder)", () => {
    const { ids } = runForTrack(["tooling"]);
    // v26.42.0 — addy-agent-skills moved to option-gated (withAddyAgentSkills).
    // v26.71.1 — playwright-skill / architecture-decision-record (T3 experimental) 는
    //   opt-in only (PRD R6) → 비대화형 default 설치에서 제외. vetted/official 만 남음.
    // v26.78.0 — agent-browser 가 dev-tools → understanding 재분류 → 카테고리 정렬상 맨 뒤로.
    expect(ids).toEqual(["find-skills", "product-skills", "karpathy-coder", "agent-browser"]);
  });

  it("data: 5 data-specific + dev baseline + dev-tools + v0.5.0 dev assets", () => {
    const { ids } = runForTrack(["data"]);
    // v26.71.1 — playwright-skill / architecture-decision-record (T3) opt-in only → 제외.
    // v26.78.0 — agent-browser 가 understanding 재분류 → 카테고리 정렬상 맨 뒤로.
    expect(ids).toEqual([
      "polars-K-Dense",
      "dask-K-Dense",
      "python-resource-management",
      "python-performance-optimization",
      "anthropic-data-plugin",
      "find-skills",
      "product-skills",
      "karpathy-coder",
      "agent-browser",
    ]);
  });

  it("csr-fastapi: dev baseline + Railway + UI(react+shadcn+web-design) + impeccable", () => {
    const { ids } = runForTrack(["csr-fastapi"]);
    // v0.6.3 — railway-plugin entry 제거. v26.71.1 — railway-skills(T3) opt-in only → default 제외.
    expect(ids).not.toContain("railway-skills");
    expect(ids).not.toContain("railway-plugin");
    expect(ids).not.toContain("addy-agent-skills"); // v26.42.0 — option-gated
    expect(ids).toContain("impeccable");
    // csr-* matches CSR_SSR_NEXTJS_FULL set → react/shadcn/web-design applies
    expect(ids).toContain("react-best-practices");
    expect(ids).toContain("shadcn-ui");
    expect(ids).toContain("web-design-guidelines");
    expect(ids).not.toContain("vercel-cli"); // csr-supabase only
    expect(ids).not.toContain("next-skills"); // ssr-nextjs only
    expect(ids).not.toContain("polars-K-Dense"); // data only
  });

  it("csr-supabase: Vercel/Netlify/Supabase CLI + supabase-skills + UI", () => {
    const { ids } = runForTrack(["csr-supabase"]);
    expect(ids).toEqual(
      expect.arrayContaining([
        "vercel-cli",
        "netlify-cli",
        "supabase-cli",
        "supabase-agent-skills",
        "postgres-best-practices",
        "react-best-practices",
        "shadcn-ui",
        "web-design-guidelines",
        "impeccable",
      ]),
    );
    expect(ids).not.toContain("railway-plugin"); // not in csr-supabase per matrix
    expect(ids).not.toContain("next-skills"); // ssr-nextjs only
  });

  it("ssr-nextjs: React/Next stack (railway-skills/next-skills T3 opt-in)", () => {
    const { ids } = runForTrack(["ssr-nextjs"]);
    // v26.71.1 — railway-skills / next-skills (T3 experimental) opt-in only (PRD R6) → default 제외.
    expect(ids).toEqual(
      expect.arrayContaining([
        "react-best-practices",
        "shadcn-ui",
        "web-design-guidelines",
        "impeccable",
      ]),
    );
    expect(ids).not.toContain("railway-skills");
    expect(ids).not.toContain("next-skills");
  });

  it("ssr-htmx: impeccable only (railway-skills T3 opt-in, no React stack)", () => {
    const { ids } = runForTrack(["ssr-htmx"]);
    // v26.71.1 — railway-skills(T3) opt-in only → default 제외.
    expect(ids).not.toContain("railway-skills");
    expect(ids).toContain("impeccable");
    expect(ids).not.toContain("react-best-practices");
    expect(ids).not.toContain("next-skills");
  });

  it("executive: only Anthropic + finance/c-level (no dev tools)", () => {
    const { ids } = runForTrack(["executive"]);
    expect(ids).toEqual([
      "anthropic-document-skills",
      "c-level-skills",
      "business-growth-skills",
      "finance-skills",
    ]);
    // No dev-track assets
    expect(ids).not.toContain("addy-agent-skills");
    expect(ids).not.toContain("polars-K-Dense");
    expect(ids).not.toContain("railway-skills");
  });

  it("full: all Track-conditional assets active", () => {
    const { ids } = runForTrack(["full"]);
    // data + csr-supabase + ui + react + executive + dev baseline
    // v26.71.1 — railway-skills / next-skills (T3) opt-in only → default 제외.
    expect(ids).toEqual(
      expect.arrayContaining([
        "polars-K-Dense",
        "vercel-cli",
        "impeccable",
        "supabase-agent-skills",
        "react-best-practices",
        "anthropic-document-skills",
        "c-level-skills",
        "business-growth-skills",
        "finance-skills",
      ]),
    );
    expect(ids).not.toContain("addy-agent-skills"); // v26.42.0 — option-gated
    expect(ids).not.toContain("railway-skills"); // v26.71.1 — T3 opt-in
    expect(ids).not.toContain("next-skills"); // v26.71.1 — T3 opt-in
  });

  it("--with addy-agent-skills adds addy-agent-skills plugin (v26.81.0 ADR-022)", () => {
    const { ids } = runForTrack(["tooling"], {}, ["addy-agent-skills"]);
    expect(ids).toContain("addy-agent-skills");
  });

  it("--with ecc-plugin adds ecc-plugin to attempt list (opt-in)", () => {
    const { ids } = runForTrack(["tooling"], {}, ["ecc-plugin"]);
    expect(ids).toContain("ecc-plugin");
    expect(ids).not.toContain("ecc-prune"); // separate opt-in (withPrune behavior flag)
  });

  it("--with-prune adds ecc-prune (option-gated, independent of withEcc)", () => {
    const { ids } = runForTrack(["tooling"], { withPrune: true });
    expect(ids).toContain("ecc-prune");
  });

  it("--with trailofbits-skills adds Trail of Bits (any track)", () => {
    const { ids } = runForTrack(["tooling"], {}, ["trailofbits-skills"]);
    expect(ids).toContain("trailofbits-skills");
    const { ids: idsExec } = runForTrack(["executive"], {}, ["trailofbits-skills"]);
    expect(idsExec).toContain("trailofbits-skills");
  });

  it("--with gsd-orchestrator adds GSD orchestrator", () => {
    const { ids } = runForTrack(["executive"], {}, ["gsd-orchestrator"]);
    expect(ids).toContain("gsd-orchestrator");
  });
});

describe("Track matrix — spawn call counts", () => {
  it("tooling: 6 spawn calls (v26.71.1 — playwright/ADR T3 opt-in 제외, -2)", () => {
    // find-skills(1) + agent-browser(npm=1) + product-skills(plugin=2) + karpathy-coder(plugin=2) = 6
    const { spawnCallCount } = runForTrack(["tooling"]);
    expect(spawnCallCount).toBe(6);
  });

  it("data: tooling baseline 6 + data 6 (4 skills + 1 plugin × 2) = 12 (v26.71.1 — T3 opt-in)", () => {
    const { spawnCallCount } = runForTrack(["data"]);
    expect(spawnCallCount).toBe(12);
  });

  it("--with-gsd alone (executive base) adds 1 npx call", () => {
    const baseExec = runForTrack(["executive"]).spawnCallCount;
    const withGsd = runForTrack(["executive"], {}, ["gsd-orchestrator"]).spawnCallCount;
    expect(withGsd - baseExec).toBe(1);
  });
});

// === v0.5.0 — 신규 Track 매핑 검증 (P2-T4 합집합 회귀 + P3-T2 신규 Track) ===
describe("Track matrix — v0.5.0 신규 Track", () => {
  it("project-management: pm-skills + product-skills (executive-style baseline, no dev tools)", () => {
    const { ids } = runForTrack(["project-management"]);
    expect(ids).toEqual(["pm-skills", "product-skills"]);
    // No has-dev-track assets
    expect(ids).not.toContain("addy-agent-skills");
    expect(ids).not.toContain("karpathy-coder");
    // No executive assets
    expect(ids).not.toContain("anthropic-document-skills");
    expect(ids).not.toContain("c-level-skills");
  });

  it("growth-marketing: business-growth (재사용) + marketing/research (v26.76.0: content-creator/demand-gen 제거 — upstream 부재)", () => {
    const { ids } = runForTrack(["growth-marketing"]);
    expect(ids).toEqual(["business-growth-skills", "marketing-skills", "research-summarizer"]);
    // No has-dev-track assets
    expect(ids).not.toContain("karpathy-coder");
    expect(ids).not.toContain("product-skills");
    // c-level/finance-skills excluded (executive/full only)
    expect(ids).not.toContain("c-level-skills");
    expect(ids).not.toContain("finance-skills");
  });

  it("project-management spawn calls: 4 (2 plugins × 2)", () => {
    const { spawnCallCount } = runForTrack(["project-management"]);
    expect(spawnCallCount).toBe(4);
  });

  it("growth-marketing spawn calls: 6 (3 plugins × 2; v26.76.0 content-creator/demand-gen 제거)", () => {
    const { spawnCallCount } = runForTrack(["growth-marketing"]);
    expect(spawnCallCount).toBe(6);
  });

  // P2-T4 회귀 검증 — business-growth-skills condition 합집합.
  it("OQ2 — business-growth-skills hits executive (regression check)", () => {
    const { ids } = runForTrack(["executive"]);
    expect(ids).toContain("business-growth-skills");
  });

  it("OQ2 — business-growth-skills hits full (regression check)", () => {
    const { ids } = runForTrack(["full"]);
    expect(ids).toContain("business-growth-skills");
  });

  it("OQ2 — business-growth-skills hits growth-marketing (new condition)", () => {
    const { ids } = runForTrack(["growth-marketing"]);
    expect(ids).toContain("business-growth-skills");
  });

  // karpathy-coder = has-dev-track only (PM/Growth excluded)
  it("karpathy-coder excluded from project-management + growth-marketing", () => {
    expect(runForTrack(["project-management"]).ids).not.toContain("karpathy-coder");
    expect(runForTrack(["growth-marketing"]).ids).not.toContain("karpathy-coder");
    expect(runForTrack(["executive"]).ids).not.toContain("karpathy-coder");
  });

  it("karpathy-coder included in all dev tracks (csr/ssr/data/full/tooling)", () => {
    expect(runForTrack(["tooling"]).ids).toContain("karpathy-coder");
    expect(runForTrack(["csr-supabase"]).ids).toContain("karpathy-coder");
    expect(runForTrack(["ssr-nextjs"]).ids).toContain("karpathy-coder");
    expect(runForTrack(["data"]).ids).toContain("karpathy-coder");
    expect(runForTrack(["full"]).ids).toContain("karpathy-coder");
  });
});
