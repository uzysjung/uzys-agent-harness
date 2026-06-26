import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runInstall } from "../src/installer.js";
import type { InstallSpec, OptionFlags, Track } from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");

const NO_OPTS: OptionFlags = {
  withPrune: false,
  withCodexTrust: false,
  withKarpathyHook: false,
};

function buildSpec(tracks: Track[], projectDir: string): InstallSpec {
  return {
    tracks,
    options: NO_OPTS,
    cli: ["claude"],
    projectDir,
  };
}

/** No-op external install — tests don't want to trigger real `claude plugin install`. */
const NO_EXTERNAL = null;

const TRACKS: ReadonlyArray<Track> = [
  "tooling",
  "csr-supabase",
  "csr-fastify",
  "csr-fastapi",
  "ssr-htmx",
  "ssr-nextjs",
  "data",
  "executive",
  "full",
  "project-management",
  "growth-marketing",
];

/** Per-track expected files (subset — proves Track-pattern routing in manifest.ts). */
const TRACK_EXPECTATIONS: Record<Track, { rules: string[]; mcp?: string[] }> = {
  tooling: { rules: ["cli-development", "test-policy"] },
  "csr-supabase": { rules: ["shadcn", "api-contract", "design-workflow"], mcp: ["supabase"] },
  "csr-fastify": { rules: ["shadcn", "api-contract", "database"] },
  "csr-fastapi": { rules: ["shadcn", "api-contract", "database"] },
  "ssr-htmx": { rules: ["htmx", "design-workflow"] },
  "ssr-nextjs": { rules: ["nextjs", "shadcn", "design-workflow"] },
  data: { rules: ["pyside6", "data-analysis"] },
  executive: { rules: ["git-policy"] },
  full: { rules: ["nextjs", "htmx", "data-analysis", "design-workflow"] },
  // v0.5.0 — executive-style baselines (common rules only).
  "project-management": { rules: ["git-policy", "change-management"] },
  "growth-marketing": { rules: ["git-policy", "change-management"] },
};

describe("11-track install (E2E vs templates/)", () => {
  let projectDir: string;

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "ch-11track-"));
  });

  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  it.each(TRACKS)("track=%s install passes core invariants", (track) => {
    const report = runInstall({
      runExternal: NO_EXTERNAL,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: buildSpec([track], projectDir),
    });

    // Core: skeleton + meta
    expect(existsSync(join(projectDir, ".claude/CLAUDE.md"))).toBe(true);
    expect(existsSync(join(projectDir, ".claude/settings.json"))).toBe(true);
    // Project-root CLAUDE.md (templates/project-claude/<track>.md → <projectDir>/CLAUDE.md).
    // Single-track install only — manifest.ts L261-269 conditional. Reviewer LOW-3 guard.
    expect(existsSync(join(projectDir, "CLAUDE.md"))).toBe(true);

    // Common rules always present
    for (const rule of ["git-policy", "change-management", "gates-taxonomy"]) {
      expect(existsSync(join(projectDir, `.claude/rules/${rule}.md`))).toBe(true);
    }

    // Per-track rules
    for (const rule of TRACK_EXPECTATIONS[track].rules) {
      expect(existsSync(join(projectDir, `.claude/rules/${rule}.md`))).toBe(true);
    }

    // .installed-tracks meta
    const meta = readFileSync(join(projectDir, ".claude/.installed-tracks"), "utf8").trim();
    expect(meta.split(/\s+/)).toContain(track);

    // .mcp.json with at least context7
    const mcp = JSON.parse(readFileSync(join(projectDir, ".mcp.json"), "utf8"));
    expect(mcp.mcpServers.context7).toBeDefined();
    for (const expected of TRACK_EXPECTATIONS[track].mcp ?? []) {
      expect(mcp.mcpServers[expected]).toBeDefined();
    }

    expect(report.installedTracks).toEqual([track]);
    expect(report.filesCopied).toBeGreaterThan(5);
  });
});

describe("track-specific skills routing", () => {
  let projectDir: string;
  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "ch-skills-"));
  });
  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  it("v26.58.0 — data routes python-* when withEcc=false (cherry-pick fallback). ADR-019", () => {
    // C2 opt-out: plugin OFF + data track → cherry-pick install.
    runInstall({
      runExternal: NO_EXTERNAL,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: buildSpec(["data"], projectDir),
    });
    expect(existsSync(join(projectDir, ".claude/skills/python-patterns"))).toBe(true);
    expect(existsSync(join(projectDir, ".claude/skills/python-testing"))).toBe(true);
  });

  it("v26.58.0 — python-* skipped when withEcc=true (plugin 으로 갈음). ADR-019", () => {
    // C2 opt-out: plugin ON 시 cherry-pick skip.
    // v26.81.0 (ADR-022) — withEcc flag → ecc-plugin 자산 선택 (isAssetSelected 통합 검증).
    const spec = buildSpec(["data"], projectDir);
    spec.userOverride = { forceInclude: ["ecc-plugin"], forceExclude: [] };
    runInstall({ runExternal: NO_EXTERNAL, harnessRoot: HARNESS_ROOT, projectDir, spec });
    expect(existsSync(join(projectDir, ".claude/skills/python-patterns"))).toBe(false);
    expect(existsSync(join(projectDir, ".claude/skills/python-testing"))).toBe(false);
  });

  it("data does NOT route nextjs-turbopack", () => {
    runInstall({
      runExternal: NO_EXTERNAL,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: buildSpec(["data"], projectDir),
    });
    expect(existsSync(join(projectDir, ".claude/skills/nextjs-turbopack"))).toBe(false);
  });

  it("ssr-nextjs routes nextjs-turbopack", () => {
    runInstall({
      runExternal: NO_EXTERNAL,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: buildSpec(["ssr-nextjs"], projectDir),
    });
    expect(existsSync(join(projectDir, ".claude/skills/nextjs-turbopack"))).toBe(true);
  });

  it("executive routes investor-materials + investor-outreach + market-research", () => {
    runInstall({
      runExternal: NO_EXTERNAL,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: buildSpec(["executive"], projectDir),
    });
    expect(existsSync(join(projectDir, ".claude/skills/investor-materials"))).toBe(true);
    expect(existsSync(join(projectDir, ".claude/skills/investor-outreach"))).toBe(true);
    expect(existsSync(join(projectDir, ".claude/skills/market-research"))).toBe(true);
  });

  it("tooling does NOT route investor-* (executive-only)", () => {
    runInstall({
      runExternal: NO_EXTERNAL,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: buildSpec(["tooling"], projectDir),
    });
    expect(existsSync(join(projectDir, ".claude/skills/investor-materials"))).toBe(false);
  });

  it("v26.58.0 — csr-fastapi routes python-patterns when withEcc=false. ADR-019", () => {
    // C2 opt-out: csr-fastapi + plugin OFF → cherry-pick install.
    runInstall({
      runExternal: NO_EXTERNAL,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: buildSpec(["csr-fastapi"], projectDir),
    });
    expect(existsSync(join(projectDir, ".claude/skills/python-patterns"))).toBe(true);
  });
});

describe("--with-tauri option", () => {
  let projectDir: string;
  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "ch-tauri-"));
  });
  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  it("adds tauri rule when csr-* + withTauri", () => {
    runInstall({
      runExternal: NO_EXTERNAL,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: {
        // v26.81.0 (ADR-022) — withTauri flag → tauri-desktop 내부 자산 선택.
        ...buildSpec(["csr-supabase"], projectDir),
        options: NO_OPTS,
        userOverride: { forceInclude: ["tauri-desktop"], forceExclude: [] },
      },
    });
    expect(existsSync(join(projectDir, ".claude/rules/tauri.md"))).toBe(true);
  });

  it("does NOT add tauri rule when data + withTauri (no CSR)", () => {
    runInstall({
      runExternal: NO_EXTERNAL,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: {
        ...buildSpec(["data"], projectDir),
        options: NO_OPTS,
        userOverride: { forceInclude: ["tauri-desktop"], forceExclude: [] },
      },
    });
    expect(existsSync(join(projectDir, ".claude/rules/tauri.md"))).toBe(false);
  });
});

describe("--cli=both produces both Claude and Codex outputs", () => {
  let projectDir: string;
  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "ch-both-"));
  });
  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  it("creates AGENTS.md + .codex/ alongside .claude/ (dev-method skills, no 6-Gate uzys-*)", () => {
    const report = runInstall({
      runExternal: NO_EXTERNAL,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: { ...buildSpec(["tooling"], projectDir), cli: ["claude", "codex"] },
    });
    expect(existsSync(join(projectDir, ".claude/CLAUDE.md"))).toBe(true);
    expect(existsSync(join(projectDir, "AGENTS.md"))).toBe(true);
    expect(existsSync(join(projectDir, ".codex/config.toml"))).toBe(true);
    expect(report.codex).not.toBeNull();
    // 6-Gate workflow removed — uzys-* skills must never be generated for Codex.
    expect(report.codex?.skillFiles?.some((f) => f.includes("/uzys-"))).toBe(false);
  });

  it("codex install never emits uzys-* 6-Gate artifacts (dev-method skills only)", () => {
    const report = runInstall({
      runExternal: NO_EXTERNAL,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: { ...buildSpec(["tooling"], projectDir), cli: ["claude", "codex"] },
    });
    // baseline 은 그대로 생성
    expect(existsSync(join(projectDir, "AGENTS.md"))).toBe(true);
    expect(existsSync(join(projectDir, ".codex/config.toml"))).toBe(true);
    // 6-Gate workflow removed — uzys-{phase} skills / prompts must be absent.
    expect(report.codex?.skillFiles?.some((f) => f.includes("/uzys-"))).toBe(false);
    expect(existsSync(join(projectDir, ".codex/prompts"))).toBe(false);
    expect(existsSync(join(projectDir, ".agents/skills/uzys-spec"))).toBe(false);
    // dev-method skill 6종은 native 매핑되어 존재해야 한다 (tooling = dev track).
    expect(existsSync(join(projectDir, ".agents/skills/multi-persona-review/SKILL.md"))).toBe(true);
  });
});
