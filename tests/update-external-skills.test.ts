import type { SpawnSyncReturns } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createInstallRenderer } from "../src/commands/install-render.js";
import {
  type ExternalInstallerDeps,
  refreshExternalSkills,
  skillsCliSpec,
} from "../src/external-installer.js";
import { type InstallLog, writeInstallLog } from "../src/install-log.js";
import type { BaselineReport } from "../src/installer.js";
import type { InstallSpec } from "../src/types.js";
import { runUpdateMode, type UpdateModeReport } from "../src/update-mode.js";
import { createMockAsset } from "./helpers/mock-asset.js";

/**
 * #374 — `update` 가 외부 스킬을 상류 최신판으로 다시 받는다.
 *
 * **무엇이 깨져 있었나**: `update` 는 우리가 놓아둔 정책 파일과 우리가 렌더한 CLI 산출물만
 * 새로 썼고, `npx skills add` 로 깐 스킬 본문은 **한 번도 건드리지 않았다**(실측 2026-08-27,
 * npx 호출 추적: install 2회 · update 0회). 화면에는 `✓ external CLI artifacts` 가 떠서 다
 * 갱신된 것처럼 보였다.
 *
 * **왜 `skills update` 가 아닌가**: 그 서브명령은 `--copy` 도 `--agent` 도 받지 않아서
 * `.claude/skills/<id>` 를 `.agents/` 로의 **심링크로 강등**하고, 고른 적 없는 `.agents/` 를
 * 만든다(실측). `foreign-slot.ts` 가 디렉터리 아닌 슬롯을 "남의 것"으로 판정하므로(#343)
 * 그 뒤로 우리 최신본이 영영 그 자리에 안 들어간다 — 독립 리뷰가 CRITICAL 로 잡았다.
 * 그래서 **install 과 같은 호출**을 다시 돌린다.
 *
 * 여기서 무는 것은 **호출 형태·대상 선정·실패 처리·화면**이다. 디스크 결과(사본이 디렉터리로
 * 남는가)는 컨테이너에서만 볼 수 있고 그쪽은 docker 시나리오가 소유한다.
 */

type SpawnFn = NonNullable<ExternalInstallerDeps["spawn"]>;

function okSpawn(): SpawnSyncReturns<string> {
  return { pid: 0, output: [], stdout: "", stderr: "", status: 0, signal: null };
}

function makeSpawn(): SpawnFn & { mock: { calls: Array<Parameters<SpawnFn>> } } {
  return vi.fn(okSpawn) as unknown as SpawnFn & { mock: { calls: Array<Parameters<SpawnFn>> } };
}

const npxArgs = (spawn: ReturnType<typeof makeSpawn>): string[][] =>
  spawn.mock.calls.filter((c) => c[0] === "npx").map((c) => [...(c[1] as string[])]);

/** 카탈로그를 흉내 낸다 — 실 자산 id 를 박으면 카탈로그가 바뀔 때 조용히 아무것도 안 문다. */
const SKILL_A = createMockAsset({
  id: "skill-a",
  condition: { kind: "any-track", tracks: ["tooling"] },
  method: { kind: "skill", source: "owner/a", skill: "a" },
});
/** 트랙 조건에 **안 맞는** 자산 — opt-in 으로 깔린 것을 흉내 낸다. */
const SKILL_OPT_IN = createMockAsset({
  id: "skill-opt-in",
  condition: { kind: "any-track", tracks: ["executive"] },
  method: { kind: "skill", source: "owner/b", skill: "b" },
});
const PLUGIN_ASSET = createMockAsset({
  id: "plugin-x",
  condition: { kind: "any-track", tracks: ["tooling"] },
  method: { kind: "plugin", marketplace: "m", pluginId: "p" },
});
const CATALOG = [SKILL_A, SKILL_OPT_IN, PLUGIN_ASSET];

function fakeLog(assetIds: Array<{ id: string; method: string }>): InstallLog {
  return {
    schemaVersion: 1,
    installedAt: "2026-08-27T00:00:00.000Z",
    scope: "project",
    spec: { tracks: ["tooling"], cli: ["claude", "codex"] },
    templates: { claudeDir: ".claude" },
    assets: assetIds.map((a) => ({
      id: a.id,
      category: "dev",
      method: a.method as never,
      scope: "project" as const,
      detail: {},
    })),
  };
}

const dirs: string[] = [];
function tmpProject(): string {
  const d = mkdtempSync(join(tmpdir(), "uzys-374-"));
  dirs.push(d);
  return d;
}
afterEach(() => {
  while (dirs.length > 0) rmSync(dirs.pop() as string, { recursive: true, force: true });
});

describe("refreshExternalSkills — 무엇을, 어떤 명령으로 다시 받는가", () => {
  it("설치 기록이 없으면 **판정 불가**로 낸다 — 조용한 무동작과 구분한다", () => {
    const spawn = makeSpawn();
    const r = refreshExternalSkills(tmpProject(), { spawn, assets: CATALOG, readLog: () => null });
    expect(r.unknown).toBe(true);
    expect(r.attempted).toBe(0);
    expect(spawn).not.toHaveBeenCalled();
  });

  it("기록에 외부 스킬이 없으면 아무것도 부르지 않는다 (판정 불가와 다르다)", () => {
    const spawn = makeSpawn();
    const r = refreshExternalSkills(tmpProject(), {
      spawn,
      assets: CATALOG,
      readLog: () => fakeLog([{ id: "plugin-x", method: "plugin" }]),
    });
    expect(r).toMatchObject({ attempted: 0, refreshed: 0, unknown: false });
    expect(spawn).not.toHaveBeenCalled();
  });

  it("`skills update` 를 부르지 않는다 — 그 명령은 사본을 심링크로 강등한다", () => {
    const spawn = makeSpawn();
    refreshExternalSkills(tmpProject(), {
      spawn,
      assets: CATALOG,
      log: () => {},
      readLog: () => fakeLog([{ id: "skill-a", method: "skill" }]),
    });
    const args = npxArgs(spawn);
    expect(args).toHaveLength(1);
    expect(args[0], "update 서브명령을 쓰면 --copy 계약이 깨진다").not.toContain("update");
    expect(args[0]?.[1]).toBe("add");
  });

  it("install 과 같은 인자로 부른다 — 고정 버전 · 에이전트별 · `--copy`", () => {
    const spawn = makeSpawn();
    refreshExternalSkills(tmpProject(), {
      spawn,
      assets: CATALOG,
      log: () => {},
      readLog: () => fakeLog([{ id: "skill-a", method: "skill" }]),
    });
    const args = npxArgs(spawn)[0] as string[];
    expect(args[0]).toBe(skillsCliSpec());
    // #372 계약: --copy 가 없으면 `.claude/skills/` 몫이 조용히 빠진다.
    expect(args, "--copy 누락 — Claude Code 몫이 조용히 빠진다").toContain("--copy");
    const agents = args.flatMap((a, i) => (a === "--agent" ? [args[i + 1] as string] : []));
    expect([...agents].sort()).toEqual(["claude-code", "codex"]);
  });

  it("기록에 있으면 트랙 조건에 안 맞아도 다시 받는다 (opt-in 으로 깐 자산)", () => {
    const spawn = makeSpawn();
    const r = refreshExternalSkills(tmpProject(), {
      spawn,
      assets: CATALOG,
      log: () => {},
      // tracks 는 tooling 인데 이 자산의 조건은 executive 다.
      readLog: () => fakeLog([{ id: "skill-opt-in", method: "skill" }]),
    });
    expect(r.attempted, "조건 재유도로 거르면 opt-in 자산이 조용히 낡는다").toBe(1);
    expect(r.refreshed).toBe(1);
  });

  it("기록에 없는 자산을 새로 깔지 않는다", () => {
    const spawn = makeSpawn();
    const r = refreshExternalSkills(tmpProject(), {
      spawn,
      assets: CATALOG,
      log: () => {},
      readLog: () => fakeLog([{ id: "skill-a", method: "skill" }]),
    });
    expect(r.attempted).toBe(1);
    expect(npxArgs(spawn)[0]).toContain("owner/a");
  });

  it("실패는 자산 이름과 함께 보고되고 예외를 던지지 않는다", () => {
    const spawn = vi.fn(() => ({
      pid: 0,
      output: [],
      stdout: "",
      stderr: "network unreachable",
      status: 1,
      signal: null,
    })) as unknown as SpawnFn;
    const r = refreshExternalSkills(tmpProject(), {
      spawn,
      assets: CATALOG,
      log: () => {},
      warn: () => {},
      readLog: () => fakeLog([{ id: "skill-a", method: "skill" }]),
    });
    expect(r.refreshed).toBe(0);
    expect(r.failed).toHaveLength(1);
    expect(r.failed[0]?.id).toBe("skill-a");
    expect(r.failed[0]?.message).toContain("network unreachable");
  });

  it("디스크의 실 설치 기록을 읽는다 (주입 없이)", () => {
    const dir = tmpProject();
    writeInstallLog(dir, fakeLog([{ id: "skill-a", method: "skill" }]));
    const spawn = makeSpawn();
    const r = refreshExternalSkills(dir, { spawn, assets: CATALOG, log: () => {} });
    expect(r.unknown).toBe(false);
    expect(r.attempted).toBe(1);
  });
});

describe("runUpdateMode 배선 — 갱신이 실제로 update 안에서 일어난다", () => {
  const templatesDir = join(__dirname, "..", "templates");
  const harnessRoot = join(__dirname, "..");

  function installedProject(): string {
    const d = tmpProject();
    mkdirSync(join(d, ".claude", "rules"), { recursive: true });
    writeFileSync(join(d, ".claude", "rules", "git-policy.md"), "old\n");
    return d;
  }

  it("update 가 외부 스킬 갱신을 **부른다** — 이 배선이 없던 것이 결함이었다", () => {
    const dir = installedProject();
    const refreshSkills = vi.fn(() => ({
      attempted: 2,
      refreshed: 2,
      failed: [],
      unknown: false,
    }));
    const report = runUpdateMode(dir, templatesDir, harnessRoot, { refreshSkills });
    expect(refreshSkills).toHaveBeenCalledWith(dir);
    expect(report.externalSkillsRefreshed).toBe(2);
    expect(report.externalSkillsFailed).toEqual([]);
    expect(report.externalSkillsUnknown).toBe(false);
  });

  it("갱신이 실패해도 update 는 정책 파일 갱신을 끝낸다", () => {
    const dir = installedProject();
    const report = runUpdateMode(dir, templatesDir, harnessRoot, {
      refreshSkills: () => ({
        attempted: 1,
        refreshed: 0,
        failed: [{ id: "skill-a", message: "npx exited 1" }],
        unknown: false,
      }),
    });
    expect(report.externalSkillsRefreshed).toBe(0);
    expect(report.externalSkillsFailed).toHaveLength(1);
    // 정책 갱신이 실제로 일어났다 — 네트워크 하나 때문에 전부 잃지 않는다.
    expect(Object.values(report.updated).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
  });

  it("판정 불가는 그대로 보고에 실린다", () => {
    const dir = installedProject();
    const report = runUpdateMode(dir, templatesDir, harnessRoot, {
      refreshSkills: () => ({ attempted: 0, refreshed: 0, failed: [], unknown: true }),
    });
    expect(report.externalSkillsUnknown).toBe(true);
  });
});

describe("화면 — 외부 스킬은 외부 CLI 산출물과 다른 행이다", () => {
  const spec: InstallSpec = {
    tracks: ["tooling"],
    options: { withPrune: false, withCodexTrust: false },
    cli: ["claude"],
    projectDir: "/p",
  };

  const updateMode: UpdateModeReport = {
    updated: {},
    pruned: {},
    staleHookRefs: [],
    claudeMdUpdated: false,
    anchorCreated: false,
    rootImportAdded: false,
    legacyAnchor: null,
    skillsBackedUp: [],
    skillsSkippedLinks: [],
    policyBackedUp: [],
    externalUpdated: 0,
    externalBackedUp: [],
    foreignOwned: [],
    installedNew: [],
    restored: [],
    needsReinstall: [],
    mcpAllowlistRetired: null,
    externalSkillsRefreshed: 0,
    externalSkillsFailed: [],
    externalSkillsUnknown: false,
  };

  const baseline = (over: Partial<UpdateModeReport>): BaselineReport => ({
    filesCopied: 0,
    dirsCopied: 0,
    skipped: 0,
    backup: null,
    installedTracks: ["tooling"],
    mcpServers: [],
    codex: null,
    codexOptIn: null,
    opencode: null,
    antigravity: null,
    updateMode: { ...updateMode, ...over },
    mode: "update",
    envFiles: {
      envExampleCreated: false,
      gitignoreEnvAdded: false,
      gitignoreNpxSkillsAdded: [],
    },
    ciScaffold: null,
    rootClaudeMd: null,
    baselineExcluded: [],
    baselineExcludedOnDisk: [],
    baselineForeignOwned: [],
    superseded: { removed: [], kept: [] },
  });

  const lines = (over: Partial<UpdateModeReport>): string => {
    const out: string[] = [];
    const r = createInstallRenderer((m) => out.push(m), spec, false);
    r.callbacks.onProgress?.({ type: "baseline-complete", baseline: baseline(over) });
    return out.join("\n");
  };

  it("갱신했으면 몇 개인지 화면에 뜬다", () => {
    const out = lines({ externalSkillsRefreshed: 3 });
    expect(out).toMatch(/external skills/);
    expect(out).toContain("3 refreshed");
  });

  it("실패했으면 자산 이름과 사유가 뜬다 — 조용한 실패가 이 결함의 정체였다", () => {
    const out = lines({
      externalSkillsFailed: [{ id: "skill-a", message: "npx exited 1: offline" }],
    });
    expect(out).toMatch(/external skills/);
    expect(out).toContain("skill-a");
    expect(out).toContain("offline");
  });

  it("판정 불가는 침묵하지 않는다 — '갱신할 게 없다'와 다른 사실이다", () => {
    const out = lines({ externalSkillsUnknown: true });
    expect(out).toMatch(/external skills/);
    expect(out).toMatch(/판정할 수 없다/);
  });

  it("대상이 없으면 아무 말도 하지 않는다 (없는 일을 했다고 하지 않는다)", () => {
    expect(lines({})).not.toMatch(/external skills/);
  });

  it("외부 CLI 산출물 행이 외부 스킬을 대신 말하지 않는다", () => {
    // 이 결함의 사용자 증상: `external CLI artifacts` 한 줄을 보고 스킬도 됐다고 읽었다.
    const out = lines({ externalUpdated: 3 });
    expect(out).toMatch(/external CLI artifacts/);
    expect(out).not.toMatch(/external skills/);
  });
});
