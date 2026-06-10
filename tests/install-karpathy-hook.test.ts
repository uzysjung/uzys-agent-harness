/**
 * v0.6.0 — karpathy-coder hook auto-wire integration test.
 *
 * SPEC: docs/specs/karpathy-hook-autowire.md AC2/AC4/AC5/AC6.
 *
 * 4 case (P4-T3):
 *   1. flag=true + install 성공 → settings.json + hook script 둘 다 존재
 *   2. flag=true + install 실패 → 둘 다 미생성
 *   3. flag=false + install 성공 → 둘 다 미생성
 *   4. flag=true + install 성공 (2회) → idempotent (중복 entry X)
 */

import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ExternalAsset } from "../src/external-assets.js";
import type { ExternalInstallReport } from "../src/external-installer.js";
import { runInstall } from "../src/installer.js";
import type { ClaudeSettings } from "../src/settings-merge.js";
import type { InstallSpec } from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");
const KARPATHY_CMD = 'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/karpathy-gate.sh"';

function spec(withFlag: boolean, projectDir: string): InstallSpec {
  return {
    tracks: ["tooling"],
    options: {
      withTauri: false,
      withGsd: false,
      withEcc: false,
      withPrune: false,
      withTob: false,
      withCodexSkills: false,
      withCodexTrust: false,
      withKarpathyHook: withFlag,
      withCodexPrompts: false,
      withAddyAgentSkills: false,
      withUzysHarness: false,
      withSuperpowers: false,

      withWshobsonAgents: false,
      withOpenspec: false,
      withBmad: false,
      withClaudeVideo: false,
      withUnderstandAnything: false,
      withAgentmemory: false,
      withAntigravityGlobal: false,
    },
    cli: ["claude"],
    projectDir,
  };
}

const KARPATHY_ASSET: ExternalAsset = {
  id: "karpathy-coder",
  description: "karpathy-coder mock",
  category: "dev-tools",
  source: "alirezarezvani",
  tier: "vetted",
  condition: { kind: "has-dev-track" },
  method: {
    kind: "plugin",
    marketplace: "alirezarezvani/claude-skills",
    pluginId: "karpathy-coder@claude-code-skills",
  },
};

function fakeExternal(karpathyOk: boolean): ExternalInstallReport {
  return {
    attempted: [{ asset: KARPATHY_ASSET, ok: karpathyOk }],
    succeeded: karpathyOk ? 1 : 0,
    skipped: karpathyOk ? 0 : 1,
  };
}

describe("karpathy-coder hook auto-wire (v0.6.0)", () => {
  let projectDir: string;

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "ch-karpathy-"));
  });

  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  it("flag=true + install 성공 → settings.json + hook script 둘 다 존재", () => {
    const report = runInstall({
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: spec(true, projectDir),
      runExternal: () => fakeExternal(true),
    });

    expect(report.karpathyHook?.wired).toBe(true);
    expect(report.karpathyHook?.hookScriptCopied).toBe(true);
    expect(report.karpathyHook?.settingsUpdated).toBe(true);

    // Hook script copied
    expect(existsSync(join(projectDir, ".claude/hooks/karpathy-gate.sh"))).toBe(true);

    // settings.json has PreToolUse Write|Edit entry with karpathy command
    const settingsPath = join(projectDir, ".claude/settings.json");
    expect(existsSync(settingsPath)).toBe(true);
    const settings: ClaudeSettings = JSON.parse(readFileSync(settingsPath, "utf8"));
    const writeEditEntry = settings.hooks?.PreToolUse?.find((m) => m.matcher === "Write|Edit");
    expect(writeEditEntry).toBeDefined();
    expect(writeEditEntry?.hooks.map((h) => h.command)).toContain(KARPATHY_CMD);
  });

  it("flag=true + install 실패 → 둘 다 미생성", () => {
    const report = runInstall({
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: spec(true, projectDir),
      runExternal: () => fakeExternal(false),
    });

    expect(report.karpathyHook?.wired).toBe(false);
    expect(report.karpathyHook?.reason).toBe("plugin-install-failed");
    expect(existsSync(join(projectDir, ".claude/hooks/karpathy-gate.sh"))).toBe(false);

    // settings.json may exist from baseline but no karpathy entry
    const settingsPath = join(projectDir, ".claude/settings.json");
    if (existsSync(settingsPath)) {
      const settings: ClaudeSettings = JSON.parse(readFileSync(settingsPath, "utf8"));
      const allCmds = (settings.hooks?.PreToolUse ?? []).flatMap((m) =>
        m.hooks.map((h) => h.command),
      );
      expect(allCmds).not.toContain(KARPATHY_CMD);
    }
  });

  it("flag=false + install 성공 → 둘 다 미생성 (opt-in 강제)", () => {
    const report = runInstall({
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: spec(false, projectDir),
      runExternal: () => fakeExternal(true),
    });

    expect(report.karpathyHook).toBeNull();
    expect(existsSync(join(projectDir, ".claude/hooks/karpathy-gate.sh"))).toBe(false);

    const settingsPath = join(projectDir, ".claude/settings.json");
    const settings: ClaudeSettings = JSON.parse(readFileSync(settingsPath, "utf8"));
    const allCmds = (settings.hooks?.PreToolUse ?? []).flatMap((m) =>
      m.hooks.map((h) => h.command),
    );
    expect(allCmds).not.toContain(KARPATHY_CMD);
  });

  it("flag=true + install 성공 (2회 fresh) → settings.json에 정확히 1개 karpathy entry", () => {
    // fresh mode는 매 install 시 settings.json을 templates에서 다시 복사 → 기존 hook 손실.
    // wireKarpathyHook은 매번 적용 → 재등록. addPreToolUseHook 자체는 idempotent (settings-merge.test.ts P3 검증).
    // 결과: 두 번째 install 후에도 entry 1개 (manifest 덮어쓰기 + wireKarpathy 한 번 추가).
    const ctx = {
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: spec(true, projectDir),
      runExternal: () => fakeExternal(true),
    };

    runInstall(ctx);
    const reportTwo = runInstall(ctx);

    expect(reportTwo.karpathyHook?.wired).toBe(true);

    // Settings has exactly one karpathy command entry
    const settingsPath = join(projectDir, ".claude/settings.json");
    const settings: ClaudeSettings = JSON.parse(readFileSync(settingsPath, "utf8"));
    const writeEditEntry = settings.hooks?.PreToolUse?.find((m) => m.matcher === "Write|Edit");
    const karpathyCount =
      writeEditEntry?.hooks.filter((h) => h.command === KARPATHY_CMD).length ?? 0;
    expect(karpathyCount).toBe(1);
  });

  it("runExternal=null → wired=false reason=external-skipped (regression guard)", () => {
    const report = runInstall({
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: spec(true, projectDir),
      runExternal: null,
    });

    expect(report.karpathyHook?.wired).toBe(false);
    expect(report.karpathyHook?.reason).toBe("external-skipped");
    expect(existsSync(join(projectDir, ".claude/hooks/karpathy-gate.sh"))).toBe(false);
  });
});
