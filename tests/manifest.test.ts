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

  it("e2e-testing: C2 opt-out gating (plugin OFF + ui track → install). v26.58.0 ADR-019", () => {
    // v26.58.0 — e2e-testing 은 ECC cherry-pick C2 → !withEcc + ui track 둘 다 필요.
    // ui track + withEcc=true → skip (plugin ON → cherry-pick 갈음)
    const uiWithEcc = buildManifest({ tracks: ["ssr-nextjs"], withEcc: true });
    const e2eUiOn = uiWithEcc.find((e) => e.source === "skills/e2e-testing");
    expect(e2eUiOn?.applies({ tracks: ["ssr-nextjs"], withEcc: true })).toBe(false);

    // ui track + withEcc=false (default) → install (cherry-pick fallback)
    const uiNoEcc = buildManifest({ tracks: ["ssr-nextjs"] });
    const e2eUiOff = uiNoEcc.find((e) => e.source === "skills/e2e-testing");
    expect(e2eUiOff?.applies({ tracks: ["ssr-nextjs"] })).toBe(true);

    // 비-UI track (data) + withEcc=false → skip (track 미일치)
    const dataNoEcc = buildManifest({ tracks: ["data"] });
    const e2eDataOff = dataNoEcc.find((e) => e.source === "skills/e2e-testing");
    expect(e2eDataOff?.applies({ tracks: ["data"] })).toBe(false);
  });

  it("CORE_AGENTS_ECC (code-reviewer, security-reviewer): C2 opt-out. v26.58.0 ADR-019", () => {
    // plugin OFF (default) → cherry-pick fallback install
    const off = buildManifest({ tracks: ["tooling"] });
    const codeOff = off.find((e) => e.source === "agents/code-reviewer.md");
    const secOff = off.find((e) => e.source === "agents/security-reviewer.md");
    expect(codeOff?.applies({ tracks: ["tooling"] })).toBe(true);
    expect(secOff?.applies({ tracks: ["tooling"] })).toBe(true);

    // plugin ON → cherry-pick skip (plugin 으로 갈음)
    const on = buildManifest({ tracks: ["tooling"], withEcc: true });
    const codeOn = on.find((e) => e.source === "agents/code-reviewer.md");
    const secOn = on.find((e) => e.source === "agents/security-reviewer.md");
    expect(codeOn?.applies({ tracks: ["tooling"], withEcc: true })).toBe(false);
    expect(secOn?.applies({ tracks: ["tooling"], withEcc: true })).toBe(false);
  });

  it("ecc commands dir: C2 opt-out gating. v26.58.0 ADR-019", () => {
    const m = buildManifest({ tracks: ["tooling"] });
    const eccCmd = m.find((e) => e.source === "commands/ecc");
    expect(eccCmd).toBeDefined();
    // plugin OFF → cherry-pick fallback
    expect(eccCmd?.applies({ tracks: ["tooling"] })).toBe(true);
    // plugin ON → skip
    expect(eccCmd?.applies({ tracks: ["tooling"], withEcc: true })).toBe(false);
  });

  it("continuous-learning-v2: C3 (modified) → withEcc 무관 항상 install. v26.58.0 ADR-019", () => {
    // C3 분류 — modified=true 라 plugin 으로 갈음 불가. 양쪽 install.
    const off = buildManifest({ tracks: ["tooling"] });
    const clOff = off.find((e) => e.source === "skills/continuous-learning-v2");
    expect(clOff).toBeDefined();
    expect(clOff?.applies({ tracks: ["tooling"] })).toBe(true);
    expect(clOff?.applies({ tracks: ["tooling"], withEcc: true })).toBe(true);

    // 다른 track 도 동일 (track 무관)
    expect(clOff?.applies({ tracks: ["executive"], withEcc: false })).toBe(true);
    expect(clOff?.applies({ tracks: ["data"], withEcc: true })).toBe(true);
  });

  it("python-* skills: C2 opt-out + track gating. v26.58.0 ADR-019", () => {
    const m = buildManifest({ tracks: ["data"] });
    const pp = m.find((e) => e.source === "skills/python-patterns");
    // data track + plugin OFF → install
    expect(pp?.applies({ tracks: ["data"] })).toBe(true);
    // data track + plugin ON → skip
    expect(pp?.applies({ tracks: ["data"], withEcc: true })).toBe(false);
    // 비-Python track + plugin OFF → skip (track 미일치)
    expect(pp?.applies({ tracks: ["executive"] })).toBe(false);
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
