import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { INTERNAL_BUNDLED_SKILL_IDS } from "../src/external-assets.js";
import { buildManifest, resolveRules } from "../src/manifest.js";

describe("resolveRules", () => {
  it("includes COMMON rules for any track", () => {
    // v26.107.0 (ADR-036) — doc-governance: SSOT 위계 + merge=코드+추적 동기화. 전 트랙 공통 —
    //   executive 트랙에서도 문서 규약은 적용된다 (거짓 상태 방지는 코드 유무와 무관).
    expect(resolveRules({ tracks: ["executive"] })).toEqual(
      expect.arrayContaining([
        "change-management",
        "gates-taxonomy",
        "git-policy",
        "doc-governance",
      ]),
    );
    expect(resolveRules({ tracks: ["tooling"] })).toContain("doc-governance");
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

  it("includes benchmark-parity only alongside playwright-launch (UI tracks)", () => {
    // v26.109.0 (ADR-038) — 벤치마크 실측→gap.md 루프는 capture 수단을 규정하는
    //   playwright-launch 와 짝일 때만 성립한다. 화면 없는 트랙에 깔리면 실행 불가능한
    //   의무(capture 확보)만 부과하므로 UI 트랙 한정.
    for (const track of ["ssr-nextjs", "csr-supabase", "full"] as const) {
      const rules = resolveRules({ tracks: [track] });
      expect(rules).toContain("benchmark-parity");
      expect(rules).toContain("playwright-launch");
    }
    for (const track of ["tooling", "data", "executive", "project-management"] as const) {
      expect(resolveRules({ tracks: [track] })).not.toContain("benchmark-parity");
    }
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
  it("does not emit any uzys/* command entries (6-Gate workflow removed)", () => {
    const tooling = buildManifest({ tracks: ["tooling"] });
    expect(tooling.find((e) => e.target.includes("commands/uzys/"))).toBeUndefined();
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

  it("verification-loop: C2→C3 재분류 (verdict 어휘 주입 = modified) → withEcc 무관 dev 트랙 install. v26.113.0 ADR-041", () => {
    // verdict 어휘는 ECC plugin 판에 없으므로 plugin ON 이어도 cherry-pick 을 유지해야 한다.
    // C2 로 남기면 withEcc 사용자에게 "verdict 코드화됨" 광고가 거짓이 된다 (no-false-ship).
    const m = buildManifest({ tracks: ["tooling"] });
    const vl = m.find((e) => e.source === "skills/verification-loop");
    expect(vl).toBeDefined();
    expect(vl?.applies({ tracks: ["tooling"] })).toBe(true);
    expect(vl?.applies({ tracks: ["tooling"], withEcc: true })).toBe(true);
    expect(vl?.applies({ tracks: ["ssr-nextjs"], withEcc: true })).toBe(true);

    // dev 트랙 조건은 유지 — executive 단독은 종전과 동일하게 미설치.
    expect(vl?.applies({ tracks: ["executive"] })).toBe(false);

    // 잔여 DEV_SKILL_DIRS_ECC 는 C2 그대로 — 재분류 전파 방지.
    // v26.114.0 (ADR-042): eval-harness 도 수정본이 되어 C3 로 이동 — 이 단언의 대상을
    // 미수정 상태인 agent-introspection-debugging 으로 교체 (전파 방지 의도는 동일).
    const aid = m.find((e) => e.source === "skills/agent-introspection-debugging");
    expect(aid?.applies({ tracks: ["tooling"], withEcc: true })).toBe(false);
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
    expect(hookEntries.length).toBeGreaterThanOrEqual(6);
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

  // v26.87.0 — dev-method skills (uzys 1st-party, internal). no-false-ship invariant:
  //   the copy is gated on selectedInternalSkills (computed by installer via isAssetSelected),
  //   NOT on track alone — so a wizard uncheck / `--without <id>` actually drops the copy.
  //   WHY a track-only gate would be wrong: it would ignore the user's deselection and still
  //   ship the skill, contradicting the advertised "selectable" surface.
  it("dev-method skill copies are gated by selectedInternalSkills (respect uncheck)", () => {
    const m = buildManifest({ tracks: ["tooling"] });
    const entry = m.find((e) => e.source === "skills/multi-persona-review");
    // entry always present in manifest — applies() gates it (parity with uzys/* commands).
    expect(entry).toBeDefined();
    expect(entry?.target).toBe(".claude/skills/multi-persona-review");
    // selected (installer included it) → copied.
    expect(
      entry?.applies({ tracks: ["tooling"], selectedInternalSkills: ["multi-persona-review"] }),
    ).toBe(true);
    // a dev track but NOT in the selected set (user unchecked / --without) → dropped,
    //   even though another internal skill IS selected.
    expect(
      entry?.applies({ tracks: ["tooling"], selectedInternalSkills: ["gap-analysis-e2e"] }),
    ).toBe(false);
    // selectedInternalSkills omitted / empty → dropped (no track-only fallback).
    expect(entry?.applies({ tracks: ["tooling"] })).toBe(false);
    expect(entry?.applies({ tracks: ["tooling"], selectedInternalSkills: [] })).toBe(false);
  });

  it("every manifest source exists under templates/ (silent-skip guard)", () => {
    // installer 는 source 부재 시 예외 없이 skip 후 진행 — 룰/스킬명 오타가 "설치됨" 보고 +
    //   무설치(silent drift, v26.58~63 형태)가 되는 것을 구조 차단 (SOD v26.109.0 N-4).
    const templatesRoot = fileURLToPath(new URL("../templates", import.meta.url));
    const spec = {
      tracks: [
        "csr-supabase",
        "csr-fastify",
        "csr-fastapi",
        "ssr-htmx",
        "ssr-nextjs",
        "data",
        "executive",
        "tooling",
        "full",
        "project-management",
        "growth-marketing",
      ] as const,
      withTauri: true,
      selectedInternalSkills: [...INTERNAL_BUNDLED_SKILL_IDS],
    };
    for (const entry of buildManifest(spec)) {
      expect(
        existsSync(join(templatesRoot, entry.source)),
        `missing template: ${entry.source}`,
      ).toBe(true);
    }
  });
});
