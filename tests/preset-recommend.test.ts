import { describe, expect, it } from "vitest";
import { recommendedExternalAssets } from "../src/preset-recommend.js";

describe("recommendedExternalAssets", () => {
  it("empty presets → empty recommendation", () => {
    expect(recommendedExternalAssets([])).toEqual([]);
  });

  it("experimental(T3) 자산은 pre-check 추천 제외, vetted 는 포함 (PRD v26-71 R6)", () => {
    const rec = recommendedExternalAssets(["csr-fastify"]);
    // T3 (star < 1000) — 추천 제외 (opt-in). 2026-08-02 정비로 playwright-skill 이 제거돼
    //   dev 트랙에서 조건이 매치되는 T3 는 railway-skills 하나다.
    expect(rec).not.toContain("railway-skills");
    expect(rec).not.toContain("architecture-decision-record");
    // T2 vetted / official — track 적합 시 추천
    expect(rec).toContain("find-skills");
    expect(rec).toContain("frontend-design");
  });

  it("csr-supabase preset includes supabase + vercel CLI + UI stack (v26.106.0 ADR-035)", () => {
    const ids = recommendedExternalAssets(["csr-supabase"]);
    expect(ids).toContain("supabase-agent-skills");
    expect(ids).toContain("supabase-cli");
    expect(ids).toContain("vercel-cli");
    expect(ids).toContain("postgres-best-practices");
    expect(ids).toContain("shadcn-ui");
    // v26.106.0 (ADR-035) — 강등 3종은 추천 제외: netlify-cli(중복 10:1 실측),
    //   web-design-guidelines·impeccable(taste 가이드 opt-in, frontend-design official 이 기본).
    expect(ids).not.toContain("netlify-cli");
    expect(ids).not.toContain("web-design-guidelines");
    expect(ids).not.toContain("impeccable");
  });

  it("does NOT include option-gated assets (addy/superpowers/ecc/tob)", () => {
    const ids = recommendedExternalAssets(["csr-supabase"]);
    expect(ids).not.toContain("addy-agent-skills");
    expect(ids).not.toContain("superpowers");
    expect(ids).not.toContain("ecc-plugin");
    expect(ids).not.toContain("trailofbits-skills");
  });

  it("executive preset → Anthropic business + finance pack + 전 트랙 상주 스킬", () => {
    const ids = recommendedExternalAssets(["executive"]);
    expect(ids).toContain("anthropic-document-skills");
    expect(ids).toContain("finance-skills");
    // 2026-08-02 정비 (ADR-060) — alirezarezvani 자문 번들 2종(c-level·business-growth) 제거.
    expect(ids).not.toContain("c-level-skills");
    expect(ids).not.toContain("business-growth-skills");
    // 이관 스킬 중 전 트랙 상주분은 비-dev 트랙에서도 추천돼야 한다 (강등 금지).
    expect(ids).toContain("north-star");
    expect(ids).toContain("gh-issue-workflow");
    // 2026-08-02 AC9 — 신설 전 트랙 스킬. 위임은 개발 트랙만의 행위가 아니다.
    expect(ids).toContain("task-brief");
  });

  it("data preset includes data plugin (v26.106.0 ADR-035 · 2026-08-02 정비)", () => {
    const ids = recommendedExternalAssets(["data"]);
    expect(ids).toContain("anthropic-data-plugin");
    // 2026-08-02 정비 (ADR-060) — K-Dense 2종 제거 (pandas 대안 사용법 = 모델이 이미 아는 것).
    expect(ids).not.toContain("polars-K-Dense");
    expect(ids).not.toContain("dask-K-Dense");
  });

  it("result is deterministic (sorted by id)", () => {
    const ids = [...recommendedExternalAssets(["csr-supabase"])];
    const sorted = [...ids].sort();
    expect(ids).toEqual(sorted);
  });
});
