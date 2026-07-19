import type { SpawnSyncReturns } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listAction } from "../src/commands/list.js";
import { uninstallAction } from "../src/commands/uninstall.js";
import type { ExternalAsset } from "../src/external-assets.js";
import { readInstallLog } from "../src/install-log.js";
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
      options: { withPrune: false, withCodexTrust: false, withKarpathyHook: false },
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
