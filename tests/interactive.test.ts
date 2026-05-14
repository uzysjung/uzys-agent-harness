import { describe, expect, it, vi } from "vitest";
import {
  applyOptionRules,
  computeUserOverride,
  formatSummary,
  runInteractive,
  toOptionFlags,
} from "../src/interactive.js";
import type { Prompts } from "../src/prompts.js";
import type { DetectedInstall } from "../src/state.js";
import type { CliTargets, OptionFlags, Track } from "../src/types.js";

function makePrompts(overrides: Partial<Prompts> = {}): Prompts {
  return {
    intro: vi.fn(),
    outro: vi.fn(),
    cancel: vi.fn(),
    selectTracks: vi.fn(async () => ["tooling"] as Track[]),
    selectOptionKeys: vi.fn(async () => [] as Array<keyof OptionFlags>),
    selectCli: vi.fn(async () => ["claude"] as CliTargets),
    selectAction: vi.fn(async () => "add" as const),
    confirmInstall: vi.fn(async () => true),
    // v26.47.0 — Phase C full. default mock: 빈 선택 (preset 추천 그대로).
    selectExternalAssets: vi.fn(async (initial) => initial),
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

  it("happy path (new install) returns InstallSpec", async () => {
    const prompts = makePrompts();
    const result = await runInteractive("/tmp/proj", {
      prompts,
      detect: () => newState,
      isTty: () => true,
    });
    expect(result.ok).toBe(true);
    expect(result.spec).toEqual({
      tracks: ["tooling"],
      options: {
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
      },
      cli: ["claude"],
      projectDir: "/tmp/proj",
    });
    expect(prompts.selectAction).not.toHaveBeenCalled(); // skipped on new install
    expect(prompts.intro).toHaveBeenCalledOnce();
    expect(prompts.outro).toHaveBeenCalledOnce();
  });

  it("v26.46.0 — cli=codex auto-enables withCodexPrompts (ADR-012)", async () => {
    const selectCli = vi.fn(async () => ["claude", "codex"] as CliTargets);
    const prompts = makePrompts({ selectCli });
    const result = await runInteractive("/tmp/proj", {
      prompts,
      detect: () => newState,
      isTty: () => true,
    });
    expect(result.ok).toBe(true);
    expect(result.spec?.options.withCodexPrompts).toBe(true);
    expect(result.spec?.cli).toEqual(["claude", "codex"]);
  });

  it("v26.46.0 — cli without codex keeps withCodexPrompts=false", async () => {
    const prompts = makePrompts(); // default selectCli → ["claude"]
    const result = await runInteractive("/tmp/proj", {
      prompts,
      detect: () => newState,
      isTty: () => true,
    });
    expect(result.spec?.options.withCodexPrompts).toBe(false);
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
    // selectTracks NOT called — update preserves existing
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

  // v26.46.0 — Wizard back navigation: selectTracks/confirmInstall ESC=exit,
  // selectOptionKeys/selectCli ESC=back to previous step (not cancel).
  it.each([
    ["selectAction", { selectAction: vi.fn(async () => null) }, true],
    ["selectTracks", { selectTracks: vi.fn(async () => null) }, false],
    ["confirmInstall", { confirmInstall: vi.fn(async () => null) }, false],
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

  it("v26.46.0 — ESC at selectOptionKeys goes back to selectTracks (wizard back nav)", async () => {
    const selectTracks = vi
      .fn<(initial?: Track[]) => Promise<Track[] | null>>()
      .mockResolvedValueOnce(["tooling"] as Track[])
      .mockResolvedValueOnce(null); // 2번째 호출 = exit
    const selectOptionKeys = vi
      .fn<() => Promise<Array<keyof OptionFlags> | null>>()
      .mockResolvedValueOnce(null); // back to tracks
    const prompts = makePrompts({ selectTracks, selectOptionKeys });
    const result = await runInteractive("/tmp/proj", {
      prompts,
      detect: () => newState,
      isTty: () => true,
    });
    expect(selectTracks).toHaveBeenCalledTimes(2);
    expect(selectOptionKeys).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("cancelled");
  });

  it("v26.46.0 — ESC at selectCli goes back to selectOptionKeys (wizard back nav)", async () => {
    const selectOptionKeys = vi
      .fn<() => Promise<Array<keyof OptionFlags> | null>>()
      .mockResolvedValueOnce([] as Array<keyof OptionFlags>)
      .mockResolvedValueOnce(null); // 2번째 = back to tracks
    const selectTracks = vi
      .fn<(initial?: Track[]) => Promise<Track[] | null>>()
      .mockResolvedValueOnce(["tooling"] as Track[])
      .mockResolvedValueOnce(null); // 2번째 호출 시 exit
    const selectCli = vi
      .fn<(initial?: CliTargets) => Promise<CliTargets | null>>()
      .mockResolvedValueOnce(null); // back to options
    const prompts = makePrompts({ selectTracks, selectOptionKeys, selectCli });
    const result = await runInteractive("/tmp/proj", {
      prompts,
      detect: () => newState,
      isTty: () => true,
    });
    expect(selectCli).toHaveBeenCalledTimes(1);
    expect(selectOptionKeys).toHaveBeenCalledTimes(2);
    expect(selectTracks).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(false);
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
    // Force isTty=false default so we don't actually prompt; this exercises the
    // `?? defaultPrompts` and `?? detectInstallState` defaults at minimum.
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
        withTauri: true,
        withGsd: true,
        withEcc: true,
        withPrune: false,
        withTob: false,
        withCodexSkills: false,
        withCodexTrust: false,
        withKarpathyHook: false,
        withCodexPrompts: false,
        withAddyAgentSkills: false,
        withUzysHarness: false,
        withSuperpowers: false,
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
      options: {
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
      },
      cli: ["claude"],
      projectDir: "/p",
    });
    expect(summary).toContain("defaults only");
  });
});

describe("toOptionFlags", () => {
  it("maps an empty array to all-false flags", () => {
    expect(toOptionFlags([])).toEqual({
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
    });
  });

  it("sets only the keys present in the array to true", () => {
    expect(toOptionFlags(["withTauri", "withTob"])).toEqual({
      withTauri: true,
      withGsd: false,
      withEcc: false,
      withPrune: false,
      withTob: true,
      withCodexSkills: false,
      withCodexTrust: false,
      withKarpathyHook: false,
      withCodexPrompts: false,
      withAddyAgentSkills: false,
      withUzysHarness: false,
      withSuperpowers: false,
    });
  });
});

describe("applyOptionRules", () => {
  it("withPrune implies withEcc — sets withEcc=true if missing", () => {
    const result = applyOptionRules({
      withTauri: false,
      withGsd: false,
      withEcc: false,
      withPrune: true,
      withTob: false,
      withCodexSkills: false,
      withCodexTrust: false,
      withKarpathyHook: false,
      withCodexPrompts: false,
      withAddyAgentSkills: false,
      withUzysHarness: false,
      withSuperpowers: false,
    });
    expect(result.withEcc).toBe(true);
    expect(result.withPrune).toBe(true);
  });

  it("leaves flags unchanged when withPrune=false", () => {
    const flags: OptionFlags = {
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
    expect(applyOptionRules(flags)).toEqual(flags);
  });

  it("does nothing when withPrune+withEcc already both true", () => {
    const flags: OptionFlags = {
      withTauri: false,
      withGsd: false,
      withEcc: true,
      withPrune: true,
      withTob: false,
      withCodexSkills: false,
      withCodexTrust: false,
      withKarpathyHook: false,
      withCodexPrompts: false,
      withAddyAgentSkills: false,
      withUzysHarness: false,
      withSuperpowers: false,
    };
    expect(applyOptionRules(flags)).toEqual(flags);
  });
});

describe("v26.47.0 — computeUserOverride (Phase C full)", () => {
  it("null assetSelections → undefined (backward compat)", () => {
    expect(computeUserOverride(["tooling"] as Track[], null)).toBeUndefined();
  });

  it("selections == recommended → undefined (no override)", () => {
    // tooling preset 의 추천 자산을 그대로 선택 → diff 0
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
    // tooling 추천에서 playwright-skill 만 제거
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
    // tooling 추천 + railway-skills 추가
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
    const mixed = ["agent-browser", "railway-skills"]; // tooling 추천 5건 제거 + railway 추가
    const result = computeUserOverride(["tooling"] as Track[], mixed);
    expect(result?.forceInclude).toEqual(["railway-skills"]);
    expect(result?.forceExclude.length).toBeGreaterThan(0);
  });
});
