import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ExternalAsset } from "../src/external-assets.js";
import type { AssetInstallResult, ExternalInstallReport } from "../src/external-installer.js";
import {
  buildAssetEntries,
  buildInstallLog,
  type InstallLog,
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

/**
 * v26.123.0 2차 검증 반영 (SOD F2) — `npx-run`(bmad-method)은 `--tools claude-code` 로
 * `.claude/` 안에 agent command 를 만든다. "npx-run 은 프로젝트 밖"이라는 가정이 틀렸고,
 * 그 가정 때문에 reinstall 후 로그가 없는 자산을 있다고 보고했다.
 */
describe("survivesClaudeDirRename — .claude/ 를 밀어낸 설치의 누적 제외 (F2)", () => {
  function withMethod(
    id: string,
    method: ExternalAsset["method"],
    scope: "project" | "global" = "project",
  ): InstallLog {
    const asset = createMockAsset({
      id,
      condition: { kind: "any-track", tracks: ["tooling"] },
      method,
    });
    return buildInstallLog(
      mkSpec(),
      { attempted: [mkResult(asset)], succeeded: 1, skipped: 0, excludedByCli: [] },
      scope,
    );
  }

  function survivorsAfterRename(previous: InstallLog): string[] {
    return buildInstallLog(mkSpec(), null, "project", null, previous, true).assets.map((a) => a.id);
  }

  it("npx-run 은 `.claude/` 산출물이 사라지므로 누적에서 빠진다", () => {
    const prev = withMethod("bmad", { kind: "npx-run", cmd: "bmad-method", version: "6.9.0" });
    expect(survivorsAfterRename(prev)).toEqual([]);
  });

  it("skill / shell-script 도 `.claude/` 안이라 빠진다", () => {
    expect(survivorsAfterRename(withMethod("sk", { kind: "skill", source: "o/r" }))).toEqual([]);
    expect(
      survivorsAfterRename(withMethod("sh", { kind: "shell-script", script: "s.sh", args: [] })),
    ).toEqual([]);
  });

  it("plugin / npm 은 프로젝트 밖이라 남는다", () => {
    expect(
      survivorsAfterRename(withMethod("pl", { kind: "plugin", marketplace: "m", pluginId: "p@m" })),
    ).toEqual(["pl"]);
    expect(
      survivorsAfterRename(withMethod("np", { kind: "npm", pkg: "vercel", version: "1.0.0" })),
    ).toEqual(["np"]);
  });

  it("global scope 자산은 method 와 무관하게 남는다 (install 이 글로벌을 건드리지 않는다)", () => {
    const prev = withMethod("gskill", { kind: "skill", source: "o/r" }, "global");
    expect(survivorsAfterRename(prev)).toEqual(["gskill"]);
  });
});

/**
 * v26.124.0 (F-1f) — install 은 `.claude/` **밖**에도 쓴다(`.mcp.json` 병합 · `.gitignore` 추가줄 ·
 * `.env.example` · `.mcp-allowlist` · `.github/workflows/`). 그런데 로그에 아무 기록이 없어
 * uninstall 이 **안내조차 못 했다**. 기록이 없으면 안내도 없다 — 그래서 install 이 먼저 적는다.
 */
describe("buildInstallLog — 루트 파일 기록 (F-1f)", () => {
  const mcpCreated = { path: ".mcp.json", change: "created" as const, notes: ["MCP 서버 정의"] };
  const mcpMerged = { path: ".mcp.json", change: "modified" as const, notes: ["MCP 서버 병합"] };

  it("루트 파일이 없으면 필드 자체가 없다 (구 로그와 같은 모양 — 구독자가 늘 배열을 가정하지 않게)", () => {
    expect(buildInstallLog(mkSpec(), null, "project").rootFiles).toBeUndefined();
  });

  it("이번 설치가 건드린 루트 파일이 기록된다", () => {
    const log = buildInstallLog(mkSpec(), null, "project", null, null, false, [mcpCreated]);
    expect(log.rootFiles).toEqual([mcpCreated]);
  });

  it("추가 설치해도 1회차 루트 파일이 남는다 — 디스크에 그대로 있으므로", () => {
    const first = buildInstallLog(mkSpec(), null, "project", null, null, false, [mcpCreated]);
    const second = buildInstallLog(mkSpec(), null, "project", null, first, false, [
      { path: ".env.example", change: "created", notes: ["Supabase 가이드"] },
    ]);
    expect(second.rootFiles?.map((f) => f.path)).toEqual([".mcp.json", ".env.example"]);
  });

  it("같은 파일을 두 번 건드리면 note 가 합쳐진다 — 이번 것만 남기면 1회차 추가분을 안 알려준다", () => {
    const first = buildInstallLog(mkSpec(), null, "project", null, null, false, [
      { path: ".gitignore", change: "modified", notes: [".env"] },
    ]);
    const second = buildInstallLog(mkSpec(), null, "project", null, first, false, [
      { path: ".gitignore", change: "modified", notes: [".factory/", ".goose/"] },
    ]);
    expect(second.rootFiles).toHaveLength(1);
    expect(second.rootFiles?.[0]?.notes).toEqual([".env", ".factory/", ".goose/"]);
  });

  it("한 번이라도 하네스가 만든 파일이면 created 로 남는다 (전량 하네스 소유 = 삭제해도 안전)", () => {
    const first = buildInstallLog(mkSpec(), null, "project", null, null, false, [mcpCreated]);
    const second = buildInstallLog(mkSpec(), null, "project", null, first, false, [mcpMerged]);
    expect(second.rootFiles?.[0]?.change).toBe("created");
  });

  it("`.claude/` 를 밀어낸 설치여도 루트 파일은 남는다 — 밖에 있으므로 사라지지 않는다", () => {
    const first = buildInstallLog(mkSpec(), null, "project", null, null, false, [mcpCreated]);
    const second = buildInstallLog(mkSpec(), null, "project", null, first, true, []);
    expect(second.rootFiles?.map((f) => f.path)).toEqual([".mcp.json"]);
  });
});

/**
 * v26.135.0 (#253) — 로그 위치가 `.claude/` → `.uzys-agent-harness/` 로 바뀌었다.
 *
 * 여기서 지키는 건 "경로가 바뀌었다"가 아니라 **게시본으로 설치한 사용자가 버려지지 않는다**는
 * 것이다. 폴백이 없으면 v26.134.1 이하로 깐 프로젝트의 `list`/`uninstall`/`update` 가 전부
 * "install log not found" 로 죽고, 이관이 없으면 같은 프로젝트에 로그가 2벌 남아 어느 쪽이
 * 참인지 알 수 없게 된다.
 */
describe("install log 위치 이관 (#253)", () => {
  let tmpDir = "";
  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "harness-log-move-"));
  });
  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  const sample = (): InstallLog => ({
    schemaVersion: 1,
    installedAt: "2026-07-26T00:00:00.000Z",
    scope: "project",
    spec: { tracks: ["tooling"], cli: ["opencode"] },
    templates: { claudeDir: ".claude/" },
    assets: [],
  });

  it("write 는 `.uzys-agent-harness/` 에 쓴다 — 안 고른 CLI 의 디렉터리를 만들지 않는다", () => {
    writeInstallLog(tmpDir, sample());
    expect(existsSync(join(tmpDir, ".uzys-agent-harness", ".harness-install.json"))).toBe(true);
    expect(existsSync(join(tmpDir, ".claude"))).toBe(false);
  });

  it("구 위치(.claude/)에만 있어도 읽는다 — v26.134.1 이하 설치본이 버려지지 않는다", () => {
    mkdirSync(join(tmpDir, ".claude"), { recursive: true });
    writeFileSync(
      join(tmpDir, ".claude", ".harness-install.json"),
      JSON.stringify({ ...sample(), scope: "global" }),
      "utf8",
    );
    expect(readInstallLog(tmpDir)?.scope).toBe("global");
  });

  it("다음 write 가 구 파일을 치운다 — 로그가 2벌 남으면 어느 쪽이 참인지 알 수 없다", () => {
    mkdirSync(join(tmpDir, ".claude"), { recursive: true });
    writeFileSync(
      join(tmpDir, ".claude", ".harness-install.json"),
      JSON.stringify(sample()),
      "utf8",
    );
    writeInstallLog(tmpDir, sample());
    expect(existsSync(join(tmpDir, ".claude", ".harness-install.json"))).toBe(false);
    expect(existsSync(installLogPath(tmpDir))).toBe(true);
  });

  it("새 위치가 구 위치를 이긴다 — 이관 직후 잔재가 남아도 최신 기록을 읽는다", () => {
    mkdirSync(join(tmpDir, ".claude"), { recursive: true });
    writeFileSync(
      join(tmpDir, ".claude", ".harness-install.json"),
      JSON.stringify({ ...sample(), installedAt: "2020-01-01T00:00:00.000Z" }),
      "utf8",
    );
    mkdirSync(join(tmpDir, ".uzys-agent-harness"), { recursive: true });
    writeFileSync(installLogPath(tmpDir), JSON.stringify(sample()), "utf8");
    expect(readInstallLog(tmpDir)?.installedAt).toBe("2026-07-26T00:00:00.000Z");
  });
});
