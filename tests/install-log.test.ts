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
      excludedByCli: [],
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
      { attempted: [mkResult(asset)], succeeded: 1, skipped: 0, excludedByCli: [] },
      "project",
    );
    expect(entries[0]?.detail).toEqual({ marketplace: "mp/foo", pluginId: "foo@mp" });
  });

  it("npm-global method → detail 에 pkg", () => {
    const asset = createMockAsset({
      id: "v",
      condition: { kind: "any-track", tracks: ["tooling"] },
      method: { kind: "npm", pkg: "vercel", version: "54.0.0" },
    });
    const entries = buildAssetEntries(
      { attempted: [mkResult(asset)], succeeded: 1, skipped: 0, excludedByCli: [] },
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
      { attempted: [mkResult(asset)], succeeded: 1, skipped: 0, excludedByCli: [] },
      "global",
    );
    expect(entries[0]?.scope).toBe("global");
  });

  // method.kind 별 detail (methodDetail switch 전 case 커버)
  it("skill method → detail 에 source (+ skill name 있으면 포함)", () => {
    const withName = createMockAsset({
      id: "s1",
      condition: { kind: "any-track", tracks: ["tooling"] },
      method: { kind: "skill", source: "owner/repo", skill: "polars" },
    });
    const noName = createMockAsset({
      id: "s2",
      condition: { kind: "any-track", tracks: ["tooling"] },
      method: { kind: "skill", source: "owner/repo" },
    });
    const e1 = buildAssetEntries(
      { attempted: [mkResult(withName)], succeeded: 1, skipped: 0, excludedByCli: [] },
      "project",
    );
    const e2 = buildAssetEntries(
      { attempted: [mkResult(noName)], succeeded: 1, skipped: 0, excludedByCli: [] },
      "project",
    );
    expect(e1[0]?.detail).toEqual({ source: "owner/repo", skill: "polars" });
    expect(e2[0]?.detail).toEqual({ source: "owner/repo" });
  });

  it("npx-run / shell-script method → detail 에 cmd/script + args", () => {
    const npxRun = createMockAsset({
      id: "gsd",
      condition: { kind: "any-track", tracks: ["tooling"] },
      // v26.80.0 — cmd 는 bare 이름 (version 은 별도 필드). detail 의 cmd 도 bare 로 기록.
      method: { kind: "npx-run", cmd: "get-shit-done-cc", version: "1.42.0", args: ["--init"] },
    });
    const shell = createMockAsset({
      id: "prune",
      condition: { kind: "any-track", tracks: ["tooling"] },
      method: { kind: "shell-script", script: "scripts/prune-ecc.sh", args: ["--yes"] },
    });
    const e1 = buildAssetEntries(
      { attempted: [mkResult(npxRun)], succeeded: 1, skipped: 0, excludedByCli: [] },
      "project",
    );
    const e2 = buildAssetEntries(
      { attempted: [mkResult(shell)], succeeded: 1, skipped: 0, excludedByCli: [] },
      "project",
    );
    expect(e1[0]?.detail).toEqual({ cmd: "get-shit-done-cc", args: "--init" });
    expect(e2[0]?.detail).toEqual({ script: "scripts/prune-ecc.sh", args: "--yes" });
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
      excludedByCli: [],
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

/**
 * v26.123.0 (F-1a) — 로그가 이전 설치를 잊으면 uninstall 이 그 자산을 못 찾아 남긴다.
 * install 은 이전 설치분을 제거하지 않으므로, 로그가 잊는 순간 "디스크엔 있는데 기록엔 없는"
 * 거짓 상태가 된다. 아래 테스트들은 그 거짓이 다시 생기면 깨진다.
 */
describe("buildInstallLog — 이전 로그 누적 (F-1a)", () => {
  function reportOf(id: string, version?: string): ExternalInstallReport {
    const asset = createMockAsset({
      id,
      condition: { kind: "any-track", tracks: ["tooling"] },
      method: { kind: "plugin", marketplace: "mp", pluginId: `${id}@mp` },
    });
    return {
      attempted: [{ asset, ok: true, ...(version ? { version } : {}) }],
      succeeded: 1,
      skipped: 0,
      excludedByCli: [],
    };
  }

  it("추가 설치해도 1회차 자산이 로그에 남는다 (uninstall 이 찾을 수 있어야 하므로)", () => {
    const first = buildInstallLog(mkSpec(), reportOf("first"), "project");
    const second = buildInstallLog(mkSpec(), reportOf("second"), "project", null, first);

    expect(second.assets.map((a) => a.id)).toEqual(["first", "second"]);
  });

  it("같은 자산을 재설치하면 중복되지 않고 이번 설치분(최신 version)이 이긴다", () => {
    const first = buildInstallLog(mkSpec(), reportOf("dup", "1.0.0"), "project");
    const second = buildInstallLog(mkSpec(), reportOf("dup", "2.0.0"), "project", null, first);

    expect(second.assets).toHaveLength(1);
    expect(second.assets[0]?.version).toBe("2.0.0");
  });

  it("previous 없으면(최초 설치) 이번 자산만 — 누적 로직이 기존 동작을 바꾸지 않는다", () => {
    const log = buildInstallLog(mkSpec(), reportOf("only"), "project", null, null);
    expect(log.assets.map((a) => a.id)).toEqual(["only"]);
  });

  it("claude 로 깔고 codex 만 추가 설치해도 rootClaudeMd 기록이 살아남는다", () => {
    // 안 살아남으면 uninstall 이 root CLAUDE.md 를 지우지도, 보존 판정하지도 못한다.
    const first = buildInstallLog(mkSpec({ cli: ["claude"] }), null, "project", {
      path: "CLAUDE.md",
      sha256: "abc",
    });
    const second = buildInstallLog(mkSpec({ cli: ["codex"] }), null, "project", null, first);

    expect(second.templates.rootClaudeMd).toEqual({ path: "CLAUDE.md", sha256: "abc" });
    expect(second.templates.codexDir).toBe(".codex/");
  });

  it("이번 설치가 CLAUDE.md 를 다시 쓰면 새 sha256 이 이긴다 (수정 감지가 최신 원본 기준)", () => {
    const first = buildInstallLog(mkSpec(), null, "project", { path: "CLAUDE.md", sha256: "old" });
    const second = buildInstallLog(
      mkSpec(),
      null,
      "project",
      { path: "CLAUDE.md", sha256: "new" },
      first,
    );

    expect(second.templates.rootClaudeMd?.sha256).toBe("new");
  });

  it("spec(tracks/cli)은 누적하지 않는다 — reinstall 이 이전 트랙 파일을 실제로 지우므로", () => {
    const first = buildInstallLog(mkSpec({ tracks: ["tooling"] }), null, "project");
    const second = buildInstallLog(mkSpec({ tracks: ["data"] }), null, "project", null, first);

    expect(second.spec.tracks).toEqual(["data"]);
  });
});
