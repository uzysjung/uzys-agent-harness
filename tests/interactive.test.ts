import { describe, expect, it, vi } from "vitest";
import {
  computeUserOverride,
  formatSummary,
  runInteractive,
  splitInstallTargets,
  toOptionFlags,
} from "../src/interactive.js";
import type { InstallTargetId, Prompts } from "../src/prompts.js";
import type { DetectedInstall } from "../src/state.js";
import type { CliTargets, OptionFlags, Track } from "../src/types.js";

function makePrompts(overrides: Partial<Prompts> = {}): Prompts {
  return {
    intro: vi.fn(),
    outro: vi.fn(),
    cancel: vi.fn(),
    selectTracks: vi.fn(async () => ["tooling"] as Track[]),
    selectCli: vi.fn(async () => ["claude"] as CliTargets),
    selectAction: vi.fn(async () => "add" as const),
    // v26.64.0 (ADR-020) — default mock: scope=project (D16).
    selectScope: vi.fn(async () => "project" as const),
    confirmInstall: vi.fn(async () => true),
    // v26.54.0 — default mock: 사용자가 추천 그대로 confirm. selectInstallTargets returns initial.
    selectInstallTargets: vi.fn(async (initial: ReadonlyArray<InstallTargetId>) => initial),
    ...overrides,
  };
}

const newState: DetectedInstall = {
  state: "new",
  tracks: [],
  source: "none",
  hasClaudeDir: false,
};

const existingState: DetectedInstall = {
  state: "existing",
  tracks: ["tooling"],
  source: "metafile",
  hasClaudeDir: true,
};

const ALL_FALSE_OPTIONS: OptionFlags = {
  withPrune: false,
  withCodexTrust: false,
  withKarpathyHook: false,
};

describe("runInteractive", () => {
  it("aborts with reason=no-tty when stdin is not a TTY", async () => {
    const prompts = makePrompts();
    const result = await runInteractive("/tmp/x", {
      prompts,
      detect: () => newState,
      isTty: () => false,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("no-tty");
    expect(result.message).toContain("TTY");
    expect(prompts.intro).not.toHaveBeenCalled();
  });

  it("happy path (new install) returns InstallSpec without userOverride (selections == recommended)", async () => {
    const prompts = makePrompts();
    const result = await runInteractive("/tmp/proj", {
      prompts,
      detect: () => newState,
      isTty: () => true,
    });
    expect(result.ok).toBe(true);
    expect(result.spec?.tracks).toEqual(["tooling"]);
    expect(result.spec?.options).toEqual(ALL_FALSE_OPTIONS);
    expect(result.spec?.cli).toEqual(["claude"]);
    expect(result.spec?.userOverride).toBeUndefined();
    expect(prompts.selectAction).not.toHaveBeenCalled();
    expect(prompts.intro).toHaveBeenCalledOnce();
    expect(prompts.outro).toHaveBeenCalledOnce();
  });

  it("v26.54.0 — option:withTauri checked in install-targets sets OptionFlags.withTauri=true", async () => {
    const selectInstallTargets = vi.fn(async (initial: ReadonlyArray<InstallTargetId>) => [
      ...initial,
      "asset:tauri-desktop" as InstallTargetId,
    ]);
    const prompts = makePrompts({
      selectTracks: vi.fn(async () => ["csr-fastapi"] as Track[]),
      selectInstallTargets,
    });
    const result = await runInteractive("/tmp/proj", {
      prompts,
      detect: () => newState,
      isTty: () => true,
    });
    expect(result.ok).toBe(true);
    // v26.81.0 (ADR-022) — tauri 는 내부 자산 체크 → forceInclude.
    expect(result.spec?.userOverride?.forceInclude).toContain("tauri-desktop");
  });

  it("v26.54.0 — asset addition outside recommended → userOverride.forceInclude", async () => {
    const selectInstallTargets = vi.fn(async (initial: ReadonlyArray<InstallTargetId>) => [
      ...initial,
      "asset:railway-skills" as InstallTargetId,
    ]);
    const prompts = makePrompts({ selectInstallTargets });
    const result = await runInteractive("/tmp/proj", {
      prompts,
      detect: () => newState,
      isTty: () => true,
    });
    expect(result.ok).toBe(true);
    expect(result.spec?.userOverride?.forceInclude).toContain("railway-skills");
  });

  it("v26.54.0 — asset unchecked from recommended → userOverride.forceExclude", async () => {
    // v26.71.0 — playwright-skill 은 T3 라 추천 제외 → vetted 추천 자산(karpathy-coder)으로 uncheck 시나리오.
    const selectInstallTargets = vi.fn(async (initial: ReadonlyArray<InstallTargetId>) =>
      initial.filter((t) => t !== "asset:karpathy-coder"),
    );
    const prompts = makePrompts({ selectInstallTargets });
    const result = await runInteractive("/tmp/proj", {
      prompts,
      detect: () => newState,
      isTty: () => true,
    });
    expect(result.ok).toBe(true);
    expect(result.spec?.userOverride?.forceExclude).toContain("karpathy-coder");
  });

  it("existing install: action=exit returns reason=exit", async () => {
    const prompts = makePrompts({ selectAction: vi.fn(async () => "exit" as const) });
    const result = await runInteractive("/tmp/proj", {
      prompts,
      detect: () => existingState,
      isTty: () => true,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("exit");
    expect(prompts.selectTracks).not.toHaveBeenCalled();
  });

  it("existing install: action=remove returns disabled-action", async () => {
    const prompts = makePrompts({ selectAction: vi.fn(async () => "remove" as const) });
    const result = await runInteractive("/tmp/proj", {
      prompts,
      detect: () => existingState,
      isTty: () => true,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("disabled-action");
    expect(prompts.cancel).toHaveBeenCalledOnce();
  });

  it("existing install: action=update returns spec with mode=update + Track preservation", async () => {
    const prompts = makePrompts({
      selectAction: vi.fn(async () => "update" as const),
      confirmInstall: vi.fn(async () => true),
    });
    const result = await runInteractive("/tmp/proj", {
      prompts,
      detect: () => existingState,
      isTty: () => true,
    });
    expect(result.ok).toBe(true);
    expect(result.mode).toBe("update");
    expect(result.spec?.tracks).toEqual(existingState.tracks);
    expect(prompts.selectTracks).not.toHaveBeenCalled();
  });

  it("existing install: action=update + user declines confirm returns cancelled", async () => {
    const prompts = makePrompts({
      selectAction: vi.fn(async () => "update" as const),
      confirmInstall: vi.fn(async () => false),
    });
    const result = await runInteractive("/tmp/proj", {
      prompts,
      detect: () => existingState,
      isTty: () => true,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("cancelled");
  });

  it("existing install: action=reinstall passes through to track prompts (mode=reinstall)", async () => {
    const prompts = makePrompts({
      selectAction: vi.fn(async () => "reinstall" as const),
    });
    const result = await runInteractive("/tmp/proj", {
      prompts,
      detect: () => existingState,
      isTty: () => true,
    });
    expect(result.ok).toBe(true);
    expect(result.mode).toBe("reinstall");
  });

  it("existing install: action=add seeds initialTracks from detected", async () => {
    const selectTracks = vi.fn(async () => ["tooling", "data"] as Track[]);
    const prompts = makePrompts({
      selectAction: vi.fn(async () => "add" as const),
      selectTracks,
    });
    await runInteractive("/tmp/proj", {
      prompts,
      detect: () => existingState,
      isTty: () => true,
    });
    // v26.65.0 — 2번째 arg 는 step indicator. 본 test 는 첫 arg (initialTracks) 만 검증.
    const calls = selectTracks.mock.calls as ReadonlyArray<ReadonlyArray<unknown>>;
    expect(calls[0]?.[0]).toEqual(["tooling"]);
  });

  it("existing install: action=reinstall does not seed initialTracks", async () => {
    const selectTracks = vi.fn(async () => ["data"] as Track[]);
    const prompts = makePrompts({
      selectAction: vi.fn(async () => "reinstall" as const),
      selectTracks,
    });
    await runInteractive("/tmp/proj", {
      prompts,
      detect: () => existingState,
      isTty: () => true,
    });
    const calls = selectTracks.mock.calls as ReadonlyArray<ReadonlyArray<unknown>>;
    expect(calls[0]?.[0]).toBeUndefined();
  });

  it.each([
    ["selectAction", { selectAction: vi.fn(async () => null) }, true],
    ["selectTracks", { selectTracks: vi.fn(async () => null) }, false],
  ] as const)("cancellation in %s returns reason=cancelled", async (_label, override, useExisting) => {
    const prompts = makePrompts(override);
    const result = await runInteractive("/tmp/proj", {
      prompts,
      detect: () => (useExisting ? existingState : newState),
      isTty: () => true,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("cancelled");
  });

  it("v26.54.0 — ESC at selectCli goes back to selectTracks (silent back)", async () => {
    const selectTracks = vi
      .fn<(initial?: Track[]) => Promise<Track[] | null>>()
      .mockResolvedValueOnce(["tooling"] as Track[])
      .mockResolvedValueOnce(null);
    const selectCli = vi
      .fn<(initial?: CliTargets) => Promise<CliTargets | null>>()
      .mockResolvedValueOnce(null);
    const prompts = makePrompts({ selectTracks, selectCli });
    const result = await runInteractive("/tmp/proj", {
      prompts,
      detect: () => newState,
      isTty: () => true,
    });
    expect(selectTracks).toHaveBeenCalledTimes(2);
    expect(selectCli).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("cancelled");
  });

  it("v26.54.0 — ESC at selectInstallTargets goes back to selectCli (silent back)", async () => {
    const selectCli = vi
      .fn<(initial?: CliTargets) => Promise<CliTargets | null>>()
      .mockResolvedValueOnce(["claude"] as CliTargets)
      .mockResolvedValueOnce(null);
    const selectTracks = vi
      .fn<(initial?: Track[]) => Promise<Track[] | null>>()
      .mockResolvedValueOnce(["tooling"] as Track[])
      .mockResolvedValueOnce(null);
    const selectInstallTargets = vi
      .fn<
        (initial: ReadonlyArray<InstallTargetId>) => Promise<ReadonlyArray<InstallTargetId> | null>
      >()
      .mockResolvedValueOnce(null);
    const prompts = makePrompts({ selectTracks, selectCli, selectInstallTargets });
    const result = await runInteractive("/tmp/proj", {
      prompts,
      detect: () => newState,
      isTty: () => true,
    });
    expect(selectInstallTargets).toHaveBeenCalledTimes(1);
    expect(selectCli).toHaveBeenCalledTimes(2);
    expect(selectTracks).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(false);
  });

  // v26.64.0 (ADR-020) — Scope step 추가로 confirm 의 silent back 은 이제 selectScope 로.
  // selectInstallTargets 는 1번만 호출됨 (scope 가 새 backstep).
  it("v26.64.0 — ESC at confirm goes back to selectScope (silent back)", async () => {
    const confirmInstall = vi
      .fn<(summary: string) => Promise<boolean | null>>()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(true);
    const selectInstallTargets = vi.fn(async (initial: ReadonlyArray<InstallTargetId>) => initial);
    const selectScope = vi.fn(async () => "project" as const);
    const prompts = makePrompts({ confirmInstall, selectInstallTargets, selectScope });
    const result = await runInteractive("/tmp/proj", {
      prompts,
      detect: () => newState,
      isTty: () => true,
    });
    expect(result.ok).toBe(true);
    expect(confirmInstall).toHaveBeenCalledTimes(2);
    expect(selectScope).toHaveBeenCalledTimes(2);
    expect(selectInstallTargets).toHaveBeenCalledTimes(1);
  });

  it("v26.54.0 — Step 1 ESC emits cancel message (not silent)", async () => {
    const prompts = makePrompts({ selectTracks: vi.fn(async () => null) });
    await runInteractive("/tmp/proj", {
      prompts,
      detect: () => newState,
      isTty: () => true,
    });
    expect(prompts.cancel).toHaveBeenCalledWith("Cancelled.");
  });

  it("v26.54.0 — Step 2/3/confirm ESC do not emit cancel message (silent back)", async () => {
    const selectTracks = vi
      .fn<(initial?: Track[]) => Promise<Track[] | null>>()
      .mockResolvedValueOnce(["tooling"] as Track[])
      .mockResolvedValueOnce(["tooling"] as Track[])
      .mockResolvedValueOnce(["tooling"] as Track[]);
    const selectCli = vi
      .fn<(initial?: CliTargets) => Promise<CliTargets | null>>()
      .mockResolvedValueOnce(null) // step2 ESC → back to step1 (silent)
      .mockResolvedValueOnce(["claude"] as CliTargets)
      .mockResolvedValueOnce(["claude"] as CliTargets);
    const selectInstallTargets = vi
      .fn<
        (initial: ReadonlyArray<InstallTargetId>) => Promise<ReadonlyArray<InstallTargetId> | null>
      >()
      .mockResolvedValueOnce(null) // step3 ESC → back to step2 (silent)
      .mockResolvedValueOnce([] as ReadonlyArray<InstallTargetId>);
    const confirmInstall = vi
      .fn<(summary: string) => Promise<boolean | null>>()
      .mockResolvedValueOnce(null) // confirm ESC → back to step3 (silent)
      .mockResolvedValueOnce(true);
    const prompts = makePrompts({
      selectTracks,
      selectCli,
      selectInstallTargets,
      confirmInstall,
    });
    const result = await runInteractive("/tmp/proj", {
      prompts,
      detect: () => newState,
      isTty: () => true,
    });
    expect(result.ok).toBe(true);
    // Step1 미통과 ESC 없음 → cancel 호출 0
    expect(prompts.cancel).not.toHaveBeenCalled();
  });

  it("v26.54.0 — preset change resets install-targets to new recommendations", async () => {
    const selectTracks = vi
      .fn<(initial?: Track[]) => Promise<Track[] | null>>()
      .mockResolvedValueOnce(["csr-supabase"] as Track[])
      .mockResolvedValueOnce(["csr-fastapi"] as Track[]);
    const selectCli = vi
      .fn<(initial?: CliTargets) => Promise<CliTargets | null>>()
      .mockResolvedValueOnce(null) // step2 ESC → back to step1
      .mockResolvedValueOnce(["claude"] as CliTargets);
    const selectInstallTargets = vi
      .fn<
        (initial: ReadonlyArray<InstallTargetId>) => Promise<ReadonlyArray<InstallTargetId> | null>
      >()
      .mockResolvedValueOnce([] as ReadonlyArray<InstallTargetId>);
    const prompts = makePrompts({ selectTracks, selectCli, selectInstallTargets });
    const result = await runInteractive("/tmp/proj", {
      prompts,
      detect: () => newState,
      isTty: () => true,
    });
    expect(result.ok).toBe(true);
    expect(result.spec?.tracks).toEqual(["csr-fastapi"]);
    const initialPassed = selectInstallTargets.mock.calls[0]?.[0] ?? [];
    // v26.71.0 — railway-skills 는 T3(추천 제외) → csr-fastapi 의 vetted 추천(impeccable)로 검증.
    expect(initialPassed.some((t) => t === "asset:impeccable")).toBe(true);
    expect(initialPassed.some((t) => t === "asset:vercel-cli")).toBe(false);
  });

  it("user declines confirm → reason=cancelled (without prompts.cancel)", async () => {
    const prompts = makePrompts({ confirmInstall: vi.fn(async () => false) });
    const result = await runInteractive("/tmp/proj", {
      prompts,
      detect: () => newState,
      isTty: () => true,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("cancelled");
    expect(prompts.outro).toHaveBeenCalledWith(expect.stringContaining("Cancelled"));
  });

  it("uses default deps without throwing the dep-resolution path", async () => {
    const original = process.stdin.isTTY;
    Object.defineProperty(process.stdin, "isTTY", { value: false, configurable: true });
    try {
      const result = await runInteractive("/tmp/x");
      expect(result.ok).toBe(false);
      expect(result.reason).toBe("no-tty");
    } finally {
      Object.defineProperty(process.stdin, "isTTY", { value: original, configurable: true });
    }
  });
});

describe("formatSummary", () => {
  it("formats with all options enabled", () => {
    const summary = formatSummary({
      tracks: ["tooling", "csr-fastapi"],
      options: {
        ...ALL_FALSE_OPTIONS,
        withPrune: true,
        withKarpathyHook: true,
      },
      cli: ["codex"],
      projectDir: "/proj",
    });
    expect(summary).toContain("tooling, csr-fastapi");
    // v26.81.0 (ADR-022) — Options 행은 잔존 동작 옵션만 표시.
    expect(summary).toContain("prune, karpathyhook");
    expect(summary).toContain("CLI:       codex");
    expect(summary).toContain("/proj");
  });

  it("renders '(none added)' when no opts toggled", () => {
    const summary = formatSummary({
      tracks: ["tooling"],
      options: ALL_FALSE_OPTIONS,
      cli: ["claude"],
      projectDir: "/p",
    });
    expect(summary).toContain("none added");
  });

  it("v26.54.0 — userOverride 표시 (forceInclude + forceExclude 각 라인)", () => {
    const summary = formatSummary({
      tracks: ["tooling"],
      options: ALL_FALSE_OPTIONS,
      cli: ["claude"],
      projectDir: "/p",
      userOverride: { forceInclude: ["railway-skills"], forceExclude: ["playwright-skill"] },
    });
    expect(summary).toContain("+User added: railway-skills");
    expect(summary).toContain("-User removed: playwright-skill");
  });
});

describe("toOptionFlags", () => {
  it("maps an empty array to all-false flags", () => {
    expect(toOptionFlags([])).toEqual(ALL_FALSE_OPTIONS);
  });

  it("sets only the keys present in the array to true", () => {
    expect(toOptionFlags(["withPrune", "withKarpathyHook"])).toEqual({
      ...ALL_FALSE_OPTIONS,
      withPrune: true,
      withKarpathyHook: true,
    });
  });
});

// v26.81.0 (ADR-022) — applyOptionRules(withPrune→withEcc) 삭제. prune→ecc 결합은
//   installer.ts eccSelected 로 이동 (tests/installer-11-track.test.ts 가 통합 검증).

describe("v26.54.0 — splitInstallTargets", () => {
  it("split mixed list of option:* and asset:* prefixed ids", () => {
    const { optionKeys, assetIds } = splitInstallTargets([
      "option:withPrune",
      "asset:playwright-skill",
      "option:withKarpathyHook",
      "asset:railway-skills",
    ]);
    expect(optionKeys).toEqual(["withPrune", "withKarpathyHook"]);
    expect(assetIds).toEqual(["playwright-skill", "railway-skills"]);
  });

  it("empty input → empty arrays", () => {
    const { optionKeys, assetIds } = splitInstallTargets([]);
    expect(optionKeys).toEqual([]);
    expect(assetIds).toEqual([]);
  });

  it("asset id with embedded colon survives prefix slice", () => {
    const { assetIds } = splitInstallTargets(["asset:foo:bar"]);
    expect(assetIds).toEqual(["foo:bar"]);
  });
});

describe("computeUserOverride", () => {
  // v26.87.0 — dev-method skills (official, has-dev-track) 가 tooling 추천에 합류.
  //   forceInclude/forceExclude diffing 의도는 동일 — recommended 기준선만 6종 늘어난다.
  const TOOLING_RECOMMENDED = [
    "agent-browser",
    "find-skills",
    // v26.92.0 — frontend-design (official, has-dev-track) → tooling 추천 집합 포함.
    "frontend-design",
    "karpathy-coder",
    "product-skills",
    "multi-persona-review",
    "gap-analysis-e2e",
    "ultracode-service-audit",
    "asis-tobe-decision",
    "compaction-handoff",
    "northstar-roadmap",
  ];

  it("selections == recommended → undefined (no override)", () => {
    // v26.71.0 — tooling 추천은 vetted 만 (T3 architecture-decision-record/playwright-skill 제외).
    // v26.87.0 — + dev-method skills 6종 (official).
    expect(computeUserOverride(["tooling"] as Track[], TOOLING_RECOMMENDED)).toBeUndefined();
  });

  it("forceExclude — 추천에서 unchecked", () => {
    // v26.71.0 — 새 추천(vetted)에서 karpathy-coder 를 uncheck → forceExclude.
    const without = TOOLING_RECOMMENDED.filter((id) => id !== "karpathy-coder");
    const result = computeUserOverride(["tooling"] as Track[], without);
    expect(result).toBeDefined();
    expect(result?.forceExclude).toEqual(["karpathy-coder"]);
    expect(result?.forceInclude).toEqual([]);
  });

  it("forceInclude — 추천 외 추가 선택", () => {
    // v26.71.0 — 새 추천(vetted) + railway-skills(T3, 추천 외) 추가 → forceInclude.
    const withRailway = [...TOOLING_RECOMMENDED, "railway-skills"];
    const result = computeUserOverride(["tooling"] as Track[], withRailway);
    expect(result?.forceInclude).toEqual(["railway-skills"]);
    expect(result?.forceExclude).toEqual([]);
  });

  it("mix — include + exclude 동시", () => {
    const mixed = ["agent-browser", "railway-skills"];
    const result = computeUserOverride(["tooling"] as Track[], mixed);
    expect(result?.forceInclude).toEqual(["railway-skills"]);
    expect(result?.forceExclude.length).toBeGreaterThan(0);
  });

  it("empty selection on track with recommendations → forceExclude all", () => {
    const result = computeUserOverride(["tooling"] as Track[], []);
    expect(result?.forceInclude).toEqual([]);
    expect(result?.forceExclude.length).toBeGreaterThan(0);
  });
});
