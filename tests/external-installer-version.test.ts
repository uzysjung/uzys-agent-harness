import type { SpawnSyncReturns } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AssetInstallResult, ExternalInstallerDeps } from "../src/external-installer.js";
import { runExternalInstall } from "../src/external-installer.js";
import { DEFAULT_OPTIONS } from "../src/types.js";
import { createMockAsset } from "./helpers/mock-asset.js";

/**
 * v26.79.0 — npm 자산 version 탐지(detectVersion 의 npm 분기) 회귀 가드.
 *
 * WHY: 설치 성공 후 `<npm root -g>/<pkg>/package.json` 의 version 을 읽어 사용자에게 표시한다
 * (v26.59.0 기능). 이 경로는 그동안 테스트 0 (getNpmGlobalRoot 의 모듈 캐시가 파일-내 테스트
 * 격리를 깨뜨려 검증이 까다로움). 본 파일은 **전용 파일** — vitest 가 모듈을 파일별 격리하므로
 * 캐시가 fresh. 실 temp 디렉토리에 실제 package.json 을 써서 fs mock 없이 검증한다.
 *
 * 캐시가 첫 호출에 고정되므로 "성공 경로" 1개만 deterministic. (root 실패 경로는 캐시 오염 위험).
 */
function spawnResult(over: Partial<SpawnSyncReturns<string>>): SpawnSyncReturns<string> {
  return { pid: 0, output: [], stdout: "", stderr: "", status: 0, signal: null, ...over };
}

describe("detectVersion — npm asset version (v26.59.0; v26.79.0 coverage)", () => {
  let npmRoot: string;

  beforeEach(() => {
    npmRoot = mkdtempSync(join(tmpdir(), "ch-npmroot-"));
  });
  afterEach(() => {
    rmSync(npmRoot, { recursive: true, force: true });
  });

  it("reads version from <npm root -g>/<pkg>/package.json after a successful install", () => {
    // 실 temp 전역 root 에 패키지 package.json 배치 (fs mock 불요 — detectVersion 이 실파일 read).
    const pkgDir = join(npmRoot, "fake-pkg");
    mkdirSync(pkgDir, { recursive: true });
    writeFileSync(join(pkgDir, "package.json"), JSON.stringify({ version: "9.9.9" }));

    const spawn = vi.fn((cmd: string, args: ReadonlyArray<string>) => {
      // `npm root -g` → temp 전역 root 반환. 그 외(npm install ...) → 성공.
      if (cmd === "npm" && args[0] === "root" && args[1] === "-g") {
        return spawnResult({ stdout: `${npmRoot}\n` });
      }
      return spawnResult({});
    }) as unknown as NonNullable<ExternalInstallerDeps["spawn"]>;

    const asset = createMockAsset({
      id: "fake-pkg",
      condition: { kind: "any-track", tracks: ["tooling"] },
      method: { kind: "npm", pkg: "fake-pkg" },
    });

    const results: AssetInstallResult[] = [];
    runExternalInstall(
      { tracks: ["tooling"], options: DEFAULT_OPTIONS, cli: ["claude"] },
      { spawn, assets: [asset], onAssetResult: (r) => results.push(r) },
    );

    expect(results).toHaveLength(1);
    expect(results[0]?.ok).toBe(true);
    // 핵심: package.json 의 version 이 result 에 부착됐는가.
    expect(results[0]?.version).toBe("9.9.9");
  });
});
