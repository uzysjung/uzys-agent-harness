import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listBaselineTargets } from "../src/baseline-targets.js";
import { buildCli, defaultAction } from "../src/cli.js";
import {
  type InstallOptions,
  installAction,
  installSpecFromOptions,
  specFromOptions,
} from "../src/commands/install.js";
import { INTERNAL_BUNDLED_SKILL_IDS } from "../src/external-assets.js";
import { type InstallLog, installLogPath } from "../src/install-log.js";
import { MODE_ENTRY_POINT } from "../src/installer.js";
import { classifyUpdateIntent, runInteractive, type UpdateSelection } from "../src/interactive.js";
import { recommendedExternalAssets } from "../src/preset-recommend.js";
import type { InstallTargetId, Prompts } from "../src/prompts.js";
import { buildRouterChoices, describeInstall, type InstallRecordView } from "../src/router.js";
import type { DetectedInstall } from "../src/state.js";
import type { CliTargets, Track } from "../src/types.js";
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
  return { state: "existing", tracks, source: "install-log", hasClaudeDir: true };
}

function makePrompts(overrides: Partial<Prompts> = {}): Prompts {
  return {
    intro: vi.fn(),
    outro: vi.fn(),
    cancel: vi.fn(),
    selectAction: vi.fn(async () => "update" as const),
    selectTracks: vi.fn(async (initial?: Track[]) => initial ?? (["tooling"] as Track[])),
    selectCli: vi.fn(async (initial?: CliTargets) => initial ?? (["claude"] as CliTargets)),
    selectScope: vi.fn(async () => "project" as const),
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
      detect: () => state(),
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
      detect: () => state(),
      isTty: () => true,
    });
    expect(result.spec?.tracks).toEqual(["data", "tooling"]);
  });

  it("base 도 다른 설치 트랙처럼 잠긴다 — 다른 트랙을 골라도 빠지지 않는다", async () => {
    writeLog(dir, { tracks: ["base"] });
    const result = await runInteractive(dir, {
      prompts: makePrompts({ selectTracks: vi.fn(async () => ["csr-fastapi"] as Track[]) }),
      detect: () => state(["base"]),
      isTty: () => true,
    });
    expect(result.spec?.tracks).toEqual(["base", "csr-fastapi"]);
  });

  it("기록이 없는 옛 설치본은 CLI 를 잠그지 않는다 — 말할 수 없는 것을 잠그지 않는다 (D5)", async () => {
    // 로그를 쓰지 않는다
    const selectCli = vi.fn(async () => ["codex"] as CliTargets);
    const result = await runInteractive(dir, {
      prompts: makePrompts({ selectCli }),
      detect: () => ({ ...state(), source: "legacy" }),
      isTty: () => true,
    });
    expect((selectCli.mock.calls[0] as unknown[])?.[2]).toEqual([]);
    expect(result.spec?.cli).toEqual(["codex"]);
    expect(result.spec?.tracks).toEqual(["tooling"]); // 트랙은 감지된 것으로 잠근다
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
      detect: () => state(),
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
      detect: () => state(),
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
      detect: () => state(),
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
      detect: () => state(),
      isTty: () => true,
    });
    const initial = selectInstallTargets.mock.calls[0]?.[0] ?? [];
    expect(initial).not.toContain(A_BASELINE);
    expect(initial).not.toContain(`asset:${A_SKILL}`);
    expect(result.mode).toBe("update");
  });
});

describe("classifyUpdateIntent — 조건 하나라도 바뀌면 add, 애매하면 add", () => {
  const log = (over: Partial<InstallLog> = {}): InstallLog => ({
    schemaVersion: 1,
    installedAt: "x",
    scope: "project",
    spec: { tracks: ["tooling"], cli: ["claude"], clis: ["claude"] },
    templates: {},
    assets: [
      { id: NOT_RECOMMENDED, category: "dev-tools", method: "skill", scope: "project", detail: {} },
    ],
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
    expect(classifyUpdateIntent(log(), same)).toBe("refresh");
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
    const legacy = { ...same, assetIds: [...TOOLING_REC] };
    expect(classifyUpdateIntent(null, legacy, ["tooling"])).toBe("refresh");
    expect(classifyUpdateIntent(null, { ...legacy, cli: ["codex"] }, ["tooling"])).toBe("add");
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
      detect: () => ({ ...state(), hasClaudeDir: false }),
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
      detect: () => ({ ...state(), hasClaudeDir: false }),
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
      detect: () => ({ ...state(), hasClaudeDir: false }),
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
