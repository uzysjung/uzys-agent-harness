import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runInstall } from "../src/installer.js";

const HARNESS_ROOT = resolve(__dirname, "..");

describe("installer (integration with templates/)", () => {
  let projectDir: string;

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "ch-installer-"));
  });

  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  it("tooling track: installs core assets + writes .installed-tracks", () => {
    const report = runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: {
        tracks: ["tooling"],
        options: {
          withPrune: false,
          withCodexTrust: false,
          withKarpathyHook: false,
        },
        cli: ["claude"],
        projectDir,
      },
    });

    expect(report.installedTracks).toEqual(["tooling"]);
    expect(report.filesCopied).toBeGreaterThan(10);

    // Project skeleton exists
    expect(existsSync(join(projectDir, ".claude/CLAUDE.md"))).toBe(true);
    expect(existsSync(join(projectDir, ".claude/settings.json"))).toBe(true);

    // Common rules
    expect(existsSync(join(projectDir, ".claude/rules/git-policy.md"))).toBe(true);
    expect(existsSync(join(projectDir, ".claude/rules/change-management.md"))).toBe(true);
    // tooling-specific
    expect(existsSync(join(projectDir, ".claude/rules/cli-development.md"))).toBe(true);

    // Hooks
    expect(existsSync(join(projectDir, ".claude/hooks/session-start.sh"))).toBe(true);
    expect(existsSync(join(projectDir, ".claude/hooks/hito-counter.sh"))).toBe(true);

    // uzys/* 6-Gate commands removed — must never be emitted
    expect(existsSync(join(projectDir, ".claude/commands/uzys/spec.md"))).toBe(false);
    expect(existsSync(join(projectDir, ".claude/commands/uzys/auto.md"))).toBe(false);

    // Project root CLAUDE.md
    expect(existsSync(join(projectDir, "CLAUDE.md"))).toBe(true);

    // .mcp.json with context7 server
    const mcpPath = join(projectDir, ".mcp.json");
    expect(existsSync(mcpPath)).toBe(true);
    const mcp = JSON.parse(readFileSync(mcpPath, "utf8"));
    expect(mcp.mcpServers.context7).toBeDefined();

    // .installed-tracks meta
    const meta = readFileSync(join(projectDir, ".claude/.installed-tracks"), "utf8");
    expect(meta).toContain("tooling");
  });

  it("executive track: skips uzys/* commands and dev rules", () => {
    runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: {
        tracks: ["executive"],
        options: {
          withPrune: false,
          withCodexTrust: false,
          withKarpathyHook: false,
        },
        cli: ["claude"],
        projectDir,
      },
    });
    expect(existsSync(join(projectDir, ".claude/commands/uzys/spec.md"))).toBe(false);
    expect(existsSync(join(projectDir, ".claude/rules/test-policy.md"))).toBe(false);
    // common rule still installed
    expect(existsSync(join(projectDir, ".claude/rules/git-policy.md"))).toBe(true);
  });

  it("multi-track: union of rules + merged project-root CLAUDE.md with track subheaders", () => {
    runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: {
        tracks: ["tooling", "data"],
        options: {
          withPrune: false,
          withCodexTrust: false,
          withKarpathyHook: false,
        },
        cli: ["claude"],
        projectDir,
      },
    });
    expect(existsSync(join(projectDir, ".claude/rules/cli-development.md"))).toBe(true);
    expect(existsSync(join(projectDir, ".claude/rules/data-analysis.md"))).toBe(true);
    expect(existsSync(join(projectDir, ".claude/rules/pyside6.md"))).toBe(true);
    // multi-track now merges fragments into a single root CLAUDE.md
    const rootMd = join(projectDir, "CLAUDE.md");
    expect(existsSync(rootMd)).toBe(true);
    const content = readFileSync(rootMd, "utf8");
    expect(content).toContain("활성 Track(s): Tooling, Data");
    expect(content).toMatch(/### Tooling/);
    expect(content).toMatch(/### Data/);
  });

  it("backup option moves existing .claude/ aside before install", () => {
    // Pre-populate a .claude/ to trigger backup
    runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: {
        tracks: ["tooling"],
        options: {
          withPrune: false,
          withCodexTrust: false,
          withKarpathyHook: false,
        },
        cli: ["claude"],
        projectDir,
      },
    });
    const second = runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      backup: true,
      spec: {
        tracks: ["tooling"],
        options: {
          withPrune: false,
          withCodexTrust: false,
          withKarpathyHook: false,
        },
        cli: ["claude"],
        projectDir,
      },
    });
    expect(second.backup).toMatch(/\.claude\.backup-/);
    expect(existsSync(`${second.backup}`)).toBe(true);
  });

  it("throws when templates directory missing", () => {
    expect(() =>
      runInstall({
        runExternal: null,
        harnessRoot: "/no/such/root",
        projectDir,
        spec: {
          tracks: ["tooling"],
          options: {
            withPrune: false,
            withCodexTrust: false,
            withKarpathyHook: false,
          },
          cli: ["claude"],
          projectDir,
        },
      }),
    ).toThrow(/Templates dir not found/);
  });
});
