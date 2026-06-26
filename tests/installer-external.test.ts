import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExternalInstallReport } from "../src/external-installer.js";
import { type InstallContext, runInstall } from "../src/installer.js";
import type { InstallSpec, OptionFlags, Track } from "../src/types.js";

type RunExternalFn = NonNullable<InstallContext["runExternal"]>;
function makeMock(fn: RunExternalFn): RunExternalFn & {
  mock: { calls: Array<Parameters<RunExternalFn>> };
} {
  return vi.fn(fn) as unknown as RunExternalFn & {
    mock: { calls: Array<Parameters<RunExternalFn>> };
  };
}

const HARNESS_ROOT = resolve(__dirname, "..");

const NO_OPTS: OptionFlags = {
  withPrune: false,
  withCodexTrust: false,
  withKarpathyHook: false,
};

function spec(tracks: Track[], options: Partial<OptionFlags>, projectDir: string): InstallSpec {
  return {
    tracks,
    options: { ...NO_OPTS, ...options },
    cli: ["claude"],
    projectDir,
  };
}

const EMPTY_REPORT: ExternalInstallReport = {
  attempted: [],
  succeeded: 0,
  skipped: 0,
};

describe("runInstall — external assets integration", () => {
  let projectDir: string;

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "ch-ext-"));
  });

  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  it("calls runExternal with spec.tracks + options when not disabled", () => {
    const runExternal = makeMock(() => EMPTY_REPORT);
    runInstall({
      runExternal,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: {
        ...spec(["tooling"], { withPrune: true }, projectDir),
        userOverride: { forceInclude: ["ecc-plugin"], forceExclude: [] },
      },
    });
    expect(runExternal).toHaveBeenCalledOnce();
    const [ctx] = runExternal.mock.calls[0] ?? [];
    expect(ctx?.tracks).toEqual(["tooling"]);
    expect(ctx?.options.withPrune).toBe(true);
    // v26.81.0 (ADR-022) — 자산 선택은 userOverride 로 전파.
    expect(ctx?.userOverride?.forceInclude).toEqual(["ecc-plugin"]);
    // Bug B (2026-06-07): 외부 설치기가 올바른 프로젝트에 착지하도록 projectDir 가 전달돼야 함.
    expect(ctx?.projectDir).toBe(projectDir);
  });

  it("skips external install when runExternal=null (test mode)", () => {
    const report = runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: spec(["tooling"], {}, projectDir),
    });
    expect(report.external).toBeNull();
  });

  it("attaches external report to InstallReport when runExternal returns one", () => {
    // Mock ExternalAsset — category/source placeholders (type compat only).
    const fakeExternal: ExternalInstallReport = {
      attempted: [
        {
          asset: {
            id: "test-skill",
            description: "test",
            category: "dev-tools",
            source: "uzys",
            tier: "vetted",
            condition: { kind: "any-track", tracks: ["tooling"] },
            method: { kind: "skill", source: "owner/repo" },
          },
          ok: true,
        },
      ],
      succeeded: 1,
      skipped: 0,
    };
    const report = runInstall({
      runExternal: () => fakeExternal,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: spec(["tooling"], {}, projectDir),
    });
    expect(report.external).toBe(fakeExternal);
    expect(report.external?.attempted[0]?.asset.id).toBe("test-skill");
  });

  // v26.81.0 (ADR-022) — 자산 opt-in 전파는 flag 가 아니라 userOverride(--with <id>).
  //   WHY: ctx 에 forceInclude 가 안 실리면 외부 설치기가 opt-in 자산을 설치하지 못한다.
  it("propagates --with <id> (userOverride) through to external installer ctx", () => {
    const runExternal = makeMock(() => EMPTY_REPORT);
    runInstall({
      runExternal,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: {
        ...spec(["csr-fastapi"], {}, projectDir),
        userOverride: {
          forceInclude: ["trailofbits-skills", "gsd-orchestrator"],
          forceExclude: ["netlify-cli"],
        },
      },
    });
    const ctx = runExternal.mock.calls[0]?.[0];
    expect(ctx?.userOverride?.forceInclude).toEqual(["trailofbits-skills", "gsd-orchestrator"]);
    expect(ctx?.userOverride?.forceExclude).toEqual(["netlify-cli"]);
  });
});

describe("runInstall — mode dispatch", () => {
  let projectDir: string;
  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "ch-mode-"));
  });
  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  it("mode=update returns updateMode report + skips manifest copy + auto-backup", async () => {
    // 첫 install로 .claude/ 만들기
    runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: spec(["tooling"], {}, projectDir),
    });
    // 두 번째: mode=update
    const report = runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: spec(["tooling"], {}, projectDir),
      mode: "update",
    });
    expect(report.mode).toBe("update");
    expect(report.updateMode).not.toBeNull();
    expect(report.backup).toMatch(/\.claude\.backup-/);
    expect(report.filesCopied).toBe(0); // manifest copy skipped
    expect(report.envFiles.envExampleCreated).toBe(false);
  });

  it("mode=update without existing .claude/ throws", () => {
    expect(() =>
      runInstall({
        runExternal: null,
        harnessRoot: HARNESS_ROOT,
        projectDir,
        spec: spec(["tooling"], {}, projectDir),
        mode: "update",
      }),
    ).toThrow(/Update mode requires existing/);
  });

  it("mode=reinstall auto-creates backup", () => {
    // baseline install
    runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: spec(["tooling"], {}, projectDir),
    });
    const report = runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: spec(["tooling"], {}, projectDir),
      mode: "reinstall",
    });
    expect(report.mode).toBe("reinstall");
    expect(report.backup).toMatch(/\.claude\.backup-/);
  });

  it("mode=add does NOT create backup", () => {
    runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: spec(["tooling"], {}, projectDir),
    });
    const report = runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: spec(["tooling"], {}, projectDir),
      mode: "add",
    });
    expect(report.mode).toBe("add");
    expect(report.backup).toBeNull();
  });

  it("default mode=fresh does NOT create backup", () => {
    const report = runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: spec(["tooling"], {}, projectDir),
    });
    expect(report.mode).toBe("fresh");
    expect(report.backup).toBeNull();
  });
});
