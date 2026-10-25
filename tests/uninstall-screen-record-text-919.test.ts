/**
 * #919 — uninstall 화면의 원래 있던 줄(displaced 되돌리기 안내 · `[BACKUPS]` 백업 이름 · 프로젝트 밖 링크 줄 · 글자부터 하네스 자리 밖인
 * 기록의 left 줄)이 기록 · 디스크 유래 글자를 그대로 찍어, 위조 기록이 화면에 진짜와 같은 명령 줄(`mv -i .env.backup-… .env`)을 끼울 수
 * 있었다. 그 글자(줄바꿈 · 공백 · 셸 메타 문자)는 `\uXXXX` 로 적혀 한 토막에 갇힌다 — 실행과 `--dry-run` 이 같다. 정상 설치본의 화면
 * 줄은 그대로다(#911 AC3 · 기존 uninstall 스위트가 고정한다 · 아래 `screenText` 항등 단언).
 */

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { uninstallAction } from "../src/commands/uninstall.js";
import { type InstallLog, readInstallLog, writeInstallLog } from "../src/install-log.js";
import { runInstall } from "../src/installer.js";
import { screenText } from "../src/screen-text.js";

const HARNESS_ROOT = resolve(__dirname, "..");
const STAMP = "20261025T000000";
const SECRET = "SECRET=installer-only\n";
const FAKE = `mv -i .env.backup-${STAMP} .env`;

let root = "";
let projectDir = "";
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "ah-919-"));
  projectDir = join(root, "proj");
  mkdirSync(projectDir);
  mkdirSync(join(root, "home"));
  vi.stubEnv("HOME", join(root, "home"));
  vi.stubEnv("CLAUDE_CONFIG_DIR", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(root, { recursive: true, force: true });
});

const abs = (rel: string): string => join(projectDir, rel);
const put = (rel: string, text: string): void => {
  mkdirSync(dirname(abs(rel)), { recursive: true });
  writeFileSync(abs(rel), text);
};
const read = (rel: string): string | null =>
  existsSync(abs(rel)) ? readFileSync(abs(rel), "utf8") : null;

function install(): void {
  runInstall({
    runExternal: null,
    harnessRoot: HARNESS_ROOT,
    projectDir,
    mode: "add",
    spec: {
      tracks: ["tooling"],
      options: { withCodexTrust: false },
      cli: ["claude", "codex"],
      projectDir,
    },
  });
  put(".env", SECRET);
  put(`.env.backup-${STAMP}`, "SECRET=attacker-chosen\n");
}

function forge(edit: (log: InstallLog) => InstallLog): void {
  writeInstallLog(projectDir, edit(readInstallLog(projectDir) as InstallLog));
}

function uninstall(dryRun: boolean): string {
  const lines: string[] = [];
  uninstallAction(
    { projectDir, yes: true, ...(dryRun ? { dryRun: true } : {}) },
    {
      log: (l: string) => lines.push(l),
      err: (l: string) => lines.push(l),
      exit: () => undefined as never,
      resolveHarnessRoot: () => HARNESS_ROOT,
    },
  );
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI 색 코드를 벗긴다
  return lines.join("\n").replace(/\x1b\[[0-9;]*m/g, "");
}

/** 위조 글자 넷 — 줄바꿈으로 새 줄 · 공백 채우기로 80칸 줄바꿈에 보이는 줄 · 공백으로 나뉜 인자 · 셸 메타 문자. */
const FORGED = (prefix: string): [string, string][] => [
  ["줄바꿈", `${prefix}zz\n        ${FAKE}`],
  ["공백 채우기", `${prefix}zz${" ".repeat(64)}${FAKE}`],
  ["공백", `${prefix}a.md .env`],
  ["셸 메타 문자", `${prefix}$(touch PWNED);x.md`],
];

/** 두 화면(미리보기 · 실행) 모두: 위조 글자가 날것으로 없고 · 명령 모양 줄이 없고 · 이스케이프된 판으로 한 토막에 적혀 있다. */
function expectConfined(screens: string[], forged: string, shown = forged): void {
  for (const screen of screens) {
    expect(screen).not.toContain(forged);
    expect(screen.split("\n").filter((l) => /^\s*(mv|rm)\s/.test(l))).toEqual([]);
    expect(screen).not.toMatch(/ {8,}mv /);
    expect(screen).not.toContain("$(touch");
    expect(screen).toContain(screenText(shown));
  }
  expect(read(".env")).toBe(SECRET);
  expect(existsSync(abs("PWNED"))).toBe(false);
}

describe("#919 — 기록 유래 글자는 uninstall 화면에서 한 토막에 갇힌다", () => {
  it.each(FORGED(".env-"))("displaced 되돌리기 안내 줄(자리 밖 기록) — %s", (_what, path) => {
    install();
    forge((log) => ({
      ...log,
      rootFiles: [
        ...(log.rootFiles ?? []),
        { path, change: "displaced", notes: [`.env.backup-${STAMP}`] },
      ],
    }));
    expectConfined([uninstall(true), uninstall(false)], path);
  });

  it.each(
    FORGED(".claude/rules/git-policy.md.backup-"),
  )("displaced 되돌리기 안내 줄(자리의 백업이 아닌 이름) — %s", (_what, backup) => {
    install();
    forge((log) => ({
      ...log,
      rootFiles: [
        ...(log.rootFiles ?? []),
        { path: ".claude/rules/git-policy.md", change: "displaced", notes: [backup] },
      ],
    }));
    expectConfined([uninstall(true), uninstall(false)], backup);
  });

  it.each(FORGED("notes/"))("글자부터 하네스 자리 밖인 기록의 left 줄 — %s", (_what, path) => {
    install();
    forge((log) => ({
      ...log,
      externalFiles: [...(log.externalFiles ?? []), { path, sha256: "0".repeat(64) }],
    }));
    expectConfined([uninstall(true), uninstall(false)], path);
  });

  it.each(FORGED(".claude/rules/x"))("[BACKUPS] 백업 이름 — %s", (_what, prefix) => {
    install();
    const name = `${prefix}.backup-${STAMP}`;
    put(name, "x\n");
    expectConfined([uninstall(true), uninstall(false)], name);
  });

  it.each(FORGED(""))("프로젝트 밖 링크 줄 — 링크 대상 이름 · 기록 경로 — %s", (_what, tail) => {
    install();
    // 기록에 있는 `.codex` 자리를 프로젝트 밖 폴더로 링크해 둔 설치본 — 대상 폴더 이름 · 그 아래 기록 경로가 위조 글자다
    const outside = join(root, `shared${tail.replaceAll("/", "_")}`);
    mkdirSync(outside, { recursive: true });
    rmSync(abs(".codex"), { recursive: true, force: true });
    symlinkSync(outside, abs(".codex"));
    const path = `.codex/${tail.replaceAll("/", "_")}`;
    forge((log) => ({
      ...log,
      externalFiles: [...(log.externalFiles ?? []), { path, sha256: "0".repeat(64) }],
    }));
    const screens = [uninstall(true), uninstall(false)];
    expectConfined(screens, outside);
    for (const screen of screens) expect(screen).not.toContain(path);
  });
});

describe("#919 — 정상 이름은 그대로 찍힌다", () => {
  it.each([
    ".claude/rules/git-policy.md",
    `.agents/rules/test-policy.md.backup-${STAMP}`,
    "../shared-codex",
    "/Users/me/dotfiles/agents",
    "dotfiles/한글-폴더/agents",
    ".claude.backup-20261025T000000-2",
  ])("%s", (text) => {
    expect(screenText(text)).toBe(text);
  });
});
