/**
 * #770 HIGH-1 (ADR-097 결정 3·5) — `install` 재실행도 외부 스킬을 `npx skills add --copy` 로 다시 받는다. 도구는 스킬
 * 폴더를 새로 만들어(컨테이너 실측) 설치자가 고친 기록 파일 · 폴더 안 기록 밖 설치자 파일(노트) · update 가 남긴 백업을
 * 지운다. update 와 같은 처리(호출 전에 들고 호출 뒤 판정)를 install 재실행에도 건다 — 판정 기준 ①②③:
 *   ① 고친 기록 파일은 `<file>.backup-<시각>` 하나로 남는다
 *   ② 슬롯의 기록 밖 파일(노트 · 앞선 백업)은 제자리에 있다
 *   ③ 안 고친 파일은 백업 없이 갱신된다
 * 실 도구로의 재현은 docker `scenario-update-external-skills` 의 install 재실행 단계가 맡는다.
 */

import type { SpawnSyncReturns } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createInstallRenderer } from "../src/commands/install-render.js";
import { EXTERNAL_ASSETS } from "../src/external-assets.js";
import { runExternalInstall } from "../src/external-installer.js";
import { listFilesRecursive } from "../src/fs-ops.js";
import { hashContent, readInstallLog } from "../src/install-log.js";
import { type InstallReport, runInstall } from "../src/installer.js";
import type { CliBase, CliTargets, InstallSpec } from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");
const found = EXTERNAL_ASSETS.find((a) => a.id === "frontend-design");
if (found === undefined) throw new Error("catalog has no frontend-design");
const FD = found;

const SLOT = ".claude/skills/frontend-design";
const SKILL = `${SLOT}/SKILL.md`;
const REF = `${SLOT}/refs/typography.md`;
const AGENTS_SKILL = ".agents/skills/frontend-design/SKILL.md";

let projectDir: string;
beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "install-rerun-770-"));
});
afterEach(() => {
  rmSync(projectDir, { recursive: true, force: true });
});

function put(rel: string, content: string): void {
  const abs = join(projectDir, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
}

function read(rel: string): string {
  return readFileSync(join(projectDir, rel), "utf8");
}

function ok(): SpawnSyncReturns<string> {
  return { pid: 0, output: [], stdout: "", stderr: "", status: 0, signal: null };
}

/** `npx skills add … --copy` 의 디스크 효과 — 실 도구처럼 스킬 폴더를 **지우고 새로 만든다**. */
function toolWriting(body: string) {
  return (cmd: string, args: ReadonlyArray<string>, opts: { cwd?: string }) => {
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
      writeFileSync(join(dir, "SKILL.md"), body);
      writeFileSync(join(dir, "refs", "typography.md"), "type scale\n");
    }
    return ok();
  };
}

function install(
  body: string,
  cli: CliBase[] = ["claude", "codex"],
  screen: string[] = [],
): InstallReport {
  const spawn = toolWriting(body);
  const spec: InstallSpec = {
    tracks: ["tooling"],
    options: { withCodexTrust: false },
    cli,
    projectDir,
    userOverride: { forceInclude: ["frontend-design"], forceExclude: [] },
  };
  return runInstall({
    harnessRoot: HARNESS_ROOT,
    projectDir,
    spec,
    mode: "add",
    ...createInstallRenderer((m) => screen.push(m), spec, false).callbacks,
    runExternal: (ctx, deps) =>
      runExternalInstall({ ...ctx, cli: cli as CliTargets }, { ...deps, assets: [FD], spawn }),
  });
}

function skillBackups(): string[] {
  return [".claude/skills", ".agents/skills"]
    .flatMap((root) => listFilesRecursive(join(projectDir, root)).map((rel) => `${root}/${rel}`))
    .filter((p) => /\.backup-\d{8}T\d{6}/.test(p))
    .sort();
}

describe("#770 HIGH-1 — install 재실행은 외부 스킬 폴더의 편집 · 노트 · 앞선 백업을 지우지 않는다", () => {
  it("① 고친 기록 파일은 편집을 담은 백업 하나로 남고 · ② 노트와 앞선 백업은 제자리 · ③ 안 고친 파일은 백업 없이 갱신된다", () => {
    install("# frontend-design v1\n");
    put(SKILL, "# frontend-design v1\nMY PROJECT NOTE\n");
    put(`${SLOT}/my-notes.md`, "installer note\n");
    put(`${SKILL}.backup-20260101T000000`, "older edit\n");

    const screen: string[] = [];
    const report = install("# frontend-design v2\n", ["claude", "codex"], screen);

    // ①
    const fresh = skillBackups().filter((p) => p !== `${SKILL}.backup-20260101T000000`);
    expect(fresh).toHaveLength(1);
    expect(fresh[0]?.startsWith(`${SKILL}.backup-`)).toBe(true);
    expect(read(fresh[0] as string)).toContain("MY PROJECT NOTE");
    expect(read(SKILL)).toBe("# frontend-design v2\n");
    // ②
    expect(read(`${SLOT}/my-notes.md`)).toBe("installer note\n");
    expect(read(`${SKILL}.backup-20260101T000000`)).toBe("older edit\n");
    // ③ — 안 고친 `.agents` 사본과 참고 파일은 상류판이고 백업이 없다
    expect(read(AGENTS_SKILL)).toBe("# frontend-design v2\n");
    expect(read(REF)).toBe("type scale\n");
    expect(fresh.some((p) => p.startsWith(AGENTS_SKILL) || p.startsWith(REF))).toBe(false);

    // 화면이 읽는 보고에 이번 백업이 실린다(실행 전부터 있던 백업은 싣지 않는다)
    const reported = (report.backups ?? []).filter((b) => b.includes("/skills/frontend-design/"));
    expect(reported).toEqual([join(projectDir, fresh[0] as string)]);
    const backupName = (fresh[0] as string).split("/").pop() as string;
    expect(screen.filter((l) => l.includes(backupName))).toHaveLength(1);
    expect(screen.some((l) => l.includes("20260101T000000"))).toBe(false);
    // 되돌린 설치자 파일 · 백업은 하네스 몫으로 기록하지 않는다(ADR-096) · 고친 파일의 기준선은 새 판으로 잇는다
    const files = readInstallLog(projectDir)?.assets.find((a) => a.id === FD.id)?.files ?? [];
    const recorded = files.map((f) => f.path);
    expect(recorded).not.toContain(`${SLOT}/my-notes.md`);
    expect(recorded.some((p) => p.includes(".backup-"))).toBe(false);
    expect(files.find((f) => f.path === SKILL)?.sha256).toBe(hashContent("# frontend-design v2\n"));
  });

  it("편집 없이 다시 install 하면 백업을 남기지 않는다", () => {
    install("# frontend-design v1\n");
    const report = install("# frontend-design v2\n");
    expect(skillBackups()).toEqual([]);
    expect((report.backups ?? []).filter((b) => b.includes("/skills/"))).toEqual([]);
  });
});
