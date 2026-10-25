/**
 * #881 — `.claude/settings.json` 의 `hooks.<Event>` 가 목록이 아닌 값(유효 JSON 이라 파서 게이트는 통과한다)으로 바뀌어 기록된
 * 하네스 훅이 사라졌으면, update · `install --reinstall` 은 그것을 "kept yours"(설치자 값이 이겼다)로 부르지 않고 되돌리지
 * 못했다고 말한다. 그 자리의 값은 설치자 것이라 덮지 않는다. 기록은 남아 자리를 고치면 다음 update 가 되돌린다.
 * 목록 모양 그대로 설치자가 고친 하네스 줄은 지금처럼 "kept yours" 다.
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createInstallRenderer, renderCliArtifacts } from "../src/commands/install-render.js";
import { readInstallLog } from "../src/install-log.js";
import { type InstallMode, runInstall } from "../src/installer.js";
import type { InstallSpec } from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");
const SETTINGS = ".claude/settings.json";
const KEY = "hooks.SessionStart#session-start.sh";
/** 다른 도구가 쓰는 모양 — Claude Code 의 `hooks.<Event>` 는 목록이어야 한다. */
const NOT_A_LIST = { matcher: "*", hooks: [{ type: "command", command: "echo other-tool" }] };

let projectDir = "";
beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "settings-hook-shape-"));
});
afterEach(() => rmSync(projectDir, { recursive: true, force: true }));

const spec = (): InstallSpec => ({
  tracks: ["tooling"],
  options: { withCodexTrust: false },
  cli: ["claude"],
  projectDir,
});

/** 한 번 돌리고 색을 벗긴 화면. */
function run(mode: InstallMode): string {
  const lines: string[] = [];
  const renderer = createInstallRenderer((m) => lines.push(m), spec(), false);
  runInstall({
    runExternal: null,
    harnessRoot: HARNESS_ROOT,
    projectDir,
    spec: spec(),
    mode,
    onProgress: (event) => renderer.callbacks.onProgress?.(event),
  });
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI 색 코드를 벗긴다
  return lines.join("\n").replace(/\x1b\[[0-9;]*m/g, "");
}

type Settings = { hooks: Record<string, unknown> };
const readSettings = (): Settings =>
  JSON.parse(readFileSync(join(projectDir, SETTINGS), "utf8")) as Settings;
const writeSettings = (s: Settings): void =>
  writeFileSync(join(projectDir, SETTINGS), `${JSON.stringify(s, null, 2)}\n`);
const recordsKey = (): boolean =>
  (readInstallLog(projectDir)?.portions ?? []).some((p) => p.path === SETTINGS && p.key === KEY);
const settingsRow = (screen: string): string =>
  screen.split("\n").find((l) => l.includes(SETTINGS)) ?? "";

/** 설치 → `hooks.SessionStart` 를 목록이 아닌 값으로 바꾼다. 바꾼 뒤의 파일 원문을 돌려준다. */
function installThenBreakShape(): string {
  run("add");
  expect(recordsKey()).toBe(true); // 전제 — 하네스 세션 훅이 기록된 몫이다
  const s = readSettings();
  s.hooks.SessionStart = NOT_A_LIST;
  writeSettings(s);
  return readFileSync(join(projectDir, SETTINGS), "utf8");
}

describe("#881 hooks.<Event> 가 목록이 아니면 사라진 하네스 훅을 'kept yours' 로 부르지 않는다", () => {
  it.each([
    "update",
    "reinstall",
  ] as const)("%s — '되돌리지 못했다' 고 말하고 그 값은 덮지 않는다 · 기록은 남는다", (mode) => {
    const broken = installThenBreakShape();

    const row = settingsRow(run(mode));

    expect(row).toContain(`was missing — could not restore: ${KEY}`);
    expect(row).not.toContain(`kept yours: ${KEY}`);
    expect(row).not.toContain("kept — the harness part is already in place");
    expect(row).not.toContain("✓");
    expect(readFileSync(join(projectDir, SETTINGS), "utf8")).toBe(broken);
    expect(recordsKey()).toBe(true);
  });

  it("자리를 목록으로 고치면 다음 update 가 기록대로 되돌린다", () => {
    installThenBreakShape();
    run("update");
    const s = readSettings();
    s.hooks.SessionStart = [NOT_A_LIST];
    writeSettings(s);

    const row = settingsRow(run("update"));

    expect(row).toContain(`was missing — restored: settings:${KEY}`);
    expect(JSON.stringify(readSettings().hooks.SessionStart)).toContain(
      ".claude/hooks/session-start.sh",
    );
  });

  it("같은 어댑터를 쓰는 opencode.json 도 같다 — 'mcp' 가 객체가 아니면 사라진 하네스 서버를 되돌리지 못했다고 말한다", () => {
    const oc = (): InstallSpec => ({ ...spec(), cli: ["opencode"] });
    const once = (mode: InstallMode): string => {
      const lines: string[] = [];
      const renderer = createInstallRenderer((m) => lines.push(m), oc(), false);
      const report = runInstall({
        runExternal: null,
        harnessRoot: HARNESS_ROOT,
        projectDir,
        spec: oc(),
        mode,
        onProgress: (event) => renderer.callbacks.onProgress?.(event),
      });
      // install 은 CLI 산출물 행을 실행 뒤에 낸다(update 는 위 스트리밍이 낸다)
      if (mode !== "update") renderCliArtifacts((m) => lines.push(m), oc(), report);
      // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI 색 코드를 벗긴다
      return lines.join("\n").replace(/\x1b\[[0-9;]*m/g, "");
    };
    once("add");
    const path = join(projectDir, "opencode.json");
    const json = JSON.parse(readFileSync(path, "utf8")) as { mcp: Record<string, unknown> };
    const servers = Object.keys(json.mcp);
    expect(servers.length).toBeGreaterThan(0); // 전제 — 하네스 서버가 기록된 몫이다
    writeFileSync(path, `${JSON.stringify({ ...json, mcp: [] }, null, 2)}\n`);

    for (const mode of ["update", "reinstall"] as const) {
      const row = once(mode)
        .split("\n")
        .find((l) => l.includes("opencode.json"));
      expect(row, mode).toContain(`was missing — could not restore: mcp.${servers[0]}`);
      expect(row, mode).not.toContain("kept yours");
    }
  });

  it("회귀 없음 — 목록 모양 그대로 설치자가 고친 하네스 줄은 지금처럼 'kept yours'", () => {
    run("add");
    const s = readSettings();
    const groups = s.hooks.SessionStart as Array<{ hooks: Array<Record<string, unknown>> }>;
    const mine = groups.find((g) => JSON.stringify(g).includes("session-start.sh"));
    if (mine?.hooks[0] === undefined) throw new Error("전제 — 하네스 세션 훅 묶음이 있다");
    mine.hooks[0].timeout = 99;
    writeSettings(s);

    const row = settingsRow(run("reinstall"));

    expect(row).toContain(`kept yours: ${KEY}`);
    expect(row).not.toContain("could not restore");
  });
});
