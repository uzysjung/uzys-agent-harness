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
 * v26.163.0 (#582) — scope=project(기본, `--save-dev`)는 **전역 사본이 아니라
 * `<projectDir>/node_modules/<pkg>/package.json`** 을 읽는다. 이전 판본은 scope 를 안 보고
 * 항상 `npm root -g` 를 읽어, 전역에 다른 버전이 깔려 있으면(흔한 상황 — `npm i -g vercel` 류)
 * 화면·설치 기록이 이번에 프로젝트에 깐 버전이 아니라 전역 버전을 보여줬다.
 *
 * WHY: 설치 성공 후 실제로 깐 자리의 package.json 의 version 을 읽어 사용자에게 표시한다
 * (v26.59.0 기능). 이 경로는 그동안 테스트 0 (getNpmGlobalRoot 의 모듈 캐시가 파일-내 테스트
 * 격리를 깨뜨려 검증이 까다로움). 본 파일은 **전용 파일** — vitest 가 모듈을 파일별 격리하므로
 * 캐시가 fresh. 실 temp 디렉토리에 실제 package.json 을 써서 fs mock 없이 검증한다.
 *
 * 캐시가 첫 호출에 고정되므로 global 경로("성공 경로")는 1개만 deterministic
 * (root 실패 경로는 캐시 오염 위험). project 경로는 npm root -g 를 호출하지 않으므로 무관하다.
 */
function spawnResult(over: Partial<SpawnSyncReturns<string>>): SpawnSyncReturns<string> {
  return { pid: 0, output: [], stdout: "", stderr: "", status: 0, signal: null, ...over };
}

describe("detectVersion — npm asset version (v26.59.0; v26.79.0; v26.163.0 #582 coverage)", () => {
  let npmRoot: string;

  beforeEach(() => {
    npmRoot = mkdtempSync(join(tmpdir(), "ch-npmroot-"));
  });
  afterEach(() => {
    rmSync(npmRoot, { recursive: true, force: true });
  });

  it("scope=global 은 <npm root -g>/<pkg>/package.json 을 읽는다", () => {
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
      method: { kind: "npm", pkg: "fake-pkg", version: "9.9.9" },
    });

    const results: AssetInstallResult[] = [];
    runExternalInstall(
      { tracks: ["tooling"], options: DEFAULT_OPTIONS, cli: ["claude"], scope: "global" },
      { spawn, assets: [asset], onAssetResult: (r) => results.push(r) },
    );

    expect(results).toHaveLength(1);
    expect(results[0]?.ok).toBe(true);
    // 핵심: package.json 의 version 이 result 에 부착됐는가.
    expect(results[0]?.version).toBe("9.9.9");
  });

  /**
   * #582 재현 그대로: 전역에는 다른(구) 버전이 깔려 있고, 이번 실행은 project scope(기본)로
   * 프로젝트에 새 버전을 깐다. 화면·기록은 **프로젝트에 실제로 깐 버전**을 말해야 한다 —
   * 전역 버전이 섞여 나오면 이 테스트가 그것을 잡는다.
   */
  it("scope=project(기본) 은 전역이 아니라 <projectDir>/node_modules/<pkg>/package.json 을 읽는다", () => {
    // 전역에는 옛 버전 — project 경로가 이걸 안 봐야 한다는 게 이 테스트의 핵심.
    const globalPkgDir = join(npmRoot, "fake-pkg");
    mkdirSync(globalPkgDir, { recursive: true });
    writeFileSync(join(globalPkgDir, "package.json"), JSON.stringify({ version: "1.0.0" }));

    const projectDir = mkdtempSync(join(tmpdir(), "ch-projectdir-"));
    const projectPkgDir = join(projectDir, "node_modules", "fake-pkg");
    mkdirSync(projectPkgDir, { recursive: true });
    writeFileSync(join(projectPkgDir, "package.json"), JSON.stringify({ version: "1.4.1" }));

    const spawn = vi.fn((cmd: string, args: ReadonlyArray<string>) => {
      if (cmd === "npm" && args[0] === "root" && args[1] === "-g") {
        return spawnResult({ stdout: `${npmRoot}\n` });
      }
      return spawnResult({});
    }) as unknown as NonNullable<ExternalInstallerDeps["spawn"]>;

    const asset = createMockAsset({
      id: "fake-pkg",
      condition: { kind: "any-track", tracks: ["tooling"] },
      method: { kind: "npm", pkg: "fake-pkg", version: "1.4.1" },
    });

    const results: AssetInstallResult[] = [];
    try {
      runExternalInstall(
        { tracks: ["tooling"], options: DEFAULT_OPTIONS, cli: ["claude"], projectDir },
        { spawn, assets: [asset], onAssetResult: (r) => results.push(r) },
      );

      expect(results).toHaveLength(1);
      expect(results[0]?.ok).toBe(true);
      expect(results[0]?.version).toBe("1.4.1");
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });
});

/**
 * #582 — plugin 자산 version 탐지는 캐시 폴더 이름 정렬이 아니라
 * `~/.claude/plugins/installed_plugins.json` 의 실제 설치 기록을 읽는다. 정렬은 Claude Code 가
 * 갱신 뒤에도 옛 캐시 폴더를 남기고, 버전 필드 없는 플러그인은 폴더 이름이 커밋 SHA 12자라
 * "최신" 과 무관하다 — 그 오탐을 함수 단위로 재현한다: `82229088932d`(SHA, 갱신 전 남은 캐시)가
 * `33375500bcea`(실제 설치본) 보다 문자열로 더 커서 정렬 최후값으로 잘못 골렸다.
 *
 * `homedir()` 를 테스트 안에서 옮기려면 `HOME` env 를 임시 디렉토리로 바꾼다 — 개발자의 실제
 * `~/.claude` 를 읽지 않는다(경계 조건).
 */
describe("detectVersion — plugin asset version (#582)", () => {
  let home: string;
  let originalHome: string | undefined;
  let projectDir: string;

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "ch-home-"));
    originalHome = process.env.HOME;
    process.env.HOME = home;
    projectDir = mkdtempSync(join(tmpdir(), "ch-plugin-projectdir-"));
  });

  afterEach(() => {
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }
    rmSync(home, { recursive: true, force: true });
    rmSync(projectDir, { recursive: true, force: true });
  });

  function writeInstalledPlugins(
    entries: Record<string, ReadonlyArray<Record<string, unknown>>>,
  ): void {
    const dir = join(home, ".claude/plugins");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "installed_plugins.json"),
      JSON.stringify({ version: 2, plugins: entries }),
    );
  }

  const spawn = vi.fn(() => ({
    pid: 0,
    output: [],
    stdout: "",
    stderr: "",
    status: 0,
    signal: null,
  })) as unknown as NonNullable<ExternalInstallerDeps["spawn"]>;

  it("캐시 폴더의 문자열 정렬이 아니라 installed_plugins.json 의 실제 버전을 쓴다", () => {
    // 정렬하면 "82229088932d" 가 "33375500bcea" 보다 커서 최후값으로 잘못 골린다 — 실제
    // 기록은 후자가 이번에 깐 것이라고 말한다.
    writeInstalledPlugins({
      "document-skills@anthropic-agent-skills": [
        {
          scope: "project",
          projectPath: projectDir,
          version: "33375500bcea",
          lastUpdated: "2026-09-27T00:00:00.000Z",
        },
      ],
    });

    const asset = createMockAsset({
      id: "document-skills",
      condition: { kind: "any-track", tracks: ["tooling"] },
      method: {
        kind: "plugin",
        marketplace: "anthropics/skills",
        pluginId: "document-skills@anthropic-agent-skills",
      },
    });

    const results: AssetInstallResult[] = [];
    runExternalInstall(
      { tracks: ["tooling"], options: DEFAULT_OPTIONS, cli: ["claude"], projectDir },
      { spawn, assets: [asset], onAssetResult: (r) => results.push(r) },
    );

    expect(results).toHaveLength(1);
    expect(results[0]?.ok).toBe(true);
    expect(results[0]?.version).toBe("33375500bcea");
  });

  it("scope=global 은 projectPath 없는 'user' 항목을 읽는다", () => {
    writeInstalledPlugins({
      "playwright@claude-plugins-official": [
        {
          scope: "project",
          projectPath: "/some/other/project",
          version: "should-not-be-picked",
          lastUpdated: "2026-01-01T00:00:00.000Z",
        },
        { scope: "user", version: "fa59bc903774", lastUpdated: "2026-09-27T02:05:04.076Z" },
      ],
    });

    const asset = createMockAsset({
      id: "playwright",
      condition: { kind: "any-track", tracks: ["tooling"] },
      method: {
        kind: "plugin",
        marketplace: "anthropics/claude-plugins-official",
        pluginId: "playwright@claude-plugins-official",
      },
    });

    const results: AssetInstallResult[] = [];
    runExternalInstall(
      {
        tracks: ["tooling"],
        options: DEFAULT_OPTIONS,
        cli: ["claude"],
        scope: "global",
        projectDir,
      },
      { spawn, assets: [asset], onAssetResult: (r) => results.push(r) },
    );

    expect(results).toHaveLength(1);
    expect(results[0]?.version).toBe("fa59bc903774");
  });

  it("기록에 이 프로젝트 항목이 없으면 비운다 — 틀린 값보다 undefined 가 낫다", () => {
    writeInstalledPlugins({
      "document-skills@anthropic-agent-skills": [
        {
          scope: "project",
          projectPath: "/completely/different/project",
          version: "deadbeef0000",
          lastUpdated: "2026-09-27T00:00:00.000Z",
        },
      ],
    });

    const asset = createMockAsset({
      id: "document-skills",
      condition: { kind: "any-track", tracks: ["tooling"] },
      method: {
        kind: "plugin",
        marketplace: "anthropics/skills",
        pluginId: "document-skills@anthropic-agent-skills",
      },
    });

    const results: AssetInstallResult[] = [];
    runExternalInstall(
      { tracks: ["tooling"], options: DEFAULT_OPTIONS, cli: ["claude"], projectDir },
      { spawn, assets: [asset], onAssetResult: (r) => results.push(r) },
    );

    expect(results).toHaveLength(1);
    expect(results[0]?.ok).toBe(true);
    expect(results[0]?.version).toBeUndefined();
  });
});
