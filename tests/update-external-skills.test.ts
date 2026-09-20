import type { SpawnSyncReturns } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createInstallRenderer } from "../src/commands/install-render.js";
import { RENAMED_SKILL_IDS, RETIRED_SKILL_IDS } from "../src/external-assets.js";
import {
  type ExternalInstallerDeps,
  refreshExternalSkills,
  skillsCliSpec,
} from "../src/external-installer.js";
import { type InstallLog, writeInstallLog } from "../src/install-log.js";
import type { BaselineReport } from "../src/installer.js";
import { RETIRED_AGENT_IDS, RETIRED_AGENTS, TRACK_AGENTS } from "../src/manifest.js";
import type { InstallSpec } from "../src/types.js";
import { buildUpdateSpec, runUpdateMode, type UpdateModeReport } from "../src/update-mode.js";
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
 * `.claude/skills/<id>` 를 `.agents/` 로의 **심링크로 강등**하고, **고른 적 없는 `.agents/`
 * 트리를 만든다**(실측). 사용자가 그 정체 모를 디렉터리를 지우면 스킬 본문이 사라진다.
 * 독립 리뷰가 CRITICAL 로 잡았다. 그래서 **install 과 같은 호출**을 다시 돌린다.
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

  it("기록에 있는데 카탈로그에서 사라진 자산은 **이름을 낸다** — 조용히 빼지 않는다", () => {
    // 이 저장소는 실제로 자산을 지운 적이 있다(`north-star-skill`). 그 릴리즈 뒤 옛 설치본이
    // update 를 돌면 여기다. 침묵하면 사용자는 일부만 갱신된 것을 모른다.
    const spawn = makeSpawn();
    const r = refreshExternalSkills(tmpProject(), {
      spawn,
      assets: CATALOG,
      log: () => {},
      readLog: () =>
        fakeLog([
          { id: "skill-a", method: "skill" },
          { id: "ghost-removed-from-catalog", method: "skill" },
        ]),
    });
    expect(r.attempted).toBe(1);
    expect(r.notInCatalog).toEqual(["ghost-removed-from-catalog"]);
  });

  it("카탈로그 밖 자산만 있으면 갱신은 0 이고 그래도 이름을 낸다", () => {
    const spawn = makeSpawn();
    const r = refreshExternalSkills(tmpProject(), {
      spawn,
      assets: CATALOG,
      readLog: () => fakeLog([{ id: "ghost-removed-from-catalog", method: "skill" }]),
    });
    expect(r.attempted).toBe(0);
    expect(r.unknown, "판정 불가가 아니다 — 무엇이 빠졌는지 안다").toBe(false);
    expect(r.notInCatalog).toEqual(["ghost-removed-from-catalog"]);
    expect(spawn).not.toHaveBeenCalled();
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
      notInCatalog: [],
      unknown: false,
    }));
    const report = runUpdateMode(dir, templatesDir, harnessRoot, { refreshSkills });
    expect(refreshSkills).toHaveBeenCalledWith(dir);
    expect(report.externalSkillsRefreshed).toBe(2);
    expect(report.externalSkillsFailed).toEqual([]);
    expect(report.externalSkillsUnknown).toBe(false);
  });

  it("디스크에 남은 개명·은퇴 스킬 디렉터리가 안내 대상에 오른다 — 설치자가 update 때 그 문구를 본다 (ADR-088)", () => {
    // 외부(npx) 스킬 갱신은 번들 스킬 id 를 모른다 — 개명·은퇴 안내가 실제로 뜨는 유일한 경로는
    // `.claude/skills/` 를 직접 훑는 스캔이다. 그 스캔을 죽이면 두 문구는 아무에게도 안 보인다
    // (PR #444 리뷰 HIGH-nit: 무력화해도 전 스위트가 초록이었다).
    const dir = installedProject();
    for (const id of ["task-brief", "spec-scaling"]) {
      mkdirSync(join(dir, ".claude", "skills", id), { recursive: true });
      writeFileSync(join(dir, ".claude", "skills", id, "SKILL.md"), `---\nname: ${id}\n---\n`);
    }
    const refreshSkills = vi.fn(() => ({
      attempted: 0,
      refreshed: 0,
      failed: [],
      notInCatalog: [],
      unknown: false,
    }));
    const report = runUpdateMode(dir, templatesDir, harnessRoot, { refreshSkills });
    expect(report.externalSkillsNotInCatalog).toEqual(
      expect.arrayContaining(["task-brief", "spec-scaling"]),
    );
  });

  it("갱신이 실패해도 update 는 정책 파일 갱신을 끝낸다", () => {
    const dir = installedProject();
    const report = runUpdateMode(dir, templatesDir, harnessRoot, {
      refreshSkills: () => ({
        attempted: 1,
        refreshed: 0,
        failed: [{ id: "skill-a", message: "npx exited 1" }],
        notInCatalog: [],
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
      refreshSkills: () => ({
        attempted: 0,
        refreshed: 0,
        failed: [],
        notInCatalog: [],
        unknown: true,
      }),
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
    skippedGroups: [],
    anchorBackedUp: false,
    anchorCreated: false,
    rootImportAdded: false,
    rootBlockRefreshed: false,
    legacyAnchor: null,
    skillsBackedUp: [],
    skillsSkippedLinks: [],
    skillsPruned: [],
    policyBackedUp: [],
    externalUpdated: 0,
    externalBackedUp: [],
    foreignOwned: [],
    installedNew: [],
    restored: [],
    needsReinstall: [],
    retiredAgents: [],
    demotedAgents: [],
    mcpAllowlistRetired: null,
    externalSkillsRefreshed: 0,
    externalSkillsFailed: [],
    externalSkillsNotInCatalog: [],
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

  it("카탈로그에서 사라진 자산은 이름이 화면에 뜬다", () => {
    const out = lines({ externalSkillsNotInCatalog: ["ghost-a", "ghost-b"] });
    expect(out).toMatch(/external skills/);
    expect(out).toContain("ghost-a");
    expect(out).toContain("ghost-b");
  });

  // ADR-088 (#426) — 개명·은퇴는 **사용자가 할 일이 다르다**. 한 문구로 뭉치면 은퇴한 스킬의
  // 새 판을 찾아 헤맨다. 매핑은 카탈로그(`RENAMED_SKILL_IDS`·`RETIRED_SKILL_IDS`)가 소유한다.
  it("개명된 스킬은 새 이름과 받는 방법을 말한다", () => {
    const [oldId, newId] = Object.entries(RENAMED_SKILL_IDS)[0] as [string, string];
    const out = lines({ externalSkillsNotInCatalog: [oldId] });
    expect(out).toContain(oldId);
    expect(out).toContain(newId);
    expect(out).toMatch(/지우고/);
    // 개명은 "은퇴"가 아니다 — 새 판이 있는데 없다고 읽히면 사용자가 그 스킬을 버린다.
    expect(out).not.toMatch(/은퇴/);
  });

  // ADR-090 (#452) — **첫 원소만 보지 않는다.** `[0]` 을 쓰면 새로 은퇴시킨 자산이 목록에만
  // 오르고 화면에는 안 뜨는 상태가 초록으로 산다(그 자리가 이 저장소의 열거-사본 실패 모드다).
  it.each([
    ...RETIRED_SKILL_IDS,
  ])("은퇴한 스킬 %s 는 지워도 된다고 말한다 — 새 이름을 찾게 만들지 않는다", (id) => {
    const out = lines({ externalSkillsNotInCatalog: [id] });
    expect(out).toContain(id);
    expect(out).toMatch(/은퇴/);
    expect(out).toContain(`.claude/skills/${id}`);
  });

  // ADR-089 (#445) — 에이전트 은퇴도 같은 규율이다: 지우지 않고 **지워도 된다는 사실과 대신
  // 쓸 것**을 말한다. 대안을 빼면 은퇴가 기능 상실로 읽혀 사용자가 죽은 파일을 붙든다.
  it.each([...RETIRED_AGENTS])("은퇴한 에이전트 $id 는 지워도 된다고 말하고 대안을 함께 준다", ({
    id,
    instead,
  }) => {
    const out = lines({ retiredAgents: [id] });
    expect(out).toContain(id);
    expect(out).toMatch(/은퇴/);
    expect(out).toContain(`.claude/agents/${id}.md`);
    expect(out).toContain(instead);
  });

  // ADR-090 (#458) — 강등은 은퇴와 **다른 사실**이다: 그 트랙에는 안 가지만 다른 트랙에는
  // 여전히 간다. 그래서 화면이 어느 트랙 전용인지를 말한다 — 안 말하면 설치자는 자산이
  // 없어진 줄 알거나, 반대로 자기 트랙 자산인 줄 알고 죽은 파일을 붙든다.
  it.each([
    ...TRACK_AGENTS,
  ])("강등된 에이전트 %s 는 트랙명과 함께 지워도 된다고 말한다", (id, pattern) => {
    const out = lines({ demotedAgents: [id] });
    expect(out).toContain(id);
    expect(out).toMatch(/이 트랙에서는 더 이상 설치하지 않는다/);
    // 트랙명은 배선 SSOT 의 패턴에서 온다 — 화면이 다른 트랙을 대라면 여기서 빨개진다.
    for (const t of pattern.split("|")) {
      expect(out).toContain(t);
    }
    expect(out).toContain("트랙 전용");
    expect(out).toContain(`.claude/agents/${id}.md`);
    // 은퇴 문구와 섞이면 사용자가 "다른 트랙에서는 쓴다"를 못 읽는다.
    expect(out).not.toMatch(/이 릴리즈에서 은퇴/);
  });

  /**
   * ADR-090 (#452) — **목록에서 derive 하지 않는 표본.** 위 `it.each(RETIRED_*)` 는 목록을
   * 훑으므로 목록에서 한 줄을 빼면 그 케이스가 통째로 사라져 초록으로 산다(변이 대조에서 실측:
   * `RETIRED_SKILL_IDS` 에서 `deep-research` 를 빼도 전 스위트가 초록이었다).
   *
   * 그래서 이 블록의 이름은 **손으로 적은 관측**이다 — v26.151.0 설치본의 `.claude/` 에 실제로
   * 있던 것들. 은퇴시키면서 목록에 안 올리면 여기가 빨간불을 낸다. 두 벌을 적는 비용은
   * 의도한 것이다(`context-cost.test.ts` 의 수기 항목 수 표와 같은 이유).
   */
  const RETIRED_FROM_V26_151_INSTALL: ReadonlyArray<string> = [
    "verification-loop",
    "deep-research",
    "eval-harness",
    "agent-introspection-debugging",
  ];
  const RETIRED_AGENTS_FROM_V26_151_INSTALL: ReadonlyArray<string> = [
    "plan-checker",
    "silent-failure-hunter",
    "build-error-resolver",
  ];
  /**
   * #458 — 같은 이유의 강등 판본. v26.151.0 을 **tooling 트랙으로** 깐 프로젝트의
   * `.claude/agents/` 에 실제로 남아 있던 두 파일이다(리뷰어 컨테이너 실측, PR #457).
   * 위 목록과 같은 규율: `TRACK_AGENTS` 에서 한 줄을 빼면 여기가 빨간불을 낸다.
   */
  const DEMOTED_AGENTS_FROM_V26_151_TOOLING_INSTALL: ReadonlyArray<string> = [
    "data-analyst",
    "strategist",
  ];

  it("v26.151.0 설치본의 은퇴 자산 전부가 이름과 함께 안내된다 (목록 derive 아님)", () => {
    const out = lines({
      externalSkillsNotInCatalog: [...RETIRED_FROM_V26_151_INSTALL],
      retiredAgents: [...RETIRED_AGENTS_FROM_V26_151_INSTALL],
    });
    for (const id of RETIRED_FROM_V26_151_INSTALL) {
      expect(out, `${id} 가 은퇴 안내를 못 받는다`).toContain(
        `${id} · 이 릴리즈에서 은퇴 — .claude/skills/${id} 를 지워도 된다`,
      );
    }
    for (const id of RETIRED_AGENTS_FROM_V26_151_INSTALL) {
      expect(out, `${id} 가 은퇴 안내를 못 받는다`).toContain(
        `${id} · 이 릴리즈에서 은퇴 — .claude/agents/${id}.md 를 지워도 된다`,
      );
    }
    // 에이전트 축은 렌더가 넘어온 id 마다 행을 찍으므로 위 단언만으로는 `RETIRED_AGENTS` 멤버십이
    // 실행되지 않는다(리뷰 #457 B1 — `plan-checker` 행을 지워도 초록이었다). 실제 배선은
    // `update-mode.ts` 가 `RETIRED_AGENT_IDS.includes` 로 화면에 낼 id 를 고르므로 멤버십을 직접 문다.
    expect(RETIRED_AGENT_IDS).toEqual(
      expect.arrayContaining([...RETIRED_AGENTS_FROM_V26_151_INSTALL]),
    );
    expect(RETIRED_SKILL_IDS).toEqual(expect.arrayContaining([...RETIRED_FROM_V26_151_INSTALL]));
  });

  it("v26.151.0 tooling 설치본의 강등 자산 전부가 트랙명과 함께 안내된다 (목록 derive 아님)", () => {
    const out = lines({ demotedAgents: [...DEMOTED_AGENTS_FROM_V26_151_TOOLING_INSTALL] });
    for (const id of DEMOTED_AGENTS_FROM_V26_151_TOOLING_INSTALL) {
      expect(out, `${id} 가 강등 안내를 못 받는다`).toContain(
        `${id} · 이 트랙에서는 더 이상 설치하지 않는다`,
      );
      expect(out).toContain(`.claude/agents/${id}.md 를 지워도 된다`);
    }
    // 렌더는 넘어온 id 를 찍을 뿐이라 위 단언만으로는 배선(`TRACK_AGENTS` 멤버십)이 실행되지
    // 않는다 — 강등 스캔이 읽는 것은 이 표이고, 여기서 한 줄이 빠지면 그 설치자는 안내를
    // 영영 못 받는다. 그래서 멤버십을 직접 문다 (은퇴 축의 리뷰 #457 B1 과 같은 형태).
    expect(TRACK_AGENTS.map(([id]) => id)).toEqual(
      expect.arrayContaining([...DEMOTED_AGENTS_FROM_V26_151_TOOLING_INSTALL]),
    );
  });

  it("카탈로그에 없지만 개명·은퇴 목록에도 없으면 기존 문구 그대로", () => {
    const out = lines({ externalSkillsNotInCatalog: ["ghost-a"] });
    expect(out).toContain("ghost-a");
    expect(out).toMatch(/카탈로그에 없어 갱신 대상이 아니다/);
  });

  it("실패가 여럿이면 한 줄이 길어지지 않는다 — 이름만 내고 사유는 대표 1건", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      id: `skill-${i}`,
      message: "npx exited 1: a very long explanation that would blow up the row width".repeat(2),
    }));
    const row = lines({ externalSkillsFailed: many })
      .split("\n")
      .find((l) => l.includes("external skills")) as string;
    expect(row).toBeDefined();
    // 사유 10건을 다 이어 붙이면 1,000자를 넘는다.
    expect(row.length, `실패 행이 너무 길다: ${row.length}자`).toBeLessThan(400);
    expect(row).toContain("skill-0");
    expect(row).toContain("10건");
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

describe("HIGH-1 — update 화면의 스코프가 실제로 쓰는 자리와 같다", () => {
  it("글로벌 설치본의 update spec 은 global 이다 — 홈에 쓰면서 '안 쓴다'고 적지 않는다", () => {
    const dir = tmpProject();
    writeInstallLog(dir, { ...fakeLog([{ id: "skill-a", method: "skill" }]), scope: "global" });
    // 이 값이 project 로 남으면 헤더가 "no global write" 를 찍는데, 갱신은 `-g` 로 홈에 쓴다.
    expect(buildUpdateSpec(dir, ["tooling"]).scope).toBe("global");
  });

  it("프로젝트 설치본은 project 다", () => {
    const dir = tmpProject();
    writeInstallLog(dir, fakeLog([{ id: "skill-a", method: "skill" }]));
    expect(buildUpdateSpec(dir, ["tooling"]).scope).toBe("project");
  });

  it("설치 기록이 없으면 project 로 떨어진다 (없는 글로벌 권한을 주장하지 않는다)", () => {
    expect(buildUpdateSpec(tmpProject(), ["tooling"]).scope).toBe("project");
  });
});
