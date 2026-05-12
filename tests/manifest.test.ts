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
  it("includes uzys/* commands only for dev tracks", () => {
    const exec = buildManifest({ tracks: ["executive"] });
    expect(
      exec.find((e) => e.target.endsWith("uzys/spec.md"))?.applies({ tracks: ["executive"] }),
    ).toBe(false);

    const tooling = buildManifest({ tracks: ["tooling"] });
    expect(
      tooling.find((e) => e.target.endsWith("uzys/spec.md"))?.applies({ tracks: ["tooling"] }),
    ).toBe(true);
  });

  it("does not include any project-root CLAUDE.md entry — merged via installer", () => {
    const single = buildManifest({ tracks: ["tooling"] });
    expect(single.find((e) => e.target === "CLAUDE.md")).toBeUndefined();
    expect(single.find((e) => e.source.startsWith("project-claude/"))).toBeUndefined();

    const multi = buildManifest({ tracks: ["tooling", "data"] });
    expect(multi.find((e) => e.target === "CLAUDE.md")).toBeUndefined();
  });

  it("includes UI skill dirs only for ui tracks", () => {
    const data = buildManifest({ tracks: ["data"] });
    const e2eEntry = data.find((e) => e.source === "skills/e2e-testing");
    expect(e2eEntry?.applies({ tracks: ["data"] })).toBe(false);

    const ui = buildManifest({ tracks: ["ssr-nextjs"] });
    const e2eEntryUi = ui.find((e) => e.source === "skills/e2e-testing");
    expect(e2eEntryUi?.applies({ tracks: ["ssr-nextjs"] })).toBe(true);
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
