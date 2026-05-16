import { describe, expect, it } from "vitest";
import { buildManifest, resolveRules } from "../src/manifest.js";

describe("resolveRules", () => {
  it("includes COMMON rules for any track", () => {
    expect(resolveRules({ tracks: ["executive"] })).toEqual(
      expect.arrayContaining(["change-management", "gates-taxonomy", "git-policy"]),
    );
  });

  it("does not include DEV rules for executive-only", () => {
    const rules = resolveRules({ tracks: ["executive"] });
    expect(rules).not.toContain("test-policy");
  });

  it("includes DEV rules when any dev track present", () => {
    const rules = resolveRules({ tracks: ["tooling"] });
    expect(rules).toEqual(
      expect.arrayContaining(["test-policy", "ship-checklist", "code-style", "error-handling"]),
    );
  });

  it("includes UI rules only for csr/ssr/full", () => {
    expect(resolveRules({ tracks: ["data"] })).not.toContain("design-workflow");
    expect(resolveRules({ tracks: ["ssr-nextjs"] })).toContain("design-workflow");
    expect(resolveRules({ tracks: ["full"] })).toContain("design-workflow");
  });

  it("appends per-track rules union", () => {
    const rules = resolveRules({ tracks: ["csr-fastapi", "ssr-nextjs"] });
    expect(rules).toEqual(expect.arrayContaining(["shadcn", "api-contract", "database", "nextjs"]));
  });

  it("--with-tauri adds tauri rule only on csr-*|full", () => {
    const csrFlag = resolveRules({ tracks: ["csr-supabase"], withTauri: true });
    expect(csrFlag).toContain("tauri");

    const dataFlag = resolveRules({ tracks: ["data"], withTauri: true });
    expect(dataFlag).not.toContain("tauri");

    const csrNoFlag = resolveRules({ tracks: ["csr-supabase"], withTauri: false });
    expect(csrNoFlag).not.toContain("tauri");
  });

  it("returns sorted, deduplicated names", () => {
    const rules = resolveRules({ tracks: ["full"] });
    expect(rules).toEqual([...rules].sort());
    expect(new Set(rules).size).toBe(rules.length);
  });
});

describe("buildManifest", () => {
  it("includes uzys/* commands only when withUzysHarness=true (v26.44.0 BREAKING)", () => {
    const tooling = buildManifest({ tracks: ["tooling"] });
    const entry = tooling.find((e) => e.target.endsWith("uzys/spec.md"));
    // 자체 entry는 항상 manifest에 존재 — applies() 가 게이팅
    expect(entry).toBeDefined();
    // default: 미설치
    expect(entry?.applies({ tracks: ["tooling"], withUzysHarness: false })).toBe(false);
    // opt-in: 설치
    expect(entry?.applies({ tracks: ["tooling"], withUzysHarness: true })).toBe(true);
    // executive 도 동일 — withUzysHarness 만 매개. 트랙 무관
    expect(entry?.applies({ tracks: ["executive"], withUzysHarness: true })).toBe(true);
  });

  it("does not include any project-root CLAUDE.md entry — merged via installer", () => {
    const single = buildManifest({ tracks: ["tooling"] });
    expect(single.find((e) => e.target === "CLAUDE.md")).toBeUndefined();
    expect(single.find((e) => e.source.startsWith("project-claude/"))).toBeUndefined();

    const multi = buildManifest({ tracks: ["tooling", "data"] });
    expect(multi.find((e) => e.target === "CLAUDE.md")).toBeUndefined();
  });

  it("includes UI skill dirs only for ui tracks (e2e-testing requires withEcc, v26.55.0)", () => {
    // v26.55.0 — e2e-testing 은 ECC cherry-pick → withEcc + ui track 둘 다 필요. ADR-016.
    const data = buildManifest({ tracks: ["data"], withEcc: true });
    const e2eEntry = data.find((e) => e.source === "skills/e2e-testing");
    expect(e2eEntry?.applies({ tracks: ["data"], withEcc: true })).toBe(false);

    const ui = buildManifest({ tracks: ["ssr-nextjs"], withEcc: true });
    const e2eEntryUi = ui.find((e) => e.source === "skills/e2e-testing");
    expect(e2eEntryUi?.applies({ tracks: ["ssr-nextjs"], withEcc: true })).toBe(true);

    // withEcc 없으면 ui track 이라도 빠짐
    const uiNoEcc = buildManifest({ tracks: ["ssr-nextjs"] });
    const e2eEntryNoEcc = uiNoEcc.find((e) => e.source === "skills/e2e-testing");
    expect(e2eEntryNoEcc?.applies({ tracks: ["ssr-nextjs"] })).toBe(false);
  });

  it("includes hooks for all tracks", () => {
    const m = buildManifest({ tracks: ["executive"] });
    const hookEntries = m.filter((e) => e.target.startsWith(".claude/hooks/"));
    expect(hookEntries.length).toBeGreaterThanOrEqual(8);
    for (const h of hookEntries) {
      expect(h.applies({ tracks: ["executive"] })).toBe(true);
    }
  });

  it("includes market-research only for executive|full", () => {
    const exec = buildManifest({ tracks: ["executive"] });
    const mrExec = exec.find((e) => e.source === "skills/market-research");
    expect(mrExec?.applies({ tracks: ["executive"] })).toBe(true);

    const data = buildManifest({ tracks: ["data"] });
    const mrData = data.find((e) => e.source === "skills/market-research");
    expect(mrData?.applies({ tracks: ["data"] })).toBe(false);
  });
});
