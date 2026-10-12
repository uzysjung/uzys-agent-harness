/**
 * #760 — `install --with gemini-delegate` 처럼 opt-in 번들 스킬을 깐 설치본에서 update 위저드 3단계가 그 스킬을
 * **체크된 채 · `● installed`** 로 보인다. 번들 스킬은 외부 설치 기록(`assets`)이 아니라 파일 기준선(`skillFiles` ·
 * `externalFiles`)에 남아, 예전에는 화면이 "안 깔렸다"고 말했다.
 *
 * 그대로 두면 refresh(`agent-harness update`)이고, 풀면 `--without <id>` — 기록된 선택 MCP 서버(#709)와 같은 규칙이다.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type InstallLog, installLogPath, readInstallLog } from "../src/install-log.js";
import { runInstall } from "../src/installer.js";
import {
  installedTargetState,
  runInteractive,
  updateInitialSelection,
} from "../src/interactive.js";
import type { InstallTargetId, Prompts } from "../src/prompts.js";
import type { DetectedInstall } from "../src/state.js";
import type { CliBase, CliTargets, Track } from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");
const PICKED = "gemini-delegate";
/** 대조군 — 고르지 않은 opt-in 번들 스킬. 이것까지 보이면 판정이 기록이 아니라 카탈로그를 읽은 것이다. */
const NOT_PICKED = "chatgpt-delegate";

let dir = "";
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "wiz-760-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function install(cli: CliBase[]): void {
  runInstall({
    harnessRoot: HARNESS_ROOT,
    projectDir: dir,
    runExternal: null,
    spec: {
      tracks: ["tooling"],
      options: { withCodexTrust: false },
      cli,
      projectDir: dir,
      userOverride: { forceInclude: [PICKED], forceExclude: [] },
    },
  });
}

function step3(): ReadonlyArray<InstallTargetId> {
  const log = readInstallLog(dir);
  return updateInitialSelection(["tooling"], installedTargetState(dir).projectScoped, log);
}

describe("#760 — 깔린 opt-in 번들 스킬이 update 3단계에 체크 · installed 로 보인다", () => {
  it.each([[["claude"]], [["codex"]]] as Array<
    [CliBase[]]
  >)("install --cli %s --with gemini-delegate", (cli) => {
    install(cli);
    const state = installedTargetState(dir);
    expect(state.installed).toContain(PICKED);
    expect(state.installed).not.toContain(NOT_PICKED);
    expect(step3()).toContain(`asset:${PICKED}`);
    expect(step3()).not.toContain(`asset:${NOT_PICKED}`);
  });

  it("옛 설치 기록(몫 기록 전 · skillFiles 에만 그 스킬) — 같은 판정", () => {
    mkdirSync(dirname(installLogPath(dir)), { recursive: true });
    const log: InstallLog = {
      schemaVersion: 1,
      installedAt: "2026-09-01T00:00:00.000Z",
      scope: "project",
      spec: { tracks: ["tooling"], cli: ["claude"] },
      templates: { claudeDir: ".claude/" },
      assets: [],
      skillFiles: [{ path: `${PICKED}/SKILL.md`, sha256: "0".repeat(64) }],
    };
    writeFileSync(installLogPath(dir), JSON.stringify(log), "utf8");
    expect(installedTargetState(dir)).toEqual({ installed: [PICKED], projectScoped: [PICKED] });
    expect(step3()).toContain(`asset:${PICKED}`);
  });
});

describe("#760 — 위저드 Update 흐름", () => {
  const detected =
    (tracks: Track[]) =>
    (projectDir: string): DetectedInstall => {
      const log = readInstallLog(projectDir);
      return { state: "installed", tracks, log, hasClaudeDir: true, traces: [] };
    };
  const prompts = (over: Partial<Prompts>): Prompts => ({
    intro: vi.fn(),
    outro: vi.fn(),
    cancel: vi.fn(),
    selectAction: vi.fn(async () => "update" as const),
    selectTracks: vi.fn(async (initial?: Track[]) => initial ?? (["tooling"] as Track[])),
    selectCli: vi.fn(async (initial?: CliTargets) => initial ?? (["claude"] as CliTargets)),
    confirmInstall: vi.fn(async () => true),
    selectInstallTargets: vi.fn(async (initial: ReadonlyArray<InstallTargetId>) => initial),
    ...over,
  });

  it("그대로 두면 체크 · installed 로 시작하고 refresh 다", async () => {
    install(["claude"]);
    const selectInstallTargets = vi.fn(
      async (initial: ReadonlyArray<InstallTargetId>, _s: unknown, _o: unknown) => initial,
    );
    const result = await runInteractive(dir, {
      prompts: prompts({ selectInstallTargets }),
      detect: detected(["tooling"]),
      isTty: () => true,
    });
    const [initial, , opts] = selectInstallTargets.mock.calls[0] ?? [];
    expect(initial).toContain(`asset:${PICKED}`);
    expect((opts as { installed: string[] }).installed).toContain(`asset:${PICKED}`);
    expect(result.mode).toBe("update");
  });

  it("옛 전역 범위 기록도 그대로 두면 refresh 다 — 번들 스킬은 범위와 무관하게 프로젝트 안에 깔린다", async () => {
    install(["claude"]);
    const log = readInstallLog(dir) as InstallLog;
    writeFileSync(installLogPath(dir), JSON.stringify({ ...log, scope: "global" }), "utf8");
    const confirmInstall = vi.fn(async (_s: string) => true);
    const result = await runInteractive(dir, {
      prompts: prompts({ confirmInstall }),
      detect: detected(["tooling"]),
      isTty: () => true,
    });
    expect(result.mode).toBe("update");
    expect(confirmInstall.mock.calls[0]?.[0] ?? "").not.toContain(`--without ${PICKED}`);
  });

  it("체크를 풀면 add 이고 RUNS AS 가 --without gemini-delegate 를 낸다", async () => {
    install(["claude"]);
    const confirmInstall = vi.fn(async (_s: string) => true);
    const result = await runInteractive(dir, {
      prompts: prompts({
        selectInstallTargets: vi.fn(async (initial: ReadonlyArray<InstallTargetId>) =>
          initial.filter((t) => t !== `asset:${PICKED}`),
        ),
        confirmInstall,
      }),
      detect: detected(["tooling"]),
      isTty: () => true,
    });
    expect(result.mode).toBe("add");
    expect(confirmInstall.mock.calls[0]?.[0] ?? "").toContain(`--without ${PICKED}`);
  });
});
