import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runInstall } from "../src/installer.js";
import type { InstallSpec, OptionFlags, Track } from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");

const NO_OPTS: OptionFlags = {
  withTauri: false,
  withGsd: false,
  withEcc: false,
  withPrune: false,
  withTob: false,
  withCodexSkills: false,
  withCodexTrust: false,
  withKarpathyHook: false,
  withCodexPrompts: false,
  withAddyAgentSkills: false,
  withUzysHarness: false,
  withSuperpowers: false,
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

  it("data + full route python-patterns / python-testing (withEcc)", () => {
    // v26.55.0 — python-* skills 는 ECC cherry-pick. withEcc=true 필수. ADR-016.
    const spec = buildSpec(["data"], projectDir);
    spec.options = { ...spec.options, withEcc: true };
    runInstall({ runExternal: NO_EXTERNAL, harnessRoot: HARNESS_ROOT, projectDir, spec });
    expect(existsSync(join(projectDir, ".claude/skills/python-patterns"))).toBe(true);
    expect(existsSync(join(projectDir, ".claude/skills/python-testing"))).toBe(true);
  });

  it("v26.55.0 — python-* NOT routed without withEcc", () => {
    runInstall({
      runExternal: NO_EXTERNAL,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: buildSpec(["data"], projectDir),
    });
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

  it("csr-fastapi routes python-patterns (csr-fastapi + data + full union, withEcc)", () => {
    // v26.55.0 — python-* skills 는 ECC cherry-pick. withEcc=true 필수. ADR-016.
    const spec = buildSpec(["csr-fastapi"], projectDir);
    spec.options = { ...spec.options, withEcc: true };
    runInstall({ runExternal: NO_EXTERNAL, harnessRoot: HARNESS_ROOT, projectDir, spec });
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
        ...buildSpec(["csr-supabase"], projectDir),
        options: { ...NO_OPTS, withTauri: true },
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
        options: { ...NO_OPTS, withTauri: true },
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

  it("creates AGENTS.md + .codex/ alongside .claude/", () => {
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
    expect(report.codex?.skillFiles).toHaveLength(6);
  });
});
