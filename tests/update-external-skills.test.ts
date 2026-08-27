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
import type { BaselineReport } from "../src/installer.js";
import type { InstallSpec } from "../src/types.js";
import { runUpdateMode, type UpdateModeReport } from "../src/update-mode.js";

/**
 * #374 — `update` 가 외부 스킬을 갱신한다.
 *
 * **무엇이 깨져 있었나**: `update` 는 우리가 렌더한 CLI 산출물만 새로 썼고, `npx skills add`
 * 로 깐 스킬 본문은 **한 번도 건드리지 않았다**(실측 2026-08-27, npx shim 호출 추적:
 * install 2회 · update 0회). 그런데 화면에는 `✓ external CLI artifacts` 가 떠서 다 갱신된
 * 것처럼 보였다 — 상류가 스킬을 고쳐도 못 받고, 못 받는다는 사실도 알 수 없었다.
 *
 * 여기서 무는 것은 **호출 형태·발화 조건·실패 처리·화면**이다. 디스크 결과(두 사본이 실제로
 * 되돌아오는가)는 컨테이너에서만 볼 수 있고 그쪽은 docker 시나리오가 소유한다 —
 * 호스트에서 실 CLI 를 돌리는 것은 훅이 차단한다.
 */

type SpawnFn = NonNullable<ExternalInstallerDeps["spawn"]>;

function okSpawn(): SpawnSyncReturns<string> {
  return { pid: 0, output: [], stdout: "", stderr: "", status: 0, signal: null };
}

const dirs: string[] = [];
function projectWith(lock: boolean): string {
  const d = mkdtempSync(join(tmpdir(), "uzys-374-"));
  dirs.push(d);
  if (lock) {
    writeFileSync(join(d, "skills-lock.json"), '{"version":1,"skills":{}}');
  }
  return d;
}

afterEach(() => {
  while (dirs.length > 0) {
    rmSync(dirs.pop() as string, { recursive: true, force: true });
  }
});

describe("refreshExternalSkills — 호출 형태와 발화 조건", () => {
  it("skills-lock.json 이 없으면 아예 부르지 않는다 (없는 대상에 네트워크를 태우지 않는다)", () => {
    const spawn = vi.fn(okSpawn) as unknown as SpawnFn;
    const r = refreshExternalSkills(projectWith(false), { spawn });
    expect(r).toEqual({ ran: false, failure: null });
    expect(spawn).not.toHaveBeenCalled();
  });

  it("잠금 파일이 있으면 고정 버전으로 `update -p -y` 를 프로젝트 디렉터리에서 부른다", () => {
    const spawn = vi.fn(okSpawn) as unknown as SpawnFn & {
      mock: { calls: Array<Parameters<SpawnFn>> };
    };
    const dir = projectWith(true);
    const r = refreshExternalSkills(dir, { spawn });
    expect(r).toEqual({ ran: true, failure: null });

    const calls = (spawn as unknown as { mock: { calls: Array<Parameters<SpawnFn>> } }).mock.calls;
    expect(calls).toHaveLength(1);
    const [cmd, rawArgs, opts] = calls[0] as [string, ReadonlyArray<string>, { cwd?: string }];
    const args = [...rawArgs];
    expect(cmd).toBe("npx");
    // 버전을 고정한다 — `skills@latest` 는 node 20 에서 EBADENGINE 이다(1.5.23 실측).
    expect(args[0]).toBe(skillsCliSpec());
    expect(args.slice(1)).toEqual(["update", "-p", "-y"]);
    // cwd 가 프로젝트가 아니면 남의 디렉터리 잠금 파일을 갱신한다.
    expect(opts.cwd).toBe(dir);
  });

  it("`-g` 를 붙이지 않는다 — 사용자의 글로벌 스킬은 이 명령의 대상이 아니다", () => {
    const spawn = vi.fn(okSpawn) as unknown as SpawnFn;
    refreshExternalSkills(projectWith(true), { spawn });
    const calls = (spawn as unknown as { mock: { calls: Array<Parameters<SpawnFn>> } }).mock.calls;
    expect(calls[0]?.[1]).not.toContain("-g");
  });

  it("비정상 종료는 사유를 담아 실패로 낸다 (침묵 금지)", () => {
    const spawn = vi.fn(() => ({
      pid: 0,
      output: [],
      stdout: "",
      stderr: "network unreachable",
      status: 1,
      signal: null,
    })) as unknown as SpawnFn;
    const r = refreshExternalSkills(projectWith(true), { spawn });
    expect(r.ran).toBe(true);
    expect(r.failure).toContain("network unreachable");
  });

  it("spawn 자체가 실패해도 예외를 던지지 않는다", () => {
    const spawn = vi.fn(() => ({
      pid: 0,
      output: [],
      stdout: "",
      stderr: "",
      status: null,
      signal: null,
      error: new Error("spawn npx ENOENT"),
    })) as unknown as SpawnFn;
    const r = refreshExternalSkills(projectWith(true), { spawn });
    expect(r).toEqual({ ran: true, failure: "spawn npx ENOENT" });
  });
});

describe("runUpdateMode 배선 — 갱신이 실제로 update 안에서 일어난다", () => {
  const templatesDir = join(__dirname, "..", "templates");
  const harnessRoot = join(__dirname, "..");

  function installedProject(): string {
    const d = projectWith(false);
    mkdirSync(join(d, ".claude", "rules"), { recursive: true });
    writeFileSync(join(d, ".claude", "rules", "git-policy.md"), "old\n");
    return d;
  }

  it("update 가 외부 스킬 갱신을 **부른다** — 이 배선이 없던 것이 결함이었다", () => {
    const dir = installedProject();
    const refreshSkills = vi.fn(() => ({ ran: true, failure: null }));
    const report = runUpdateMode(dir, templatesDir, harnessRoot, { refreshSkills });
    expect(refreshSkills).toHaveBeenCalledWith(dir);
    expect(report.externalSkillsRefreshed).toBe(true);
    expect(report.externalSkillsFailed).toBeNull();
  });

  it("갱신이 실패해도 update 는 정책 파일 갱신을 끝낸다", () => {
    const dir = installedProject();
    const report = runUpdateMode(dir, templatesDir, harnessRoot, {
      refreshSkills: () => ({ ran: true, failure: "npx exited 1" }),
    });
    expect(report.externalSkillsRefreshed).toBe(false);
    expect(report.externalSkillsFailed).toBe("npx exited 1");
    // 정책 갱신이 실제로 일어났다 — 네트워크 하나 때문에 전부 잃지 않는다.
    expect(Object.values(report.updated).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
  });

  it("대상이 없으면 갱신했다고 말하지 않는다", () => {
    const dir = installedProject();
    const report = runUpdateMode(dir, templatesDir, harnessRoot, {
      refreshSkills: () => ({ ran: false, failure: null }),
    });
    expect(report.externalSkillsRefreshed).toBe(false);
    expect(report.externalSkillsFailed).toBeNull();
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
    externalSkillsRefreshed: false,
    externalSkillsFailed: null,
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

  it("갱신했으면 그 사실이 화면에 뜬다", () => {
    expect(lines({ externalSkillsRefreshed: true })).toMatch(/external skills/);
  });

  it("실패했으면 사유와 함께 뜬다 — 조용한 실패가 이 결함의 정체였다", () => {
    const out = lines({ externalSkillsFailed: "npx exited 1: offline" });
    expect(out).toMatch(/external skills/);
    expect(out).toContain("offline");
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
