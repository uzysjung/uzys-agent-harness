import { describe, expect, it } from "vitest";
import { recommendedExternalAssets } from "../src/preset-recommend.js";

describe("recommendedExternalAssets", () => {
  it("empty presets → empty recommendation", () => {
    expect(recommendedExternalAssets([])).toEqual([]);
  });

  it("csr-supabase preset includes supabase + vercel/netlify CLI + UI stack", () => {
    const ids = recommendedExternalAssets(["csr-supabase"]);
    expect(ids).toContain("supabase-agent-skills");
    expect(ids).toContain("supabase-cli");
    expect(ids).toContain("vercel-cli");
    expect(ids).toContain("netlify-cli");
    expect(ids).toContain("postgres-best-practices");
    expect(ids).toContain("shadcn-ui");
    expect(ids).toContain("web-design-guidelines");
    expect(ids).toContain("impeccable");
  });

  it("does NOT include option-gated assets (addy/gsd/superpowers/ecc)", () => {
    const ids = recommendedExternalAssets(["csr-supabase"]);
    expect(ids).not.toContain("addy-agent-skills");
    expect(ids).not.toContain("gsd-orchestrator");
    expect(ids).not.toContain("ecc-plugin");
    expect(ids).not.toContain("trailofbits-skills");
  });

  it("executive preset → 4 Anthropic business + alirezarezvani advisory packs", () => {
    const ids = recommendedExternalAssets(["executive"]);
    expect(ids).toContain("anthropic-document-skills");
    expect(ids).toContain("c-level-skills");
    expect(ids).toContain("business-growth-skills");
    expect(ids).toContain("finance-skills");
  });

  it("data preset includes data plugin + python + K-Dense packs", () => {
    const ids = recommendedExternalAssets(["data"]);
    expect(ids).toContain("anthropic-data-plugin");
    expect(ids).toContain("polars-K-Dense");
    expect(ids).toContain("dask-K-Dense");
  });

  it("result is deterministic (sorted by id)", () => {
    const ids = [...recommendedExternalAssets(["csr-supabase"])];
    const sorted = [...ids].sort();
    expect(ids).toEqual(sorted);
  });
});
