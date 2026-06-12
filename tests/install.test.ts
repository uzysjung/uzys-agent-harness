import { describe, expect, it, vi } from "vitest";
import { executeSpec, installAction, specFromOptions } from "../src/commands/install.js";
import type { BaselineReport, InstallReport } from "../src/installer.js";
import type { InstallSpec, Track } from "../src/types.js";

/**
 * Build a mock runPipeline that fires onProgress events from the supplied
 * report (so Phase 1 + Phase 2 streaming renders correctly in tests).
 */
function pipelineFor(report: InstallReport) {
  return vi.fn((_spec, _root, _mode, callbacks) => {
    const baseline: BaselineReport = {
      filesCopied: report.filesCopied,
      dirsCopied: report.dirsCopied,
      skipped: report.skipped,
      backup: report.backup,
      installedTracks: report.installedTracks,
      mcpServers: report.mcpServers,
      codex: report.codex,
      codexOptIn: report.codexOptIn,
      opencode: report.opencode,
      antigravity: report.antigravity,
      antigravityOptIn: report.antigravityOptIn,
      updateMode: report.updateMode,
      mode: report.mode,
      envFiles: report.envFiles,
      rootClaudeMd: null,
    };
    callbacks?.onProgress?.({ type: "baseline-complete", baseline });
    if (report.external && report.external.attempted.length > 0) {
      callbacks?.onProgress?.({
        type: "external-start",
        assetCount: report.external.attempted.length,
      });
      for (const r of report.external.attempted) {
        callbacks?.externalDeps?.onAssetStart?.(r.asset);
        callbacks?.externalDeps?.onAssetResult?.(r);
      }
      callbacks?.onProgress?.({ type: "external-complete", report: report.external });
    }
    return report;
  });
}

const fakeReport: InstallReport = {
  filesCopied: 5,
  dirsCopied: 2,
  skipped: 0,
  backup: null,
  installedTracks: ["tooling"],
  mcpServers: ["context7"],
  codex: null,
  codexOptIn: null,
  opencode: null,
  antigravity: null,
  antigravityOptIn: null,
  external: null,
  updateMode: null,
  karpathyHook: null,
  mode: "fresh",
  envFiles: {
    envExampleCreated: false,
    gitignoreEnvAdded: false,
    mcpAllowlist: null,
    gitignoreNpxSkillsAdded: [],
  },
};

describe("specFromOptions (v0.7.0 — CliTargets)", () => {
  it("returns ok=true with valid options", () => {
    const result = specFromOptions({ cli: ["codex"], track: ["tooling"] });
    expect(result.ok).toBe(true);
    expect(result.cli).toEqual(["codex"]);
  });

  // v0.8.0 — alias 제거. 3 base CLI만 valid.
  it.each([
    ["claude", ["claude"]],
    ["codex", ["codex"]],
    ["opencode", ["opencode"]],
  ] as const)("accepts %s — targets=%j", (mode, expected) => {
    const result = specFromOptions({ cli: mode, track: ["tooling"] });
    expect(result.ok).toBe(true);
    expect(result.cli).toEqual(expected);
    expect(result.warnings).toHaveLength(0);
  });

  // v0.8.0 — alias 제거: both/all → invalid reject
  it.each(["both", "all"] as const)("rejects '%s' alias (v0.8.0 BREAKING — removed)", (alias) => {
    const result = specFromOptions({ cli: alias, track: ["tooling"] });
    expect(result.ok).toBe(false);
    expect(result.message).toContain(`Invalid --cli value: ${alias}`);
    expect(result.message).toContain(`v0.8.0 removed '${alias}' alias`);
  });

  it("rejects an unknown --cli value with ok=false", () => {
    const result = specFromOptions({ cli: "rust", track: ["tooling"] });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("Invalid --cli value");
    expect(result.message).toContain("rust");
  });

  it("rejects when --track is missing/empty", () => {
    const noTrack = specFromOptions({ cli: ["claude"] });
    expect(noTrack.ok).toBe(false);
    expect(noTrack.message).toContain("--track is required");

    const empty = specFromOptions({ cli: ["claude"], track: [] });
    expect(empty.ok).toBe(false);
  });

  it("rejects an unknown track name", () => {
    const result = specFromOptions({ cli: ["claude"], track: ["bogus"] });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("Unknown track");
  });

  it("defaults --cli to [claude] when omitted but track is valid", () => {
    const result = specFromOptions({ track: ["tooling"] });
    expect(result.ok).toBe(true);
    expect(result.cli).toEqual(["claude"]);
  });

  it("repeatable --cli claude --cli codex → sorted [claude, codex]", () => {
    const result = specFromOptions({ cli: ["codex", "claude"], track: ["tooling"] });
    expect(result.ok).toBe(true);
    expect(result.cli).toEqual(["claude", "codex"]);
    expect(result.warnings).toHaveLength(0);
  });
});

describe("installAction", () => {
  it("logs install report on success", () => {
    const log = vi.fn();
    const err = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    const runPipeline = pipelineFor(fakeReport);
    installAction(
      { cli: ["codex"], track: ["tooling"], projectDir: "/tmp/p" },
      { log, err, exit, runPipeline, resolveHarnessRoot: () => "/h" },
    );
    expect(err).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("Install complete"));
    expect(log).toHaveBeenCalledWith(expect.stringContaining("tooling"));
    expect(log).toHaveBeenCalledWith(expect.stringContaining("5 files"));
    expect(runPipeline).toHaveBeenCalledOnce();
  });

  it("non-interactive tooling install hints experimental opt-in via --with (v26.71.1 — Transparent Defaults)", () => {
    const log = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    const runPipeline = pipelineFor(fakeReport);
    installAction(
      { cli: ["claude"], track: ["tooling"], projectDir: "/p" },
      { log, exit, runPipeline, resolveHarnessRoot: () => "/h" },
    );
    // WHY: T3 default 제외(R6)되더라도 사용자가 존재를 알도록 안내해야 함 (숨김 0건).
    expect(log).toHaveBeenCalledWith(expect.stringContaining("OPT-IN"));
    expect(log).toHaveBeenCalledWith(expect.stringContaining("playwright-skill"));
  });

  it("no opt-in hint when experimental already force-included via --with (v26.71.1)", () => {
    const log = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    const runPipeline = pipelineFor(fakeReport);
    installAction(
      {
        cli: ["claude"],
        track: ["tooling"],
        projectDir: "/p",
        with: ["playwright-skill", "architecture-decision-record"],
      },
      { log, exit, runPipeline, resolveHarnessRoot: () => "/h" },
    );
    const optInCalls = log.mock.calls.filter((call) => String(call[0]).includes("OPT-IN"));
    expect(optInCalls).toHaveLength(0);
  });

  it("calls err + exit(1) on invalid --cli", () => {
    const log = vi.fn();
    const err = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    const runPipeline = vi.fn();
    installAction(
      { cli: "rust", track: ["tooling"] },
      { log, err, exit, runPipeline, resolveHarnessRoot: () => "/h" },
    );
    expect(err).toHaveBeenCalledWith(expect.stringContaining("Invalid --cli value"));
    expect(exit).toHaveBeenCalledWith(1);
    expect(runPipeline).not.toHaveBeenCalled();
  });

  it("calls err + exit(1) when pipeline throws", () => {
    const log = vi.fn();
    const err = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    const runPipeline = vi.fn(() => {
      throw new Error("boom");
    });
    installAction(
      { cli: ["claude"], track: ["tooling"] },
      { log, err, exit, runPipeline, resolveHarnessRoot: () => "/h" },
    );
    expect(err).toHaveBeenCalledWith(expect.stringContaining("install failed"));
    expect(err).toHaveBeenCalledWith(expect.stringContaining("boom"));
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("normalizes --with-prune → --with-ecc=true in spec", () => {
    const log = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    let captured: InstallSpec | undefined;
    const runPipeline = vi.fn((spec: InstallSpec) => {
      captured = spec;
      return fakeReport;
    });
    installAction(
      { cli: ["claude"], track: ["tooling"], withPrune: true, projectDir: "/p" },
      { log, exit, runPipeline, resolveHarnessRoot: () => "/h" },
    );
    expect(captured?.options.withPrune).toBe(true);
    // v26.81.0 (ADR-022) — withEcc boolean 삭제. prune→ecc 결합은 installer 내부
    //   (eccSelected = isAssetSelected("ecc-plugin") || withPrune) 로 이동.
  });

  it("logs backup path when pipeline returns one", () => {
    const log = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    const runPipeline = pipelineFor({ ...fakeReport, backup: "/backup/.claude.bak" });
    installAction(
      { cli: ["claude"], track: ["tooling"] },
      { log, exit, runPipeline, resolveHarnessRoot: () => "/h" },
    );
    expect(log).toHaveBeenCalledWith(expect.stringContaining("/backup/.claude.bak"));
    expect(log).toHaveBeenCalledWith(expect.stringContaining("/backup/.claude.bak"));
  });

  it("logs '(none)' for MCP servers when list is empty", () => {
    const log = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    const runPipeline = pipelineFor({ ...fakeReport, mcpServers: [] });
    installAction(
      { cli: ["claude"], track: ["tooling"] },
      { log, exit, runPipeline, resolveHarnessRoot: () => "/h" },
    );
    expect(log).toHaveBeenCalledWith(expect.stringContaining("(none)"));
  });
});

describe("executeSpec", () => {
  const baseSpec: InstallSpec = {
    tracks: ["tooling"],
    options: {
      withPrune: false,
      withCodexSkills: false,
      withCodexTrust: false,
      withKarpathyHook: false,
      withCodexPrompts: false,
      withAntigravityGlobal: false,
    },
    cli: ["claude"],
    projectDir: "/p",
  };

  it("logs install report on success (claude only)", () => {
    const log = vi.fn();
    const err = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    const runPipeline = pipelineFor(fakeReport);
    executeSpec(baseSpec, { log, err, exit, runPipeline, resolveHarnessRoot: () => "/h" });
    expect(err).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("Install complete"));
    expect(runPipeline).toHaveBeenCalledOnce();
  });

  it("renders Codex line when report.codex is present", () => {
    const log = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    const runPipeline = pipelineFor({
      ...fakeReport,
      codex: {
        agentsMdPath: "/p/AGENTS.md",
        configTomlPath: "/p/.codex/config.toml",
        hookFiles: ["/p/.codex/hooks/a.sh", "/p/.codex/hooks/b.sh"],
        skillFiles: ["/p/.agents/skills/uzys-spec/SKILL.md"],
        promptFiles: [],
      },
    });
    executeSpec(
      { ...baseSpec, cli: ["codex"] },
      { log, exit, runPipeline, resolveHarnessRoot: () => "/h" },
    );
    expect(log).toHaveBeenCalledWith(expect.stringContaining("Codex"));
  });

  it("renders OpenCode line when report.opencode is present", () => {
    const log = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    const runPipeline = pipelineFor({
      ...fakeReport,
      opencode: {
        agentsMdPath: "/p/AGENTS.md",
        opencodeJsonPath: "/p/opencode.json",
        commandFiles: Array.from({ length: 6 }, (_, i) => `/p/.opencode/commands/uzys-${i}.md`),
        pluginPath: "/p/.opencode/plugins/uzys-harness.ts",
      },
    });
    executeSpec(
      { ...baseSpec, cli: ["opencode"] },
      { log, exit, runPipeline, resolveHarnessRoot: () => "/h" },
    );
    expect(log).toHaveBeenCalledWith(expect.stringContaining("OpenCode"));
  });

  it("logs warn when skipped > 0", () => {
    const log = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    const runPipeline = pipelineFor({ ...fakeReport, skipped: 3 });
    executeSpec(baseSpec, { log, exit, runPipeline, resolveHarnessRoot: () => "/h" });
    // skipped row is rendered with `assetRow("skip", ...)` → contains the count
    expect(log).toHaveBeenCalledWith(expect.stringContaining("skipped"));
  });

  it("logs Backup info when report.backup present", () => {
    const log = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    const runPipeline = pipelineFor({ ...fakeReport, backup: "/p/.claude.backup-123" });
    executeSpec(baseSpec, { log, exit, runPipeline, resolveHarnessRoot: () => "/h" });
    expect(log).toHaveBeenCalledWith(expect.stringContaining("/p/.claude.backup-123"));
  });

  it("renders 'Claude · Codex · OpenCode' line for cli=all", () => {
    const log = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    const runPipeline = pipelineFor({
      ...fakeReport,
      codex: {
        agentsMdPath: "/p/AGENTS.md",
        configTomlPath: "/p/.codex/config.toml",
        hookFiles: [],
        skillFiles: [],
        promptFiles: [],
      },
      opencode: {
        agentsMdPath: "/p/AGENTS.md",
        opencodeJsonPath: "/p/opencode.json",
        commandFiles: [],
        pluginPath: "/p/.opencode/plugins/uzys-harness.ts",
      },
    });
    executeSpec(
      { ...baseSpec, cli: ["claude", "codex", "opencode"] },
      { log, exit, runPipeline, resolveHarnessRoot: () => "/h" },
    );
    expect(log).toHaveBeenCalledWith(expect.stringContaining("Claude · Codex · OpenCode"));
  });

  it("renders 'Claude · Codex' line for cli=both (Codex only)", () => {
    const log = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    const runPipeline = pipelineFor({
      ...fakeReport,
      codex: {
        agentsMdPath: "/p/AGENTS.md",
        configTomlPath: "/p/.codex/config.toml",
        hookFiles: [],
        skillFiles: [],
        promptFiles: [],
      },
    });
    executeSpec(
      { ...baseSpec, cli: ["claude", "codex"] },
      { log, exit, runPipeline, resolveHarnessRoot: () => "/h" },
    );
    expect(log).toHaveBeenCalledWith(expect.stringContaining("Claude · Codex"));
  });

  it("renders 'OpenCode' (not 'Claude · OpenCode') when claude is NOT selected", () => {
    // v26.78.1 (R2): Summary CLI 행은 spec.cli 에서 derive — claude 미선택 시 "Claude"
    //   prepend 하지 않는다. WHY: claude baseline 은 spec.cli.includes("claude") 시에만
    //   설치(installer.ts:265)되므로, claude 없이 "Claude" 표기는 거짓 (설치 안 된 CLI 광고).
    const log = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    const runPipeline = pipelineFor({
      ...fakeReport,
      opencode: {
        agentsMdPath: "/p/AGENTS.md",
        opencodeJsonPath: "/p/opencode.json",
        commandFiles: [],
        pluginPath: "/p/.opencode/plugins/uzys-harness.ts",
      },
    });
    executeSpec(
      { ...baseSpec, cli: ["opencode"] },
      { log, exit, runPipeline, resolveHarnessRoot: () => "/h" },
    );
    expect(log).toHaveBeenCalledWith(expect.stringContaining("CLI"));
    expect(log).toHaveBeenCalledWith(expect.stringContaining("OpenCode"));
    // claude 미선택 → Summary CLI 행에 "Claude" 가 없어야 한다.
    const cliRow = log.mock.calls
      .map((args) => String(args[0]))
      .find((line) => line.includes("CLI") && line.includes("OpenCode"));
    expect(cliRow).toBeDefined();
    expect(cliRow).not.toContain("Claude");
  });

  // v26.78.1 (R2) — antigravity 가 Summary/산출물 양쪽에서 invisible 이던 회귀 가드.
  //   WHY: `--cli antigravity` 시 Summary CLI 행이 "Claude" 로 잘못 떴고(claude 무조건
  //   prepend) 산출물 섹션도 codex/opencode 게이트라 antigravity 자산이 화면에 0건 → 사용자가
  //   설치 결과를 못 봄 (Transparent Defaults + no-false-ship 위반).
  it("renders 'Antigravity' CLI row + .agents/ artifacts for cli=antigravity", () => {
    const log = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    const runPipeline = pipelineFor({
      ...fakeReport,
      antigravity: {
        rulesFile: "/p/.agents/rules/uzys-harness.md",
        skillFiles: ["/p/.agents/skills/uzys-spec/SKILL.md"],
        workflowFiles: ["/p/.agents/workflows/uzys-spec.md"],
      },
    });
    executeSpec(
      { ...baseSpec, cli: ["antigravity"] },
      { log, exit, runPipeline, resolveHarnessRoot: () => "/h" },
    );
    const lines = log.mock.calls.map((args) => String(args[0]));
    // Summary CLI 행 = "Antigravity" (claude prepend 없음).
    const cliRow = lines.find((line) => line.includes("CLI") && line.includes("Antigravity"));
    expect(cliRow).toBeDefined();
    expect(cliRow).not.toContain("Claude");
    // 산출물 섹션 헤더 + rules/skills/workflows 행.
    expect(lines.some((l) => l.includes("Antigravity artifacts"))).toBe(true);
    expect(lines.some((l) => l.includes(".agents/rules/uzys-harness.md"))).toBe(true);
    expect(lines.some((l) => l.includes(".agents/skills/uzys-*/SKILL.md"))).toBe(true);
    expect(lines.some((l) => l.includes(".agents/workflows/uzys-*.md"))).toBe(true);
  });

  // v26.78.1 (R1) — karpathy hook opt-in 실패가 무음이던 회귀 가드 (Rule 12 fail-loud).
  //   WHY: withKarpathyHook=true 인데 plugin install 실패(wired=false)면 사용자는 hook 이
  //   안 깔린 걸 모른 채 "Install complete" 만 본다. 성공/실패 둘 다 1행 노출 강제.
  it("renders a HOOK row when karpathy hook is wired", () => {
    const log = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    const runPipeline = pipelineFor({
      ...fakeReport,
      karpathyHook: { wired: true, settingsUpdated: true, hookScriptCopied: true },
    });
    executeSpec(baseSpec, { log, exit, runPipeline, resolveHarnessRoot: () => "/h" });
    const lines = log.mock.calls.map((args) => String(args[0]));
    expect(lines.some((l) => l.includes("HOOK") && l.includes("wired"))).toBe(true);
  });

  it("renders a HOOK skip row WITH reason when karpathy hook fails (not silent)", () => {
    const log = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    const runPipeline = pipelineFor({
      ...fakeReport,
      karpathyHook: { wired: false, reason: "plugin-install-failed" },
    });
    executeSpec(baseSpec, { log, exit, runPipeline, resolveHarnessRoot: () => "/h" });
    const lines = log.mock.calls.map((args) => String(args[0]));
    const hookRow = lines.find((l) => l.includes("HOOK"));
    expect(hookRow).toBeDefined();
    expect(hookRow).toContain("plugin-install-failed");
  });

  it("renders NO HOOK row when user did not opt in (karpathyHook null)", () => {
    const log = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    const runPipeline = pipelineFor({ ...fakeReport, karpathyHook: null });
    executeSpec(baseSpec, { log, exit, runPipeline, resolveHarnessRoot: () => "/h" });
    const lines = log.mock.calls.map((args) => String(args[0]));
    expect(lines.some((l) => l.includes("HOOK"))).toBe(false);
  });

  it("shortens long /private/tmp paths in TARGET row", () => {
    const log = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    const runPipeline = pipelineFor(fakeReport);
    executeSpec(
      {
        ...baseSpec,
        projectDir: "/private/tmp/some-very-long-path-that-exceeds-fifty-characters",
      },
      { log, exit, runPipeline, resolveHarnessRoot: () => "/h" },
    );
    const targetCall = log.mock.calls.find((args) =>
      typeof args[0] === "string" ? args[0].includes("TARGET") : false,
    );
    // /private prefix dropped
    expect(targetCall?.[0]).not.toContain("/private/");
    expect(targetCall?.[0]).toContain("/tmp/");
  });

  it("shortens HOME-relative paths in TARGET row", () => {
    const log = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    const runPipeline = pipelineFor(fakeReport);
    const home = process.env.HOME ?? "/Users/test";
    process.env.HOME = home;
    executeSpec(
      {
        ...baseSpec,
        projectDir: `${home}/some-very-long-project-name-here-that-is-over-fifty-chars`,
      },
      { log, exit, runPipeline, resolveHarnessRoot: () => "/h" },
    );
    const targetCall = log.mock.calls.find((args) =>
      typeof args[0] === "string" ? args[0].includes("TARGET") : false,
    );
    expect(targetCall?.[0]).toContain("~/");
  });

  it("formatOptions reflects enabled flags", () => {
    const log = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    const runPipeline = pipelineFor(fakeReport);
    executeSpec(
      {
        ...baseSpec,
        options: {
          withPrune: true,
          withCodexSkills: false,
          withCodexTrust: false,
          withKarpathyHook: true,
          withCodexPrompts: false,
          withAntigravityGlobal: false,
        },
      },
      { log, exit, runPipeline, resolveHarnessRoot: () => "/h" },
    );
    // v26.81.0 (ADR-022) — OPTIONS row 는 잔존 동작 옵션만 (자산 flag 13종 삭제됨).
    const optsCall = log.mock.calls.find((args) =>
      typeof args[0] === "string" ? args[0].includes("OPTIONS") : false,
    );
    expect(optsCall?.[0]).toContain("prune");
    expect(optsCall?.[0]).toContain("karpathy-hook");
  });

  it("renders Phase 2 (External Assets) when report.external has attempted entries", () => {
    const log = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    // Mock ExternalAsset — category/source placeholders (type compat only;
    // tests below assert install report rendering, not category/source semantics).
    const runPipeline = pipelineFor({
      ...fakeReport,
      external: {
        attempted: [
          {
            asset: {
              id: "test-skill",
              description: "test",
              category: "dev-tools" as const,
              source: "uzys" as const,
              tier: "vetted" as const,
              condition: { kind: "any-track" as const, tracks: ["tooling"] as Track[] },
              method: { kind: "skill", source: "owner/repo", skill: "react" } as const,
            },
            ok: true,
          },
          {
            asset: {
              id: "test-plugin",
              description: "plugin",
              category: "dev-tools" as const,
              source: "uzys" as const,
              tier: "vetted" as const,
              condition: { kind: "any-track" as const, tracks: ["tooling"] as Track[] },
              method: { kind: "plugin", marketplace: "ms/foo", pluginId: "foo@ms" } as const,
            },
            ok: true,
          },
          {
            asset: {
              id: "test-npm",
              description: "npm pkg",
              category: "dev-tools" as const,
              source: "uzys" as const,
              tier: "vetted" as const,
              condition: { kind: "any-track" as const, tracks: ["tooling"] as Track[] },
              method: { kind: "npm", pkg: "vercel", version: "54.0.0" } as const,
            },
            ok: true,
          },
          {
            asset: {
              id: "test-npx",
              description: "npx",
              category: "dev-tools" as const,
              source: "uzys" as const,
              tier: "vetted" as const,
              condition: { kind: "any-track" as const, tracks: ["tooling"] as Track[] },
              method: { kind: "npx-run", cmd: "gsd", version: "1.0.0" } as const,
            },
            ok: true,
          },
          {
            asset: {
              id: "test-shell",
              description: "shell",
              category: "dev-tools" as const,
              source: "uzys" as const,
              tier: "vetted" as const,
              condition: { kind: "any-track" as const, tracks: ["tooling"] as Track[] },
              method: {
                kind: "shell-script",
                script: "scripts/x.sh",
                args: [],
              } as const,
            },
            ok: false,
            message: "script missing",
          },
        ],
        succeeded: 4,
        skipped: 1,
      },
    });
    executeSpec(baseSpec, { log, exit, runPipeline, resolveHarnessRoot: () => "/h" });
    // Each asset id rendered
    expect(log).toHaveBeenCalledWith(expect.stringContaining("test-skill"));
    expect(log).toHaveBeenCalledWith(expect.stringContaining("test-plugin"));
    expect(log).toHaveBeenCalledWith(expect.stringContaining("test-npm"));
    expect(log).toHaveBeenCalledWith(expect.stringContaining("test-npx"));
    expect(log).toHaveBeenCalledWith(expect.stringContaining("test-shell"));
    // formatAssetMeta covered each kind
    expect(log).toHaveBeenCalledWith(expect.stringContaining("owner/repo · react"));
    expect(log).toHaveBeenCalledWith(expect.stringContaining("foo@ms"));
    // A2 — npm 라벨은 scope-중립 "npm · " (ADR-020 후 default project; "-g" 거짓 표기 제거).
    // v26.80.0 — 라벨에 pinned 버전 노출 (사용자가 실행되는 정확한 버전을 봄).
    expect(log).toHaveBeenCalledWith(expect.stringContaining("npm · vercel@54.0.0"));
    expect(log).toHaveBeenCalledWith(expect.stringContaining("npx · gsd@1.0.0"));
    // failed asset shows error message
    expect(log).toHaveBeenCalledWith(expect.stringContaining("script missing"));
    // v26.63.0 — unifiedSection "━━ External assets (N) ━━" (Phase 카운터 제거)
    expect(log).toHaveBeenCalledWith(expect.stringContaining("External assets"));
    // Summary WARN line for skipped
    expect(log).toHaveBeenCalledWith(expect.stringContaining("1 external asset"));
  });

  it("renders Phase 3 (instead of 2) for codex when external assets phase is rendered", () => {
    const log = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    const runPipeline = pipelineFor({
      ...fakeReport,
      external: {
        attempted: [
          {
            asset: {
              id: "x",
              description: "x",
              category: "dev-tools" as const,
              source: "uzys" as const,
              tier: "vetted" as const,
              condition: { kind: "any-track" as const, tracks: ["tooling"] as Track[] },
              method: { kind: "skill", source: "owner/repo" } as const,
            },
            ok: true,
          },
        ],
        succeeded: 1,
        skipped: 0,
      },
      codex: {
        agentsMdPath: "/p/AGENTS.md",
        configTomlPath: "/p/.codex/config.toml",
        hookFiles: [],
        skillFiles: [],
        promptFiles: [],
      },
    });
    executeSpec(
      { ...baseSpec, cli: ["codex"] },
      { log, exit, runPipeline, resolveHarnessRoot: () => "/h" },
    );
    // v26.63.0 — unifiedSection (Phase 카운터 제거). External assets + Codex artifacts 둘 다.
    expect(log).toHaveBeenCalledWith(expect.stringContaining("External assets"));
    expect(log).toHaveBeenCalledWith(expect.stringContaining("Codex"));
  });

  it("renders .env.example + .gitignore + .mcp-allowlist rows when envFiles flags set", () => {
    const log = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    const runPipeline = pipelineFor({
      ...fakeReport,
      envFiles: {
        envExampleCreated: true,
        gitignoreEnvAdded: true,
        mcpAllowlist: ["context7", "github", "supabase"],
        gitignoreNpxSkillsAdded: [],
      },
    });
    executeSpec(baseSpec, { log, exit, runPipeline, resolveHarnessRoot: () => "/h" });
    expect(log).toHaveBeenCalledWith(expect.stringContaining(".env.example"));
    expect(log).toHaveBeenCalledWith(expect.stringContaining(".gitignore"));
    expect(log).toHaveBeenCalledWith(expect.stringContaining(".mcp-allowlist"));
    expect(log).toHaveBeenCalledWith(expect.stringContaining("3 servers"));
  });

  it("renders Update Mode summary when report.updateMode is present", () => {
    const log = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    const runPipeline = pipelineFor({
      ...fakeReport,
      backup: "/p/.claude.backup-2026",
      mode: "update",
      updateMode: {
        updated: { ".claude/rules": 5, ".claude/agents": 0, ".claude/hooks": 2 },
        pruned: { ".claude/rules": ["orphan.md"], ".claude/hooks": [] },
        staleHookRefs: ["dead.sh"],
        claudeMdUpdated: true,
      },
    });
    executeSpec(baseSpec, {
      log,
      exit,
      runPipeline,
      resolveHarnessRoot: () => "/h",
      mode: "update",
    });
    expect(log).toHaveBeenCalledWith(expect.stringContaining("Update Mode"));
    expect(log).toHaveBeenCalledWith(expect.stringContaining("Update complete"));
    expect(log).toHaveBeenCalledWith(expect.stringContaining("5 files updated"));
    expect(log).toHaveBeenCalledWith(expect.stringContaining("ROLLBACK"));
    expect(log).toHaveBeenCalledWith(expect.stringContaining(".claude/CLAUDE.md"));
    expect(log).toHaveBeenCalledWith(expect.stringContaining("stale hook refs"));
    expect(log).toHaveBeenCalledWith(expect.stringContaining("orphan prune"));
  });

  it("renders 'add' / 'reinstall' header label for those modes", () => {
    const log = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    const runPipeline = pipelineFor(fakeReport);
    executeSpec(baseSpec, {
      log,
      exit,
      runPipeline,
      resolveHarnessRoot: () => "/h",
      mode: "add",
    });
    expect(log).toHaveBeenCalledWith(expect.stringContaining("uzys-claude-harness · add"));

    executeSpec(baseSpec, {
      log,
      exit,
      runPipeline,
      resolveHarnessRoot: () => "/h",
      mode: "reinstall",
    });
    expect(log).toHaveBeenCalledWith(expect.stringContaining("uzys-claude-harness · reinstall"));
  });

  it("renders Codex opt-in rows when codexOptIn report has skills + trust", () => {
    const log = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    const runPipeline = pipelineFor({
      ...fakeReport,
      codex: {
        agentsMdPath: "/p/AGENTS.md",
        configTomlPath: "/p/.codex/config.toml",
        hookFiles: [],
        skillFiles: [],
        promptFiles: [],
      },
      codexOptIn: {
        skillsInstalled: { enabled: true, count: 6, targetDir: "/Users/x/.codex/skills" },
        trustEntry: { enabled: true, status: "registered" as const },
        promptsInstalled: { enabled: false, count: 0, targetDir: "/test/.codex/prompts" },
      },
    });
    executeSpec(
      { ...baseSpec, cli: ["codex"] },
      { log, exit, runPipeline, resolveHarnessRoot: () => "/h" },
    );
    expect(log).toHaveBeenCalledWith(expect.stringContaining("~/.codex/skills/uzys-*"));
    expect(log).toHaveBeenCalledWith(expect.stringContaining("6 copied"));
    expect(log).toHaveBeenCalledWith(expect.stringContaining("trust entry"));
    expect(log).toHaveBeenCalledWith(expect.stringContaining('trust_level="trusted"'));
  });

  it("renders 'already present' for trust entry when previously registered", () => {
    const log = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    const runPipeline = pipelineFor({
      ...fakeReport,
      codex: {
        agentsMdPath: "/p/AGENTS.md",
        configTomlPath: "/p/.codex/config.toml",
        hookFiles: [],
        skillFiles: [],
        promptFiles: [],
      },
      codexOptIn: {
        skillsInstalled: { enabled: false, count: 0, targetDir: "/Users/x/.codex/skills" },
        trustEntry: { enabled: true, status: "already-present" as const },
        promptsInstalled: { enabled: false, count: 0, targetDir: "/test/.codex/prompts" },
      },
    });
    executeSpec(
      { ...baseSpec, cli: ["codex"] },
      { log, exit, runPipeline, resolveHarnessRoot: () => "/h" },
    );
    expect(log).toHaveBeenCalledWith(expect.stringContaining("already present"));
  });

  it("renders trust entry error as skip row", () => {
    const log = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    const runPipeline = pipelineFor({
      ...fakeReport,
      codex: {
        agentsMdPath: "/p/AGENTS.md",
        configTomlPath: "/p/.codex/config.toml",
        hookFiles: [],
        skillFiles: [],
        promptFiles: [],
      },
      codexOptIn: {
        skillsInstalled: { enabled: false, count: 0, targetDir: "/Users/x/.codex/skills" },
        trustEntry: { enabled: true, status: "error" as const, message: "permission denied" },
        promptsInstalled: { enabled: false, count: 0, targetDir: "/test/.codex/prompts" },
      },
    });
    executeSpec(
      { ...baseSpec, cli: ["codex"] },
      { log, exit, runPipeline, resolveHarnessRoot: () => "/h" },
    );
    expect(log).toHaveBeenCalledWith(expect.stringContaining("permission denied"));
  });

  it("shortens long non-HOME non-/private paths to '…/last3' fallback", () => {
    const log = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    const runPipeline = pipelineFor(fakeReport);
    // Force HOME mismatch: use /opt/very/long/non-home/project-name-that-is-over-fifty-chars
    const longPath = "/opt/some/very/long/path/way/over/fifty/chars/total/here/indeed";
    process.env.HOME = "/Users/never-matches";
    executeSpec(
      { ...baseSpec, projectDir: longPath },
      { log, exit, runPipeline, resolveHarnessRoot: () => "/h" },
    );
    const targetCall = log.mock.calls.find((args) =>
      typeof args[0] === "string" ? args[0].includes("TARGET") : false,
    );
    // Last 3 segments fallback
    expect(targetCall?.[0]).toContain("…/");
  });

  it("uses path as-is when ≤ 50 chars", () => {
    const log = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    const runPipeline = pipelineFor(fakeReport);
    const shortPath = "/short/p";
    executeSpec(
      { ...baseSpec, projectDir: shortPath },
      { log, exit, runPipeline, resolveHarnessRoot: () => "/h" },
    );
    const targetCall = log.mock.calls.find((args) =>
      typeof args[0] === "string" ? args[0].includes("TARGET") : false,
    );
    expect(targetCall?.[0]).toContain("/short/p");
  });

  it("err + exit(1) when pipeline throws", () => {
    const err = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    const runPipeline = vi.fn(() => {
      throw new Error("disk full");
    });
    executeSpec(baseSpec, {
      log: vi.fn(),
      err,
      exit,
      runPipeline,
      resolveHarnessRoot: () => "/h",
    });
    expect(err).toHaveBeenCalledWith(expect.stringContaining("install failed"));
    expect(err).toHaveBeenCalledWith(expect.stringContaining("disk full"));
    expect(exit).toHaveBeenCalledWith(1);
  });
});

describe("v26.51.0 — --no-codex-prompts bug fix (cac negation field 매핑)", () => {
  it("cli=codex + codexPrompts=false (cac negation) → withCodexPrompts=false (opt-out)", () => {
    const log = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    let captured: InstallSpec | undefined;
    const runPipeline = vi.fn((spec: InstallSpec) => {
      captured = spec;
      return fakeReport;
    });
    installAction(
      {
        cli: ["codex"],
        track: ["tooling"],
        codexPrompts: false, // cac --no-codex-prompts
        projectDir: "/p",
      },
      { log, exit, runPipeline, resolveHarnessRoot: () => "/h" },
    );
    expect(captured?.options.withCodexPrompts).toBe(false);
  });

  // v26.64.0 (ADR-020 BREAKING) — ADR-017 supersede. cli=codex + withUzysHarness 자동 ON 폐기.
  // withCodexPrompts 는 명시 `--with-codex-prompts` 시에만 true.
  it("v26.64.0 (ADR-020) — cli=codex + withUzysHarness 둘 다 켜져도 withCodexPrompts 자동 ON 안 함", () => {
    const log = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    let captured: InstallSpec | undefined;
    const runPipeline = vi.fn((spec: InstallSpec) => {
      captured = spec;
      return fakeReport;
    });
    installAction(
      { cli: ["codex"], track: ["tooling"], with: ["uzys-harness"], projectDir: "/p" },
      { log, exit, runPipeline, resolveHarnessRoot: () => "/h" },
    );
    expect(captured?.options.withCodexPrompts).toBe(false);
  });

  it("v26.56.0 (ADR-017 BREAKING) — cli=codex 단독 (uzys-harness 없음) → withCodexPrompts=false", () => {
    const log = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    let captured: InstallSpec | undefined;
    const runPipeline = vi.fn((spec: InstallSpec) => {
      captured = spec;
      return fakeReport;
    });
    installAction(
      { cli: ["codex"], track: ["tooling"], projectDir: "/p" },
      { log, exit, runPipeline, resolveHarnessRoot: () => "/h" },
    );
    // 기존 ADR-012 에서는 true 였음. ADR-017 BREAKING 으로 false.
    expect(captured?.options.withCodexPrompts).toBe(false);
  });

  it("v26.56.0 — 사용자 명시 --with-codex-prompts 는 uzys-harness 없어도 작동 (legacy override)", () => {
    const log = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    let captured: InstallSpec | undefined;
    const runPipeline = vi.fn((spec: InstallSpec) => {
      captured = spec;
      return fakeReport;
    });
    installAction(
      {
        cli: ["codex"],
        track: ["tooling"],
        withCodexPrompts: true,
        projectDir: "/p",
      },
      { log, exit, runPipeline, resolveHarnessRoot: () => "/h" },
    );
    expect(captured?.options.withCodexPrompts).toBe(true);
  });

  it("cli=claude + codexPrompts=false → warning (no effect)", () => {
    const log = vi.fn();
    const err = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    const runPipeline = pipelineFor(fakeReport);
    installAction(
      { cli: ["claude"], track: ["tooling"], codexPrompts: false },
      { log, err, exit, runPipeline, resolveHarnessRoot: () => "/h" },
    );
    expect(err).toHaveBeenCalledWith(
      expect.stringContaining("--no-codex-prompts has no effect without --cli codex"),
    );
  });
});

// v26.64.0 (ADR-020) — --scope flag 검증.
describe("v26.64.0 (ADR-020) — --scope flag", () => {
  it("default (no --scope) → spec.scope === 'project'", () => {
    const log = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    let captured: InstallSpec | undefined;
    const runPipeline = vi.fn((spec: InstallSpec) => {
      captured = spec;
      return fakeReport;
    });
    installAction(
      { cli: ["claude"], track: ["tooling"], projectDir: "/p" },
      { log, exit, runPipeline, resolveHarnessRoot: () => "/h" },
    );
    expect(captured?.scope).toBe("project");
  });

  it("--scope project → spec.scope === 'project'", () => {
    const log = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    let captured: InstallSpec | undefined;
    const runPipeline = vi.fn((spec: InstallSpec) => {
      captured = spec;
      return fakeReport;
    });
    installAction(
      { cli: ["claude"], track: ["tooling"], projectDir: "/p", scope: "project" },
      { log, exit, runPipeline, resolveHarnessRoot: () => "/h" },
    );
    expect(captured?.scope).toBe("project");
  });

  it("--scope global → spec.scope === 'global'", () => {
    const log = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    let captured: InstallSpec | undefined;
    const runPipeline = vi.fn((spec: InstallSpec) => {
      captured = spec;
      return fakeReport;
    });
    installAction(
      { cli: ["claude"], track: ["tooling"], projectDir: "/p", scope: "global" },
      { log, exit, runPipeline, resolveHarnessRoot: () => "/h" },
    );
    expect(captured?.scope).toBe("global");
  });

  it("--scope invalid → warn + fallback to 'project' (D16 safe default)", () => {
    const log = vi.fn();
    const err = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    let captured: InstallSpec | undefined;
    const runPipeline = vi.fn((spec: InstallSpec) => {
      captured = spec;
      return fakeReport;
    });
    installAction(
      { cli: ["claude"], track: ["tooling"], projectDir: "/p", scope: "nonsense" },
      { log, err, exit, runPipeline, resolveHarnessRoot: () => "/h" },
    );
    expect(captured?.scope).toBe("project");
    expect(err).toHaveBeenCalledWith(expect.stringContaining("Unknown --scope value 'nonsense'"));
  });
});

describe("v26.49.0 — --with/--without validation (unknown asset id)", () => {
  it("unknown id in --with → warning + skip (no fail)", () => {
    const log = vi.fn();
    const err = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    const runPipeline = pipelineFor(fakeReport);
    installAction(
      { cli: ["claude"], track: ["tooling"], with: "nonexistent-asset", projectDir: "/tmp/p" },
      { log, err, exit, runPipeline, resolveHarnessRoot: () => "/h" },
    );
    expect(err).toHaveBeenCalledWith(
      expect.stringContaining("Unknown asset id 'nonexistent-asset'"),
    );
    expect(exit).not.toHaveBeenCalled();
    expect(runPipeline).toHaveBeenCalledOnce();
  });

  it("known + unknown mix in --with → known applied, unknown warning", () => {
    const log = vi.fn();
    const err = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    const runPipeline = pipelineFor(fakeReport);
    installAction(
      {
        cli: ["claude"],
        track: ["tooling"],
        with: ["railway-skills", "nonexistent"],
        projectDir: "/tmp/p",
      },
      { log, err, exit, runPipeline, resolveHarnessRoot: () => "/h" },
    );
    expect(err).toHaveBeenCalledWith(expect.stringContaining("Unknown asset id 'nonexistent'"));
    expect(err).not.toHaveBeenCalledWith(expect.stringContaining("'railway-skills'"));
    expect(exit).not.toHaveBeenCalled();
  });

  it("unknown id in --without → warning + skip", () => {
    const log = vi.fn();
    const err = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    const runPipeline = pipelineFor(fakeReport);
    installAction(
      { cli: ["claude"], track: ["tooling"], without: "fake-id", projectDir: "/tmp/p" },
      { log, err, exit, runPipeline, resolveHarnessRoot: () => "/h" },
    );
    expect(err).toHaveBeenCalledWith(expect.stringContaining("Unknown asset id 'fake-id'"));
  });
});

describe("v26.48.0 — install helpers (coverage 복구)", () => {
  it("formatCliPhaseTitle: claude only → 'CLI artifacts'", async () => {
    const { formatCliPhaseTitle } = await import("../src/commands/install-render.js");
    expect(formatCliPhaseTitle(["claude"])).toBe("CLI artifacts");
  });

  it("formatCliPhaseTitle: codex only → 'Codex artifacts'", async () => {
    const { formatCliPhaseTitle } = await import("../src/commands/install-render.js");
    expect(formatCliPhaseTitle(["codex"])).toBe("Codex artifacts");
  });

  it("formatCliPhaseTitle: opencode only → 'OpenCode artifacts'", async () => {
    const { formatCliPhaseTitle } = await import("../src/commands/install-render.js");
    expect(formatCliPhaseTitle(["opencode"])).toBe("OpenCode artifacts");
  });

  it("formatCliPhaseTitle: codex + opencode → 'Codex + OpenCode artifacts'", async () => {
    const { formatCliPhaseTitle } = await import("../src/commands/install-render.js");
    expect(formatCliPhaseTitle(["codex", "opencode"])).toBe("Codex + OpenCode artifacts");
  });

  // v26.78.1 (R2) — antigravity 누락 시 "CLI artifacts" generic 으로만 떠 invisible 했음.
  it("formatCliPhaseTitle: antigravity only → 'Antigravity artifacts'", async () => {
    const { formatCliPhaseTitle } = await import("../src/commands/install-render.js");
    expect(formatCliPhaseTitle(["antigravity"])).toBe("Antigravity artifacts");
  });

  it("formatCliPhaseTitle: codex + antigravity → 'Codex + Antigravity artifacts'", async () => {
    const { formatCliPhaseTitle } = await import("../src/commands/install-render.js");
    expect(formatCliPhaseTitle(["codex", "antigravity"])).toBe("Codex + Antigravity artifacts");
  });

  it("shortenPath: short path (≤50) returns as-is", async () => {
    const { shortenPath } = await import("../src/commands/install-render.js");
    expect(shortenPath("/tmp/short")).toBe("/tmp/short");
  });

  it("shortenPath: HOME prefix → '~/...'", async () => {
    const { shortenPath } = await import("../src/commands/install-render.js");
    const home = process.env.HOME ?? "";
    if (home) {
      const long = `${home}/very/deep/nested/path/that/exceeds/50/characters/threshold`;
      expect(shortenPath(long).startsWith("~/")).toBe(true);
    }
  });

  it("shortenPath: /private/tmp/ → /tmp/", async () => {
    const { shortenPath } = await import("../src/commands/install-render.js");
    const long = "/private/tmp/very/deep/nested/path/that/exceeds/50/characters";
    expect(shortenPath(long).startsWith("/tmp/")).toBe(true);
  });

  it("shortenPath: long path without HOME match → '…/last3'", async () => {
    const { shortenPath } = await import("../src/commands/install-render.js");
    const origHome = process.env.HOME;
    process.env.HOME = "/nowhere-impossible-prefix-for-test";
    try {
      const path = "/opt/some/very/long/path/with/many/segments/to/exceed/limit";
      expect(shortenPath(path).startsWith("…/")).toBe(true);
    } finally {
      if (origHome === undefined) delete process.env.HOME;
      else process.env.HOME = origHome;
    }
  });

  it("shortenPath: long but ≤3 segments → unchanged (fallback)", async () => {
    const { shortenPath } = await import("../src/commands/install-render.js");
    const origHome = process.env.HOME;
    process.env.HOME = "/nowhere-impossible-prefix-for-test";
    try {
      const path = "/aaaaaaaaaaaaaaaaaaaaa/bbbbbbbbbbbbbbbbbbbbb/cccccccccccccccccccccc";
      expect(shortenPath(path)).toBe(path);
    } finally {
      if (origHome === undefined) delete process.env.HOME;
      else process.env.HOME = origHome;
    }
  });
});
