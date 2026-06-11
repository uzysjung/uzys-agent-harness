import type { SpawnSyncReturns } from "node:child_process";
import { describe, expect, it, vi } from "vitest";
import type { ExternalAsset } from "../src/external-assets.js";
import {
  type ExternalInstallerDeps,
  formatSkippedReport,
  runExternalInstall,
} from "../src/external-installer.js";
import { DEFAULT_OPTIONS } from "../src/types.js";
import { createMockAsset } from "./helpers/mock-asset.js";

type SpawnFn = NonNullable<ExternalInstallerDeps["spawn"]>;

/** vi.fn은 generic이 까다로워 단순 cast로 처리. */
function makeSpawnMock(fn: () => SpawnSyncReturns<string>): SpawnFn & {
  mock: { calls: Array<Parameters<SpawnFn>> };
} {
  return vi.fn(fn) as unknown as SpawnFn & {
    mock: { calls: Array<Parameters<SpawnFn>> };
  };
}

function ok(): SpawnSyncReturns<string> {
  return {
    pid: 0,
    output: [],
    stdout: "",
    stderr: "",
    status: 0,
    signal: null,
  };
}

function fail(stderr = "boom"): SpawnSyncReturns<string> {
  return {
    pid: 0,
    output: [],
    stdout: "",
    stderr,
    status: 1,
    signal: null,
  };
}

// v26.53.0 — createMockAsset helper (tests/helpers/mock-asset.ts). category/source = placeholder.
const TEST_ASSETS: ExternalAsset[] = [
  createMockAsset({
    id: "skill-no-name",
    description: "skill without explicit name",
    condition: { kind: "any-track", tracks: ["tooling"] },
    method: { kind: "skill", source: "owner/repo" },
  }),
  createMockAsset({
    id: "skill-with-name",
    description: "skill with --skill flag",
    condition: { kind: "has-dev-track" },
    method: { kind: "skill", source: "owner/repo", skill: "react" },
  }),
  createMockAsset({
    id: "plugin-asset",
    description: "claude plugin",
    condition: { kind: "any-track", tracks: ["full"] },
    method: { kind: "plugin", marketplace: "ms/foo", pluginId: "foo@ms-foo" },
  }),
  createMockAsset({
    id: "npm-asset",
    description: "npm install -g",
    condition: { kind: "opt-in" },
    method: { kind: "npm", pkg: "vercel", version: "54.0.0" },
  }),
  createMockAsset({
    id: "npx-asset",
    description: "npx run",
    condition: { kind: "opt-in" },
    method: { kind: "npx-run", cmd: "get-shit-done-cc", version: "1.42.0" },
  }),
];

describe("runExternalInstall — method dispatch", () => {
  it("skill without --skill produces correct npx args", () => {
    const spawn = makeSpawnMock(() => ok());
    runExternalInstall(
      { tracks: ["tooling"], options: DEFAULT_OPTIONS, cli: ["claude"] },
      { spawn, assets: [TEST_ASSETS[0] as ExternalAsset] },
    );
    expect(spawn).toHaveBeenCalledTimes(1);
    expect(spawn.mock.calls[0]?.[0]).toBe("npx");
    expect(spawn.mock.calls[0]?.[1]).toEqual([
      "skills",
      "add",
      "owner/repo",
      "--agent",
      "claude-code",
      "--yes",
    ]);
  });

  it("threads projectDir into spawn cwd so assets land in the right project", () => {
    // 회귀 가드 (Bug B, 2026-06-07): cwd 미고정 시 npm(--save-dev)/npx-run/plugin/skill 이
    // process.cwd() 에 설치돼, --project-dir 가 cwd 와 다르면 자산이 엉뚱한 프로젝트(예: harness
    // repo)에 떨어진다. probe 가 repo 의 package.json/_bmad/.claude 를 오염시킨 근본 원인.
    const spawn = makeSpawnMock(() => ok());
    runExternalInstall(
      {
        tracks: ["tooling"],
        options: DEFAULT_OPTIONS,
        cli: ["claude"],
        projectDir: "/tmp/target-proj",
      },
      { spawn, assets: [TEST_ASSETS[0] as ExternalAsset] },
    );
    expect(spawn.mock.calls[0]?.[2]?.cwd).toBe("/tmp/target-proj");
  });

  it("skill with --skill includes --skill flag", () => {
    const spawn = makeSpawnMock(() => ok());
    runExternalInstall(
      { tracks: ["tooling"], options: DEFAULT_OPTIONS, cli: ["claude"] },
      { spawn, assets: [TEST_ASSETS[1] as ExternalAsset] },
    );
    expect(spawn.mock.calls[0]?.[1]).toEqual([
      "skills",
      "add",
      "owner/repo",
      "--skill",
      "react",
      "--agent",
      "claude-code",
      "--yes",
    ]);
  });

  // v26.39.5 — multi-CLI 콤마 구분 (사용자 보고 #3)
  // v26.39.6 — `claude` → `claude-code` 매핑 (skills CLI 1.5.5 valid name)
  // v26.55.1 — skills cli 1.5.7 부터 repeatable `--agent` 만 지원 (comma 폐지).
  //   "Invalid agents: claude-code,codex,opencode" exit 1 regression.
  it("skill with multi-CLI passes repeatable --agent (v26.55.1)", () => {
    const spawn = makeSpawnMock(() => ok());
    runExternalInstall(
      {
        tracks: ["tooling"],
        options: DEFAULT_OPTIONS,
        cli: ["claude", "codex", "opencode"],
      },
      { spawn, assets: [TEST_ASSETS[0] as ExternalAsset] },
    );
    expect(spawn.mock.calls[0]?.[1]).toEqual([
      "skills",
      "add",
      "owner/repo",
      "--agent",
      "claude-code",
      "--agent",
      "codex",
      "--agent",
      "opencode",
      "--yes",
    ]);
  });

  // v26.64.0 (ADR-020) — scope=project (default) 시 claude plugin --scope project, marketplace add --scope project.
  it("plugin invokes marketplace add --scope project + plugin install --scope project (scope=project default)", () => {
    const spawn = makeSpawnMock(() => ok());
    runExternalInstall(
      { tracks: ["full"], options: DEFAULT_OPTIONS, cli: ["claude"] },
      { spawn, assets: [TEST_ASSETS[2] as ExternalAsset] },
    );
    expect(spawn).toHaveBeenCalledTimes(2);
    expect(spawn.mock.calls[0]?.[1]).toEqual([
      "plugin",
      "marketplace",
      "add",
      "--scope",
      "project",
      "ms/foo",
    ]);
    expect(spawn.mock.calls[1]?.[1]).toEqual([
      "plugin",
      "install",
      "--scope",
      "project",
      "foo@ms-foo",
    ]);
  });

  // v26.64.0 (ADR-020) — scope=global (opt-in) 시 claude plugin --scope user.
  it("plugin invokes --scope user when scope=global (opt-in)", () => {
    const spawn = makeSpawnMock(() => ok());
    runExternalInstall(
      { tracks: ["full"], options: DEFAULT_OPTIONS, cli: ["claude"], scope: "global" },
      { spawn, assets: [TEST_ASSETS[2] as ExternalAsset] },
    );
    expect(spawn.mock.calls[0]?.[1]).toEqual([
      "plugin",
      "marketplace",
      "add",
      "--scope",
      "user",
      "ms/foo",
    ]);
    expect(spawn.mock.calls[1]?.[1]).toEqual([
      "plugin",
      "install",
      "--scope",
      "user",
      "foo@ms-foo",
    ]);
  });

  // v26.64.0 (ADR-020) — scope=project (default) → npm install --save-dev. -g 는 opt-in.
  it("npm-global produces npm install --save-dev <pkg> when scope=project (default)", () => {
    const spawn = makeSpawnMock(() => ok());
    runExternalInstall(
      {
        tracks: ["tooling"],
        options: DEFAULT_OPTIONS,
        cli: ["claude"],
        userOverride: { forceInclude: ["npm-asset"], forceExclude: [] },
      },
      { spawn, assets: [TEST_ASSETS[3] as ExternalAsset] },
    );
    expect(spawn.mock.calls[0]?.[0]).toBe("npm");
    // v26.80.0 — pinned 설치 (pkg@version). unpinned 는 vetting 시점과 다른 미래 코드 실행.
    expect(spawn.mock.calls[0]?.[1]).toEqual(["install", "--save-dev", "vercel@54.0.0"]);
  });

  it("npm-global produces npm install -g <pkg> when scope=global (opt-in)", () => {
    const spawn = makeSpawnMock(() => ok());
    runExternalInstall(
      {
        tracks: ["tooling"],
        options: DEFAULT_OPTIONS,
        cli: ["claude"],
        scope: "global",
        userOverride: { forceInclude: ["npm-asset"], forceExclude: [] },
      },
      { spawn, assets: [TEST_ASSETS[3] as ExternalAsset] },
    );
    expect(spawn.mock.calls[0]?.[0]).toBe("npm");
    expect(spawn.mock.calls[0]?.[1]).toEqual(["install", "-g", "vercel@54.0.0"]);
  });

  // v26.64.0 (ADR-020) — scope=global 시 skills add -g flag 추가.
  it("skill adds -g flag when scope=global (opt-in)", () => {
    const spawn = makeSpawnMock(() => ok());
    runExternalInstall(
      {
        tracks: ["tooling"],
        options: DEFAULT_OPTIONS,
        cli: ["claude"],
        scope: "global",
      },
      { spawn, assets: [TEST_ASSETS[0] as ExternalAsset] },
    );
    const args = spawn.mock.calls[0]?.[1] as readonly string[];
    expect(args).toContain("-g");
    expect(args[args.length - 1]).toBe("--yes");
  });

  it("npx-run produces npx <cmd>", () => {
    const spawn = makeSpawnMock(() => ok());
    runExternalInstall(
      {
        tracks: ["tooling"],
        options: DEFAULT_OPTIONS,
        cli: ["claude"],
        userOverride: { forceInclude: ["npx-asset"], forceExclude: [] },
      },
      { spawn, assets: [TEST_ASSETS[4] as ExternalAsset] },
    );
    expect(spawn.mock.calls[0]?.[0]).toBe("npx");
    expect(spawn.mock.calls[0]?.[1]).toEqual(["get-shit-done-cc@1.42.0"]);
  });
});

describe("runExternalInstall — failure modes", () => {
  it("warn-skip default reports failure but continues", () => {
    const spawn = makeSpawnMock(() => fail("registry down"));
    const warn = vi.fn();
    const report = runExternalInstall(
      {
        tracks: ["tooling"],
        options: DEFAULT_OPTIONS,
        userOverride: { forceInclude: ["npm-asset", "npx-asset"], forceExclude: [] },
        cli: ["claude"],
      },
      {
        spawn,
        warn,
        assets: [TEST_ASSETS[3] as ExternalAsset, TEST_ASSETS[4] as ExternalAsset],
      },
    );
    expect(report.succeeded).toBe(0);
    expect(report.skipped).toBe(2);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  // v26.79.0 — abort failureMode 메커니즘 제거 (사용 자산 0 + 렌더러 미참조).
  //   모든 실패는 warn-skip 로 수렴 (위 default 테스트가 보장). 이전의 "abort stops
  //   install" 테스트는 죽은 코드 검증이라 삭제.

  it("skips assets that don't match the spec (dispatch never called)", () => {
    const spawn = makeSpawnMock(() => ok());
    runExternalInstall(
      { tracks: ["executive"], options: DEFAULT_OPTIONS, cli: ["claude"] },
      { spawn, assets: [TEST_ASSETS[0] as ExternalAsset] }, // tooling-only
    );
    expect(spawn).not.toHaveBeenCalled();
  });
});

describe("formatSkippedReport", () => {
  it("returns empty string when nothing skipped", () => {
    expect(
      formatSkippedReport({
        attempted: [{ asset: TEST_ASSETS[0] as ExternalAsset, ok: true }],
        succeeded: 1,
        skipped: 0,
      }),
    ).toBe("");
  });

  it("lists failed asset ids + messages", () => {
    const text = formatSkippedReport({
      attempted: [
        { asset: TEST_ASSETS[0] as ExternalAsset, ok: true },
        { asset: TEST_ASSETS[3] as ExternalAsset, ok: false, message: "registry down" },
      ],
      succeeded: 1,
      skipped: 1,
    });
    expect(text).toContain("npm-asset");
    expect(text).toContain("registry down");
    expect(text).toContain("1개 외부 자산");
  });
});
