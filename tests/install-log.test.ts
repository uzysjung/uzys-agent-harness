import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { ExternalAsset } from "../src/external-assets.js";
import type { AssetInstallResult, ExternalInstallReport } from "../src/external-installer.js";
import {
  buildAssetEntries,
  buildInstallLog,
  installLogPath,
  readInstallLog,
  writeInstallLog,
} from "../src/install-log.js";
import { DEFAULT_OPTIONS, type InstallSpec } from "../src/types.js";
import { createMockAsset } from "./helpers/mock-asset.js";

function mkSpec(overrides: Partial<InstallSpec> = {}): InstallSpec {
  return {
    tracks: ["tooling"],
    options: DEFAULT_OPTIONS,
    cli: ["claude"],
    projectDir: "/tmp/proj",
    scope: "project",
    ...overrides,
  };
}

function mkResult(asset: ExternalAsset, ok = true): AssetInstallResult {
  return { asset, ok };
}

describe("buildAssetEntries", () => {
  it("filters ok=false assets (failed install 은 log 에 안 들어감)", () => {
    const asset1 = createMockAsset({
      id: "okk",
      condition: { kind: "any-track", tracks: ["tooling"] },
      method: { kind: "plugin", marketplace: "mp/foo", pluginId: "foo@mp" },
    });
    const asset2 = createMockAsset({
      id: "fail",
      condition: { kind: "any-track", tracks: ["tooling"] },
      method: { kind: "skill", source: "owner/repo" },
    });
    const report: ExternalInstallReport = {
      attempted: [mkResult(asset1, true), mkResult(asset2, false)],
      succeeded: 1,
      skipped: 1,
    };
    const entries = buildAssetEntries(report, "project");
    expect(entries).toHaveLength(1);
    expect(entries[0]?.id).toBe("okk");
  });

  it("plugin method → detail 에 marketplace + pluginId", () => {
    const asset = createMockAsset({
      id: "p",
      condition: { kind: "any-track", tracks: ["tooling"] },
      method: { kind: "plugin", marketplace: "mp/foo", pluginId: "foo@mp" },
    });
    const entries = buildAssetEntries(
      { attempted: [mkResult(asset)], succeeded: 1, skipped: 0 },
      "project",
    );
    expect(entries[0]?.detail).toEqual({ marketplace: "mp/foo", pluginId: "foo@mp" });
  });

  it("npm-global method → detail 에 pkg", () => {
    const asset = createMockAsset({
      id: "v",
      condition: { kind: "any-track", tracks: ["tooling"] },
      method: { kind: "npm", pkg: "vercel" },
    });
    const entries = buildAssetEntries(
      { attempted: [mkResult(asset)], succeeded: 1, skipped: 0 },
      "project",
    );
    expect(entries[0]?.detail).toEqual({ pkg: "vercel" });
  });

  it("scope=global → 모든 entry 에 scope=global 부착", () => {
    const asset = createMockAsset({
      id: "g",
      condition: { kind: "any-track", tracks: ["tooling"] },
      method: { kind: "plugin", marketplace: "mp", pluginId: "p@mp" },
    });
    const entries = buildAssetEntries(
      { attempted: [mkResult(asset)], succeeded: 1, skipped: 0 },
      "global",
    );
    expect(entries[0]?.scope).toBe("global");
  });
});

describe("buildInstallLog + write/read round-trip", () => {
  let tmpDir = "";
  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "harness-install-log-"));
    mkdirSync(join(tmpDir, ".claude"), { recursive: true });
  });

  it("templates 의 codexDir 은 cli=codex 일 때만 포함 (D16 — 불필요 entry 안 만듦)", () => {
    const log = buildInstallLog(mkSpec({ cli: ["claude"] }), null, "project");
    expect(log.templates.claudeDir).toBe(".claude/");
    expect(log.templates.codexDir).toBeUndefined();
    expect(log.templates.opencodeDir).toBeUndefined();
  });

  it("templates 의 codexDir 은 cli=codex 시 .codex/ 로 (project-scope codex transform 대상)", () => {
    const log = buildInstallLog(mkSpec({ cli: ["claude", "codex"] }), null, "project");
    expect(log.templates.codexDir).toBe(".codex/");
  });

  it("write → read round-trip 으로 log 내용 보존", () => {
    const asset = createMockAsset({
      id: "p",
      condition: { kind: "any-track", tracks: ["tooling"] },
      method: { kind: "plugin", marketplace: "mp", pluginId: "p@mp" },
    });
    const report: ExternalInstallReport = {
      attempted: [mkResult(asset)],
      succeeded: 1,
      skipped: 0,
    };
    const log = buildInstallLog(mkSpec(), report, "project");
    const path = writeInstallLog(tmpDir, log);
    expect(path).toBe(installLogPath(tmpDir));

    const restored = readInstallLog(tmpDir);
    expect(restored?.schemaVersion).toBe(1);
    expect(restored?.scope).toBe("project");
    expect(restored?.assets).toHaveLength(1);
    expect(restored?.assets[0]?.id).toBe("p");

    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("readInstallLog 가 파일 없을 때 null 반환 (safe)", () => {
    const result = readInstallLog(tmpDir); // .claude/.harness-install.json 미생성
    expect(result).toBeNull();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("readInstallLog 가 invalid JSON 파일에 대해 null 반환 (corrupted log 안전)", async () => {
    const fs = await import("node:fs");
    const { join } = await import("node:path");
    fs.writeFileSync(join(tmpDir, ".claude", ".harness-install.json"), "not-json{", "utf8");
    const result = readInstallLog(tmpDir);
    expect(result).toBeNull();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("v26.68.0 backward compat — legacy method 'npm-global' 을 'npm' 으로 normalize", async () => {
    const fs = await import("node:fs");
    const { join: pathJoin } = await import("node:path");
    const legacyLog = {
      schemaVersion: 1,
      installedAt: "2026-05-19T00:00:00.000Z",
      scope: "project" as const,
      spec: { tracks: ["tooling"], cli: ["claude"] },
      templates: { claudeDir: ".claude/" },
      assets: [
        {
          id: "vercel",
          category: "dev-tools",
          method: "npm-global", // v26.64.0 ~ v26.67.0 시점 install log
          scope: "project" as const,
          detail: { pkg: "vercel" },
        },
      ],
    };
    fs.writeFileSync(
      pathJoin(tmpDir, ".claude", ".harness-install.json"),
      JSON.stringify(legacyLog),
      "utf8",
    );
    const restored = readInstallLog(tmpDir);
    expect(restored?.assets[0]?.method).toBe("npm");
    rmSync(tmpDir, { recursive: true, force: true });
  });
});
