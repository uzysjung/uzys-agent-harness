/**
 * #812 — 설치 기록 폴더의 헬퍼(`.uzys-agent-harness/*.sh`)도 다른 하네스 파일과 똑같이 회수한다. 전에는 uninstall 이 그 폴더를
 * 통째로 지워 ⓐ 설치자가 고친 헬퍼가 백업 없이 사라지고 ⓑ update 가 남긴 헬퍼 백업이 함께 사라지고 ⓒ 하네스가 비켜 둔(displaced)
 * 설치자 헬퍼가 돌아오지 않았다. 고치지 않은 헬퍼 · 기록 · 런타임 파일만 있던 설치는 지금처럼 폴더째 남지 않는다.
 */

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type UninstallOptions, uninstallAction } from "../src/commands/uninstall.js";
import { readInstallLog, writeInstallLog } from "../src/install-log.js";
import { runInstall } from "../src/installer.js";
import type { CliTargets } from "../src/types.js";
import { runUpdateMode } from "../src/update-mode.js";

const HARNESS_ROOT = resolve(__dirname, "..");
const TEMPLATES_DIR = join(HARNESS_ROOT, "templates");
const DIR = ".uzys-agent-harness";
const PROTECT = `${DIR}/protect-branch.sh`;
const ABSENCE = `${DIR}/check-absence.sh`;
const MINE = "\n# 우리 팀 기본 브랜치는 trunk\n";

let projectDir = "";
beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "un-helper-"));
});
afterEach(() => rmSync(projectDir, { recursive: true, force: true }));

const abs = (rel: string): string => join(projectDir, rel);
const read = (rel: string): string => readFileSync(abs(rel), "utf8");

function put(rel: string, content: string): void {
  mkdirSync(dirname(abs(rel)), { recursive: true });
  writeFileSync(abs(rel), content);
}

function install(cli: CliTargets = ["claude"]) {
  return runInstall({
    runExternal: null,
    harnessRoot: HARNESS_ROOT,
    projectDir,
    mode: "add",
    spec: { tracks: ["tooling"], options: { withCodexTrust: false }, cli: [...cli], projectDir },
  });
}

function uninstall(options: Omit<UninstallOptions, "projectDir"> = {}) {
  const out = { lines: [] as string[], code: null as number | null };
  uninstallAction(
    { projectDir, yes: true, ...options },
    {
      log: (l: string) => out.lines.push(l),
      err: (l: string) => out.lines.push(l),
      exit: (code: number) => {
        out.code ??= code;
        return undefined as never;
      },
      resolveHarnessRoot: () => HARNESS_ROOT,
    },
  );
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI 색 코드를 벗긴다
  return { ...out, text: out.lines.join("\n").replace(/\x1b\[[0-9;]*m/g, "") };
}

/** 기록 폴더 안의 `<name>.backup-*` 내용들. */
function backupsOf(rel: string): string[] {
  const dir = dirname(abs(rel));
  const base = rel.slice(rel.lastIndexOf("/") + 1);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => n.startsWith(`${base}.backup-`))
    .map((n) => readFileSync(join(dir, n), "utf8"));
}

/** v26.161.0 이하 모양 — writer 표식이 없고 헬퍼는 기록 어디에도 없다(쓰는 순간 적는 기록은 v26.162.0 부터). */
function makeLegacyLog(): void {
  const log = readInstallLog(projectDir);
  if (log === null) throw new Error("no install log");
  const { records: _records, ...rest } = log;
  writeInstallLog(projectDir, {
    ...rest,
    externalFiles: (log.externalFiles ?? []).filter((f) => !f.path.startsWith(`${DIR}/`)),
  });
}

describe("#812 헬퍼는 다른 하네스 파일처럼 하나씩 회수한다", () => {
  it("고친 헬퍼 → uninstall: 고친 내용이 그 파일 하나의 백업으로 남고 화면이 말한다 · 고치지 않은 헬퍼 · 기록은 치운다", () => {
    install();
    const edited = `${read(PROTECT)}${MINE}`;
    writeFileSync(abs(PROTECT), edited);

    const out = uninstall();

    expect(out.code).toBe(0);
    expect(existsSync(abs(PROTECT))).toBe(false);
    expect(backupsOf(PROTECT)).toEqual([edited]);
    expect(existsSync(abs(ABSENCE))).toBe(false);
    expect(existsSync(abs(`${DIR}/.harness-install.json`))).toBe(false);
    expect(out.text).toMatch(
      /backed up {2}\.uzys-agent-harness\/protect-branch\.sh — you edited it — saved as \.uzys-agent-harness\/protect-branch\.sh\.backup-\d{8}T\d{6}/,
    );
    expect(out.text).toMatch(/\[BACKUPS\][^\n]*\n(?:[^\n]*\n)*?\s+\.uzys-agent-harness\/protect-branch\.sh\.backup-/);
  });

  it("옛 기록(헬퍼 항목 없음)도 같다 — 번들 판 그대로인 헬퍼는 백업 없이, 고친 헬퍼는 백업하고 치운다", () => {
    install();
    makeLegacyLog();
    const edited = `${read(PROTECT)}${MINE}`;
    writeFileSync(abs(PROTECT), edited);

    const out = uninstall();

    expect(out.code).toBe(0);
    expect(backupsOf(PROTECT)).toEqual([edited]);
    expect(backupsOf(ABSENCE)).toEqual([]);
    expect(existsSync(abs(ABSENCE))).toBe(false);
    expect(out.text).toMatch(/\[BACKUPS\][\s\S]*\.uzys-agent-harness\/protect-branch\.sh\.backup-/);
  });

  it("update 가 남긴 헬퍼 백업은 uninstall 뒤에도 남고 [BACKUPS] 에 나온다", () => {
    install();
    const edited = `${read(ABSENCE)}${MINE}`;
    writeFileSync(abs(ABSENCE), edited);
    runUpdateMode(projectDir, TEMPLATES_DIR, HARNESS_ROOT);
    expect(backupsOf(ABSENCE)).toEqual([edited]); // 전제 — update 가 고친 헬퍼를 백업했다

    const out = uninstall();

    expect(out.code).toBe(0);
    expect(existsSync(abs(ABSENCE))).toBe(false);
    expect(backupsOf(ABSENCE)).toEqual([edited]);
    expect(out.text).toMatch(/\[BACKUPS\][\s\S]*\.uzys-agent-harness\/check-absence\.sh\.backup-/);
  });

  it("update 를 거쳐 고친 헬퍼 → uninstall: 같은 판정 — 백업으로 남는다", () => {
    install();
    runUpdateMode(projectDir, TEMPLATES_DIR, HARNESS_ROOT);
    const edited = `${read(PROTECT)}${MINE}`;
    writeFileSync(abs(PROTECT), edited);

    const out = uninstall();

    expect(out.code).toBe(0);
    expect(backupsOf(PROTECT)).toEqual([edited]);
  });

  it("하네스가 비켜 둔(displaced) 설치자 헬퍼 → uninstall 뒤 원본이 바이트 그대로 제자리", () => {
    const mine = "#!/usr/bin/env bash\necho 내 check-absence\n";
    put(ABSENCE, mine);
    install();
    expect(read(ABSENCE)).not.toBe(mine); // 전제 — 하네스 판이 그 자리에 있다
    expect(
      (readInstallLog(projectDir)?.rootFiles ?? []).some(
        (f) => f.path === ABSENCE && f.change === "displaced",
      ),
    ).toBe(true);

    const out = uninstall();

    expect(out.code).toBe(0);
    expect(read(ABSENCE)).toBe(mine);
    expect(backupsOf(ABSENCE)).toEqual([]);
    expect(existsSync(abs(PROTECT))).toBe(false);
    expect(existsSync(abs(`${DIR}/.harness-install.json`))).toBe(false);
  });

  it("하네스 것만 있던 기록 폴더(헬퍼 · 기록 · 차단 로그 · update 백업 목록)는 남지 않는다", () => {
    install();
    put(`${DIR}/hook-blocks.log`, "2026-10-14\tprotect-files\t.env\n");
    put(`${DIR}/update-backups.json`, "[]\n");

    const out = uninstall();

    expect(out.code).toBe(0);
    expect(existsSync(abs(DIR))).toBe(false);
    expect(out.text).not.toContain("[BACKUPS]");
  });

  it("--cli 는 기록 폴더를 건드리지 않는다(헬퍼는 남는 CLI 와 함께 쓴다)", () => {
    install(["claude", "codex"]);
    const before = read(PROTECT);

    const out = uninstall({ cli: "claude" });

    expect(out.code).toBe(0);
    expect(read(PROTECT)).toBe(before);
    expect(existsSync(abs(`${DIR}/.harness-install.json`))).toBe(true);
  });
});
