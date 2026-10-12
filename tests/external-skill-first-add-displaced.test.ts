/**
 * #780 (ADR-097 결정 3·7 · 설계 v26.170.0 §4.2 · §13 B4) — 기존 설치본에 외부 스킬을 **처음** 더할 때 그 스킬 자리
 * (`.claude/skills/<id>/` · `.agents/skills/<id>/`)에 설치자 파일이 있으면, 도구(`npx skills add --copy`)가 폴더를 새로
 * 만들어도 잃지 않는다:
 *   ① 상류와 같은 이름(`SKILL.md`)으로 덮인 파일 → `<file>.backup-<시각>` + `rootFiles displaced` · 그 자리의 도구 파일은 자산 몫
 *   ② 상류에 없는 이름(`mine.md`)이라 도구가 지운 파일 → 제자리(기록 안 함)
 *   ③ uninstall(전량 · `--only`)이 원본을 되돌린다
 *   ④ 1 MiB 를 넘는 파일도 같다 — 메모리 대신 자리 밖 사본으로 지킨다
 * 실 도구로의 재현은 docker `scenario-update-external-skills` 의 첫 추가 단계가 맡는다.
 */

import type { SpawnSyncReturns } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createInstallRenderer } from "../src/commands/install-render.js";
import { uninstallAction } from "../src/commands/uninstall.js";
import { EXTERNAL_ASSETS } from "../src/external-assets.js";
import { runExternalInstall } from "../src/external-installer.js";
import { listFilesRecursive } from "../src/fs-ops.js";
import { type InstallLog, readInstallLog } from "../src/install-log.js";
import { runInstall } from "../src/installer.js";
import type { CliBase, CliTargets, InstallSpec } from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");
const found = EXTERNAL_ASSETS.find((a) => a.id === "frontend-design");
if (found === undefined) throw new Error("catalog has no frontend-design");
const FD = found;

const SLOT = ".claude/skills/frontend-design";
const SKILL = `${SLOT}/SKILL.md`;
const MINE = `${SLOT}/mine.md`;
const AGENTS_SLOT = ".agents/skills/frontend-design";
const AGENTS_MINE = `${AGENTS_SLOT}/mine.md`;
const CLI: CliBase[] = ["claude", "codex"];

let projectDir: string;
beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "first-add-780-"));
});
afterEach(() => {
  rmSync(projectDir, { recursive: true, force: true });
});

function put(rel: string, content: string | Buffer): void {
  const abs = join(projectDir, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
}

function bytes(rel: string): Buffer {
  return readFileSync(join(projectDir, rel));
}

function ok(): SpawnSyncReturns<string> {
  return { pid: 0, output: [], stdout: "", stderr: "", status: 0, signal: null };
}

/** `npx skills add … --copy` 의 디스크 효과 — 실 도구처럼 스킬 폴더를 **지우고 새로 만든다**(770b 리뷰 S5 실측). */
function toolRecreatingFolder(cmd: string, args: ReadonlyArray<string>, opts: { cwd?: string }) {
  if (cmd !== "npx" || args[1] !== "add") return ok();
  const cwd = opts.cwd ?? projectDir;
  const agents = args.flatMap((a, i) => (args[i - 1] === "--agent" ? [a] : []));
  const roots = new Set(
    agents.map((a) => (a === "claude-code" ? ".claude/skills" : ".agents/skills")),
  );
  for (const root of roots) {
    const dir = join(cwd, root, "frontend-design");
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(join(dir, "refs"), { recursive: true });
    writeFileSync(join(dir, "SKILL.md"), "# frontend-design upstream\n");
    writeFileSync(join(dir, "refs", "typography.md"), "type scale\n");
  }
  return ok();
}

/** 외부 스킬 없이 깐 기존 설치본. */
function installWithoutSkill(): void {
  runInstall({
    harnessRoot: HARNESS_ROOT,
    projectDir,
    spec: { tracks: ["tooling"], options: { withCodexTrust: false }, cli: CLI, projectDir },
    mode: "add",
    runExternal: null,
  });
}

/** 같은 설치본에 `--with frontend-design` 으로 처음 더한다. */
function addSkill(screen: string[] = []): void {
  const spec: InstallSpec = {
    tracks: ["tooling"],
    options: { withCodexTrust: false },
    cli: CLI,
    projectDir,
    userOverride: { forceInclude: ["frontend-design"], forceExclude: [] },
  };
  runInstall({
    harnessRoot: HARNESS_ROOT,
    projectDir,
    spec,
    mode: "add",
    // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI 색 코드를 벗긴다
    ...createInstallRenderer((m) => screen.push(m.replace(/\x1b\[[0-9;]*m/g, "")), spec, false)
      .callbacks,
    runExternal: (ctx, deps) =>
      runExternalInstall(
        { ...ctx, cli: CLI as CliTargets },
        { ...deps, assets: [FD], spawn: toolRecreatingFolder },
      ),
  });
}

function uninstall(extra: { only?: string; dryRun?: boolean } = {}): string {
  const lines: string[] = [];
  uninstallAction(
    { projectDir, ...extra },
    {
      exit: () => undefined as never,
      // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI 색 코드를 벗긴다
      log: (l: string) => lines.push(l.replace(/\x1b\[[0-9;]*m/g, "")),
      // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI 색 코드를 벗긴다
      err: (l: string) => lines.push(l.replace(/\x1b\[[0-9;]*m/g, "")),
      spawn: (() => ok()) as never,
      resolveHarnessRoot: () => HARNESS_ROOT,
    },
  );
  return lines.join("\n");
}

function slotBackups(): string[] {
  return [".claude/skills", ".agents/skills"]
    .flatMap((root) => listFilesRecursive(join(projectDir, root)).map((rel) => `${root}/${rel}`))
    .filter((p) => /\.backup-\d{8}T\d{6}/.test(p))
    .sort();
}

function log(): InstallLog {
  return readInstallLog(projectDir) as InstallLog;
}

function displacedIn(l: InstallLog): Array<{ path: string; notes: string[] }> {
  return (l.rootFiles ?? []).filter((f) => f.change === "displaced");
}

/** 설치자 표식 — 상류와 같은 이름 하나 · 상류에 없는 이름 둘(두 루트). */
function placeInstallerFiles(): void {
  put(SKILL, "MINE skill\n");
  put(MINE, "mine note\n");
  put(AGENTS_MINE, "agents mine\n");
}

describe("#780 — 외부 스킬 첫 추가는 그 자리의 설치자 파일을 잃지 않는다", () => {
  it("덮인 파일은 백업 + displaced, 지워진 파일은 제자리, 도구 파일은 자산 몫이고 · 화면이 한 줄로 말한다", () => {
    installWithoutSkill();
    placeInstallerFiles();
    const screen: string[] = [];
    addSkill(screen);

    // ① 덮인 설치자 파일
    expect(bytes(SKILL).toString()).toBe("# frontend-design upstream\n");
    const backups = slotBackups();
    expect(backups).toHaveLength(1);
    expect(backups[0]?.startsWith(`${SKILL}.backup-`)).toBe(true);
    expect(bytes(backups[0] as string).toString()).toBe("MINE skill\n");
    expect(displacedIn(log())).toEqual([{ path: SKILL, change: "displaced", notes: [backups[0]] }]);
    // ② 지워진 설치자 파일은 제자리 · 기록 안 함
    expect(bytes(MINE).toString()).toBe("mine note\n");
    expect(bytes(AGENTS_MINE).toString()).toBe("agents mine\n");
    const files = (log().assets.find((a) => a.id === FD.id)?.files ?? []).map((f) => f.path);
    expect(files).toContain(SKILL);
    expect(files).toContain(`${AGENTS_SLOT}/SKILL.md`);
    expect(files).not.toContain(MINE);
    expect(files).not.toContain(AGENTS_MINE);
    expect(files.some((p) => p.includes(".backup-"))).toBe(false);
    // 화면
    const said = screen.filter((l) => l.includes("had a file with this name"));
    expect(said).toHaveLength(1);
    expect(said[0]).toContain(SKILL);
    expect(said[0]).toContain(backups[0] as string);
  });

  it("uninstall(전량)이 원본을 되돌린다 — 미리보기도 같은 말을 한다", () => {
    installWithoutSkill();
    placeInstallerFiles();
    addSkill();

    const preview = uninstall({ dryRun: true });
    expect(preview).toContain(`put back 1 file(s) of yours (displaced): ${SKILL}`);
    expect(preview).not.toContain("the spot is taken");

    const out = uninstall();
    expect(out).toContain(`put back  ${SKILL}`);
    expect(bytes(SKILL).toString()).toBe("MINE skill\n");
    expect(bytes(MINE).toString()).toBe("mine note\n");
    expect(bytes(AGENTS_MINE).toString()).toBe("agents mine\n");
    expect(slotBackups()).toEqual([]);
    expect(existsSync(join(projectDir, `${AGENTS_SLOT}/SKILL.md`))).toBe(false);
  });

  it("`uninstall --only` 도 원본을 되돌리고 그 displaced 만 기록에서 뺀다(다른 rootFiles 는 그대로)", () => {
    installWithoutSkill();
    placeInstallerFiles();
    addSkill();
    const before = log().rootFiles ?? [];

    const preview = uninstall({ only: FD.id, dryRun: true });
    expect(preview).toContain(`put back 1 file(s) of yours (displaced): ${SKILL}`);

    const out = uninstall({ only: FD.id });
    expect(out).toContain(`put back  ${SKILL}`);
    expect(bytes(SKILL).toString()).toBe("MINE skill\n");
    expect(bytes(MINE).toString()).toBe("mine note\n");
    expect(slotBackups()).toEqual([]);
    const after = log();
    expect(after.assets.some((a) => a.id === FD.id)).toBe(false);
    expect(displacedIn(after)).toEqual([]);
    expect(after.rootFiles).toEqual(before.filter((f) => f.path !== SKILL));
    expect(after.rootFiles?.length).toBeGreaterThan(0);
  });

  it("B4 — 1 MiB 를 넘는 설치자 파일도 지워지면 제자리(바이트 동일 · 백업 없음), 덮이면 백업 + displaced 뒤 uninstall 이 되돌린다", () => {
    installWithoutSkill();
    const big = Buffer.alloc(1024 * 1024 + 17);
    for (let i = 0; i < big.length; i++) big[i] = (i * 31 + 7) % 251;
    const bigSkill = Buffer.concat([Buffer.from("MINE big skill\n"), big]);
    put(`${SLOT}/data.bin`, big);
    put(SKILL, bigSkill);
    const screen: string[] = [];
    addSkill(screen);

    // 지워진 큰 파일은 제자리
    expect(bytes(`${SLOT}/data.bin`).equals(big)).toBe(true);
    // 덮인 큰 파일은 백업 하나 + displaced
    const backups = slotBackups();
    expect(backups).toHaveLength(1);
    expect(backups[0]?.startsWith(`${SKILL}.backup-`)).toBe(true);
    expect(bytes(backups[0] as string).equals(bigSkill)).toBe(true);
    expect(displacedIn(log()).map((f) => f.path)).toEqual([SKILL]);
    expect(screen.some((l) => l.includes("not held"))).toBe(false);

    uninstall();
    expect(bytes(SKILL).equals(bigSkill)).toBe(true);
    expect(bytes(`${SLOT}/data.bin`).equals(big)).toBe(true);
    expect(slotBackups()).toEqual([]);
  });

  it("설치자 파일이 상류와 바이트까지 같으면 손대지 않는다 — 백업 · displaced 없음", () => {
    installWithoutSkill();
    put(SKILL, "# frontend-design upstream\n");
    addSkill();
    expect(slotBackups()).toEqual([]);
    expect(displacedIn(log())).toEqual([]);
  });
});
