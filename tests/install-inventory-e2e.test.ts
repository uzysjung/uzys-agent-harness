import type { SpawnSyncReturns } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listAction } from "../src/commands/list.js";
import { uninstallAction } from "../src/commands/uninstall.js";
import type { ExternalAsset } from "../src/external-assets.js";
import { hashContent, readInstallLog } from "../src/install-log.js";
import { runInstall } from "../src/installer.js";
import type { InstallSpec } from "../src/types.js";

/**
 * v26.123.0 (F-1e) — 사용자 요청의 AC 를 한 줄기로 검증한다:
 * 설치 → 추가 설치 → `list` 에 둘 다 보임 → `--only` 로 하나만 제거 → 나머지 유지.
 *
 * 조각별 단위 테스트(install-log / uninstall / list)가 각각 통과해도, 이어붙였을 때
 * 기록이 끊기면 사용자에겐 기능이 없는 것과 같다. 이 테스트가 그 이음매를 지킨다.
 */
const HARNESS_ROOT = resolve(__dirname, "..");

function okSpawn(): SpawnSyncReturns<string> {
  return { pid: 0, output: [], stdout: "", stderr: "", status: 0, signal: null };
}

function pluginAsset(id: string): ExternalAsset {
  return {
    id,
    description: id,
    category: "dev-tools",
    source: "uzys",
    tier: "vetted",
    condition: { kind: "any-track", tracks: ["tooling"] },
    method: { kind: "plugin", marketplace: "mp", pluginId: `${id}@mp` },
  };
}

describe("설치 내역 관리 end-to-end (F-1e)", () => {
  let projectDir = "";

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "harness-inventory-"));
  });
  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  function install(assetId: string): void {
    const spec: InstallSpec = {
      tracks: ["tooling"],
      options: { withPrune: false, withCodexTrust: false },
      cli: ["claude"],
      projectDir,
    };
    runInstall({
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec,
      mode: "add",
      runExternal: () => ({
        attempted: [{ asset: pluginAsset(assetId), ok: true }],
        succeeded: 1,
        skipped: 0,
        excludedByCli: [],
      }),
    });
  }

  function listOutput(): string {
    const log = vi.fn();
    listAction({ projectDir }, { log, err: vi.fn(), exit: vi.fn() as never });
    return log.mock.calls.flat().join("\n");
  }

  it("설치 → 추가 설치 → list 에 둘 다 → --only 로 하나 제거 → 나머지 유지", () => {
    install("first-plugin");
    install("second-plugin");

    // 1) 조회: 두 자산 모두 보인다 (안 보이면 제거할 방법이 없다)
    const before = listOutput();
    expect(before).toContain("first-plugin");
    expect(before).toContain("second-plugin");

    // 2) 항목별 제거: 지정한 것만 실제 reverse 명령이 나간다
    const spawn = vi.fn((_cmd: string, _args: ReadonlyArray<string>) => okSpawn());
    uninstallAction(
      { projectDir, only: "first-plugin" },
      { log: vi.fn(), err: vi.fn(), exit: vi.fn() as never, spawn, rm: vi.fn() },
    );
    expect(spawn).toHaveBeenCalledOnce();
    expect(spawn.mock.calls[0]?.[1]).toContain("first-plugin@mp");

    // 3) 나머지는 기록에 남고 계속 조회된다
    expect(readInstallLog(projectDir)?.assets.map((a) => a.id)).toEqual(["second-plugin"]);
    const after = listOutput();
    expect(after).toContain("second-plugin");
    expect(after).not.toContain("first-plugin");
  });
});

/**
 * v26.124.0 (F-1f) — 위 흐름의 사각지대: install 은 `.claude/` **밖**에도 쓴다.
 * 실제 `runInstall` 이 그걸 기록하는지 본다 — 단위 테스트의 rootFiles 는 전부 손으로 만든
 * 입력이라, install 이 애초에 안 적으면 uninstall 안내는 영원히 비어 있다.
 */
describe("루트 파일 기록 end-to-end (F-1f)", () => {
  let projectDir = "";

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "harness-rootfiles-"));
  });
  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  function install(): void {
    runInstall({
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: {
        tracks: ["tooling"],
        options: { withPrune: false, withCodexTrust: false },
        cli: ["claude"],
        projectDir,
      },
      mode: "add",
      runExternal: () => ({ attempted: [], succeeded: 0, skipped: 0, excludedByCli: [] }),
    });
  }

  it("install 이 `.mcp.json` 을 만들면 로그에 created 로 남는다", () => {
    install();
    const mcp = readInstallLog(projectDir)?.rootFiles?.find((f) => f.path === ".mcp.json");
    expect(mcp?.change).toBe("created");
  });

  it("이미 있던 `.mcp.json` 은 modified — 하네스 것이 아니므로 삭제 안내를 하면 안 된다", () => {
    writeFileSync(join(projectDir, ".mcp.json"), JSON.stringify({ mcpServers: {} }), "utf8");
    install();
    const mcp = readInstallLog(projectDir)?.rootFiles?.find((f) => f.path === ".mcp.json");
    expect(mcp?.change).toBe("modified");
  });

  it("`.gitignore` 에 추가한 줄이 기록되고, uninstall 이 그걸 안내한다", () => {
    writeFileSync(join(projectDir, ".gitignore"), "node_modules\n", "utf8");
    install();

    const gitignore = readInstallLog(projectDir)?.rootFiles?.find((f) => f.path === ".gitignore");
    expect(gitignore?.change).toBe("modified");
    expect(gitignore?.notes.join(" ")).toContain(".env");

    const log = vi.fn();
    uninstallAction(
      { projectDir, dryRun: true },
      { log, err: vi.fn(), exit: vi.fn() as never, spawn: vi.fn(() => okSpawn()), rm: vi.fn() },
    );
    expect(log.mock.calls.flat().join("\n")).toContain(".gitignore");
  });
});

/**
 * v26.126.0 (R-3a) — 실제 `runInstall` 이 스킬 기준선 해시를 적는가.
 *
 * 이 테스트가 없으면 지난 사이클(F-1f)과 **같은 함정**에 빠진다: update 쪽 단위 테스트는
 * install log 를 전부 손으로 만들어 넣는다. install 이 애초에 안 적으면 그 판정 로직은
 * 현실에서 한 번도 "안 고쳤다" 경로를 타지 못하고, 사용자는 매 update 마다 백업본을 받는다.
 */
describe("스킬 기준선 기록 end-to-end (R-3a)", () => {
  let projectDir = "";

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "harness-skillbase-"));
  });
  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  it("install 이 설치한 스킬 파일마다 sha256 을 남긴다", () => {
    runInstall({
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: {
        tracks: ["tooling"],
        options: { withPrune: false, withCodexTrust: false },
        cli: ["claude"],
        projectDir,
      },
      mode: "add",
      runExternal: () => ({ attempted: [], succeeded: 0, skipped: 0, excludedByCli: [] }),
    });

    const skillsDir = join(projectDir, ".claude/skills");
    const installedSkills = existsSync(skillsDir) ? readdirSync(skillsDir) : [];
    // 전제: tooling 트랙이 스킬을 실제로 깐다. 안 깔리면 이 테스트가 아무것도 검증하지 못한다.
    expect(installedSkills.length).toBeGreaterThan(0);

    const recorded = readInstallLog(projectDir)?.skillFiles ?? [];
    expect(recorded.length).toBeGreaterThan(0);

    // 기록된 해시가 **디스크의 실제 내용**과 맞아야 한다 — 안 맞으면 update 가 전부 오판한다.
    for (const entry of recorded) {
      const onDisk = readFileSync(join(skillsDir, entry.path), "utf8");
      expect(entry.sha256).toBe(hashContent(onDisk));
    }
  });
});
