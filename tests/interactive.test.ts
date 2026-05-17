import { describe, expect, it, vi } from "vitest";
import {
  applyOptionRules,
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
  withTauri: false,
  withGsd: false,
  withEcc: false,
  withPrune: false,
  withTob: false,
  withCodexSkills: false,
  withCodexTrust: false,
  withKarpathyHook: false,
  withCodexPrompts: false,
  withAddyAgentSkills: false,
  withUzysHarness: false,
  withSuperpowers: false,
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

  it("v26.56.0 (ADR-017) — cli=codex + withUzysHarness 둘 다 → withCodexPrompts=true", async () => {
    const selectCli = vi.fn(async () => ["claude", "codex"] as CliTargets);
    // Step 3 에서 withUzysHarness 옵션 토글 → install-targets 에 "option:withUzysHarness" 포함
    const selectInstallTargets = vi.fn(async (initial: ReadonlyArray<InstallTargetId>) => [
      ...initial,
      "option:withUzysHarness" as InstallTargetId,
    ]);
    const prompts = makePrompts({ selectCli, selectInstallTargets });
    const result = await runInteractive("/tmp/proj", {
      prompts,
      detect: () => newState,
      isTty: () => true,
    });
    expect(result.ok).toBe(true);
    expect(result.spec?.options.withCodexPrompts).toBe(true);
    expect(result.spec?.options.withUzysHarness).toBe(true);
  });

  it("v26.56.0 (ADR-017 BREAKING) — cli=codex 단독 (uzys-harness 없음) → withCodexPrompts=false", async () => {
    const selectCli = vi.fn(async () => ["claude", "codex"] as CliTargets);
    const prompts = makePrompts({ selectCli });
    const result = await runInteractive("/tmp/proj", {
      prompts,
      detect: () => newState,
      isTty: () => true,
    });
    expect(result.ok).toBe(true);
    // 기존 ADR-012 에서는 true 였음. ADR-017 BREAKING 으로 false.
    expect(result.spec?.options.withCodexPrompts).toBe(false);
  });

  it("v26.46.0 — cli without codex keeps withCodexPrompts=false", async () => {
    const prompts = makePrompts();
    const result = await runInteractive("/tmp/proj", {
      prompts,
      detect: () => newState,
      isTty: () => true,
    });
    expect(result.spec?.options.withCodexPrompts).toBe(false);
  });

  it("v26.54.0 — option:withTauri checked in install-targets sets OptionFlags.withTauri=true", async () => {
    const selectInstallTargets = vi.fn(async (initial: ReadonlyArray<InstallTargetId>) => [
      ...initial,
      "option:withTauri" as InstallTargetId,
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
    expect(result.spec?.options.withTauri).toBe(true);
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
    const selectInstallTargets = vi.fn(async (initial: ReadonlyArray<InstallTargetId>) =>
      initial.filter((t) => t !== "asset:playwright-skill"),
    );
    const prompts = makePrompts({ selectInstallTargets });
    const result = await runInteractive("/tmp/proj", {
      prompts,
      detect: () => newState,
      isTty: () => true,
    });
    expect(result.ok).toBe(true);
    expect(result.spec?.userOverride?.forceExclude).toContain("playwright-skill");
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
    expect(selectTracks).toHaveBeenCalledWith(["tooling"]);
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
    expect(selectTracks).toHaveBeenCalledWith(undefined);
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

  it("v26.54.0 — ESC at confirm goes back to selectInstallTargets (silent back)", async () => {
    const confirmInstall = vi
      .fn<(summary: string) => Promise<boolean | null>>()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(true);
    const selectInstallTargets = vi.fn(async (initial: ReadonlyArray<InstallTargetId>) => initial);
    const prompts = makePrompts({ confirmInstall, selectInstallTargets });
    const result = await runInteractive("/tmp/proj", {
      prompts,
      detect: () => newState,
      isTty: () => true,
    });
    expect(result.ok).toBe(true);
    expect(confirmInstall).toHaveBeenCalledTimes(2);
    expect(selectInstallTargets).toHaveBeenCalledTimes(2);
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
    expect(initialPassed.some((t) => t === "asset:railway-skills")).toBe(true);
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
        withTauri: true,
        withGsd: true,
        withEcc: true,
      },
      cli: ["codex"],
      projectDir: "/proj",
    });
    expect(summary).toContain("tooling, csr-fastapi");
    expect(summary).toContain("tauri, gsd, ecc");
    expect(summary).toContain("CLI:       codex");
    expect(summary).toContain("/proj");
  });

  it("renders '(defaults only)' when no opts toggled", () => {
    const summary = formatSummary({
      tracks: ["tooling"],
      options: ALL_FALSE_OPTIONS,
      cli: ["claude"],
      projectDir: "/p",
    });
    expect(summary).toContain("defaults only");
  });

  it("v26.54.0 — userOverride 표시 (forceInclude + forceExclude 각 라인)", () => {
    const summary = formatSummary({
      tracks: ["tooling"],
      options: ALL_FALSE_OPTIONS,
      cli: ["claude"],
      projectDir: "/p",
      userOverride: { forceInclude: ["railway-skills"], forceExclude: ["playwright-skill"] },
    });
    expect(summary).toContain("+Assets: railway-skills");
    expect(summary).toContain("-Assets: playwright-skill");
  });
});

describe("toOptionFlags", () => {
  it("maps an empty array to all-false flags", () => {
    expect(toOptionFlags([])).toEqual(ALL_FALSE_OPTIONS);
  });

  it("sets only the keys present in the array to true", () => {
    expect(toOptionFlags(["withTauri", "withTob"])).toEqual({
      ...ALL_FALSE_OPTIONS,
      withTauri: true,
      withTob: true,
    });
  });
});

describe("applyOptionRules", () => {
  it("withPrune implies withEcc — sets withEcc=true if missing", () => {
    const result = applyOptionRules({ ...ALL_FALSE_OPTIONS, withPrune: true });
    expect(result.withEcc).toBe(true);
    expect(result.withPrune).toBe(true);
  });

  it("leaves flags unchanged when withPrune=false", () => {
    expect(applyOptionRules(ALL_FALSE_OPTIONS)).toEqual(ALL_FALSE_OPTIONS);
  });

  it("does nothing when withPrune+withEcc already both true", () => {
    const flags: OptionFlags = { ...ALL_FALSE_OPTIONS, withEcc: true, withPrune: true };
    expect(applyOptionRules(flags)).toEqual(flags);
  });
});

describe("v26.54.0 — splitInstallTargets", () => {
  it("split mixed list of option:* and asset:* prefixed ids", () => {
    const { optionKeys, assetIds } = splitInstallTargets([
      "option:withTauri",
      "asset:playwright-skill",
      "option:withUzysHarness",
      "asset:railway-skills",
    ]);
    expect(optionKeys).toEqual(["withTauri", "withUzysHarness"]);
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
  it("selections == recommended → undefined (no override)", () => {
    const recommended = [
      "agent-browser",
      "architecture-decision-record",
      "find-skills",
      "karpathy-coder",
      "playwright-skill",
      "product-skills",
    ];
    expect(computeUserOverride(["tooling"] as Track[], recommended)).toBeUndefined();
  });

  it("forceExclude — 추천에서 unchecked", () => {
    const without = [
      "agent-browser",
      "architecture-decision-record",
      "find-skills",
      "karpathy-coder",
      "product-skills",
    ];
    const result = computeUserOverride(["tooling"] as Track[], without);
    expect(result).toBeDefined();
    expect(result?.forceExclude).toEqual(["playwright-skill"]);
    expect(result?.forceInclude).toEqual([]);
  });

  it("forceInclude — 추천 외 추가 선택", () => {
    const withRailway = [
      "agent-browser",
      "architecture-decision-record",
      "find-skills",
      "karpathy-coder",
      "playwright-skill",
      "product-skills",
      "railway-skills",
    ];
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
