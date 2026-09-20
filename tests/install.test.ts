import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { executeSpec, installAction, specFromOptions } from "../src/commands/install.js";
import { estimateTokens } from "../src/context-cost.js";
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
      baselineExcluded: [],
      baselineExcludedOnDisk: [],
      baselineForeignOwned: [],
      backup: report.backup,
      installedTracks: report.installedTracks,
      mcpServers: report.mcpServers,
      codex: report.codex,
      codexOptIn: report.codexOptIn,
      opencode: report.opencode,
      antigravity: report.antigravity,
      ciScaffold: report.ciScaffold,
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
  baselineExcluded: [],
  baselineExcludedOnDisk: [],
  baselineForeignOwned: [],
  backup: null,
  installedTracks: ["tooling"],
  mcpServers: ["context7"],
  codex: null,
  codexOptIn: null,
  opencode: null,
  antigravity: null,
  ciScaffold: null,
  external: null,
  updateMode: null,
  staleHookRefs: [],
  mode: "fresh",
  envFiles: {
    envExampleCreated: false,
    gitignoreEnvAdded: false,
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
      { cli: ["claude"], track: ["tooling"], withCodexTrust: true, projectDir: "/p" },
      { log, exit, runPipeline, resolveHarnessRoot: () => "/h" },
    );
    expect(captured?.options.withCodexTrust).toBe(true);
    // #492 — 동작 플래그는 `--with-codex-trust` 하나만 남았다(`--with-prune` 은 ECC 자산과 함께
    //   은퇴). 자산 선택은 `--with <id>`(userOverride) 경로다.
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
      withCodexTrust: false,
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
        ownership: { files: [], backedUp: [], backupPaths: [], updated: 0, foreignOwned: [] },
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
        skillFiles: Array.from({ length: 6 }, (_, i) => `/p/.agents/skills/s-${i}/SKILL.md`),
        retiredCommands: [],
        ownership: { files: [], backedUp: [], backupPaths: [], updated: 0, foreignOwned: [] },
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
        ownership: { files: [], backedUp: [], backupPaths: [], updated: 0, foreignOwned: [] },
      },
      opencode: {
        agentsMdPath: "/p/AGENTS.md",
        opencodeJsonPath: "/p/opencode.json",
        skillFiles: [],
        retiredCommands: [],
        ownership: { files: [], backedUp: [], backupPaths: [], updated: 0, foreignOwned: [] },
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
        ownership: { files: [], backedUp: [], backupPaths: [], updated: 0, foreignOwned: [] },
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
        skillFiles: [],
        retiredCommands: [],
        ownership: { files: [], backedUp: [], backupPaths: [], updated: 0, foreignOwned: [] },
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
        harnessRuleFiles: [],
        skillFiles: ["/p/.agents/skills/compaction-handoff/SKILL.md"],
        ownership: { files: [], backedUp: [], backupPaths: [], updated: 0, foreignOwned: [] },
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
    // 산출물 섹션 헤더 + rules/skills 행 (6-Gate workflows 제거 — project context rules + dev-method skills).
    expect(lines.some((l) => l.includes("Antigravity artifacts"))).toBe(true);
    expect(lines.some((l) => l.includes(".agents/rules/uzys-harness.md"))).toBe(true);
    // ADR-086 — 이제 디렉터리째 간다. 라벨도 파일이 아니라 디렉터리다.
    // 옛 라벨의 진부분 문자열이라 includes 로는 회귀를 못 문다 — 뒤에 SKILL 이 오면 실패해야 한다.
    expect(lines.some((l) => /\.agents\/skills\/<id>\/(?!SKILL)/.test(l))).toBe(true);
  });

  /**
   * M-1 — fresh/add/reinstall 분기의 stale hook ref 보고.
   *
   * WHY: 치유기를 install 경로에서도 부르기로 한 처방(A′)의 **채택 조건이 소리를 내는 것**이었다.
   * 경쟁안이던 "훅 커맨드가 스스로 파일 존재를 확인하고 조용히 넘어간다"(B)는
   * *지금 유일한 파손 신호(bash exit 127)를 지우면서 아무 말도 안 한다* 는 이유로 기각됐다.
   * 즉 **렌더가 빠지면 채택안이 기각안으로 퇴화한다** — 이 테스트가 그 퇴화를 막는다.
   * update 분기는 위 `"renders Update Mode summary…"` 가 이미 지킨다.
   *
   * **라벨만 단언하지 않는다.** 경로 나열이 빠지면 사용자는 "2 removed" 만 보고 *무엇이*
   * 지워졌는지 모르며, 그 상태로는 자기 훅이 사라진 이유를 추적할 방법이 없다. 그래서
   * 건수와 경로를 **둘 다** 단언하고, 참조를 2건 넣어 나열이 잘리지 않는지까지 본다.
   */
  it("fresh 분기가 제거된 stale hook ref 를 라벨·건수·경로로 노출한다 (무음 금지)", () => {
    const log = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    const runPipeline = pipelineFor({
      ...fakeReport,
      staleHookRefs: ["skills/sidecar-skill/suggest.sh", "hooks/legacy-thing.sh"],
    });
    executeSpec(baseSpec, { log, exit, runPipeline, resolveHarnessRoot: () => "/h" });

    const row = log.mock.calls
      .map((args) => String(args[0]))
      .find((l) => l.includes("stale hook refs"));
    expect(
      row,
      "fresh 분기에 stale hook ref 행이 없다 — install 이 사용자의 settings.json 에서 훅을 " +
        "지우면서 아무 말도 안 한다. 무음 no-op 은 이 처방의 기각 사유였다.",
    ).toBeDefined();
    expect(row).toContain("2 removed");
    // 경로 나열 — 하나라도 빠지면 사용자가 그 파일을 못 찾는다 (건수만으로는 추적 불가).
    expect(row).toContain("skills/sidecar-skill/suggest.sh");
    expect(row).toContain("hooks/legacy-thing.sh");
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
          withCodexTrust: true,
        },
      },
      { log, exit, runPipeline, resolveHarnessRoot: () => "/h" },
    );
    // v26.81.0 (ADR-022) — OPTIONS row 는 잔존 동작 옵션만 (자산 flag 13종 삭제됨).
    const optsCall = log.mock.calls.find((args) =>
      typeof args[0] === "string" ? args[0].includes("OPTIONS") : false,
    );
    // #492 — 잔존 동작 옵션은 codex-trust 하나다(prune 은 ECC 자산과 함께 은퇴).
    expect(optsCall?.[0]).toContain("codex-trust");
    expect(optsCall?.[0]).not.toContain("prune");
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
              id: "test-internal",
              description: "internal",
              category: "dev-tools" as const,
              source: "uzys" as const,
              tier: "vetted" as const,
              condition: { kind: "any-track" as const, tracks: ["tooling"] as Track[] },
              method: { kind: "internal", key: "ci-scaffold" } as const,
            },
            ok: false,
            message: "template missing",
          },
        ],
        succeeded: 4,
        skipped: 1,
        excludedByCli: [],
      },
    });
    executeSpec(baseSpec, { log, exit, runPipeline, resolveHarnessRoot: () => "/h" });
    // Each asset id rendered
    expect(log).toHaveBeenCalledWith(expect.stringContaining("test-skill"));
    expect(log).toHaveBeenCalledWith(expect.stringContaining("test-plugin"));
    expect(log).toHaveBeenCalledWith(expect.stringContaining("test-npm"));
    expect(log).toHaveBeenCalledWith(expect.stringContaining("test-npx"));
    expect(log).toHaveBeenCalledWith(expect.stringContaining("test-internal"));
    // formatAssetMeta covered each kind
    expect(log).toHaveBeenCalledWith(expect.stringContaining("owner/repo · react"));
    expect(log).toHaveBeenCalledWith(expect.stringContaining("foo@ms"));
    // A2 — npm 라벨은 scope-중립 "npm · " (ADR-020 후 default project; "-g" 거짓 표기 제거).
    // v26.80.0 — 라벨에 pinned 버전 노출 (사용자가 실행되는 정확한 버전을 봄).
    expect(log).toHaveBeenCalledWith(expect.stringContaining("npm · vercel@54.0.0"));
    expect(log).toHaveBeenCalledWith(expect.stringContaining("npx · gsd@1.0.0"));
    // failed asset shows error message
    expect(log).toHaveBeenCalledWith(expect.stringContaining("template missing"));
    // v26.63.0 — unifiedSection "━━ External assets (N) ━━" (Phase 카운터 제거)
    expect(log).toHaveBeenCalledWith(expect.stringContaining("External assets"));
    // Summary WARN line for skipped
    expect(log).toHaveBeenCalledWith(expect.stringContaining("1 external asset"));
  });

  it('npm 자산은 결과 행 전에 진행 중 한 줄을 낸다 — 수 분의 침묵이 "멈춤"으로 보였다 (#422)', () => {
    const log = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    const npmAsset = {
      id: "netlify-cli",
      description: "Netlify CLI (npm)",
      category: "backend" as const,
      source: "netlify" as const,
      tier: "vetted" as const,
      condition: { kind: "opt-in" as const },
      method: { kind: "npm" as const, pkg: "netlify-cli", version: "26.1.0" },
    };
    const skillAsset = {
      ...npmAsset,
      id: "some-skill",
      method: { kind: "skill" as const, source: "owner/repo" },
    };
    executeSpec(baseSpec, {
      log,
      exit,
      runPipeline: pipelineFor({
        ...fakeReport,
        external: {
          attempted: [
            { asset: npmAsset, ok: true },
            { asset: skillAsset, ok: true },
          ],
          succeeded: 2,
          skipped: 0,
          excludedByCli: [],
        },
      }),
      resolveHarnessRoot: () => "/h",
    });
    const lines = log.mock.calls.map((c) => String(c[0]));
    const pending = lines.findIndex(
      (l) => l.includes("… netlify-cli") && l.includes("npm install netlify-cli@26.1.0"),
    );
    const result = lines.findIndex(
      (l) => l.includes("netlify-cli") && l.includes("npm · netlify-cli@26.1.0"),
    );
    expect(pending, "진행 중 줄이 없다").toBeGreaterThanOrEqual(0);
    expect(pending, "진행 중 줄이 결과 행보다 뒤에 있다").toBeLessThan(result);
    // 대조군: 스킬 자산은 F2 결정대로 결과 1행뿐
    expect(lines.some((l) => l.includes("… some-skill"))).toBe(false);
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
        excludedByCli: [],
      },
      codex: {
        agentsMdPath: "/p/AGENTS.md",
        configTomlPath: "/p/.codex/config.toml",
        hookFiles: [],
        skillFiles: [],
        ownership: { files: [], backedUp: [], backupPaths: [], updated: 0, foreignOwned: [] },
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

  // 2026-08-16 (ADR-072) — `.mcp-allowlist` 행 단언 삭제. 그 파일을 만들지 않으므로 렌더할
  // 행 자체가 없다. 같은 블록의 나머지 두 행은 남는다 — 이 테스트가 무는 것은 "envFiles 플래그가
  // 화면에 도달하는가"이고, 그 술어는 자산 하나가 빠져도 여전히 유효하다.
  it("renders .env.example + .gitignore rows when envFiles flags set", () => {
    const log = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    const runPipeline = pipelineFor({
      ...fakeReport,
      envFiles: {
        envExampleCreated: true,
        gitignoreEnvAdded: true,
        gitignoreNpxSkillsAdded: [],
      },
    });
    executeSpec(baseSpec, { log, exit, runPipeline, resolveHarnessRoot: () => "/h" });
    expect(log).toHaveBeenCalledWith(expect.stringContaining(".env.example"));
    expect(log).toHaveBeenCalledWith(expect.stringContaining(".gitignore"));
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
        backups: [],
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
    expect(log).toHaveBeenCalledWith(expect.stringContaining("CLAUDE-uzys-harness.md"));
    expect(log).toHaveBeenCalledWith(expect.stringContaining("stale hook refs"));
    expect(log).toHaveBeenCalledWith(expect.stringContaining("orphan prune"));
  });

  /**
   * #458 — update 화면의 상주 계측은 **갱신 후 디스크**를 잰다.
   *
   * 무엇이 틀려 있었나: 헤더가 찍던 줄은 manifest 계획("지금 깔면 이렇게 된다")이라, 트랙에서
   * 강등·은퇴해 manifest 에서 빠졌지만 **파일은 남아 매 세션 상주하는** 에이전트를 못 센다.
   * 리뷰어 컨테이너 실측(v26.151.0 tooling → 이 빌드로 update)에서 화면은 20 items 를 찍었고
   * 디스크 `.claude/agents/` 에는 4개가 있었다. 같은 화면이 바로 아래 줄에서 "이 파일 지워도
   * 된다"고 말하는데, 그 근거가 되는 숫자가 그 파일을 안 세고 있었다.
   */
  const withAgentsOnDisk = (
    fn: (spec: InstallSpec, agents: ReadonlyArray<string>) => void,
    agentFrontmatters: ReadonlyArray<string>,
  ): void => {
    const dir = mkdtempSync(join(tmpdir(), "ch-upd-cost-"));
    try {
      mkdirSync(join(dir, ".claude", "agents"), { recursive: true });
      agentFrontmatters.forEach((fm, i) => {
        writeFileSync(join(dir, ".claude", "agents", `a${i}.md`), `---\n${fm}\n---\n\n본문\n`);
      });
      fn({ ...baseSpec, projectDir: dir }, agentFrontmatters);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };

  const updatePipeline = () =>
    pipelineFor({
      ...fakeReport,
      mode: "update",
      updateMode: {
        updated: {},
        pruned: {},
        staleHookRefs: [],
        claudeMdUpdated: false,
        backups: [],
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
      },
    });

  it("update 요약은 백업이 있으면 목록 파일과 다음 행동(audit-harness-fit)을 지목한다 (#480 ③)", () => {
    withAgentsOnDisk(
      (spec) => {
        const log = vi.fn();
        const exit = vi.fn() as unknown as (code: number) => never;
        const base = updatePipeline();
        executeSpec(spec, {
          log,
          exit,
          runPipeline: (...args: Parameters<typeof base>) => {
            const r = base(...args);
            return {
              ...r,
              updateMode: r.updateMode
                ? {
                    ...r.updateMode,
                    backups: [
                      {
                        path: ".claude/rules/git-policy.md",
                        // 화면 출력만 보는 픽스처 — 실제 백업은 실행 시각으로 이름이 붙는다(fs-ops formatStamp).
                        // 진짜 날짜처럼 보이면 "오늘이어야 한다"로 읽히므로 누가 봐도 가짜인 스탬프로 둔다.
                        backup: ".claude/rules/git-policy.md.backup-00000000T000000",
                      },
                    ],
                  }
                : r.updateMode,
            };
          },
          resolveHarnessRoot: () => "/h",
          mode: "update",
        });
        const out = log.mock.calls.map((c) => String(c[0])).join("\n");
        expect(out).toContain("BACKUPS");
        expect(out).toContain("update-backups.json");
        expect(out).toContain("audit-harness-fit");
      },
      ["name: a\ndescription: 하나"],
    );
  });

  it("update 의 상주 계측은 디스크의 에이전트 파일을 센다 (#458)", () => {
    withAgentsOnDisk(
      (spec, agents) => {
        const log = vi.fn();
        const exit = vi.fn() as unknown as (code: number) => never;
        executeSpec(spec, {
          log,
          exit,
          runPipeline: updatePipeline(),
          resolveHarnessRoot: () => "/h",
          mode: "update",
        });
        const out = log.mock.calls.map((c) => String(c[0])).join("\n");
        const line = /session-start context cost: [^\n]*/.exec(out)?.[0];
        expect(line, "update 화면에 상주 계측 줄이 없다").toBeDefined();
        // 개수는 디스크 파일 수, 토큰은 그 파일들의 frontmatter 합 — 계획(manifest)으로 재면
        // tooling 트랙 에이전트 수(2)가 나와 여기서 빨개진다.
        const tokens = agents.reduce((sum, fm) => sum + estimateTokens(fm.length), 0);
        expect(line).toContain(`agents ${agents.length} ~${tokens}`);
      },
      ["name: a\ndescription: 첫째", "name: b\ndescription: 둘째", "name: c\ndescription: 셋째"],
    );
  });

  it("update 전체 출력에 상주 계측 줄은 하나뿐이다 — 계획과 실측이 함께 뜨면 어느 쪽이 참인지 모른다", () => {
    withAgentsOnDisk(
      (spec) => {
        const log = vi.fn();
        const exit = vi.fn() as unknown as (code: number) => never;
        executeSpec(spec, {
          log,
          exit,
          runPipeline: updatePipeline(),
          resolveHarnessRoot: () => "/h",
          mode: "update",
        });
        const hits = log.mock.calls
          .map((c) => String(c[0]))
          .filter((l) => l.includes("session-start context cost"));
        expect(hits.length, `상주 계측 줄 ${hits.length}개:\n${hits.join("\n")}`).toBe(1);
      },
      ["name: a\ndescription: 하나"],
    );
  });

  /**
   * M-1 (표면 대칭) — update 분기도 **어느 파일이 지워졌는지** 보여준다.
   *
   * fresh 분기는 이미 경로를 나열한다(위 `"fresh 분기가 …"`). 그 테스트가 경로 나열을 요구하며
   * 든 논거가 *"건수만으로는 사용자가 자기 훅이 사라진 이유를 추적할 방법이 없다"* 인데,
   * **그 논거는 update 에 더 강하게 적용된다** — install 은 `settings.json` 을 템플릿으로
   * 덮어써서 치유기가 보는 것이 우리 템플릿 내용뿐이지만, update 는 사용자가 손댄
   * `settings.json` 을 **제자리에서** 고치는 유일한 경로다. 즉 사용자 자신이 적어 넣은 훅이
   * 실제로 사라질 수 있는 쪽은 update 다.
   *
   * `feedback_surface_symmetry`: 한 축이 계열 일부에만 있으면 **빠진 쪽이 입증 책임**을 진다.
   *
   * 참조를 **2건** 넣는다 — 1건이면 `slice(0, 1)` 같은 절단을 통과시킨다.
   */
  it("update 분기도 제거된 stale hook ref 를 경로까지 노출한다 (fresh 와 같은 정보량)", () => {
    const log = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    const runPipeline = pipelineFor({
      ...fakeReport,
      mode: "update",
      updateMode: {
        updated: {},
        pruned: {},
        staleHookRefs: ["skills/sidecar-skill/suggest.sh", "hooks/legacy-thing.sh"],
        claudeMdUpdated: false,
        backups: [],
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
      },
    });
    executeSpec(baseSpec, {
      log,
      exit,
      runPipeline,
      resolveHarnessRoot: () => "/h",
      mode: "update",
    });

    const row = log.mock.calls
      .map((args) => String(args[0]))
      .find((l) => l.includes("stale hook refs"));
    expect(row, "update 분기에 stale hook ref 행이 없다").toBeDefined();
    expect(row).toContain("2 removed");
    // 경로 나열 — 건수만 찍으면 사용자는 자기 훅이 왜 사라졌는지 추적할 수 없다.
    expect(
      row,
      "update 행이 건수만 찍고 경로를 안 보여준다 — 사용자가 제자리에서 고쳐진 자기 " +
        "settings.json 에서 무엇이 사라졌는지 알 방법이 없다 (fresh 분기는 이미 보여준다).",
    ).toContain("skills/sidecar-skill/suggest.sh");
    expect(row).toContain("hooks/legacy-thing.sh");
  });

  /**
   * v26.126.0 (R-3a) — 스킬 행이 화면에 뜨는가.
   *
   * R-3a 의 본질은 "update 가 스킬을 안 건드린다"보다 **사용자가 그 사실을 알 방법이 0이었다**는
   * 것이다. 렌더는 `updated` 를 순회하므로 키가 없으면 행 자체가 안 나온다. 백업 행도 마찬가지 —
   * 안 보이면 사용자는 자기 편집분이 어디 갔는지 모른다. 두 행 다 이 테스트가 지킨다.
   */
  it("스킬 갱신/백업 건수를 화면에 노출한다 — 침묵이 R-3a 를 만들었다", () => {
    const log = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    const runPipeline = pipelineFor({
      ...fakeReport,
      mode: "update",
      updateMode: {
        updated: { ".claude/skills": 7 },
        pruned: {},
        staleHookRefs: [],
        claudeMdUpdated: false,
        backups: [],
        skippedGroups: [],
        anchorBackedUp: false,
        anchorCreated: false,
        rootImportAdded: false,
        rootBlockRefreshed: false,
        legacyAnchor: null,
        skillsBackedUp: ["multi-persona-review/SKILL.md", "north-star/SKILL.md"],
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
      },
    });
    executeSpec(baseSpec, {
      log,
      exit,
      runPipeline,
      resolveHarnessRoot: () => "/h",
      mode: "update",
    });
    const out = log.mock.calls.flat().join("\n");
    expect(out).toContain(".claude/skills");
    expect(out).toContain("7 files updated");
    expect(out).toContain("2 backed up");
  });

  /**
   * P5 이행 (ADR-060) — 레거시 설치본에서 update 가 앵커를 만들고 사용자 CLAUDE.md 에 import 를
   * 얹은 사실, 그리고 구 앵커가 이제 죽은 사본이라는 사실을 **화면이 말하는가**.
   *
   * 이 셋이 침묵하면 사용자는 ⓐ 앵커 계약이 바뀐 줄 모르고 ⓑ 자기 CLAUDE.md 가 한 줄 늘어난
   * 것도 모르고 ⓒ `.claude/CLAUDE.md` 를 여전히 살아 있는 설정으로 읽는다.
   */
  it("앵커 이행 3사실(생성·import 부착·구 앵커 안내)을 화면에 노출한다", () => {
    const log = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    const runPipeline = pipelineFor({
      ...fakeReport,
      mode: "update",
      updateMode: {
        updated: {},
        pruned: {},
        staleHookRefs: [],
        claudeMdUpdated: false,
        backups: [],
        skippedGroups: [],
        anchorBackedUp: false,
        anchorCreated: true,
        rootImportAdded: true,
        rootBlockRefreshed: false,
        legacyAnchor: ".claude/CLAUDE.md",
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
      },
    });
    executeSpec(baseSpec, {
      log,
      exit,
      runPipeline,
      resolveHarnessRoot: () => "/h",
      mode: "update",
    });

    const rows = log.mock.calls.map((args) => String(args[0]));
    expect(
      rows.find((l) => l.includes("CLAUDE-uzys-harness.md") && l.includes("created")),
      "앵커를 새로 만들었는데 화면에 아무 말이 없다",
    ).toBeDefined();
    expect(
      rows.find((l) => l.includes("import added")),
      "사용자 CLAUDE.md 를 고쳤는데 화면에 아무 말이 없다",
    ).toBeDefined();
    const legacy = rows.find((l) => l.includes(".claude/CLAUDE.md"));
    expect(legacy, "구 앵커 안내 행이 없다 — 죽은 사본이 살아 있는 설정으로 읽힌다").toBeDefined();
    expect(legacy).toContain("no longer updated");
    expect(legacy).toContain("delete");
  });

  // ADR-085 — 정상 설치본에서 관리 블록 안(상시 스킬 안내)이 바뀌면 화면이 말한다. 재리뷰(#433)가
  // 이 줄에 게이트가 없다고 지적했다. 이행 3사실과 달리 블록 갱신은 **혼자** 일어난다(앵커 생성·
  // import 부착 없음) — 그 조합에서만 이 줄이 뜨고 이행 줄은 뜨지 않아야 한다.
  it("관리 블록 갱신 사실을 화면에 노출한다 — 이행 줄과 섞이지 않는다", () => {
    const log = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    const runPipeline = pipelineFor({
      ...fakeReport,
      mode: "update",
      updateMode: {
        updated: {},
        pruned: {},
        staleHookRefs: [],
        claudeMdUpdated: true,
        backups: [],
        skippedGroups: [],
        anchorBackedUp: false,
        anchorCreated: false,
        rootImportAdded: false,
        rootBlockRefreshed: true,
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
      },
    });
    executeSpec(baseSpec, {
      log,
      exit,
      runPipeline,
      resolveHarnessRoot: () => "/h",
      mode: "update",
    });
    const rows = log.mock.calls.map((args) => String(args[0]));
    expect(
      rows.find((l) => l.includes("harness block refreshed")),
      "사용자 CLAUDE.md 의 관리 블록을 고쳤는데 화면에 아무 말이 없다",
    ).toBeDefined();
    expect(rows.find((l) => l.includes("import added"))).toBeUndefined();
    expect(rows.find((l) => l.includes("anchor migration"))).toBeUndefined();
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
    expect(log).toHaveBeenCalledWith(expect.stringContaining("uzys-agent-harness · add"));

    executeSpec(baseSpec, {
      log,
      exit,
      runPipeline,
      resolveHarnessRoot: () => "/h",
      mode: "reinstall",
    });
    expect(log).toHaveBeenCalledWith(expect.stringContaining("uzys-agent-harness · reinstall"));
  });

  it("renders Codex opt-in trust row when codexOptIn trust entry is registered", () => {
    const log = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    const runPipeline = pipelineFor({
      ...fakeReport,
      codex: {
        agentsMdPath: "/p/AGENTS.md",
        configTomlPath: "/p/.codex/config.toml",
        hookFiles: [],
        skillFiles: [],
        ownership: { files: [], backedUp: [], backupPaths: [], updated: 0, foreignOwned: [] },
      },
      codexOptIn: {
        trustEntry: { enabled: true, status: "registered" as const },
      },
    });
    executeSpec(
      { ...baseSpec, cli: ["codex"] },
      { log, exit, runPipeline, resolveHarnessRoot: () => "/h" },
    );
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
        ownership: { files: [], backedUp: [], backupPaths: [], updated: 0, foreignOwned: [] },
      },
      codexOptIn: {
        trustEntry: { enabled: true, status: "already-present" as const },
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
        ownership: { files: [], backedUp: [], backupPaths: [], updated: 0, foreignOwned: [] },
      },
      codexOptIn: {
        trustEntry: { enabled: true, status: "error" as const, message: "permission denied" },
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

  /**
   * 2026-08-16 (독립 리뷰 F7) — `--with baseline:<id>` 는 경고 없이 통과하고 아무 일도 안 했다.
   * 두 플래그를 한 루프에서 검사하면서 `baselineIds.has(id)` 가 `--with` 에도 걸렸기 때문이다.
   * **조용히 no-op 하는 지시**는 ADR-074 가 두 목록을 안 섞은 바로 그 이유다.
   */
  it("--with baseline:<id> → 경고 (조용한 no-op 금지)", () => {
    const err = vi.fn();
    installAction(
      {
        cli: ["claude"],
        track: ["tooling"],
        with: "baseline:rules/git-policy",
        projectDir: "/tmp/p",
      },
      {
        log: vi.fn(),
        err,
        exit: vi.fn() as unknown as (code: number) => never,
        runPipeline: pipelineFor(fakeReport),
        resolveHarnessRoot: () => "/h",
      },
    );
    expect(err).toHaveBeenCalledWith(expect.stringContaining("cannot be used with --with"));
  });

  it("--without baseline:<id> 는 그대로 통과한다 (음성 대조 — 위 경고가 과잉이 아님)", () => {
    const err = vi.fn();
    installAction(
      {
        cli: ["claude"],
        track: ["tooling"],
        without: "baseline:rules/git-policy",
        projectDir: "/tmp/p",
      },
      {
        log: vi.fn(),
        err,
        exit: vi.fn() as unknown as (code: number) => never,
        runPipeline: pipelineFor(fakeReport),
        resolveHarnessRoot: () => "/h",
      },
    );
    expect(err).not.toHaveBeenCalled();
  });
});

describe("v26.48.0 — install helpers (coverage 복구)", () => {
  it("formatCliPhaseTitle: claude only → 'CLI artifacts'", async () => {
    const { formatCliPhaseTitle } = await import("../src/commands/install-render.js");
    expect(formatCliPhaseTitle(["claude"])).toBe("CLI artifacts");
  });

  // v26.96.0 (review Finding #1) — FILL 콘솔 안내가 실제 써진 파일만 지칭해야 한다.
  //   기본 설치는 cli=["claude"] → CLAUDE.md 만 쓰고 AGENTS.md 는 안 쓴다. 안내가 AGENTS.md 를
  //   지칭하면 no-false-ship "광고 ≠ 실산출" 위반(기본 경로).
  it("scaffoldFilesForCli: claude only → ['CLAUDE.md'] (no AGENTS.md)", async () => {
    const { scaffoldFilesForCli } = await import("../src/commands/install-render.js");
    expect(scaffoldFilesForCli(["claude"])).toEqual(["CLAUDE.md"]);
  });

  it("scaffoldFilesForCli: codex only → ['AGENTS.md'] (no root CLAUDE.md)", async () => {
    const { scaffoldFilesForCli } = await import("../src/commands/install-render.js");
    expect(scaffoldFilesForCli(["codex"])).toEqual(["AGENTS.md"]);
  });

  it("scaffoldFilesForCli: claude + codex → both files", async () => {
    const { scaffoldFilesForCli } = await import("../src/commands/install-render.js");
    expect(scaffoldFilesForCli(["claude", "codex"])).toEqual(["CLAUDE.md", "AGENTS.md"]);
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
});

// ADR-084 — FILL 힌트의 populate 안내는 `audit-harness-fit` 이 **실제로 깔린 경우에만** 붙는다.
// 독립 리뷰(#432) 가 이 분기를 덮는 테스트가 없다고 지적했다 — 안 깔린 스킬을 부르라는 안내는
// "advertised ≠ real" 이라 양 분기를 다 잰다.
describe("renderFinalSummary FILL row — populate 안내는 깔린 경우에만 (ADR-084)", () => {
  const base: InstallSpec = {
    tracks: ["tooling"],
    options: { withCodexTrust: false },
    cli: ["claude"],
    projectDir: "/p",
  };

  async function fillRow(spec: InstallSpec): Promise<string> {
    const { renderFinalSummary } = await import("../src/commands/install-render.js");
    const lines: string[] = [];
    renderFinalSummary((m) => lines.push(m), spec, fakeReport, false);
    return lines.find((l) => l.includes("FILL")) ?? "";
  }

  it("기본 설치(any-track 이라 깔린다) → populate 안내가 붙는다", async () => {
    const row = await fillRow(base);
    expect(row).toContain("FILL: … -->");
    expect(row).toContain("audit-harness-fit");
  });

  it("--without audit-harness-fit → 안내가 없고 기존 문장은 그대로", async () => {
    const row = await fillRow({
      ...base,
      userOverride: { forceInclude: [], forceExclude: ["audit-harness-fit"] },
    });
    expect(row).toContain("FILL: … -->");
    expect(row).not.toContain("audit-harness-fit");
  });
});

describe("renderFinalSummary NEXT row (audit UX-2)", () => {
  // WHY: /uzys:* 6-Gate 슬래시 명령이 제거됐다. NEXT 행은 더 이상 존재하지 않는
  //   `claude → /uzys:spec` 로 첫 가치를 유도하면 안 된다 (no-false-ship dead-end).
  const toolingClaude: InstallSpec = {
    tracks: ["tooling"],
    options: {
      withCodexTrust: false,
    },
    cli: ["claude"],
    projectDir: "/p",
  };

  async function nextRow(spec: InstallSpec): Promise<string> {
    const { renderFinalSummary } = await import("../src/commands/install-render.js");
    const lines: string[] = [];
    renderFinalSummary((m) => lines.push(m), spec, fakeReport, false);
    return lines.find((l) => l.includes("NEXT")) ?? "";
  }

  it("claude install → NEXT 행이 Claude 사용을 안내 (/uzys:spec 없음)", async () => {
    const row = await nextRow(toolingClaude);
    expect(row).not.toContain("/uzys:spec");
    expect(row).toContain("Claude");
  });

  it("codex 단독설치 → claude 아닌 설치 CLI 안내 (/uzys:spec 없음)", async () => {
    const row = await nextRow({ ...toolingClaude, cli: ["codex"] });
    expect(row).not.toContain("/uzys:spec");
    expect(row).toContain("Codex");
  });
});
