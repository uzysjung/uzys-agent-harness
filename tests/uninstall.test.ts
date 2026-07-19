import type { SpawnSyncReturns } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { uninstallAction } from "../src/commands/uninstall.js";
import { skillsCliSpec } from "../src/external-installer.js";
import { hashContent, type InstallLog, installLogPath } from "../src/install-log.js";

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
    expect(spawn).toHaveBeenCalledWith("npx", [
      skillsCliSpec(),
      "remove",
      "anthropics/skills",
      "--yes",
    ]);
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
          method: "npm",
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
    expect(spawn).toHaveBeenCalledWith("npx", [
      skillsCliSpec(),
      "remove",
      "fallback-skill-id",
      "--yes",
    ]);
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
          method: "npm",
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
          method: "npm",
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

  // 버그 2 — root CLAUDE.md 는 install 원본 그대로일 때만 삭제. 사용자 수정 시 데이터 보존.
  it("root CLAUDE.md 가 install 원본 그대로면 삭제 (sha 일치)", () => {
    const content = "# CLAUDE.md\nharness-generated content\n";
    const log: InstallLog = {
      ...baseLog(),
      templates: {
        claudeDir: ".claude/",
        rootClaudeMd: { path: "CLAUDE.md", sha256: hashContent(content) },
      },
    };
    writeLog(tmpDir, log);
    writeFileSync(join(tmpDir, "CLAUDE.md"), content, "utf8");
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
    expect(rmPaths).toContain(join(tmpDir, "CLAUDE.md"));
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("root CLAUDE.md 가 사용자 수정됐으면 보존 + 안내 (sha 불일치)", () => {
    const original = "# CLAUDE.md\nharness-generated content\n";
    const log: InstallLog = {
      ...baseLog(),
      templates: {
        claudeDir: ".claude/",
        rootClaudeMd: { path: "CLAUDE.md", sha256: hashContent(original) },
      },
    };
    writeLog(tmpDir, log);
    // 사용자가 install 이후 직접 수정 → 현재 내용이 sha 와 불일치
    writeFileSync(join(tmpDir, "CLAUDE.md"), `${original}\n# my own project rules\n`, "utf8");
    const rm = vi.fn();
    const logFn = vi.fn();
    uninstallAction(
      { projectDir: tmpDir },
      {
        log: logFn,
        err: vi.fn(),
        exit: vi.fn() as unknown as (code: number) => never,
        spawn: vi.fn(() => ok()),
        rm,
      },
    );
    const rmPaths = rm.mock.calls.map((c) => c[0] as string);
    expect(rmPaths).not.toContain(join(tmpDir, "CLAUDE.md")); // 보존
    expect(logFn.mock.calls.flat().join("\n")).toContain("CLAUDE.md kept");
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("--dry-run + rootClaudeMd 원본 → 'remove CLAUDE.md' 미리보기", () => {
    const content = "# CLAUDE.md\nharness content\n";
    const log: InstallLog = {
      ...baseLog(),
      templates: {
        claudeDir: ".claude/",
        rootClaudeMd: { path: "CLAUDE.md", sha256: hashContent(content) },
      },
    };
    writeLog(tmpDir, log);
    writeFileSync(join(tmpDir, "CLAUDE.md"), content, "utf8");
    const logFn = vi.fn();
    const rm = vi.fn();
    uninstallAction(
      { projectDir: tmpDir, dryRun: true },
      {
        log: logFn,
        err: vi.fn(),
        exit: vi.fn() as unknown as (code: number) => never,
        spawn: vi.fn(() => ok()),
        rm,
      },
    );
    expect(rm).not.toHaveBeenCalled(); // dry-run → 실제 변경 없음
    expect(logFn.mock.calls.flat().join("\n")).toContain("remove CLAUDE.md");
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("--dry-run + rootClaudeMd 수정됨 → 'keep CLAUDE.md' 미리보기", () => {
    const original = "# CLAUDE.md\nharness content\n";
    const log: InstallLog = {
      ...baseLog(),
      templates: {
        claudeDir: ".claude/",
        rootClaudeMd: { path: "CLAUDE.md", sha256: hashContent(original) },
      },
    };
    writeLog(tmpDir, log);
    writeFileSync(join(tmpDir, "CLAUDE.md"), `${original}# user edit\n`, "utf8");
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
    expect(logFn.mock.calls.flat().join("\n")).toContain("keep CLAUDE.md (modified");
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("rootClaudeMd 기록됐으나 파일이 이미 없으면 graceful (kept 아님, rm no-op)", () => {
    const log: InstallLog = {
      ...baseLog(),
      templates: {
        claudeDir: ".claude/",
        rootClaudeMd: { path: "CLAUDE.md", sha256: "0".repeat(64) },
      },
    };
    writeLog(tmpDir, log);
    // CLAUDE.md 파일 자체를 만들지 않음 (이미 삭제된 상태)
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
    // 파일 부재 → modified=false → "kept" 안내 없이 정상 종료
    expect(logFn.mock.calls.flat().join("\n")).not.toContain("CLAUDE.md kept");
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("rootClaudeMd 없는 (구버전) log 는 CLAUDE.md 를 건드리지 않음 (backward compat)", () => {
    const log: InstallLog = { ...baseLog(), templates: { claudeDir: ".claude/" } };
    writeLog(tmpDir, log);
    writeFileSync(join(tmpDir, "CLAUDE.md"), "anything", "utf8");
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
    expect(rmPaths).not.toContain(join(tmpDir, "CLAUDE.md"));
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

/**
 * v26.123.0 (F-1c) — 항목별 제거. 전량 제거만 되던 것을 자산 단위로 좁힌다.
 * 핵심 계약: 대상 외 자산은 손대지 않고, 로그는 **지우는 게 아니라 남은 것으로 다시 쓴다**.
 */
describe("uninstallAction — --only (항목별 제거)", () => {
  let tmpDir = "";
  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "harness-uninstall-only-"));
  });

  function twoAssetLog(): InstallLog {
    return {
      ...baseLog(),
      assets: [
        {
          id: "keep-me",
          category: "frontend",
          method: "plugin",
          scope: "project",
          detail: { marketplace: "mp", pluginId: "keep@mp" },
        },
        {
          id: "drop-me",
          category: "dev-tools",
          method: "plugin",
          scope: "project",
          detail: { marketplace: "mp", pluginId: "drop@mp" },
        },
      ],
    };
  }

  function readLog(dir: string): InstallLog {
    return JSON.parse(readFileSync(installLogPath(dir), "utf8")) as InstallLog;
  }

  it("지정한 자산만 reverse 하고 나머지는 건드리지 않는다", () => {
    writeLog(tmpDir, twoAssetLog());
    const spawn = vi.fn(() => ok());
    const exit = vi.fn() as unknown as (code: number) => never;
    uninstallAction(
      { projectDir: tmpDir, only: "drop-me" },
      { log: vi.fn(), err: vi.fn(), exit, spawn, rm: vi.fn() },
    );
    expect(spawn).toHaveBeenCalledOnce();
    expect(spawn).toHaveBeenCalledWith("claude", [
      "plugin",
      "uninstall",
      "--scope",
      "project",
      "drop@mp",
    ]);
    expect(exit).toHaveBeenCalledWith(0);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("제거한 자산만 로그에서 빠지고 나머지는 남는다 (로그 삭제 아님)", () => {
    // 로그를 통째로 지우면 남은 자산의 uninstall 경로가 영구히 사라진다.
    writeLog(tmpDir, twoAssetLog());
    uninstallAction(
      { projectDir: tmpDir, only: "drop-me" },
      {
        log: vi.fn(),
        err: vi.fn(),
        exit: vi.fn() as unknown as (code: number) => never,
        spawn: vi.fn(() => ok()),
        rm: vi.fn(),
      },
    );
    expect(readLog(tmpDir).assets.map((a) => a.id)).toEqual(["keep-me"]);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("reverse 실패한 자산은 로그에 남는다 (안 지워진 걸 지웠다고 기록하지 않는다)", () => {
    writeLog(tmpDir, twoAssetLog());
    uninstallAction(
      { projectDir: tmpDir, only: "drop-me" },
      {
        log: vi.fn(),
        err: vi.fn(),
        exit: vi.fn() as unknown as (code: number) => never,
        spawn: vi.fn(() => fail("plugin not found")),
        rm: vi.fn(),
      },
    );
    expect(readLog(tmpDir).assets.map((a) => a.id)).toEqual(["keep-me", "drop-me"]);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("templates 를 지우지 않는다 — 하나만 빼려는데 .claude/ 가 날아가면 안 된다", () => {
    writeLog(tmpDir, twoAssetLog());
    const rm = vi.fn();
    uninstallAction(
      { projectDir: tmpDir, only: "drop-me" },
      {
        log: vi.fn(),
        err: vi.fn(),
        exit: vi.fn() as unknown as (code: number) => never,
        spawn: vi.fn(() => ok()),
        rm,
      },
    );
    expect(rm).not.toHaveBeenCalled();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("모르는 id 는 아무것도 실행하기 전에 차단한다 (Pre-flight — 부분 작업 없음)", () => {
    writeLog(tmpDir, twoAssetLog());
    const spawn = vi.fn(() => ok());
    const err = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    uninstallAction(
      { projectDir: tmpDir, only: "drop-me,typo-id" },
      { log: vi.fn(), err, exit, spawn, rm: vi.fn() },
    );
    expect(spawn).not.toHaveBeenCalled();
    expect(exit).toHaveBeenCalledWith(1);
    expect(err.mock.calls.flat().join("\n")).toContain("typo-id");
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("--only 없이는 기존대로 전량 제거 + templates 삭제 (기본 동작 불변)", () => {
    writeLog(tmpDir, twoAssetLog());
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
    expect(rm).toHaveBeenCalledWith(join(tmpDir, ".claude/"));
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("karpathy 훅이 settings.json 에 남아 있으면 수기 제거 안내를 출력한다 (F-1d)", () => {
    // 자동으로 안 고치는 이유는 사용자 편집이 섞이기 때문 — 대신 정확히 무엇을 지울지 알려준다.
    const log: InstallLog = {
      ...baseLog(),
      assets: [
        {
          id: "karpathy-coder",
          category: "dev-tools",
          method: "plugin",
          scope: "project",
          detail: { marketplace: "mp", pluginId: "k@mp" },
        },
      ],
    };
    writeLog(tmpDir, log);
    writeFileSync(
      join(tmpDir, ".claude", "settings.json"),
      JSON.stringify({
        hooks: {
          PreToolUse: [
            {
              matcher: "Write|Edit",
              hooks: [
                {
                  type: "command",
                  command: 'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/karpathy-gate.sh"',
                },
              ],
            },
          ],
        },
      }),
      "utf8",
    );
    const logFn = vi.fn();
    uninstallAction(
      { projectDir: tmpDir, only: "karpathy-coder" },
      {
        log: logFn,
        err: vi.fn(),
        exit: vi.fn() as unknown as (code: number) => never,
        spawn: vi.fn(() => ok()),
        rm: vi.fn(),
      },
    );
    const output = logFn.mock.calls.flat().join("\n");
    expect(output).toContain("[MANUAL]");
    expect(output).toContain(".claude/settings.json");
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("훅 흔적이 없으면 수기 안내를 출력하지 않는다 (예측 아니라 실제 상태를 읽는다)", () => {
    const log: InstallLog = {
      ...baseLog(),
      assets: [
        {
          id: "karpathy-coder",
          category: "dev-tools",
          method: "plugin",
          scope: "project",
          detail: { marketplace: "mp", pluginId: "k@mp" },
        },
      ],
    };
    writeLog(tmpDir, log);
    const logFn = vi.fn();
    uninstallAction(
      { projectDir: tmpDir, only: "karpathy-coder" },
      {
        log: logFn,
        err: vi.fn(),
        exit: vi.fn() as unknown as (code: number) => never,
        spawn: vi.fn(() => ok()),
        rm: vi.fn(),
      },
    );
    expect(logFn.mock.calls.flat().join("\n")).not.toContain("[MANUAL]");
    rmSync(tmpDir, { recursive: true, force: true });
  });
});

/**
 * v26.123.0 리뷰 반영 (SOD C1) — `--only` 가 아무것도 못 되돌렸는데 초록 "complete" 를 찍고
 * exit 0 하던 것. `npx-run`/`shell-script`/`internal` 자산과 **모든 global scope 자산**이 해당.
 * 그 침묵은 F-1a 가 없애려던 "로그가 거짓이 되는 상태"를 반대편에서 되살린다.
 */
describe("uninstallAction — 되돌릴 수 없는 자산 (SOD C1)", () => {
  let tmpDir = "";
  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "harness-noreverse-"));
  });

  function logWith(asset: InstallLog["assets"][number]): InstallLog {
    return { ...baseLog(), assets: [asset] };
  }

  const NPX_RUN_ASSET = {
    id: "bmad",
    category: "dev-tools",
    method: "npx-run" as const,
    scope: "project" as const,
    detail: { cmd: "bmad-method", args: "install" },
  };

  it("자동 경로가 없으면 그렇다고 말하고 성공으로 보고하지 않는다 (exit 1)", () => {
    writeLog(tmpDir, logWith(NPX_RUN_ASSET));
    const logFn = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    uninstallAction(
      { projectDir: tmpDir, only: "bmad" },
      { log: logFn, err: vi.fn(), exit, spawn: vi.fn(() => ok()), rm: vi.fn() },
    );
    const output = logFn.mock.calls.flat().join("\n");
    expect(output).toContain("자동 되돌리기 경로 없음");
    expect(output).not.toContain("uninstall complete");
    expect(exit).toHaveBeenCalledWith(1);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("되돌리지 못한 자산은 기록에 남는다 (지웠다고 적으면 그게 거짓 기록)", () => {
    writeLog(tmpDir, logWith(NPX_RUN_ASSET));
    uninstallAction(
      { projectDir: tmpDir, only: "bmad" },
      {
        log: vi.fn(),
        err: vi.fn(),
        exit: vi.fn() as unknown as (code: number) => never,
        spawn: vi.fn(() => ok()),
        rm: vi.fn(),
      },
    );
    const after = JSON.parse(readFileSync(installLogPath(tmpDir), "utf8")) as InstallLog;
    expect(after.assets.map((a) => a.id)).toEqual(["bmad"]);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("global scope 자산도 --only 로는 자동 제거되지 않으므로 성공으로 보고하지 않는다", () => {
    writeLog(
      tmpDir,
      logWith({
        id: "glob",
        category: "dev-tools",
        method: "plugin",
        scope: "global",
        detail: { marketplace: "mp", pluginId: "g@mp" },
      }),
    );
    const logFn = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    uninstallAction(
      { projectDir: tmpDir, only: "glob" },
      { log: logFn, err: vi.fn(), exit, spawn: vi.fn(() => ok()), rm: vi.fn() },
    );
    const output = logFn.mock.calls.flat().join("\n");
    expect(output).toContain("[GLOBAL]");
    expect(output).not.toContain("uninstall complete");
    expect(exit).toHaveBeenCalledWith(1);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("전량 uninstall 은 자산이 0개여도 templates 를 지우므로 성공이다 (오탐 방지)", () => {
    writeLog(tmpDir, baseLog());
    const logFn = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    uninstallAction(
      { projectDir: tmpDir },
      { log: logFn, err: vi.fn(), exit, spawn: vi.fn(() => ok()), rm: vi.fn() },
    );
    expect(logFn.mock.calls.flat().join("\n")).toContain("uninstall complete");
    expect(exit).toHaveBeenCalledWith(0);
    rmSync(tmpDir, { recursive: true, force: true });
  });
});

/** v26.123.0 리뷰 반영 (SOD I2/I3/I5). */
describe("uninstallAction — 로그 재기록 · 미리보기 · 실패 처리", () => {
  let tmpDir = "";
  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "harness-uninstall-edge-"));
  });

  function richLog(): InstallLog {
    return {
      ...baseLog(),
      spec: { tracks: ["tooling"], cli: ["claude", "codex"] },
      templates: {
        claudeDir: ".claude/",
        codexDir: ".codex/",
        opencodeDir: ".opencode/",
        rootClaudeMd: { path: "CLAUDE.md", sha256: hashContent("x") },
      },
      assets: [
        {
          id: "a",
          category: "frontend",
          method: "plugin",
          scope: "project",
          detail: { marketplace: "mp", pluginId: "a@mp" },
        },
        {
          id: "b",
          category: "frontend",
          method: "plugin",
          scope: "project",
          detail: { marketplace: "mp", pluginId: "b@mp" },
        },
      ],
    };
  }

  it("--only 재기록이 assets 외 필드를 전부 그대로 보존한다 (I2)", () => {
    // 여기가 새면 다음 전량 uninstall 이 .codex/·.opencode/·CLAUDE.md 를 기록 없이 남긴다.
    writeLog(tmpDir, richLog());
    uninstallAction(
      { projectDir: tmpDir, only: "a" },
      {
        log: vi.fn(),
        err: vi.fn(),
        exit: vi.fn() as unknown as (code: number) => never,
        spawn: vi.fn(() => ok()),
        rm: vi.fn(),
      },
    );
    const after = JSON.parse(readFileSync(installLogPath(tmpDir), "utf8")) as InstallLog;
    expect({ ...after, assets: [] }).toEqual({ ...richLog(), assets: [] });
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("--only 없는 dry-run 은 수기 안내를 하지 않는다 — 실제 실행은 그 파일을 지운다 (I3)", () => {
    const log: InstallLog = {
      ...baseLog(),
      assets: [
        {
          id: "karpathy-coder",
          category: "dev-tools",
          method: "plugin",
          scope: "project",
          detail: { marketplace: "mp", pluginId: "k@mp" },
        },
      ],
    };
    writeLog(tmpDir, log);
    writeFileSync(
      join(tmpDir, ".claude", "settings.json"),
      JSON.stringify({
        hooks: {
          PreToolUse: [
            {
              matcher: "Write|Edit",
              hooks: [
                {
                  type: "command",
                  command: 'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/karpathy-gate.sh"',
                },
              ],
            },
          ],
        },
      }),
      "utf8",
    );
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
    expect(logFn.mock.calls.flat().join("\n")).not.toContain("[MANUAL]");
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("로그 재기록이 실패하면 무엇이 실제로 제거됐는지 알리고 exit 1 (I5)", () => {
    // 되돌리기는 이미 끝난 뒤라 스택트레이스로 죽으면 그 정보가 사라진다.
    writeLog(tmpDir, richLog());
    const err = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    uninstallAction(
      { projectDir: tmpDir, only: "a" },
      {
        log: vi.fn(),
        err,
        exit,
        spawn: vi.fn(() => ok()),
        rm: vi.fn(),
        writeLog: () => {
          throw new Error("EROFS: read-only file system");
        },
      },
    );
    const errors = err.mock.calls.flat().join("\n");
    expect(errors).toContain("install log 갱신 실패");
    expect(errors).toContain("a");
    expect(exit).toHaveBeenCalledWith(1);
    rmSync(tmpDir, { recursive: true, force: true });
  });
});

/**
 * v26.123.0 — dry-run 과 실행 경로가 **같은 조건**으로 수기 안내를 낸다.
 * 판정 기준은 "`--only` 인가"가 아니라 "`.claude/` 가 남는가"다: `--keep-templates` 만 줘도
 * settings.json 은 살아남으므로 훅 등록 안내가 필요하다. 두 경로가 갈리면 미리보기가 거짓이 된다.
 */
describe("uninstallAction — 수기 안내 조건은 templates 보존 여부", () => {
  let tmpDir = "";
  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "harness-advisory-"));
  });

  function setup(): void {
    writeLog(tmpDir, {
      ...baseLog(),
      assets: [
        {
          id: "karpathy-coder",
          category: "dev-tools",
          method: "plugin",
          scope: "project",
          detail: { marketplace: "mp", pluginId: "k@mp" },
        },
      ],
    });
    writeFileSync(
      join(tmpDir, ".claude", "settings.json"),
      JSON.stringify({
        hooks: {
          PreToolUse: [
            {
              matcher: "Write|Edit",
              hooks: [
                {
                  type: "command",
                  command: 'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/karpathy-gate.sh"',
                },
              ],
            },
          ],
        },
      }),
      "utf8",
    );
  }

  function run(options: Parameters<typeof uninstallAction>[0]): string {
    const logFn = vi.fn();
    uninstallAction(options, {
      log: logFn,
      err: vi.fn(),
      exit: vi.fn() as unknown as (code: number) => never,
      spawn: vi.fn(() => ok()),
      rm: vi.fn(),
    });
    return logFn.mock.calls.flat().join("\n");
  }

  it("--keep-templates 만 줘도 안내한다 (.claude/ 가 남으므로 훅 등록이 살아 있다)", () => {
    setup();
    expect(run({ projectDir: tmpDir, keepTemplates: true })).toContain("[MANUAL]");
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("같은 옵션의 dry-run 과 실행이 안내 여부에서 일치한다", () => {
    setup();
    const dry = run({ projectDir: tmpDir, keepTemplates: true, dryRun: true }).includes("[MANUAL]");
    setup();
    const real = run({ projectDir: tmpDir, keepTemplates: true }).includes("[MANUAL]");
    expect(dry).toBe(real);
    rmSync(tmpDir, { recursive: true, force: true });
  });
});

/**
 * v26.123.0 2차 검증 반영 (SOD F4) — C1 수정이 과하게 휘둘러 `--keep-templates` 전량 uninstall
 * 까지 exit 1 로 묶었다. 자산이 전부 global 인 설치(= `--scope global` 사용자 전부)에서 자동
 * 제거 0건은 D16 설계대로의 정상이고, 그 실행은 install log 를 지우는 실제 작업을 한다.
 * 게다가 재시도하면 로그가 없어 더 나빠져 exit 0 을 영원히 못 받는다.
 */
describe("uninstallAction — nothingDone 은 --only 경로에만 적용된다 (SOD F4)", () => {
  let tmpDir = "";
  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "harness-nothingdone-"));
  });

  const GLOBAL_ONLY: InstallLog["assets"] = [
    {
      id: "g1",
      category: "dev-tools",
      method: "plugin",
      scope: "global",
      detail: { marketplace: "mp", pluginId: "g1@mp" },
    },
  ];

  it("--keep-templates + global 자산뿐이어도 exit 0 (로그 제거라는 실제 작업을 한다)", () => {
    writeLog(tmpDir, { ...baseLog(), assets: GLOBAL_ONLY });
    const rm = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    const logFn = vi.fn();
    uninstallAction(
      { projectDir: tmpDir, keepTemplates: true },
      { log: logFn, err: vi.fn(), exit, spawn: vi.fn(() => ok()), rm },
    );
    expect(rm).toHaveBeenCalledWith(installLogPath(tmpDir));
    expect(logFn.mock.calls.flat().join("\n")).not.toContain("아무것도 자동 제거되지 않았다");
    expect(exit).toHaveBeenCalledWith(0);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("같은 로그를 --only 로 지정하면 여전히 exit 1 (C1 이 잡으려던 경로)", () => {
    // 경계 확인 — F4 수정이 C1 을 되돌리지 않았는지.
    writeLog(tmpDir, { ...baseLog(), assets: GLOBAL_ONLY });
    const exit = vi.fn() as unknown as (code: number) => never;
    uninstallAction(
      { projectDir: tmpDir, only: "g1" },
      { log: vi.fn(), err: vi.fn(), exit, spawn: vi.fn(() => ok()), rm: vi.fn() },
    );
    expect(exit).toHaveBeenCalledWith(1);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("전량 uninstall 은 '기록 유지'라고 말하지 않는다 — 로그도 함께 지우므로 (SOD F6)", () => {
    writeLog(tmpDir, {
      ...baseLog(),
      assets: [
        {
          id: "bmad",
          category: "dev-tools",
          method: "npx-run",
          scope: "project",
          detail: { cmd: "bmad-method", args: "install" },
        },
      ],
    });
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
    const output = logFn.mock.calls.flat().join("\n");
    expect(output).toContain("자동 되돌리기 경로 없음");
    expect(output).not.toContain("기록 유지");
    rmSync(tmpDir, { recursive: true, force: true });
  });
});

/**
 * v26.123.0 3차 검증 반영 (SOD R1/R2) — 세 사실을 하나로 묶다 3라운드 내리 회귀가 났다.
 * 분리해서 고정한다:
 *   `.claude/` 가 남는가  = keepTemplates  (수기 안내 대상 여부)
 *   install log 가 남는가 = `--only` 인가   (--only 만 재기록, 나머지는 삭제)
 * 특히 `--keep-templates` 는 `.claude/` 를 남기면서 로그는 지운다 — 그 조합이 매번 새는 자리였다.
 */
describe("uninstallAction — keepTemplates 와 log 생존은 다른 사실이다 (SOD R1/R2)", () => {
  let tmpDir = "";
  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "harness-logsurvives-"));
  });

  const NO_REVERSE_PROJECT_ASSET: InstallLog["assets"] = [
    {
      id: "bmad",
      category: "dev-tools",
      method: "npx-run",
      scope: "project",
      detail: { cmd: "bmad-method", args: "install" },
    },
  ];

  function run(options: Parameters<typeof uninstallAction>[0]): {
    output: string;
    code: number | undefined;
    rm: ReturnType<typeof vi.fn>;
  } {
    const logFn = vi.fn();
    const rm = vi.fn();
    let code: number | undefined;
    uninstallAction(options, {
      log: logFn,
      err: vi.fn(),
      exit: ((c: number) => {
        code = c;
      }) as unknown as (code: number) => never,
      spawn: vi.fn(() => ok()),
      rm,
    });
    return { output: logFn.mock.calls.flat().join("\n"), code, rm };
  }

  it("--keep-templates 로 되돌릴 수 없는 project 자산만 남으면 성공이라 하지 않는다", () => {
    // 여기서 로그가 지워지므로 재시도로 복구할 수 없다 — 성공으로 보고하면 사용자는
    // 디스크에 남은 자산을 기록 없이 떠안는다 (F-1a 가 없애려던 바로 그 상태).
    writeLog(tmpDir, { ...baseLog(), assets: NO_REVERSE_PROJECT_ASSET });
    const { output, code } = run({ projectDir: tmpDir, keepTemplates: true });
    expect(output).not.toContain("uninstall complete");
    expect(code).toBe(1);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("--keep-templates 로 로그가 지워질 때 '기록 유지'라고 말하지 않는다", () => {
    writeLog(tmpDir, { ...baseLog(), assets: NO_REVERSE_PROJECT_ASSET });
    const { output, rm } = run({ projectDir: tmpDir, keepTemplates: true });
    expect(rm).toHaveBeenCalledWith(installLogPath(tmpDir));
    expect(output).toContain("자동 되돌리기 경로 없음");
    expect(output).not.toContain("기록 유지");
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("--only 로 같은 자산을 지정하면 로그가 남으므로 '기록 유지'가 참이다", () => {
    writeLog(tmpDir, { ...baseLog(), assets: NO_REVERSE_PROJECT_ASSET });
    const { output } = run({ projectDir: tmpDir, only: "bmad" });
    expect(output).toContain("기록 유지");
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("--keep-templates + global 자산뿐이면 성공이다 — 정확한 수기 명령을 줬으므로", () => {
    // 경계: R1 수정이 F4 를 되돌리지 않았는지. global 은 안내할 명령이 있고 D16 설계대로다.
    writeLog(tmpDir, {
      ...baseLog(),
      assets: [
        {
          id: "g1",
          category: "dev-tools",
          method: "plugin",
          scope: "global",
          detail: { marketplace: "mp", pluginId: "g1@mp" },
        },
      ],
    });
    const { output, code } = run({ projectDir: tmpDir, keepTemplates: true });
    expect(output).toContain("[GLOBAL]");
    expect(code).toBe(0);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("--only 에 id 가 없으면(`--only ,`) 전량 제거로 흘려보내지 않고 차단한다", () => {
    // 하나만 빼려던 사용자가 templates 까지 잃는 경로였다.
    writeLog(tmpDir, { ...baseLog(), assets: NO_REVERSE_PROJECT_ASSET });
    const rm = vi.fn();
    const err = vi.fn();
    let code: number | undefined;
    uninstallAction(
      { projectDir: tmpDir, only: "," },
      {
        log: vi.fn(),
        err,
        exit: ((c: number) => {
          code = c;
        }) as unknown as (code: number) => never,
        spawn: vi.fn(() => ok()),
        rm,
      },
    );
    expect(rm).not.toHaveBeenCalled();
    expect(code).toBe(1);
    expect(err.mock.calls.flat().join("\n")).toContain("--only");
    rmSync(tmpDir, { recursive: true, force: true });
  });
});

/**
 * v26.124.0 (F-1f) — install 은 `.claude/` 밖에도 쓰는데(`.mcp.json` 병합 · `.gitignore` 추가줄 ·
 * `.github/workflows/`) uninstall 이 **안내조차 하지 않았다**. `.claude/` 를 통째로 지우고 나면
 * 남은 것들은 사용자가 존재조차 모른다. 지우지는 않되(사용자 내용이 섞인다) 반드시 말한다.
 */
describe("uninstallAction — 루트 파일 안내 (F-1f)", () => {
  let tmpDir = "";
  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "harness-uninstall-root-"));
  });

  function logWithRootFiles(): InstallLog {
    return {
      ...baseLog(),
      rootFiles: [
        { path: ".mcp.json", change: "modified", notes: ["MCP 서버 정의 병합 (기존 항목 보존)"] },
        { path: ".github/workflows/ci.yml", change: "created", notes: ["CI 워크플로 스캐폴드"] },
      ],
    };
  }

  function run(opts: { only?: string; dryRun?: boolean } = {}): string {
    const log = vi.fn();
    uninstallAction(
      { projectDir: tmpDir, ...opts },
      {
        log,
        err: vi.fn(),
        exit: vi.fn() as unknown as (code: number) => never,
        spawn: vi.fn(() => ok()),
        rm: vi.fn(),
        writeLog: vi.fn(),
      },
    );
    return log.mock.calls.flat().join("\n");
  }

  it("전량 uninstall 시 `.claude/` 밖에 남는 파일을 알려준다", () => {
    writeLog(tmpDir, logWithRootFiles());
    writeFileSync(join(tmpDir, ".mcp.json"), "{}", "utf8");
    mkdirSync(join(tmpDir, ".github/workflows"), { recursive: true });
    writeFileSync(join(tmpDir, ".github/workflows/ci.yml"), "on: push\n", "utf8");

    const out = run();
    expect(out).toContain(".mcp.json");
    expect(out).toContain(".github/workflows/ci.yml");
    // 병합 파일은 "직접 확인", 하네스 생성 파일은 "삭제해도 안전" — 처리 방법이 다르므로 구분한다.
    expect(out).toMatch(/\.mcp\.json[\s\S]*병합/);
    expect(out).toMatch(/ci\.yml[\s\S]*안전/);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("로그에 있어도 디스크에 없으면 안내하지 않는다 — 없는 파일을 손보라고 시키지 않는다", () => {
    writeLog(tmpDir, logWithRootFiles());
    writeFileSync(join(tmpDir, ".mcp.json"), "{}", "utf8"); // ci.yml 은 만들지 않는다

    const out = run();
    expect(out).toContain(".mcp.json");
    expect(out).not.toContain("ci.yml");
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("`--only` 는 자산 범위 작업이라 루트 파일을 안내하지 않는다", () => {
    writeLog(tmpDir, {
      ...logWithRootFiles(),
      assets: [{ id: "p", category: "frontend", method: "plugin", scope: "project", detail: {} }],
    });
    writeFileSync(join(tmpDir, ".mcp.json"), "{}", "utf8");

    expect(run({ only: "p" })).not.toContain(".mcp.json");
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("dry-run 도 같은 안내를 낸다 — 미리보기가 실제와 다르면 미리보기가 아니다", () => {
    writeLog(tmpDir, logWithRootFiles());
    writeFileSync(join(tmpDir, ".mcp.json"), "{}", "utf8");

    expect(run({ dryRun: true })).toContain(".mcp.json");
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("rootFiles 없는 구 로그(v26.123.0 이하)는 안내 섹션 자체가 없다", () => {
    writeLog(tmpDir, baseLog());
    writeFileSync(join(tmpDir, ".mcp.json"), "{}", "utf8");

    expect(run()).not.toContain("[ROOT]");
    rmSync(tmpDir, { recursive: true, force: true });
  });
});
