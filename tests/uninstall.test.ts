import type { SpawnSyncReturns } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { uninstallAction } from "../src/commands/uninstall.js";
import { type InstallLog, installLogPath } from "../src/install-log.js";

function ok(): SpawnSyncReturns<string> {
  return { pid: 0, output: [], stdout: "", stderr: "", status: 0, signal: null };
}

function fail(stderr = "boom"): SpawnSyncReturns<string> {
  return { pid: 0, output: [], stdout: "", stderr, status: 1, signal: null };
}

function writeLog(projectDir: string, log: InstallLog): void {
  mkdirSync(join(projectDir, ".claude"), { recursive: true });
  writeFileSync(installLogPath(projectDir), JSON.stringify(log), "utf8");
}

function baseLog(): InstallLog {
  return {
    schemaVersion: 1,
    installedAt: "2026-05-19T00:00:00.000Z",
    scope: "project",
    spec: { tracks: ["tooling"], cli: ["claude"] },
    templates: { claudeDir: ".claude/" },
    assets: [],
  };
}

describe("uninstallAction", () => {
  let tmpDir = "";
  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "harness-uninstall-"));
  });

  it("log 없으면 exit 1 + 명확 에러 (D16 — 모르는 자산 자동 삭제 금지)", () => {
    const err = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    uninstallAction({ projectDir: tmpDir }, { log: vi.fn(), err, exit });
    expect(exit).toHaveBeenCalledWith(1);
    expect(err).toHaveBeenCalledWith(expect.stringContaining("install log not found"));
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("project-scope plugin → claude plugin uninstall --scope project 호출", () => {
    const log: InstallLog = {
      ...baseLog(),
      assets: [
        {
          id: "p",
          category: "frontend",
          method: "plugin",
          scope: "project",
          detail: { marketplace: "mp", pluginId: "p@mp" },
        },
      ],
    };
    writeLog(tmpDir, log);
    const spawn = vi.fn(() => ok());
    const exit = vi.fn() as unknown as (code: number) => never;
    uninstallAction(
      { projectDir: tmpDir },
      { log: vi.fn(), err: vi.fn(), exit, spawn, rm: vi.fn() },
    );
    expect(spawn).toHaveBeenCalledWith("claude", [
      "plugin",
      "uninstall",
      "--scope",
      "project",
      "p@mp",
    ]);
    expect(exit).toHaveBeenCalledWith(0);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("project-scope skill → npx skills remove 호출", () => {
    const log: InstallLog = {
      ...baseLog(),
      assets: [
        {
          id: "playwright",
          category: "dev-tools",
          method: "skill",
          scope: "project",
          detail: { source: "anthropics/skills" },
        },
      ],
    };
    writeLog(tmpDir, log);
    const spawn = vi.fn(() => ok());
    uninstallAction(
      { projectDir: tmpDir },
      {
        log: vi.fn(),
        err: vi.fn(),
        exit: vi.fn() as unknown as (code: number) => never,
        spawn,
        rm: vi.fn(),
      },
    );
    expect(spawn).toHaveBeenCalledWith("npx", ["skills", "remove", "anthropics/skills", "--yes"]);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("detail.source / detail.pkg 없으면 asset.id 로 fallback", () => {
    const log: InstallLog = {
      ...baseLog(),
      assets: [
        {
          id: "fallback-skill-id",
          category: "dev-tools",
          method: "skill",
          scope: "project",
          detail: {}, // source 없음
        },
        {
          id: "fallback-pkg-id",
          category: "dev-tools",
          method: "npm-global",
          scope: "project",
          detail: {}, // pkg 없음
        },
      ],
    };
    writeLog(tmpDir, log);
    const spawn = vi.fn(() => ok());
    uninstallAction(
      { projectDir: tmpDir },
      {
        log: vi.fn(),
        err: vi.fn(),
        exit: vi.fn() as unknown as (code: number) => never,
        spawn,
        rm: vi.fn(),
      },
    );
    // skill: asset.id 로 fallback
    expect(spawn).toHaveBeenCalledWith("npx", ["skills", "remove", "fallback-skill-id", "--yes"]);
    // npm-global: asset.id 로 fallback
    expect(spawn).toHaveBeenCalledWith("npm", ["uninstall", "--save-dev", "fallback-pkg-id"]);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("project-scope npm-global → npm uninstall --save-dev 호출", () => {
    const log: InstallLog = {
      ...baseLog(),
      assets: [
        {
          id: "vercel",
          category: "dev-tools",
          method: "npm-global",
          scope: "project",
          detail: { pkg: "vercel" },
        },
      ],
    };
    writeLog(tmpDir, log);
    const spawn = vi.fn(() => ok());
    uninstallAction(
      { projectDir: tmpDir },
      {
        log: vi.fn(),
        err: vi.fn(),
        exit: vi.fn() as unknown as (code: number) => never,
        spawn,
        rm: vi.fn(),
      },
    );
    expect(spawn).toHaveBeenCalledWith("npm", ["uninstall", "--save-dev", "vercel"]);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // v26.64.0 (ADR-020) — global scope 자산은 자동 제거 X (D16). spawn 호출 0.
  it("global-scope 자산은 advisory 만 출력, spawn 호출 X (D16)", () => {
    const log: InstallLog = {
      ...baseLog(),
      scope: "global",
      assets: [
        {
          id: "g",
          category: "frontend",
          method: "plugin",
          scope: "global",
          detail: { marketplace: "mp", pluginId: "g@mp" },
        },
      ],
    };
    writeLog(tmpDir, log);
    const spawn = vi.fn(() => ok());
    const logFn = vi.fn();
    uninstallAction(
      { projectDir: tmpDir },
      {
        log: logFn,
        err: vi.fn(),
        exit: vi.fn() as unknown as (code: number) => never,
        spawn,
        rm: vi.fn(),
      },
    );
    expect(spawn).not.toHaveBeenCalled();
    expect(logFn.mock.calls.flat().join("\n")).toContain("g@mp");
    expect(logFn.mock.calls.flat().join("\n")).toContain("manual removal required");
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("--dry-run → spawn 호출 X, rm 호출 X (실제 변경 없음)", () => {
    const log: InstallLog = {
      ...baseLog(),
      assets: [
        {
          id: "p",
          category: "frontend",
          method: "plugin",
          scope: "project",
          detail: { marketplace: "mp", pluginId: "p@mp" },
        },
      ],
    };
    writeLog(tmpDir, log);
    const spawn = vi.fn(() => ok());
    const rm = vi.fn();
    const logFn = vi.fn();
    uninstallAction(
      { projectDir: tmpDir, dryRun: true },
      { log: logFn, err: vi.fn(), exit: vi.fn() as unknown as (code: number) => never, spawn, rm },
    );
    expect(spawn).not.toHaveBeenCalled();
    expect(rm).not.toHaveBeenCalled();
    expect(logFn.mock.calls.flat().join("\n")).toContain("DRY RUN");
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("default 모드 → templates 폴더 rm 호출 (claudeDir + codexDir + opencodeDir 모두)", () => {
    const log: InstallLog = {
      ...baseLog(),
      assets: [],
      templates: { claudeDir: ".claude/", codexDir: ".codex/", opencodeDir: ".opencode/" },
    };
    writeLog(tmpDir, log);
    const rm = vi.fn();
    uninstallAction(
      { projectDir: tmpDir },
      {
        log: vi.fn(),
        err: vi.fn(),
        exit: vi.fn() as unknown as (code: number) => never,
        spawn: vi.fn(() => ok()),
        rm,
      },
    );
    const rmPaths = rm.mock.calls.map((c) => c[0] as string);
    expect(rmPaths).toContain(join(tmpDir, ".claude/"));
    expect(rmPaths).toContain(join(tmpDir, ".codex/"));
    expect(rmPaths).toContain(join(tmpDir, ".opencode/"));
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("--keep-templates → templates rm 호출 X, log 만 rm", () => {
    const log: InstallLog = {
      ...baseLog(),
      assets: [],
      templates: { claudeDir: ".claude/", codexDir: ".codex/" },
    };
    writeLog(tmpDir, log);
    const rm = vi.fn();
    uninstallAction(
      { projectDir: tmpDir, keepTemplates: true },
      {
        log: vi.fn(),
        err: vi.fn(),
        exit: vi.fn() as unknown as (code: number) => never,
        spawn: vi.fn(() => ok()),
        rm,
      },
    );
    const rmPaths = rm.mock.calls.map((c) => c[0] as string);
    expect(rmPaths).not.toContain(join(tmpDir, ".claude/"));
    expect(rmPaths).not.toContain(join(tmpDir, ".codex/"));
    expect(rmPaths).toContain(installLogPath(tmpDir));
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("global skill → advisory 'npx skills remove -g <source>' 안내", () => {
    const log: InstallLog = {
      ...baseLog(),
      scope: "global",
      assets: [
        {
          id: "playwright",
          category: "dev-tools",
          method: "skill",
          scope: "global",
          detail: { source: "anthropics/skills" },
        },
      ],
    };
    writeLog(tmpDir, log);
    const logFn = vi.fn();
    uninstallAction(
      { projectDir: tmpDir },
      {
        log: logFn,
        err: vi.fn(),
        exit: vi.fn() as unknown as (code: number) => never,
        spawn: vi.fn(() => ok()),
        rm: vi.fn(),
      },
    );
    expect(logFn.mock.calls.flat().join("\n")).toContain("npx skills remove -g anthropics/skills");
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("global npm-global → advisory 'npm uninstall -g <pkg>' 안내", () => {
    const log: InstallLog = {
      ...baseLog(),
      scope: "global",
      assets: [
        {
          id: "vercel",
          category: "dev-tools",
          method: "npm-global",
          scope: "global",
          detail: { pkg: "vercel" },
        },
      ],
    };
    writeLog(tmpDir, log);
    const logFn = vi.fn();
    uninstallAction(
      { projectDir: tmpDir },
      {
        log: logFn,
        err: vi.fn(),
        exit: vi.fn() as unknown as (code: number) => never,
        spawn: vi.fn(() => ok()),
        rm: vi.fn(),
      },
    );
    expect(logFn.mock.calls.flat().join("\n")).toContain("npm uninstall -g vercel");
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("npx-run / shell-script 자산은 reverse 안 함 (fire-and-forget)", () => {
    const log: InstallLog = {
      ...baseLog(),
      assets: [
        {
          id: "gsd",
          category: "workflow",
          method: "npx-run",
          scope: "project",
          detail: { cmd: "get-shit-done-cc@latest", args: "" },
        },
        {
          id: "prune-ecc",
          category: "ecc-suite",
          method: "shell-script",
          scope: "project",
          detail: { script: "scripts/prune-ecc.sh", args: "" },
        },
      ],
    };
    writeLog(tmpDir, log);
    const spawn = vi.fn(() => ok());
    uninstallAction(
      { projectDir: tmpDir },
      {
        log: vi.fn(),
        err: vi.fn(),
        exit: vi.fn() as unknown as (code: number) => never,
        spawn,
        rm: vi.fn(),
      },
    );
    // reverse step 없음 → spawn 호출 0 (npx-run / shell-script 의 reverse null)
    expect(spawn).not.toHaveBeenCalled();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("global npx-run / shell-script → advisory '(no standard reverse — manual)' 안내", () => {
    const log: InstallLog = {
      ...baseLog(),
      scope: "global",
      assets: [
        {
          id: "gsd",
          category: "workflow",
          method: "npx-run",
          scope: "global",
          detail: { cmd: "get-shit-done-cc@latest", args: "" },
        },
        {
          id: "prune-ecc",
          category: "ecc-suite",
          method: "shell-script",
          scope: "global",
          detail: { script: "scripts/prune-ecc.sh", args: "" },
        },
      ],
    };
    writeLog(tmpDir, log);
    const logFn = vi.fn();
    uninstallAction(
      { projectDir: tmpDir },
      {
        log: logFn,
        err: vi.fn(),
        exit: vi.fn() as unknown as (code: number) => never,
        spawn: vi.fn(() => ok()),
        rm: vi.fn(),
      },
    );
    expect(logFn.mock.calls.flat().join("\n")).toContain("no standard reverse");
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("--dry-run + global assets → DRY RUN + GLOBAL advisory 둘 다 출력", () => {
    const log: InstallLog = {
      ...baseLog(),
      scope: "global",
      assets: [
        {
          id: "p",
          category: "frontend",
          method: "plugin",
          scope: "global",
          detail: { marketplace: "mp", pluginId: "p@mp" },
        },
      ],
    };
    writeLog(tmpDir, log);
    const logFn = vi.fn();
    uninstallAction(
      { projectDir: tmpDir, dryRun: true },
      {
        log: logFn,
        err: vi.fn(),
        exit: vi.fn() as unknown as (code: number) => never,
        spawn: vi.fn(() => ok()),
        rm: vi.fn(),
      },
    );
    const out = logFn.mock.calls.flat().join("\n");
    expect(out).toContain("DRY RUN");
    expect(out).toContain("manual removal required");
    expect(out).toContain("claude plugin uninstall --scope user p@mp");
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("spawn 실패 시 ⊘ 출력 + exit code 1 (silent skip 안 함, fail loud)", () => {
    const log: InstallLog = {
      ...baseLog(),
      assets: [
        {
          id: "p",
          category: "frontend",
          method: "plugin",
          scope: "project",
          detail: { marketplace: "mp", pluginId: "p@mp" },
        },
      ],
    };
    writeLog(tmpDir, log);
    const spawn = vi.fn(() => fail("plugin not found"));
    const exit = vi.fn() as unknown as (code: number) => never;
    const logFn = vi.fn();
    uninstallAction({ projectDir: tmpDir }, { log: logFn, err: vi.fn(), exit, spawn, rm: vi.fn() });
    expect(exit).toHaveBeenCalledWith(1);
    expect(logFn.mock.calls.flat().join("\n")).toContain("plugin not found");
    rmSync(tmpDir, { recursive: true, force: true });
  });
});
