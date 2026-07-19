import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EXTERNAL_ASSETS } from "../src/external-assets.js";
import { type ExternalInstallReport, selectExternalTargets } from "../src/external-installer.js";
import { readInstallLog } from "../src/install-log.js";
import { type InstallContext, runInstall } from "../src/installer.js";
import type { CliTargets, InstallSpec, OptionFlags, Track } from "../src/types.js";

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
  excludedByCli: [],
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

  it("external-start 헤더 카운트가 실 시도 대상 수와 일치하고 CLI 필터가 관통한다 (SOD F1)", () => {
    // WHY: 이전 헤더 카운트는 internal 자산을 포함해 dev 트랙 전부에서 과대였고
    // ("External assets (13)" 표기 후 5행 스트리밍), 그 값을 검증하는 테스트가 0건이라
    // mock 이 값을 날조하는 경로만 존재했다. 실 runExternalPhase 를 태워 실측한다.
    const capture = (cli: CliTargets): number => {
      let announced = -1;
      runInstall({
        runExternal: makeMock(() => EMPTY_REPORT),
        harnessRoot: HARNESS_ROOT,
        projectDir,
        spec: { ...spec(["tooling"], {}, projectDir), cli },
        onProgress: (e) => {
          if (e.type === "external-start") announced = e.assetCount;
        },
      });
      return announced;
    };
    const claudeCount = capture(["claude"]);
    const codexCount = capture(["codex"]);
    const expectedCodex = selectExternalTargets(EXTERNAL_ASSETS, {
      tracks: ["tooling"],
      options: NO_OPTS,
      cli: ["codex"],
    }).targets.length;
    expect(codexCount).toBe(expectedCodex);
    // CLI 필터가 실 경로를 관통한다는 직접 증거 — tooling 트랙엔 claude 전용 plugin 이 있다.
    expect(codexCount).toBeLessThan(claudeCount);
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
      excludedByCli: [],
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
          forceInclude: ["trailofbits-skills", "addy-agent-skills"],
          forceExclude: ["netlify-cli"],
        },
      },
    });
    const ctx = runExternal.mock.calls[0]?.[0];
    expect(ctx?.userOverride?.forceInclude).toEqual(["trailofbits-skills", "addy-agent-skills"]);
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

  /**
   * v26.123.0 (F-1a) 회귀 — 추가 설치가 이전 설치 기록을 지우던 결함.
   * install 은 이전 자산을 제거하지 않는데 로그만 덮어썼으므로, `install --with <id>` 한 번에
   * 1회차 자산이 기록에서 사라지고 uninstall 이 그걸 못 찾아 프로젝트에 남겼다.
   */
  it("추가 설치 후에도 1회차 자산이 install log 에 남는다 (uninstall 의 유일한 source)", () => {
    const installWith = (id: string): void => {
      runInstall({
        runExternal: makeMock(() => ({
          attempted: [
            {
              asset: {
                id,
                description: id,
                category: "dev-tools",
                source: "uzys",
                tier: "vetted",
                condition: { kind: "any-track", tracks: ["tooling"] },
                method: { kind: "plugin", marketplace: "mp", pluginId: `${id}@mp` },
              },
              ok: true,
            },
          ],
          succeeded: 1,
          skipped: 0,
          excludedByCli: [],
        })),
        harnessRoot: HARNESS_ROOT,
        projectDir,
        spec: spec(["tooling"], {}, projectDir),
        mode: "add",
      });
    };

    installWith("first-asset");
    installWith("second-asset");

    const log = readInstallLog(projectDir);
    expect(log?.assets.map((a) => a.id)).toEqual(["first-asset", "second-asset"]);
  });

  /**
   * reinstall 은 `.claude/` 를 backup 으로 rename 한다. 그래서 이전 자산 중
   * **`.claude/` 밖에 사는 것만** 기록에 남아야 맞다 — 안쪽에 살던 건 실제로 사라졌으므로
   * 남기면 "있지도 않은 걸 있다고" 기록하게 된다(F-1a 를 반대 방향으로 재현).
   */
  const withAsset = (id: string, method: "plugin" | "skill"): RunExternalFn =>
    makeMock(() => ({
      attempted: [
        {
          asset: {
            id,
            description: id,
            category: "dev-tools",
            source: "uzys",
            tier: "vetted",
            condition: { kind: "any-track", tracks: ["tooling"] },
            method:
              method === "plugin"
                ? { kind: "plugin", marketplace: "mp", pluginId: `${id}@mp` }
                : { kind: "skill", source: `owner/${id}` },
          },
          ok: true,
        },
      ],
      succeeded: 1,
      skipped: 0,
      excludedByCli: [],
    }));

  it("reinstall 후에도 `.claude/` 밖 자산(plugin)의 기록은 살아남는다", () => {
    // plugin 은 ~/.claude/plugins/ 에 살아서 프로젝트 `.claude/` rename 과 무관하다.
    // 기존 로그를 backup **전에** 읽지 않으면 이것마저 사라진다.
    runInstall({
      runExternal: withAsset("before-reinstall", "plugin"),
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: spec(["tooling"], {}, projectDir),
    });
    runInstall({
      runExternal: withAsset("after-reinstall", "plugin"),
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: spec(["tooling"], {}, projectDir),
      mode: "reinstall",
    });

    const log = readInstallLog(projectDir);
    expect(log?.assets.map((a) => a.id)).toEqual(["before-reinstall", "after-reinstall"]);
  });

  it("reinstall 은 `.claude/skills/` 에 살던 skill 자산 기록을 버린다 (실제로 사라졌으므로)", () => {
    // `npx skills add` project scope = `.claude/skills/` → rename 과 함께 소멸.
    // 남겨두면 list 가 과대보고하고 uninstall 이 없는 걸 지우려 든다.
    runInstall({
      runExternal: withAsset("old-skill", "skill"),
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: spec(["tooling"], {}, projectDir),
    });
    runInstall({
      runExternal: withAsset("new-skill", "skill"),
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: spec(["tooling"], {}, projectDir),
      mode: "reinstall",
    });

    expect(readInstallLog(projectDir)?.assets.map((a) => a.id)).toEqual(["new-skill"]);
  });

  it("backup 없는 추가 설치(add)에서는 skill 자산도 그대로 유지된다", () => {
    // 경계 확인 — 버리는 기준은 method 가 아니라 `.claude/` 를 밀어냈는가다.
    runInstall({
      runExternal: withAsset("skill-one", "skill"),
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: spec(["tooling"], {}, projectDir),
    });
    runInstall({
      runExternal: withAsset("skill-two", "skill"),
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: spec(["tooling"], {}, projectDir),
      mode: "add",
    });

    expect(readInstallLog(projectDir)?.assets.map((a) => a.id)).toEqual(["skill-one", "skill-two"]);
  });
});
