/**
 * #800 (PR #804 리뷰 HIGH-1) — 다음 판이 하네스 훅 배선을 은퇴시켜 update 가 **설치자가 고친** 그 훅 줄을 걷을 때:
 * `.claude/settings.json` 백업 1개에 편집이 있고, 화면은 그 백업을 편집의 자리로 말한다 — "no checksum on record … may not
 * be your edits" 로 분류하지 않는다(함께 쓰는 파일은 몫마다 sha 가 기록돼 있다).
 */

import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { createInstallRenderer } from "../src/commands/install-render.js";
import { type InstallMode, runInstall } from "../src/installer.js";
import type { InstallSpec } from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");
const MINE = " && bash ./scripts/team-guard.sh";

let projectDir = "";
let nextRelease = "";
beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "ah-800-update-"));
  nextRelease = mkdtempSync(join(tmpdir(), "ah-800-bundle-"));
});
afterEach(() => {
  rmSync(projectDir, { recursive: true, force: true });
  rmSync(nextRelease, { recursive: true, force: true });
});

const spec = (): InstallSpec => ({
  tracks: ["tooling"],
  options: { withCodexTrust: false },
  cli: ["claude"],
  projectDir,
});

function run(root: string, mode: InstallMode): string {
  const lines: string[] = [];
  const renderer = createInstallRenderer((m) => lines.push(m), spec(), false);
  runInstall({
    runExternal: null,
    harnessRoot: root,
    projectDir,
    spec: spec(),
    mode,
    onProgress: (e) => renderer.callbacks.onProgress?.(e),
  });
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI 색 코드를 벗긴다
  return lines.join("\n").replace(/\x1b\[[0-9;]*m/g, "");
}

interface Hook {
  command: string;
}
interface Group {
  hooks: Hook[];
}
type Settings = { hooks: Record<string, Group[]> };

const settingsPath = () => join(projectDir, ".claude/settings.json");
const backups = () =>
  readdirSync(join(projectDir, ".claude")).filter((f) => f.startsWith("settings.json.backup-"));
const isProtect = (h: Hook) => h.command.includes("protect-files.sh");

/** protect-files 배선이 빠진 "다음 판" 번들 — 템플릿 settings.json 에서 그 핸들러만 지운다. */
function releaseWithoutProtectFiles(): string {
  cpSync(join(HARNESS_ROOT, "templates"), join(nextRelease, "templates"), { recursive: true });
  const p = join(nextRelease, "templates/settings.json");
  const s = JSON.parse(readFileSync(p, "utf8")) as Settings;
  for (const [event, groups] of Object.entries(s.hooks)) {
    s.hooks[event] = groups
      .map((g) => ({ ...g, hooks: g.hooks.filter((h) => !isProtect(h)) }))
      .filter((g) => g.hooks.length > 0);
  }
  writeFileSync(p, `${JSON.stringify(s, null, 2)}\n`);
  return nextRelease;
}

it("은퇴한 배선의 고친 훅 줄 — update 가 걷고 백업에 편집이 있으며, 화면이 그 백업을 편집의 자리로 말한다", () => {
  run(HARNESS_ROOT, "add");
  const s = JSON.parse(readFileSync(settingsPath(), "utf8")) as Settings;
  const hook = Object.values(s.hooks)
    .flatMap((gs) => gs.flatMap((g) => g.hooks))
    .find(isProtect);
  expect(hook, "전제 — protect-files 훅이 깔렸다").toBeDefined();
  if (hook === undefined) return;
  hook.command += MINE;
  const edited = hook.command;
  writeFileSync(settingsPath(), JSON.stringify(s, null, 2));

  const screen = run(releaseWithoutProtectFiles(), "update");

  expect(readFileSync(settingsPath(), "utf8")).not.toContain("protect-files.sh");
  const [backup, ...more] = backups();
  expect(more).toEqual([]);
  expect(readFileSync(join(projectDir, ".claude", backup ?? ""), "utf8")).toContain(
    JSON.stringify(edited).slice(1, -1),
  );
  expect(screen).toContain(`are in the copy: .claude/${backup}`);
  expect(screen).not.toContain("no checksum on record");
  expect(screen).not.toContain("nothing to carry over");
});
