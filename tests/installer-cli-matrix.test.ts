/**
 * 77 시나리오 매트릭스 — 11 Track × 7 CLI combination E2E install (v0.7.0).
 *
 * SPEC: docs/specs/cli-multi-select.md AC5 + AC6 + Major CR.
 *
 * v0.7.0 BREAKING: 5 mode (claude/codex/opencode/both/all) → 7 combination
 *   1. [claude]
 *   2. [codex]
 *   3. [opencode]
 *   4. [claude, codex]      (= 기존 both)
 *   5. [claude, opencode]   (신규 — Codex 제외)
 *   6. [codex, opencode]    (신규 — Claude 제외)
 *   7. [claude, codex, opencode]  (= 기존 all)
 *
 * 검증 항목 (per scenario):
 *   1. runInstall 예외 없음 (exit 0)
 *   2. .claude/CLAUDE.md + skeleton 생성 (baseline은 항상)
 *   3. .mcp.json 생성 + Track별 MCP 포함
 *   4. CLI combination별 추가 산출물:
 *      - codex 포함 시: AGENTS.md + .codex/{config.toml, hooks/} + .agents/skills/uzys-*
 *      - opencode 포함 시: AGENTS.md + opencode.json + .opencode/{commands/, plugins/}
 *   5. installedTracks 정합성
 *
 * 실제 spawn은 mock (runExternal=null) — 외부 자산 호출 차단.
 */
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runInstall } from "../src/installer.js";
import {
  type CliBase,
  type CliTargets,
  DEFAULT_OPTIONS,
  type InstallSpec,
  TRACKS,
  type Track,
} from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");

/** 7 combinations (2^3 - 1, empty 제외). sorted (claude → codex → opencode 순). */
const COMBINATIONS: ReadonlyArray<CliTargets> = [
  ["claude"],
  ["codex"],
  ["opencode"],
  ["claude", "codex"],
  ["claude", "opencode"],
  ["codex", "opencode"],
  ["claude", "codex", "opencode"],
];

function spec(track: Track, cli: CliTargets, projectDir: string): InstallSpec {
  return {
    tracks: [track],
    options: { ...DEFAULT_OPTIONS },
    cli,
    projectDir,
  };
}

interface ExpectedArtifacts {
  /** v0.8.0 — claude 포함 시에만 .claude/ baseline 생성 */
  claudeBaseline: boolean;
  agentsMd: boolean;
  codexConfig: boolean;
  opencodeJson: boolean;
}

function expectedFor(targets: CliTargets): ExpectedArtifacts {
  const hasClaude = targets.includes("claude");
  const hasCodex = targets.includes("codex");
  const hasOpenCode = targets.includes("opencode");
  return {
    claudeBaseline: hasClaude,
    agentsMd: hasCodex || hasOpenCode,
    codexConfig: hasCodex,
    opencodeJson: hasOpenCode,
  };
}

function comboLabel(targets: CliTargets): string {
  return targets.join("+");
}

describe("11 Track × 7 CLI combination matrix (77 scenarios) — E2E install", () => {
  let projectDir: string;

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "ch-mtx-"));
  });

  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  for (const track of TRACKS) {
    for (const cli of COMBINATIONS) {
      it(`track=${track} × cli=${comboLabel(cli)}: install completes + correct artifacts`, () => {
        const report = runInstall({
          runExternal: null,
          harnessRoot: HARNESS_ROOT,
          projectDir,
          spec: spec(track, cli, projectDir),
        });

        // 1. baseline: .claude/ 조건부 (v0.8.0 — claude 포함 시만), .mcp.json 항상
        const exp = expectedFor(cli);
        expect(existsSync(join(projectDir, ".claude/CLAUDE.md"))).toBe(exp.claudeBaseline);
        expect(existsSync(join(projectDir, ".claude/settings.json"))).toBe(exp.claudeBaseline);
        expect(existsSync(join(projectDir, ".mcp.json"))).toBe(true);

        // 2. installed-tracks meta
        expect(report.installedTracks).toEqual([track]);

        // 3. .mcp.json includes context7 (always)
        expect(report.mcpServers).toContain("context7");

        // 4. CLI artifacts per combination
        expect(existsSync(join(projectDir, "AGENTS.md"))).toBe(exp.agentsMd);
        expect(existsSync(join(projectDir, ".codex/config.toml"))).toBe(exp.codexConfig);
        expect(existsSync(join(projectDir, "opencode.json"))).toBe(exp.opencodeJson);

        // 5. mode default fresh
        expect(report.mode).toBe("fresh");

        // 6. external skipped (runExternal=null)
        expect(report.external).toBeNull();

        // 7. envFiles always present (even null mcpAllowlist when no .mcp.json yet — but here generated)
        expect(report.envFiles).toBeDefined();
        expect(report.envFiles.mcpAllowlist).not.toBeNull();
      });
    }
  }
});

describe("Matrix invariants — cross-cutting", () => {
  let projectDir: string;
  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "ch-inv-"));
  });
  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  it("count check: TRACKS.length=11 × COMBINATIONS.length=7 = 77 scenarios (v0.7.0)", () => {
    expect(TRACKS.length).toBe(11);
    expect(COMBINATIONS.length).toBe(7);
    expect(TRACKS.length * COMBINATIONS.length).toBe(77);
  });

  it("each combination is sorted (claude → codex → opencode order)", () => {
    const order: Record<CliBase, number> = { claude: 0, codex: 1, opencode: 2, antigravity: 3 };
    for (const combo of COMBINATIONS) {
      const indices = combo.map((c) => order[c]);
      const sorted = [...indices].sort((a, b) => a - b);
      expect(indices).toEqual(sorted);
    }
  });

  it("csr-supabase + [claude]: .env.example generated", () => {
    const report = runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: spec("csr-supabase", ["claude"], projectDir),
    });
    expect(report.envFiles.envExampleCreated).toBe(true);
    expect(existsSync(join(projectDir, ".env.example"))).toBe(true);
  });

  it("tooling + [claude]: .env.example NOT generated (non-supabase Track)", () => {
    const report = runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: spec("tooling", ["claude"], projectDir),
    });
    expect(report.envFiles.envExampleCreated).toBe(false);
    expect(existsSync(join(projectDir, ".env.example"))).toBe(false);
  });

  it("[opencode] only: opencode.json + commands/ + plugin", () => {
    runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: spec("tooling", ["opencode"], projectDir),
    });
    expect(existsSync(join(projectDir, "opencode.json"))).toBe(true);
    expect(existsSync(join(projectDir, ".opencode/commands"))).toBe(true);
    expect(existsSync(join(projectDir, ".opencode/plugins/uzys-harness.ts"))).toBe(true);
  });

  it("[claude, codex, opencode]: 3 CLI artifacts side-by-side", () => {
    runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: spec("tooling", ["claude", "codex", "opencode"], projectDir),
    });
    expect(existsSync(join(projectDir, ".claude/CLAUDE.md"))).toBe(true);
    expect(existsSync(join(projectDir, ".codex/config.toml"))).toBe(true);
    expect(existsSync(join(projectDir, "AGENTS.md"))).toBe(true);
    expect(existsSync(join(projectDir, "opencode.json"))).toBe(true);
  });

  // v0.8.0 — .claude/ 조건부 생성 검증 (Codex/OpenCode 단독 dead weight 제거)
  it("[codex] only: .claude/ 디렉토리 자체 미생성", () => {
    runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: spec("tooling", ["codex"], projectDir),
    });
    expect(existsSync(join(projectDir, ".claude/CLAUDE.md"))).toBe(false);
    expect(existsSync(join(projectDir, ".claude/settings.json"))).toBe(false);
    expect(existsSync(join(projectDir, ".claude/.installed-tracks"))).toBe(false);
    // Codex 산출물은 정상 생성
    expect(existsSync(join(projectDir, ".codex/config.toml"))).toBe(true);
    expect(existsSync(join(projectDir, "AGENTS.md"))).toBe(true);
    // .mcp.json은 Codex도 사용 (cli 무관 항상)
    expect(existsSync(join(projectDir, ".mcp.json"))).toBe(true);
  });

  it("[opencode] only: .claude/ 미생성, opencode.json만", () => {
    runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: spec("tooling", ["opencode"], projectDir),
    });
    expect(existsSync(join(projectDir, ".claude/CLAUDE.md"))).toBe(false);
    expect(existsSync(join(projectDir, "opencode.json"))).toBe(true);
  });

  it("[codex, opencode] (Claude 제외): .claude/ 미생성, Codex+OpenCode 둘 다 생성", () => {
    runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: spec("tooling", ["codex", "opencode"], projectDir),
    });
    expect(existsSync(join(projectDir, ".claude/CLAUDE.md"))).toBe(false);
    expect(existsSync(join(projectDir, ".codex/config.toml"))).toBe(true);
    expect(existsSync(join(projectDir, "opencode.json"))).toBe(true);
    expect(existsSync(join(projectDir, "AGENTS.md"))).toBe(true);
  });

  it("Codex global opt-in stays OFF when withCodex* flags false (D16)", () => {
    const report = runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: spec("tooling", ["codex"], projectDir),
    });
    expect(report.codexOptIn).toBeNull();
  });

  // v26.64.0 (ADR-020) — scope=project (default) 시 withCodex* 가 true 라도 글로벌 opt-in skip.
  // ~/.codex/ write 는 scope=global 일 때만.
  it("scope=project: withCodexPrompts=true 라도 codexOptIn skip (ADR-020 / D16)", () => {
    const report = runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: {
        tracks: ["tooling"],
        options: { ...DEFAULT_OPTIONS, withCodexPrompts: true },
        cli: ["codex"],
        projectDir,
        scope: "project",
      },
    });
    expect(report.codexOptIn).toBeNull();
  });

  // v26.64.0 (ADR-020) — scope=global + withCodex* true → codexOptIn 호출됨.
  it("scope=global + withCodexPrompts=true: codexOptIn 호출 (~/.codex/ write 활성)", () => {
    const report = runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: {
        tracks: ["tooling"],
        options: { ...DEFAULT_OPTIONS, withCodexPrompts: true },
        cli: ["codex"],
        projectDir,
        scope: "global",
      },
    });
    expect(report.codexOptIn).not.toBeNull();
  });

  // v0.8.0 HIGH-1 — withKarpathyHook + claude 미선택 시 silent skip (reason="claude-not-selected")
  it("[codex] + withKarpathyHook=true: hook 미와이어 + reason=claude-not-selected", () => {
    const report = runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: {
        tracks: ["tooling"],
        options: { ...DEFAULT_OPTIONS, withKarpathyHook: true },
        cli: ["codex"],
        projectDir,
      },
    });
    expect(report.karpathyHook).toEqual({
      wired: false,
      reason: "claude-not-selected",
    });
    // .claude/settings.json 자체가 없어야 (cli=codex 단독)
    expect(existsSync(join(projectDir, ".claude/settings.json"))).toBe(false);
  });

  it("[opencode] + withKarpathyHook=true: hook 미와이어 + reason=claude-not-selected", () => {
    const report = runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: {
        tracks: ["tooling"],
        options: { ...DEFAULT_OPTIONS, withKarpathyHook: true },
        cli: ["opencode"],
        projectDir,
      },
    });
    expect(report.karpathyHook).toEqual({
      wired: false,
      reason: "claude-not-selected",
    });
  });

  // v0.7.0 신규 조합 검증 (이전 5 mode에 없던 조합)
  it("[claude, opencode] (Codex 제외): AGENTS.md + opencode.json, NO .codex/config.toml", () => {
    runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: spec("tooling", ["claude", "opencode"], projectDir),
    });
    expect(existsSync(join(projectDir, ".claude/CLAUDE.md"))).toBe(true);
    expect(existsSync(join(projectDir, "AGENTS.md"))).toBe(true);
    expect(existsSync(join(projectDir, "opencode.json"))).toBe(true);
    expect(existsSync(join(projectDir, ".codex/config.toml"))).toBe(false);
  });
});
