/**
 * #761 B-1 — 외부 CLI 기록(`externalFiles`)이 **아예 없는** 옛 설치본(≤v26.132)의 update · reinstall.
 *
 * 그 판의 하네스는 `.agents/` · `.codex/` 에 쓰고도 기록을 남기지 않았다. 기록이 없는 것은 "하네스가 쓴 적 없다" 가
 * 아니라 "그 판은 적지 않았다" 이므로, `.claude/` 쪽 B3(스캔 필드가 아예 없으면 `no-sha`)와 같은 말로 읽는다 — 하네스 판과
 * 같은 파일은 sha 로 적고, 다른 파일은 1회 백업 뒤 `no checksum` 으로 말한다. 설치자 파일(displaced)로 적으면 uninstall 이
 * 하네스 파일을 치우지 못하고 화면이 하네스의 옛 훅을 "yours" 라고 부른다(리뷰 B-1 재현: `.agents/` 41개 잔존).
 *
 * 대조(필드가 있는 로그 · writer 로그의 첫 접촉)는 `update-dev-default-skills.test.ts` ①③④ 가 문다.
 */

import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createInstallRenderer, renderUpdateSummary } from "../src/commands/install-render.js";
import { uninstallAction } from "../src/commands/uninstall.js";
import {
  hashContent,
  type InstallLog,
  installLogPath,
  readInstallLog,
} from "../src/install-log.js";
import { type InstallReport, runInstall } from "../src/installer.js";
import type { CliTargets, InstallSpec } from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");
const CLIS: CliTargets = ["claude", "codex"];
const HOOK = ".codex/hooks/session-start.sh";
const OLD_HOOK = "#!/bin/bash\n# an older harness release of this hook\n";

let projectDir: string;
beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "legacy-ext-log-"));
});
afterEach(() => {
  rmSync(projectDir, { recursive: true, force: true });
});

const spec = (): InstallSpec => ({
  tracks: ["tooling"],
  options: { withCodexTrust: false },
  cli: CLIS,
  projectDir,
});
const read = (rel: string): string => readFileSync(join(projectDir, rel), "utf8");
const log = (): InstallLog => {
  const l = readInstallLog(projectDir);
  if (!l) throw new Error("install log missing");
  return l;
};
/** `.claude/` 밖에 적힌 displaced — 이 시나리오에서 하네스 산출물이 설치자 파일로 잘못 적힌 것. */
const displacedOutsideClaude = (): string[] =>
  (log().rootFiles ?? [])
    .filter((f) => f.change === "displaced" && !f.path.startsWith(".claude/"))
    .map((f) => f.path);
const filesUnder = (rel: string): string[] => {
  const dir = join(projectDir, rel);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => join(e.parentPath, e.name));
};
const hookBackups = (): string[] =>
  readdirSync(join(projectDir, ".codex/hooks")).filter((f) =>
    f.startsWith("session-start.sh.backup-"),
  );

/** 지금 판으로 깐 뒤 외부 기록이 없던 판(≤v26.132)의 로그 모양으로 만든다 — 훅 하나는 그 판의 바이트다. */
function legacyInstall(): void {
  runInstall({
    runExternal: null,
    harnessRoot: HARNESS_ROOT,
    projectDir,
    spec: spec(),
    mode: "add",
  });
  const { externalFiles: _e, records: _r, portions: _p, ...rest } = log();
  writeFileSync(installLogPath(projectDir), JSON.stringify(rest), "utf8");
  writeFileSync(join(projectDir, HOOK), OLD_HOOK);
}

function runWithScreen(mode: "update" | "reinstall"): { report: InstallReport; screen: string } {
  const lines: string[] = [];
  const renderer = createInstallRenderer((m) => lines.push(m), spec(), false);
  const report = runInstall({
    runExternal: null,
    harnessRoot: HARNESS_ROOT,
    projectDir,
    spec: spec(),
    mode,
    onProgress: (event) => renderer.callbacks.onProgress?.(event),
  });
  if (mode === "update") renderUpdateSummary((m) => lines.push(m), spec(), report);
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI 색 코드를 벗긴다
  return { report, screen: lines.join("\n").replace(/\x1b\[[0-9;]*m/g, "") };
}

function uninstall(): void {
  uninstallAction({ projectDir, yes: true } as never, {
    exit: () => undefined as never,
    log: () => undefined,
    err: () => undefined,
    resolveHarnessRoot: () => HARNESS_ROOT,
  });
}

/** 완료 기준 1 — 하네스 판과 같은 외부 파일은 sha 로 · 다른 파일은 백업 1회 뒤 sha 로. displaced 는 0. */
function expectHarnessRecorded(): void {
  expect(displacedOutsideClaude()).toEqual([]);
  const external = new Map((log().externalFiles ?? []).map((f) => [f.path, f.sha256]));
  const agents = filesUnder(".agents");
  expect(agents.length).toBeGreaterThan(0);
  for (const abs of agents) {
    const rel = abs.slice(projectDir.length + 1);
    expect(external.get(rel), rel).toBe(hashContent(readFileSync(abs, "utf8")));
  }
  expect(read(HOOK)).not.toBe(OLD_HOOK);
  expect(external.get(HOOK)).toBe(hashContent(read(HOOK)));
  expect(hookBackups()).toHaveLength(1);
}

describe("#761 B-1 — 외부 기록이 없는 옛 로그: 하네스 산출물은 하네스 것(no-sha)이다", () => {
  it("update — sha 로 적고 · 옛 훅은 'no checksum' · 두 번째 update 는 조용하다 · uninstall 뒤 .agents/ 0개", () => {
    legacyInstall();

    const { report, screen } = runWithScreen("update");

    expectHarnessRecorded();
    expect(report.updateMode?.noChecksum).toContain(HOOK);
    expect(screen).toContain("no checksum");
    expect(screen).not.toContain("had files with these names");
    expect(screen).not.toContain("same as the harness version");

    const again = runWithScreen("update").screen;
    expect(again).not.toContain("same as the harness version");
    expect(again).not.toContain("had files with these names");

    uninstall();
    expect(filesUnder(".agents")).toEqual([]);
  });

  it("reinstall — 같은 판정 · uninstall 뒤 .agents/ 0개", () => {
    legacyInstall();

    runWithScreen("reinstall");

    expectHarnessRecorded();
    uninstall();
    expect(filesUnder(".agents")).toEqual([]);
  });
});
