import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listBaselineTargets } from "../src/baseline-targets.js";
import { buildCli, defaultAction } from "../src/cli.js";
import {
  type InstallOptions,
  installAction,
  installSpecFromOptions,
  specFromOptions,
} from "../src/commands/install.js";
import { uninstallAction } from "../src/commands/uninstall.js";
import {
  assetReachesCli,
  EXTERNAL_ASSETS,
  INTERNAL_BUNDLED_SKILL_IDS,
} from "../src/external-assets.js";
import { type InstallLog, installLogPath, readInstallLog } from "../src/install-log.js";
import { MODE_ENTRY_POINT, runInstall } from "../src/installer.js";
import { classifyUpdateIntent, runInteractive, type UpdateSelection } from "../src/interactive.js";
import { recommendedExternalAssets } from "../src/preset-recommend.js";
import type { InstallTargetId, Prompts } from "../src/prompts.js";
import {
  buildInstallRecordView,
  buildRouterChoices,
  describeInstall,
  type InstallRecordView,
} from "../src/router.js";
import type { DetectedInstall } from "../src/state.js";
import type { CliBase, CliTargets, Track } from "../src/types.js";
import { buildUpdateSpec } from "../src/update-mode.js";

/**
 * #533 · #523 — 기설치 위저드의 Update 한 흐름.
 *
 * 이 파일이 지키는 것(설계 `docs/plans/wizard-533-design-2026-09-27.md` §4 불변식 · §8):
 *   - 깔린 트랙·CLI 는 프롬프트가 무엇을 돌려주든 spec 에서 빠지지 않는다 (잠금 = 합집합, D4)
 *   - 더한 것이 없으면 `agent-harness update` 와 같은 spec, 더했으면 확인 화면이 찍는
 *     `install …` 명령과 같은 spec (D6)
 *   - 깨진 설치(기록 ∋ claude ∧ `.claude/` 없음)는 복구 명령을 먼저 보이고 Update 를 막는다 (D10)
 */

const TOOLING_REC = recommendedExternalAssets(["tooling"]);
const BUNDLED = new Set<string>(INTERNAL_BUNDLED_SKILL_IDS);
/** tooling 이 추천하는 번들 스킬 하나 — 해제 기록(skillExclude) 표본. 카탈로그에서 뽑는다. */
const A_SKILL = TOOLING_REC.find((id) => BUNDLED.has(id)) ?? "";
/** tooling baseline 하나 — 해제 기록(baselineExclude) 표본. */
const A_BASELINE = listBaselineTargets({ tracks: ["tooling"] })[0]?.id ?? "";
/** tooling 추천 밖의 외부 자산 — "더했다"의 표본. */
const NOT_RECOMMENDED = "railway-skills";
const assetOf = (id: string) => EXTERNAL_ASSETS.find((a) => a.id === id);
/**
 * tooling 추천 중 **외부 설치 단계를 타고 claude 에 닿는** 자산 — 설치되면 기록 `assets` 에 남는 것.
 * 기록에 없으면 설치 때 뺐거나 실패했거나 새 릴리즈가 더한 것이다(리뷰 B2). 카탈로그에서 뽑는다.
 */
const TOOLING_EXTERNAL_REC = TOOLING_REC.filter((id) => {
  const a = assetOf(id);
  return a !== undefined && a.method.kind !== "internal" && assetReachesCli(a, ["claude"]);
});
const TOOLING_INTERNAL_REC = TOOLING_REC.filter((id) => assetOf(id)?.method.kind === "internal");
const logAsset = (id: string): InstallLog["assets"][number] => ({
  id,
  category: "dev-tools",
  method: "skill",
  scope: "project",
  detail: {},
});

function writeLog(
  dir: string,
  over: Partial<InstallLog["spec"]> & { scope?: "project" | "global" },
) {
  const { scope = "project", ...spec } = over;
  const log: InstallLog = {
    schemaVersion: 1,
    installedAt: "2026-09-27T00:00:00.000Z",
    scope,
    spec: { tracks: ["tooling"], cli: ["claude"], clis: ["claude"], ...spec },
    templates: { claudeDir: ".claude/" },
    assets: [],
  };
  mkdirSync(dirname(installLogPath(dir)), { recursive: true });
  writeFileSync(installLogPath(dir), JSON.stringify(log), "utf8");
  return log;
}

function state(tracks: Track[] = ["tooling"]): DetectedInstall {
  return { state: "installed", log: null, tracks, hasClaudeDir: true, traces: [] };
}

/** 위저드에 주는 판정 — 트랙은 고정하고 기록은 그 프로젝트의 디스크에서 읽는다(판정 결과가 기록을 싣는다). */
function detected(tracks: Track[] = ["tooling"], over: Partial<DetectedInstall> = {}) {
  return (projectDir: string): DetectedInstall => ({
    ...state(tracks),
    log: readInstallLog(projectDir),
    ...over,
  });
}

function makePrompts(overrides: Partial<Prompts> = {}): Prompts {
  return {
    intro: vi.fn(),
    outro: vi.fn(),
    cancel: vi.fn(),
    selectAction: vi.fn(async () => "update" as const),
    selectTracks: vi.fn(async (initial?: Track[]) => initial ?? (["tooling"] as Track[])),
    selectCli: vi.fn(async (initial?: CliTargets) => initial ?? (["claude"] as CliTargets)),
    confirmInstall: vi.fn(async () => true),
    selectInstallTargets: vi.fn(async (initial: ReadonlyArray<InstallTargetId>) => initial),
    ...overrides,
  };
}

/** 확인 화면의 `RUNS AS` 줄을 **실제 CLI 파서**로 다시 읽어, `install` 명령이 만들 spec 을 낸다. */
function specFromRunsAs(summary: string, projectDir: string) {
  const line = summary.split("\n").find((l) => l.includes("RUNS AS"));
  if (!line) throw new Error(`RUNS AS 줄이 없다:\n${summary}`);
  const argv = line.replace(/^.*RUNS AS\s+agent-harness\s+/, "").split(/\s+/);
  const cli = buildCli();
  const parsed = cli.parse(["node", "agent-harness", ...argv], { run: false });
  expect(cli.matchedCommand?.name).toBe("install");
  const options = { ...(parsed.options as InstallOptions), projectDir };
  const validated = specFromOptions(options);
  expect(validated.ok).toBe(true);
  return installSpecFromOptions(options, validated.cli, () => {});
}

describe("Update 흐름 — 잠금 (D4)", () => {
  let dir = "";
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "wiz-upd-"));
    mkdirSync(join(dir, ".claude"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("CLI 잠금 — 프롬프트가 opencode 만 돌려줘도(`a`·`i` 로 claude 를 풀었다) claude 는 빠지지 않는다", async () => {
    writeLog(dir, { clis: ["claude"] });
    const selectCli = vi.fn(async () => ["opencode"] as CliTargets);
    const result = await runInteractive(dir, {
      prompts: makePrompts({ selectCli }),
      detect: detected(),
      isTty: () => true,
    });
    expect(result.ok).toBe(true);
    expect(result.spec?.cli).toEqual(["claude", "opencode"]);
    // 화면에는 깔린 CLI 가 체크된 채 · 표시된 채로 간다
    const call = selectCli.mock.calls[0] as unknown[] | undefined;
    expect(call?.[0]).toEqual(["claude"]);
    expect(call?.[2]).toEqual(["claude"]);
  });

  it("트랙 잠금 — 프롬프트가 data 만 돌려줘도 tooling 은 빠지지 않는다", async () => {
    writeLog(dir, { tracks: ["tooling"] });
    const result = await runInteractive(dir, {
      prompts: makePrompts({ selectTracks: vi.fn(async () => ["data"] as Track[]) }),
      detect: detected(),
      isTty: () => true,
    });
    expect(result.spec?.tracks).toEqual(["data", "tooling"]);
  });

  it("base 도 다른 설치 트랙처럼 잠긴다 — 다른 트랙을 골라도 빠지지 않는다", async () => {
    writeLog(dir, { tracks: ["base"] });
    const result = await runInteractive(dir, {
      prompts: makePrompts({ selectTracks: vi.fn(async () => ["csr-fastapi"] as Track[]) }),
      detect: detected(["base"]),
      isTty: () => true,
    });
    expect(result.spec?.tracks).toEqual(["base", "csr-fastapi"]);
  });

  it("A5 · 기록이 없으면 Update 메뉴가 아니라 새 설치 흐름 — 흔적 안내 1회 · 트랙 기본값은 메타파일 (#595)", async () => {
    // 로그를 쓰지 않는다 — `.claude/` 와 옛 메타파일만 있다(기록 전 판 · 기록을 잃은 클론)
    writeFileSync(join(dir, ".claude/.installed-tracks"), "data\n");
    const selectAction = vi.fn(async () => "update" as const);
    const selectTracks = vi.fn(
      async (initial?: Track[], _step?: unknown, _installed?: ReadonlyArray<Track>) =>
        initial ?? (["tooling"] as Track[]),
    );
    const note = vi.fn();
    const result = await runInteractive(dir, {
      prompts: makePrompts({ selectAction, selectTracks, note }),
      isTty: () => true,
    });
    expect(selectAction).not.toHaveBeenCalled();
    expect(selectTracks).toHaveBeenCalled();
    expect(selectTracks.mock.calls[0]?.[0]).toEqual(["data"]);
    expect(selectTracks.mock.calls[0]?.[2]).toBeUndefined(); // 잠긴 트랙 없음 — 새 설치다
    expect(note).toHaveBeenCalledTimes(1);
    expect(note.mock.calls[0]?.[0]).toContain("Harness files are here (.claude/.installed-tracks)");
    expect(note.mock.calls[0]?.[0]).toContain("Cloned from a teammate?");
    expect(result.mode).toBe("fresh");
    expect(result.spec?.tracks).toEqual(["data"]);
  });

  it("깨진 기록이면 corrupted 줄만 보이고 끝낸다 — 메뉴 · 설치 흐름 없음 (#595)", async () => {
    mkdirSync(dirname(installLogPath(dir)), { recursive: true });
    writeFileSync(installLogPath(dir), "{ broken", "utf8");
    const prompts = makePrompts();
    const result = await runInteractive(dir, { prompts, isTty: () => true });
    expect(result).toEqual({ ok: false, reason: "corrupted" });
    expect(prompts.cancel).toHaveBeenCalledWith(
      expect.stringContaining("install log is corrupted"),
    );
    expect(prompts.selectAction).not.toHaveBeenCalled();
    expect(prompts.selectTracks).not.toHaveBeenCalled();
  });
});

describe("Update 흐름 — 엔진 선택 (D6 · D7)", () => {
  let dir = "";
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "wiz-eng-"));
    mkdirSync(join(dir, ".claude"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("아무것도 더하지 않으면 `agent-harness update` 와 같은 spec (mode=update) · RUNS AS agent-harness update", async () => {
    writeLog(dir, {});
    const confirmInstall = vi.fn(async (_s: string) => true);
    const result = await runInteractive(dir, {
      prompts: makePrompts({ confirmInstall }),
      detect: detected(),
      isTty: () => true,
    });
    expect(result.mode).toBe("update");
    expect(result.spec).toEqual(buildUpdateSpec(dir, ["tooling"]));
    expect(confirmInstall.mock.calls[0]?.[0]).toMatch(/RUNS AS\s+agent-harness update$/m);
  });

  it("CLI 하나를 더하면 확인 화면의 `install …` 명령과 같은 spec (mode=add)", async () => {
    writeLog(dir, {});
    const confirmInstall = vi.fn(async (_s: string) => true);
    const result = await runInteractive(dir, {
      prompts: makePrompts({
        selectCli: vi.fn(async () => ["claude", "opencode"] as CliTargets),
        confirmInstall,
      }),
      detect: detected(),
      isTty: () => true,
    });
    const summary = confirmInstall.mock.calls[0]?.[0] ?? "";
    expect(result.mode).toBe("add");
    expect(summary).toContain(
      "RUNS AS   agent-harness install --track tooling --cli claude --cli opencode --scope project",
    );
    expect(result.spec).toEqual(specFromRunsAs(summary, dir));
  });

  it("자산을 더하고 baseline 을 풀면 `--with`·`--without` 까지 같은 명령으로 왕복한다", async () => {
    writeLog(dir, { scope: "global" });
    const confirmInstall = vi.fn(async (_s: string) => true);
    const result = await runInteractive(dir, {
      prompts: makePrompts({
        selectInstallTargets: vi.fn(async (initial: ReadonlyArray<InstallTargetId>) => [
          ...initial.filter((t) => t !== A_BASELINE),
          `asset:${NOT_RECOMMENDED}` as InstallTargetId,
        ]),
        confirmInstall,
      }),
      detect: detected(),
      isTty: () => true,
    });
    const summary = confirmInstall.mock.calls[0]?.[0] ?? "";
    expect(result.mode).toBe("add");
    expect(summary).toContain(`--with ${NOT_RECOMMENDED}`);
    expect(summary).toContain(`--without ${A_BASELINE}`);
    expect(summary).toContain("--scope global"); // 스코프는 기록의 것
    expect(result.spec).toEqual(specFromRunsAs(summary, dir));
  });

  it("예전에 뺀 스킬·baseline 은 체크 해제된 채로 시작한다 — 그대로 두면 refresh 이고 되살아나지 않는다", async () => {
    writeLog(dir, { baselineExclude: [A_BASELINE], skillExclude: [A_SKILL] });
    const selectInstallTargets = vi.fn(async (initial: ReadonlyArray<InstallTargetId>) => initial);
    const result = await runInteractive(dir, {
      prompts: makePrompts({ selectInstallTargets }),
      detect: detected(),
      isTty: () => true,
    });
    const initial = selectInstallTargets.mock.calls[0]?.[0] ?? [];
    expect(initial).not.toContain(A_BASELINE);
    expect(initial).not.toContain(`asset:${A_SKILL}`);
    expect(result.mode).toBe("update");
  });
});

/**
 * 리뷰 B2 — "화면에 체크돼 있으면 확인 뒤 실제로 깔려 있다 · 아무것도 안 바꾸면 refresh".
 * 추천됐지만 기록에 없는 외부 자산(설치 때 뺐거나 · 실패했거나 · 새 릴리즈가 추천에 더했다)은 체크된 채
 * 보이고 "N selected" 로 세어지는데 refresh 로 가서 깔리지 않았다.
 */
describe("Update 흐름 — 추천됐지만 기록에 없는 외부 자산 (리뷰 B2)", () => {
  let dir = "";
  const EXT = TOOLING_EXTERNAL_REC[0] ?? "";
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "wiz-b2-"));
    mkdirSync(join(dir, ".claude"));
    writeLog(dir, {}); // assets [] — 추천 외부 자산이 기록에 없다
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("기본값 그대로 → refresh 이고, 그 자산은 체크 안 된 채 시작하며 선택으로 세지 않는다", async () => {
    expect(EXT).not.toBe(""); // 전제
    const selectInstallTargets = vi.fn(async (initial: ReadonlyArray<InstallTargetId>) => initial);
    const confirmInstall = vi.fn(async (_s: string) => true);
    const result = await runInteractive(dir, {
      prompts: makePrompts({ selectInstallTargets, confirmInstall }),
      detect: detected(),
      isTty: () => true,
    });
    expect(selectInstallTargets.mock.calls[0]?.[0]).not.toContain(`asset:${EXT}`);
    expect(result.mode).toBe("update");
    const summary = confirmInstall.mock.calls[0]?.[0] ?? "";
    const selectedLines = summary.split("\n").filter((l) => l.trim().startsWith("· "));
    expect(selectedLines.join("\n")).not.toContain(EXT);
  });

  it("그 자산을 체크하면 add — RUNS AS install 이고 spec 이 그 자산을 깐다", async () => {
    const confirmInstall = vi.fn(async (_s: string) => true);
    const result = await runInteractive(dir, {
      prompts: makePrompts({
        selectInstallTargets: vi.fn(async (initial: ReadonlyArray<InstallTargetId>) => [
          ...initial,
          `asset:${EXT}` as InstallTargetId,
        ]),
        confirmInstall,
      }),
      detect: detected(),
      isTty: () => true,
    });
    const summary = confirmInstall.mock.calls[0]?.[0] ?? "";
    expect(result.mode).toBe("add");
    expect(summary).toMatch(/RUNS AS\s+agent-harness install --track tooling --cli claude/);
    expect(result.spec?.userOverride?.forceExclude ?? []).not.toContain(EXT);
    expect(result.spec).toEqual(specFromRunsAs(summary, dir));
  });
});

describe("classifyUpdateIntent — 조건 하나라도 바뀌면 add, 애매하면 add", () => {
  const log = (over: Partial<InstallLog> = {}): InstallLog => ({
    schemaVersion: 1,
    installedAt: "x",
    scope: "project",
    spec: { tracks: ["tooling"], cli: ["claude"], clis: ["claude"] },
    templates: {},
    // 추천 외부 자산은 설치됐다(기록에 있다) — 아래 "기록과 같다"의 기준선.
    assets: [...TOOLING_EXTERNAL_REC, NOT_RECOMMENDED].map(logAsset),
    ...over,
  });
  const same: UpdateSelection = {
    tracks: ["tooling"],
    cli: ["claude"],
    assetIds: [...TOOLING_REC, NOT_RECOMMENDED],
    baselineExclude: [],
    skillExclude: [],
  };

  it("기록과 같으면 refresh — 번들 스킬(assets 에 안 남는 내장 자산)이 체크돼 있어도", () => {
    expect(TOOLING_EXTERNAL_REC.length).toBeGreaterThan(0); // 전제: 아래 ③ 케이스가 헛통과하지 않게
    expect(classifyUpdateIntent(log(), same)).toBe("refresh");
  });

  it("③ 기록에 없는 추천 외부 자산을 체크했다(설치 때 뺐거나 실패했다) → add — refresh 는 그걸 깔지 않는다", () => {
    const unrecorded = log({ assets: [logAsset(NOT_RECOMMENDED)] });
    expect(classifyUpdateIntent(unrecorded, same)).toBe("add");
  });

  it("기록의 CLI 로 닿지 않는 추천 자산은 기록에 없어도 덮인다 — 설치해도 안 깔리는 것이다", () => {
    // data 트랙 · codex 단독 — 추천 중 claude 전용(plugin) 자산은 codex 로 닿지 않는다(카탈로그에서 유도).
    const rec = recommendedExternalAssets(["data"]);
    const external = rec.filter((id) => assetOf(id)?.method.kind !== "internal");
    const unreachable = external.filter((id) => {
      const a = assetOf(id);
      return a !== undefined && !assetReachesCli(a, ["codex"]);
    });
    expect(unreachable.length).toBeGreaterThan(0); // 전제
    const codexLog = log({
      spec: { tracks: ["data"], cli: ["codex"], clis: ["codex"] },
      // 닿는 외부 자산은 설치됐다(기록에 있다). 닿지 않는 것은 기록에 없다.
      assets: external.filter((id) => !unreachable.includes(id)).map(logAsset),
    });
    const selection = {
      ...same,
      tracks: ["data"] as Track[],
      cli: ["codex"] as const,
      assetIds: rec,
    };
    expect(classifyUpdateIntent(codexLog, selection)).toBe("refresh");
  });

  it.each([
    ["① 트랙을 더했다", { tracks: ["data", "tooling"] as Track[] }],
    ["② CLI 를 더했다", { cli: ["claude", "codex"] as const }],
    ["③ 기록도 추천도 아닌 자산을 체크했다", { assetIds: [...same.assetIds, "tauri-desktop"] }],
    ["③ 기록된 자산의 체크를 풀었다", { assetIds: [...TOOLING_REC] }],
    ["④ baseline 해제가 바뀌었다", { baselineExclude: [A_BASELINE] }],
    ["⑤ 번들 스킬 해제가 바뀌었다", { skillExclude: [A_SKILL] }],
  ] as const)("%s → add", (_label, over) => {
    expect(classifyUpdateIntent(log(), { ...same, ...over })).toBe("add");
  });

  it("기록이 없으면 감지된 트랙 · claude 를 기준으로 본다 (buildUpdateSpec 과 같은 기준)", () => {
    // 기록이 없으니 기록된 외부 자산도 없다 — Step 3 는 내장 추천만 체크한 채 시작한다.
    const legacy = { ...same, assetIds: [...TOOLING_INTERNAL_REC] };
    expect(classifyUpdateIntent(null, legacy, ["tooling"])).toBe("refresh");
    expect(classifyUpdateIntent(null, { ...legacy, cli: ["codex"] }, ["tooling"])).toBe("add");
    expect(classifyUpdateIntent(null, { ...legacy, assetIds: [...TOOLING_REC] }, ["tooling"])).toBe(
      "add",
    );
  });
});

describe("깨진 설치 (D10) — 기록에 claude, `.claude/` 없음", () => {
  let dir = "";
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "wiz-broken-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("메뉴 머리글에 복구 명령 한 줄 · Update 는 막힌다", async () => {
    writeLog(dir, {});
    let seen: InstallRecordView | undefined;
    const selectAction = vi.fn(async (_s: DetectedInstall, record?: InstallRecordView) => {
      seen = record;
      return "exit" as const;
    });
    await runInteractive(dir, {
      prompts: makePrompts({ selectAction }),
      detect: detected(["tooling"], { hasClaudeDir: false }),
      isTty: () => true,
    });
    if (!seen) throw new Error("selectAction 이 기록을 받지 못했다");
    expect(describeInstall(state(), seen)).toContain(
      "agent-harness install --reinstall --track tooling --cli claude --scope project",
    );
    const update = buildRouterChoices(state(), seen).find((c) => c.value === "update");
    expect(update?.enabled).toBe(false);
  });

  it("그래도 update 가 돌아오면 실행을 만들지 않는다 — 엔진이 거절할 실행이다", async () => {
    writeLog(dir, {});
    const result = await runInteractive(dir, {
      prompts: makePrompts(),
      detect: detected(["tooling"], { hasClaudeDir: false }),
      isTty: () => true,
    });
    expect(result.ok).toBe(false);
    expect(result.spec).toBeUndefined();
    expect(result.message).toContain("install --reinstall");
  });

  it("claude 가 기록에 없으면 `.claude/` 가 없어도 정상이다 (codex 단독 설치)", async () => {
    writeLog(dir, { cli: ["codex"], clis: ["codex"] });
    let seen: InstallRecordView | undefined;
    await runInteractive(dir, {
      prompts: makePrompts({
        selectAction: vi.fn(async (_s: DetectedInstall, record?: InstallRecordView) => {
          seen = record;
          return "exit" as const;
        }),
      }),
      detect: detected(["tooling"], { hasClaudeDir: false }),
      isTty: () => true,
    });
    expect(seen?.repair).toBeNull();
    expect(seen?.clis).toEqual(["codex"]);
  });
});

describe("메뉴 Uninstall → uninstall 명령과 같은 화면 (D8)", () => {
  it("설치 파이프라인을 타지 않고 uninstall 화면으로 넘긴다", async () => {
    const execute = vi.fn();
    const uninstall = vi.fn(async (_cwd: string) => {});
    const exit = vi.fn() as unknown as (code: number) => never;
    await defaultAction({
      run: async () => ({ ok: true, uninstall: true }),
      execute,
      uninstall,
      exit,
      err: vi.fn(),
    });
    expect(uninstall).toHaveBeenCalledWith(process.cwd());
    expect(execute).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });
});

describe("`install --reinstall` (D9) — 위저드 메뉴의 Reinstall 이 플래그가 됐다", () => {
  const runFlags = (argv: string[]) => {
    const cli = buildCli();
    const parsed = cli.parse(["node", "agent-harness", ...argv], { run: false });
    // mode 만 보고 멈춘다 — executeSpec 이 throw 를 "install failed" 로 받아 exit 한다.
    const runPipeline = vi.fn((..._args: unknown[]): never => {
      throw new Error("stop after capturing mode");
    });
    const err = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    installAction(parsed.options as InstallOptions, {
      runPipeline,
      resolveHarnessRoot: () => "/nowhere",
      log: vi.fn(),
      err,
      exit,
    });
    return { runPipeline, err, exit };
  };

  it("파이프라인이 mode=reinstall 로 돈다 · 플래그 없으면 이전처럼 mode 없음", () => {
    const withFlag = runFlags(["install", "--reinstall", "--track", "tooling", "--cli", "claude"]);
    expect(withFlag.runPipeline.mock.calls[0]?.[2]).toBe("reinstall");
    const without = runFlags(["install", "--track", "tooling"]);
    expect(without.runPipeline.mock.calls[0]?.[2]).toBeUndefined();
  });

  it("--track 없이는 기존 거절 그대로 (exit 1) — 무엇을 다시 깔지 모르고 .claude/ 를 옮기지 않는다", () => {
    const { runPipeline, err, exit } = runFlags(["install", "--reinstall"]);
    expect(runPipeline).not.toHaveBeenCalled();
    expect(exit).toHaveBeenCalledWith(1);
    // 문구는 기존 거절 그대로다(cac 가 다른 플래그와 함께면 빈 --track 을 "undefined" 로 채워
    // "Unknown track" 이 된다 — `install --verbose` 도 같다). 여기서 지키는 것은 거절 자체다.
    expect(err.mock.calls.flat().join("\n")).toMatch(/track/i);
  });

  it("모든 mode 에 비대화형 진입점이 있다 (위저드 전용 mode 0)", () => {
    expect(Object.values(MODE_ENTRY_POINT)).not.toContain(null);
    expect(MODE_ENTRY_POINT.reinstall).toBe("install --reinstall");
  });
});

/**
 * 리뷰 B1 — Claude 를 뺀 뒤(`uninstall --cli claude`, 새 Uninstall 화면의 Remove one CLI)에도 Update 가
 * 돌아야 한다. 화면(메뉴 머리글)과 엔진(update pre-flight)이 깨진 설치를 **같은 기록(`clis`)**으로
 * 판정해야 한다(D10) — 엔진이 마지막 설치의 `spec.cli` 를 보던 때는 화면이 Update 를 열어 주고
 * 엔진이 "broken install … Reinstall" 로 거절했다(방금 뺀 Claude 를 다시 깔라는 문장).
 */
describe("깨진 설치 — 화면과 엔진이 같은 기록으로 판정한다 (리뷰 B1 · D10)", () => {
  const HARNESS_ROOT = resolve(__dirname, "..");
  let dir = "";
  const run = (mode: "add" | "update", cli: ReadonlyArray<CliBase>) =>
    runInstall({
      harnessRoot: HARNESS_ROOT,
      projectDir: dir,
      mode,
      runExternal: null,
      spec: {
        tracks: ["tooling"],
        options: { withCodexTrust: false },
        cli: [...cli],
        projectDir: dir,
      },
    });
  const screenSaysBroken = (): boolean => {
    const log = readInstallLog(dir);
    if (log === null) throw new Error("픽스처에 설치 기록이 없다 — 메뉴는 기록이 있을 때만 뜬다");
    return buildInstallRecordView(state(), log, existsSync(join(dir, ".claude"))).repair !== null;
  };
  const engineSaysBroken = (): boolean => {
    try {
      run("update", ["claude", "codex"]);
      return false;
    } catch (e) {
      if (e instanceof Error && e.message.includes("broken install")) return true;
      throw e;
    }
  };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "wiz-b1-"));
    run("add", ["claude", "codex"]);
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("claude+codex → `uninstall --cli claude` → update 가 돈다 · codex 자산을 갱신하고 `.claude/` 를 되살리지 않는다", () => {
    let code: number | null = null;
    uninstallAction(
      { projectDir: dir, cli: "claude" },
      {
        log: () => {},
        err: () => {},
        exit: (c: number) => {
          code ??= c;
          return undefined as never;
        },
        resolveHarnessRoot: () => HARNESS_ROOT,
      },
    );
    expect(code).toBe(0);
    // 기록의 마지막 설치분(spec.cli)엔 claude 가 남아 있다 — 이 상태가 두 술어를 갈라 놓던 입력이다.
    expect(readInstallLog(dir)?.spec.cli).toContain("claude");
    const skill = join(dir, ".agents/skills/audit-harness-fit/SKILL.md");
    appendFileSync(skill, "\n<!-- stale local copy -->\n");

    expect(screenSaysBroken()).toBe(false);
    expect(engineSaysBroken()).toBe(false);
    expect(readFileSync(skill, "utf8")).not.toContain("stale local copy");
    expect(existsSync(join(dir, ".claude"))).toBe(false);
  });

  it("기록에 claude 가 남았는데 `.claude/` 가 없으면 — 화면도 엔진도 깨진 설치라고 한다", () => {
    rmSync(join(dir, ".claude"), { recursive: true, force: true });
    expect(screenSaysBroken()).toBe(true);
    expect(engineSaysBroken()).toBe(true);
  });
});
