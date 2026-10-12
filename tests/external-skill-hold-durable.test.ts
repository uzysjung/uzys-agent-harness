/**
 * #780 리뷰 BLOCKER · MEDIUM-1 · MEDIUM-2 — 외부 스킬 도구(`npx skills add --copy`) 앞에서 든 설치자 파일은 **실행이 어디서
 * 끊겨도** 잃지 않는다. 사본은 프로젝트 안 보존 자리(`.uzys-agent-harness/held/<시각>/<원래 경로>`)에 디스크로 두고, 그 파일의
 * 판정이 성공한 뒤에만 지운다. 끊긴 실행이 남긴 사본은 다음 install · update · uninstall 이 맨 먼저 정리한다.
 *   P-A  도구가 폴더를 지운 뒤 예외 → 원본이 제자리로(작은 파일 · 1 MiB 초과 둘 다) · update 경로도 같다
 *   P-E  판정 도중 실패(자리 쓰기 불가) → 사본이 보존 자리에 남고 다음 실행이 되돌린다(1 MiB 초과 포함)
 *   kill 끊긴 실행이 남긴 보존 자리 → 다음 install · uninstall 이 되돌린다(자리가 차 있으면 덮지 않고 백업) · 실제 SIGINT 로도
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
import { uninstallAction } from "../src/commands/uninstall.js";
import { EXTERNAL_ASSETS } from "../src/external-assets.js";
import { refreshExternalSkills, runExternalInstall } from "../src/external-installer.js";
import { listFilesRecursive } from "../src/fs-ops.js";
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
/** 보존 자리 — 설치자가 찾을 수 있는 경로라 테스트도 글자 그대로 쓴다(`held-files.ts` HOLD_DIR). */
const HOLD_DIR = ".uzys-agent-harness/held";
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

function heldFiles(): string[] {
  return listFilesRecursive(join(projectDir, HOLD_DIR));
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

function uninstall(extra: { dryRun?: boolean } = {}): { out: string; code: number | null } {
  const lines: string[] = [];
  let code: number | null = null;
  uninstallAction(
    { projectDir, ...extra },
    {
      exit: ((c: number) => {
        code = c;
      }) as never,
      // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI 색 코드를 벗긴다
      log: (l: string) => lines.push(l.replace(/\x1b\[[0-9;]*m/g, "")),
      // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI 색 코드를 벗긴다
      err: (l: string) => lines.push(l.replace(/\x1b\[[0-9;]*m/g, "")),
      spawn: (() => ok()) as never,
      resolveHarnessRoot: () => HARNESS_ROOT,
    },
  );
  return { out: lines.join("\n"), code };
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
    expect(has(HOLD_DIR)).toBe(false);
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
    expect(has(HOLD_DIR)).toBe(false);
    expect(log()).toEqual(recorded);
  });

  it.skipIf(ROOT_IS_SUPERUSER)(
    "P-E — 판정 도중 실패해도 사본은 보존 자리에 남고(1 MiB 초과 포함) 다음 install 이 되돌리며 화면이 파일마다 말한다",
    () => {
      installWithoutSkill();
      placeInstallerFiles();
      // 도구가 폴더를 새로 만든 뒤 자리를 잠근다 — 되돌리기 · 백업 쓰기가 EACCES 로 실패한다
      expect(() => addSkill({ after: () => chmodSync(join(projectDir, SLOT), 0o555) })).toThrow(
        /copies kept at \.uzys-agent-harness\/held\//,
      );
      chmodSync(join(projectDir, SLOT), 0o755);
      // 사본이 바이트까지 보존 자리에 있다
      const held = heldFiles();
      const copyOf = (rel: string): Buffer => {
        const hit = held.find((h) => h.endsWith(`/${rel}`));
        expect(hit, rel).toBeDefined();
        return readFileSync(join(projectDir, HOLD_DIR, hit as string));
      };
      expect(copyOf(MINE).toString()).toBe("mine note\n");
      expect(copyOf(SKILL).toString()).toBe("MINE skill\n");
      expect(copyOf(BIG).equals(big(7))).toBe(true);
      // 잠기지 않은 자리(.agents)는 이미 판정을 마쳤다
      expect(bytes(AGENTS_MINE).toString()).toBe("agents mine\n");

      const screen: string[] = [];
      addSkill({}, screen);
      expect(bytes(MINE).toString()).toBe("mine note\n");
      expect(bytes(BIG).equals(big(7))).toBe(true);
      // SKILL.md 자리는 상류 파일이 차지했다 — 덮지 않고 백업으로 둔다
      expect(bytes(SKILL).toString()).toBe(UPSTREAM);
      const kept = backupsOf(SKILL).map((b) => bytes(b).toString());
      expect(kept).toContain("MINE skill\n");
      expect(has(HOLD_DIR)).toBe(false);
      const said = screen.filter((l) => l.includes("held by an earlier run"));
      expect(said.some((l) => l.includes(`put back ${MINE}`))).toBe(true);
      expect(said.some((l) => l.includes(`put back ${BIG}`))).toBe(true);
      expect(said.some((l) => l.includes(`${SKILL} —`) && l.includes(".backup-"))).toBe(true);
    },
  );
});

/** 끊긴 실행이 남긴 보존 자리를 그대로 만든다 — kill 된 프로세스가 남기는 모양(`held/<시각>/<원래 경로>`). */
function leaveHoldArea(stamp: string, files: Record<string, string | Buffer>): void {
  for (const [rel, body] of Object.entries(files)) put(`${HOLD_DIR}/${stamp}/${rel}`, body);
}

describe("#780 BLOCKER — 끊긴 실행이 남긴 보존 자리는 다음 실행이 먼저 정리한다", () => {
  it("install — 빈 자리는 제자리로 · 차 있는 자리는 덮지 않고 `<path>.backup-<보존 시각>` · 같은 바이트는 사본만 걷는다", () => {
    installWithoutSkill();
    put(SKILL, "someone else now\n");
    put(".claude/skills/other/notes.md", "same\n");
    leaveHoldArea("20261012T010203", {
      [MINE]: "mine note\n",
      [SKILL]: "MINE skill\n",
      ".claude/skills/other/notes.md": "same\n",
      [BIG]: big(7),
    });
    const screen: string[] = [];
    const spec: InstallSpec = {
      tracks: ["tooling"],
      options: { withCodexTrust: false },
      cli: CLI,
      projectDir,
    };
    runInstall({
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec,
      mode: "add",
      runExternal: null,
      // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI 색 코드를 벗긴다
      ...createInstallRenderer((m) => screen.push(m.replace(/\x1b\[[0-9;]*m/g, "")), spec, false)
        .callbacks,
    });
    expect(bytes(MINE).toString()).toBe("mine note\n");
    expect(bytes(BIG).equals(big(7))).toBe(true);
    expect(bytes(SKILL).toString()).toBe("someone else now\n");
    expect(bytes(`${SKILL}.backup-20261012T010203`).toString()).toBe("MINE skill\n");
    expect(bytes(".claude/skills/other/notes.md").toString()).toBe("same\n");
    expect(has(HOLD_DIR)).toBe(false);
    const said = screen.filter((l) => l.includes("held by an earlier run"));
    expect(said).toHaveLength(3);
  });

  it("uninstall — 기록 폴더를 지우기 전에 되돌린다 · 미리보기는 디스크를 바꾸지 않고 같은 판정을 말한다", () => {
    installWithoutSkill();
    addSkill();
    leaveHoldArea("20261012T010203", { [MINE]: "mine note\n", [BIG]: big(7) });

    const preview = uninstall({ dryRun: true });
    expect(preview.out).toContain(`would put back ${MINE}`);
    expect(has(MINE)).toBe(false);
    expect(heldFiles()).toHaveLength(2);

    const done = uninstall();
    expect(done.code).not.toBe(1);
    expect(done.out).toContain(`put back ${MINE}`);
    expect(bytes(MINE).toString()).toBe("mine note\n");
    expect(bytes(BIG).equals(big(7))).toBe(true);
    expect(has(".uzys-agent-harness")).toBe(false);
  });

  it.skipIf(ROOT_IS_SUPERUSER)(
    "uninstall — 사본을 되돌리지 못하면 아무것도 지우지 않고 멈춘다(기록 폴더와 함께 사본이 사라지지 않게)",
    () => {
      installWithoutSkill();
      addSkill();
      leaveHoldArea("20261012T010203", { [MINE]: "mine note\n" });
      chmodSync(join(projectDir, SLOT), 0o555);
      const r = uninstall();
      chmodSync(join(projectDir, SLOT), 0o755);
      expect(r.code).toBe(1);
      expect(r.out).toContain("Nothing was removed");
      expect(heldFiles()).toHaveLength(1);
      expect(log().assets.some((a) => a.id === FD.id)).toBe(true);
    },
  );

  it("실제 SIGINT — 도구가 자리를 지운 채 멈춘 프로세스를 끊어도 다음 install 이 설치자 파일을 되돌린다", async () => {
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

      const screen: string[] = [];
      addSkill({}, screen);
      expect(bytes(MINE).toString()).toBe("mine note\n");
      expect(bytes(AGENTS_MINE).toString()).toBe("agents mine\n");
      expect(bytes(BIG).equals(big(7))).toBe(true);
      const skillCopies = [SKILL, ...backupsOf(SKILL)].map((p) => bytes(p).toString());
      expect(skillCopies).toContain("MINE skill\n");
      expect(has(HOLD_DIR)).toBe(false);
      expect(screen.some((l) => l.includes("held by an earlier run"))).toBe(true);
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
    expect(has(HOLD_DIR)).toBe(false);
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
    expect(has(HOLD_DIR)).toBe(false);
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
