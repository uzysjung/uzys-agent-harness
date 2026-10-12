/**
 * #780 리뷰 BLOCKER · MEDIUM-1 · MEDIUM-2 — 외부 스킬 도구(`npx skills add --copy`) 앞에서 지킬 설치자 파일은 **실행이 어디서
 * 끊겨도** 잃지 않는다. 호출 전에 자리 옆 평범한 백업 폴더(`<스킬 루트>.backup-<시각>/<id>/`, 같은 상대 경로)로 옮기고, 호출 뒤에
 * 제자리로 되돌리거나 백업으로 남긴다. 끊기면 파일은 그 폴더에 그대로 있다 — 되살리는 코드가 따로 없다.
 *   P-A  도구가 폴더를 지운 뒤 예외 → 원본이 제자리로(작은 파일 · 1 MiB 초과 둘 다) · update 경로도 같다
 *   P-E  판정 도중 실패(자리 쓰기 불가) → 파일이 백업 폴더에 바이트까지 남고 오류가 그 폴더를 말한다
 *   kill 실제 SIGINT 로 끊긴 실행 → 파일이 백업 폴더에 바이트까지 남는다
 *   P-C  도구가 덮은 뒤 실패(비영 종료) → displaced 로 적지 않고 원본을 바로 제자리로
 *   P-F  1 MiB 를 넘는 안 고친 도구 파일은 상류가 바뀌어도 백업 없이 갱신된다
 */

import { type SpawnSyncReturns, spawn } from "node:child_process";
import {
  chmodSync,
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
import { buildSync } from "esbuild";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createInstallRenderer } from "../src/commands/install-render.js";
import { EXTERNAL_ASSETS } from "../src/external-assets.js";
import { refreshExternalSkills, runExternalInstall } from "../src/external-installer.js";
import { hashContent, type InstallLog, readInstallLog } from "../src/install-log.js";
import { runInstall } from "../src/installer.js";
import type { CliBase, CliTargets, InstallSpec } from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");
const found = EXTERNAL_ASSETS.find((a) => a.id === "frontend-design");
if (found === undefined) throw new Error("catalog has no frontend-design");
const FD = found;

const SLOT = ".claude/skills/frontend-design";
const SKILL = `${SLOT}/SKILL.md`;
const MINE = `${SLOT}/mine.md`;
const BIG = `${SLOT}/zbig.bin`;
const AGENTS_SLOT = ".agents/skills/frontend-design";
const AGENTS_MINE = `${AGENTS_SLOT}/mine.md`;
const CLI: CliBase[] = ["claude", "codex"];
const UPSTREAM = "# frontend-design upstream\n";
/** 1 MiB 를 넘고 UTF-8 로 유효하지 않은 바이트가 섞인 파일 — 조각 해시가 기록 sha 방식과 같아야 한다. */
const big = (seed: number): Buffer => {
  const b = Buffer.alloc(1024 * 1024 + 17);
  for (let i = 0; i < b.length; i++) b[i] = (i * 31 + seed) % 251;
  return b;
};
const ROOT_IS_SUPERUSER = typeof process.getuid === "function" && process.getuid() === 0;

let projectDir: string;
beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "hold-durable-780-"));
});
afterEach(() => {
  for (const s of [SLOT, AGENTS_SLOT]) {
    if (existsSync(join(projectDir, s))) chmodSync(join(projectDir, s), 0o755);
  }
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

function has(rel: string): boolean {
  return existsSync(join(projectDir, rel));
}

function ok(status = 0): SpawnSyncReturns<string> {
  return { pid: 0, output: [], stdout: "", stderr: "", status, signal: null };
}

/** 스킬 루트 밖 백업 폴더(`<루트>.backup-<시각>/<id>`) — 설치자가 찾을 경로라 이름 규칙을 글자 그대로 쓴다. */
function asideDirs(slot: string): string[] {
  const root = dirname(slot);
  const id = slot.slice(root.length + 1);
  const parent = dirname(root);
  const name = root.slice(parent.length + 1);
  if (!has(parent)) return [];
  return readdirSync(join(projectDir, parent))
    .filter((n) => new RegExp(`^${name}\\.backup-\\d{8}T\\d{6}$`).test(n))
    .map((n) => `${parent}/${n}/${id}`)
    .filter((d) => has(d));
}

/** 원래 경로(`rel`)의 파일이 그 자리의 백업 폴더 안 같은 상대 경로에 있는 바이트. */
function asideBytes(slot: string, rel: string): Buffer {
  const dirs = asideDirs(slot);
  expect(dirs, slot).toHaveLength(1);
  return bytes(`${dirs[0]}/${rel.slice(slot.length + 1)}`);
}

function noAsideLeft(): void {
  expect(asideDirs(SLOT)).toEqual([]);
  expect(asideDirs(AGENTS_SLOT)).toEqual([]);
}

function backupsOf(rel: string): string[] {
  const dir = dirname(rel);
  const name = rel.slice(dir.length + 1);
  if (!has(dir)) return [];
  return readdirSync(join(projectDir, dir))
    .filter((n) => n.startsWith(`${name}.backup-`))
    .map((n) => `${dir}/${n}`);
}

interface ToolPlan {
  /** 상류가 폴더에 쓰는 파일(슬롯 상대). */
  files?: Record<string, string | Buffer>;
  /** 폴더를 새로 만든 뒤 할 일 — 예외 · 자리 잠금 등. */
  after?: () => void;
  status?: number;
}

/** `npx skills add … --copy` 의 디스크 효과 — 실 도구처럼 스킬 폴더를 **지우고 새로 만든다**(770b 리뷰 S5 실측). */
function tool(plan: ToolPlan = {}) {
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
      mkdirSync(dir, { recursive: true });
      for (const [rel, body] of Object.entries(plan.files ?? { "SKILL.md": UPSTREAM })) {
        mkdirSync(dirname(join(dir, rel)), { recursive: true });
        writeFileSync(join(dir, rel), body);
      }
    }
    plan.after?.();
    return ok(plan.status ?? 0);
  };
}

function installWithoutSkill(): void {
  runInstall({
    harnessRoot: HARNESS_ROOT,
    projectDir,
    spec: { tracks: ["tooling"], options: { withCodexTrust: false }, cli: CLI, projectDir },
    mode: "add",
    runExternal: null,
  });
}

/** 같은 설치본에 `--with frontend-design` 으로 더한다(재실행도 같은 호출). */
function addSkill(plan: ToolPlan = {}, screen: string[] = []): void {
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
        { ...deps, assets: [FD], spawn: tool(plan) },
      ),
  });
}

function log(): InstallLog {
  return readInstallLog(projectDir) as InstallLog;
}

function placeInstallerFiles(): void {
  put(SKILL, "MINE skill\n");
  put(MINE, "mine note\n");
  put(AGENTS_MINE, "agents mine\n");
  put(BIG, big(7));
}

function expectInstallerFilesInPlace(): void {
  expect(bytes(SKILL).toString()).toBe("MINE skill\n");
  expect(bytes(MINE).toString()).toBe("mine note\n");
  expect(bytes(AGENTS_MINE).toString()).toBe("agents mine\n");
  expect(bytes(BIG).equals(big(7))).toBe(true);
}

describe("#780 BLOCKER — 도구 앞에서 든 파일은 실행이 끊겨도 남는다", () => {
  it("P-A — 도구가 폴더를 지운 뒤 예외가 나면 든 파일이 바이트까지 제자리로 돌아오고 보존 자리는 비워진다(1 MiB 초과 포함)", () => {
    installWithoutSkill();
    placeInstallerFiles();
    expect(() =>
      addSkill({
        after: () => {
          throw new Error("boom after the tool wiped the slot");
        },
      }),
    ).toThrow(/boom/);
    expectInstallerFilesInPlace();
    expect(backupsOf(SKILL)).toEqual([]);
    noAsideLeft();
  });

  it("P-A (update 경로) — 갱신 도구가 폴더를 지운 뒤 예외가 나도 고친 기록 파일 · 노트가 제자리다", () => {
    installWithoutSkill();
    addSkill();
    const recorded = log();
    put(SKILL, "MY EDIT\n");
    put(MINE, "mine note\n");
    put(BIG, big(7));
    expect(() =>
      refreshExternalSkills(projectDir, {
        assets: [FD],
        run: (ctx, deps) =>
          runExternalInstall(
            { ...ctx, cli: CLI as CliTargets },
            {
              ...deps,
              spawn: tool({
                after: () => {
                  throw new Error("boom in update");
                },
              }),
            },
          ),
        writeLog: () => undefined,
      }),
    ).toThrow(/boom in update/);
    expect(bytes(SKILL).toString()).toBe("MY EDIT\n");
    expect(bytes(MINE).toString()).toBe("mine note\n");
    expect(bytes(BIG).equals(big(7))).toBe(true);
    noAsideLeft();
    expect(log()).toEqual(recorded);
  });

  it.skipIf(ROOT_IS_SUPERUSER)(
    "P-E — 판정 도중 실패해도 옮긴 파일은 자리 옆 백업 폴더에 바이트까지 남고(1 MiB 초과 포함) 오류가 그 폴더를 말한다",
    () => {
      installWithoutSkill();
      placeInstallerFiles();
      // 도구가 폴더를 새로 만든 뒤 자리를 잠근다 — 되돌리기 · 백업 쓰기가 EACCES 로 실패한다
      expect(() => addSkill({ after: () => chmodSync(join(projectDir, SLOT), 0o555) })).toThrow(
        /they stay in \.claude\/skills\.backup-\d{8}T\d{6}\//,
      );
      chmodSync(join(projectDir, SLOT), 0o755);
      expect(asideBytes(SLOT, MINE).toString()).toBe("mine note\n");
      expect(asideBytes(SLOT, SKILL).toString()).toBe("MINE skill\n");
      expect(asideBytes(SLOT, BIG).equals(big(7))).toBe(true);
      // 잠기지 않은 자리(.agents)는 이미 판정을 마쳤다
      expect(bytes(AGENTS_MINE).toString()).toBe("agents mine\n");
      expect(asideDirs(AGENTS_SLOT)).toEqual([]);
    },
  );

  it("실제 SIGINT — 도구가 자리를 지운 채 멈춘 프로세스를 끊어도 설치자 파일은 자리 옆 백업 폴더에 바이트까지 남는다", async () => {
    installWithoutSkill();
    placeInstallerFiles();
    const work = mkdtempSync(join(tmpdir(), "hold-sigint-780-"));
    try {
      const marker = join(work, "wiped");
      const entry = join(work, "child.mjs");
      buildSync({
        stdin: {
          contents: childSource(),
          resolveDir: HARNESS_ROOT,
          sourcefile: "child.ts",
          loader: "ts",
        },
        bundle: true,
        platform: "node",
        format: "esm",
        outfile: entry,
        logLevel: "silent",
        banner: {
          js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);",
        },
      });
      const child = spawn(process.execPath, [entry, HARNESS_ROOT, projectDir, marker], {
        stdio: ["ignore", "ignore", "pipe"],
      });
      let stderr = "";
      child.stderr.on("data", (d) => {
        stderr += String(d);
      });
      const exited = new Promise<NodeJS.Signals | null>((res) =>
        child.on("exit", (_code, signal) => res(signal)),
      );
      const deadline = Date.now() + 20_000;
      while (!existsSync(marker)) {
        if (Date.now() > deadline || child.exitCode !== null)
          throw new Error(`child never reached the tool: ${stderr}`);
        await new Promise((r) => setTimeout(r, 25));
      }
      // 도구가 폴더를 지운 순간 — 설치자 파일은 자리에 없다
      expect(has(MINE)).toBe(false);
      child.kill("SIGINT");
      expect(await exited).toBe("SIGINT");

      expect(asideBytes(SLOT, MINE).toString()).toBe("mine note\n");
      expect(asideBytes(SLOT, SKILL).toString()).toBe("MINE skill\n");
      expect(asideBytes(SLOT, BIG).equals(big(7))).toBe(true);
      expect(asideBytes(AGENTS_SLOT, AGENTS_MINE).toString()).toBe("agents mine\n");
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  }, 30_000);
});

/** 자식 프로세스 — 같은 첫 추가를 돌리되 도구가 폴더를 지운 뒤 표식을 남기고 멈춘다(사람이 Ctrl-C 를 누르는 순간). */
function childSource(): string {
  return `
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EXTERNAL_ASSETS } from "./src/external-assets.js";
import { runExternalInstall } from "./src/external-installer.js";
import { runInstall } from "./src/installer.js";
const [harnessRoot, projectDir, marker] = process.argv.slice(2);
const FD = EXTERNAL_ASSETS.find((a) => a.id === "frontend-design");
const CLI = ["claude", "codex"];
const ok = { pid: 0, output: [], stdout: "", stderr: "", status: 0, signal: null };
function spawn(cmd, args, opts) {
  if (cmd !== "npx" || args[1] !== "add") return ok;
  const agents = args.flatMap((a, i) => (args[i - 1] === "--agent" ? [a] : []));
  for (const a of agents) {
    const dir = join(opts.cwd ?? projectDir, a === "claude-code" ? ".claude/skills" : ".agents/skills", "frontend-design");
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "SKILL.md"), "# frontend-design upstream\\n");
  }
  writeFileSync(marker, "1");
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 60000);
  return ok;
}
runInstall({
  harnessRoot,
  projectDir,
  spec: { tracks: ["tooling"], options: { withCodexTrust: false }, cli: CLI, projectDir,
    userOverride: { forceInclude: ["frontend-design"], forceExclude: [] } },
  mode: "add",
  runExternal: (ctx, deps) => runExternalInstall({ ...ctx, cli: CLI }, { ...deps, assets: [FD], spawn }),
});
`;
}

describe("#780 MEDIUM — 실패한 도구 · 큰 도구 파일", () => {
  it("P-C — 도구가 설치자 파일을 덮은 뒤 실패하면 원본을 바로 제자리로 · displaced 도 '되돌린다' 약속도 없다", () => {
    installWithoutSkill();
    placeInstallerFiles();
    const screen: string[] = [];
    addSkill({ status: 1 }, screen);
    expectInstallerFilesInPlace();
    expect(backupsOf(SKILL)).toEqual([]);
    expect((log().rootFiles ?? []).filter((f) => f.change === "displaced")).toEqual([]);
    expect(log().assets.some((a) => a.id === FD.id)).toBe(false);
    expect(screen.some((l) => l.includes("put back on uninstall"))).toBe(false);
    noAsideLeft();
  });

  it("P-F — 1 MiB 를 넘는 안 고친 도구 파일은 상류가 바뀌어도 백업 없이 갱신된다(작은 파일과 같다)", () => {
    installWithoutSkill();
    addSkill({ files: { "SKILL.md": UPSTREAM, "font.bin": big(3) } });
    const recorded = log().assets.find((a) => a.id === FD.id)?.files ?? [];
    expect(recorded.find((f) => f.path === `${SLOT}/font.bin`)?.sha256).toBe(
      hashContent(big(3).toString("utf8")),
    );
    addSkill({ files: { "SKILL.md": UPSTREAM, "font.bin": big(5) } });
    expect(bytes(`${SLOT}/font.bin`).equals(big(5))).toBe(true);
    expect(backupsOf(`${SLOT}/font.bin`)).toEqual([]);
    expect(backupsOf(`${AGENTS_SLOT}/font.bin`)).toEqual([]);
    noAsideLeft();
  });

  it("P-F 대조 — 1 MiB 를 넘는 도구 파일을 설치자가 고쳤으면 그 편집은 백업 하나로 남는다", () => {
    installWithoutSkill();
    addSkill({ files: { "SKILL.md": UPSTREAM, "font.bin": big(3) } });
    put(`${SLOT}/font.bin`, big(9));
    addSkill({ files: { "SKILL.md": UPSTREAM, "font.bin": big(5) } });
    expect(bytes(`${SLOT}/font.bin`).equals(big(5))).toBe(true);
    const b = backupsOf(`${SLOT}/font.bin`);
    expect(b).toHaveLength(1);
    expect(bytes(b[0] as string).equals(big(9))).toBe(true);
  });
});
