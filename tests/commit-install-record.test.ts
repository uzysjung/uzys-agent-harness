/**
 * ADR-100 (#658) — 설치 기록을 저장소에 싣는다. 하네스는 `.gitignore` 에 기록 폴더(`.uzys-agent-harness/`)를 통째로
 * 무시하는 줄을 더하지 않고, 그 안의 런타임 파일 둘(`hook-blocks.log` · `update-backups.json`)만 무시한다.
 *
 * 이 파일이 무는 것(설계 `no-record-project-design-2026-10-04.md` §6 NR-2):
 *   - B2 — 옛 판이 더한 폴더 줄을 다음 install · update 가 걷고 두 줄을 더하며 그 까닭을 화면에 한 줄로 말한다. 설치자가
 *     고친 줄 · 설치자가 직접 둔 줄은 그대로다(설치자 줄이 이긴다)
 *   - B4 — install 직후 같은 판 update 가 기록 바이트를 바꾸지 않는다(경로 배열 정렬 — 커밋되는 기록에 뜻 없는 diff 0)
 *   - B3 — 실제 git 으로 커밋 → 클론: 클론에서 `list` 가 기록을 읽고, 같은 판 update 뒤 `git status --porcelain` 이 비고,
 *     `uninstall --dry-run` 이 원본과 같은 계획을 낸다
 *   (B1 — 렌더 키 — 은 `tests/env-files.test.ts`)
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ADAPTERS } from "../src/adapters/index.js";
import { createInstallRenderer } from "../src/commands/install-render.js";
import { listAction } from "../src/commands/list.js";
import { uninstallAction } from "../src/commands/uninstall.js";
import { gitignoreRender } from "../src/env-files.js";
import {
  hashContent,
  type InstallLog,
  installLogPath,
  readInstallLog,
} from "../src/install-log.js";
import { type InstallMode, runInstall } from "../src/installer.js";
import type { InstallSpec } from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");
const DIR_LINE = ".uzys-agent-harness/";
const RUNTIME = [".uzys-agent-harness/hook-blocks.log", ".uzys-agent-harness/update-backups.json"];
const NOTE = "now ignores only the harness's runtime files — commit .uzys-agent-harness/";

let root = "";
let projectDir = "";

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "ah-commit-record-"));
  projectDir = join(root, "origin");
  mkdirSync(projectDir);
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function spec(dir: string, over: Partial<InstallSpec> = {}): InstallSpec {
  return {
    tracks: ["tooling"],
    options: { withCodexTrust: false },
    cli: ["claude"],
    projectDir: dir,
    ...over,
  };
}

/** install(플래그 없음) 또는 update 1회 — 색을 벗긴 화면. */
function run(mode: InstallMode | undefined, dir = projectDir, over: Partial<InstallSpec> = {}) {
  const s = spec(dir, over);
  const lines: string[] = [];
  const renderer = createInstallRenderer((m) => lines.push(m), s, false);
  runInstall({
    runExternal: null,
    harnessRoot: HARNESS_ROOT,
    projectDir: dir,
    spec: s,
    ...(mode ? { mode } : {}),
    onProgress: (event) => renderer.callbacks.onProgress?.(event),
  });
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI 색 코드를 벗긴다
  return lines.join("\n").replace(/\u001b\[[0-9;]*m/g, "");
}

const read = (rel: string, dir = projectDir): string => readFileSync(join(dir, rel), "utf8");
const write = (rel: string, text: string): void => {
  mkdirSync(dirname(join(projectDir, rel)), { recursive: true });
  writeFileSync(join(projectDir, rel), text);
};
const log = (dir = projectDir): InstallLog => {
  const l = readInstallLog(dir);
  if (l === null) throw new Error("설치 기록이 없다 — 시나리오 전제가 깨졌다");
  return l;
};
const writeLog = (l: InstallLog): void => {
  writeFileSync(installLogPath(projectDir), `${JSON.stringify(l, null, 2)}\n`);
};
const gitignoreLines = (): string[] => read(".gitignore").split("\n");
const gitignoreKeys = (): string[] =>
  (log().portions ?? []).filter((p) => p.path === ".gitignore").map((p) => p.key);

/** 26.163.0 의 렌더 — 런타임 파일 두 줄 자리에 폴더 줄 하나. */
function oldRender(): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of gitignoreRender()) {
    if (key === RUNTIME[0]) out.set(DIR_LINE, DIR_LINE);
    if (!RUNTIME.includes(key)) out.set(key, value);
  }
  return out;
}

/**
 * 26.163.0 이 깐 저장소의 `.gitignore` 와 기록(몫 기록이 있는 판) — 지금 판으로 깐 뒤 `.gitignore` 와 그 몫만 옛 렌더로
 * 바꿔 놓는다. `edit` 으로 디스크 텍스트를 고칠 수 있다.
 */
function seedOldInstall(edit: (text: string) => string = (t) => t): void {
  write(".gitignore", "node_modules/\n");
  run(undefined);
  const res = ADAPTERS.lines.upsert("node_modules/\n", {
    render: oldRender(),
    recorded: new Map(),
    excluded: new Set(),
  });
  if (!res.ok) throw new Error("lines 어댑터가 픽스처를 못 읽었다");
  write(".gitignore", edit(res.text));
  const l = log();
  writeLog({
    ...l,
    portions: [
      ...(l.portions ?? []).filter((p) => p.path !== ".gitignore"),
      ...[...res.portions].map(([key, sha256]) => ({
        path: ".gitignore",
        adapter: "lines" as const,
        key,
        sha256,
      })),
    ],
  });
  expect(gitignoreLines()).toContain(DIR_LINE); // 전제
  expect(gitignoreKeys()).toContain(DIR_LINE); // 전제 — 옛 판의 하네스 몫
}

/* ─── B2 — 이관 ──────────────────────────────────────────────────────────── */

describe("B2: 옛 판이 더한 기록 폴더 줄 — 다음 install · update 가 걷고 런타임 두 줄을 더한다", () => {
  for (const mode of [undefined, "update"] as const) {
    const name = mode ?? "install";
    it(`${name}: 그 줄 remove + 두 줄 add + 안내 한 줄 · 설치자가 뺀 줄은 되살리지 않는다`, () => {
      seedOldInstall((t) => t.replace(".goose/\n", ""));
      // 설치자가 `--without gitignore:.goose/` 로 뺀 상태(기록) — 이관이 이 선택을 덮지 않는다
      writeLog({ ...log(), excluded: ["gitignore:.goose/"] });

      const screen = run(mode, projectDir, mode ? {} : { keyExclude: ["gitignore:.goose/"] });

      const lines = gitignoreLines();
      expect(lines).not.toContain(DIR_LINE);
      for (const r of RUNTIME) expect(lines).toContain(r);
      expect(lines).not.toContain(".goose/");
      expect(lines).toContain("node_modules/"); // 설치자 줄
      expect(gitignoreKeys()).not.toContain(DIR_LINE);
      expect(gitignoreKeys()).toEqual(expect.arrayContaining(RUNTIME));
      expect(log().excluded).toContain("gitignore:.goose/");
      expect(screen).toContain(NOTE);
    });
  }

  it("옛 판 저장소에서 설치자가 폴더 줄을 손으로 지웠으면 update 가 되살리지 않는다 (NR-1 리뷰 N1)", () => {
    seedOldInstall();
    write(".gitignore", read(".gitignore").replace(`${DIR_LINE}\n`, ""));

    const screen = run("update");

    expect(gitignoreLines()).not.toContain(DIR_LINE);
    for (const r of RUNTIME) expect(gitignoreLines()).toContain(r);
    expect(screen).not.toMatch(/gitignore:\.uzys-agent-harness\/(?!\S)/);
    expect(screen).not.toContain(NOTE); // 걷은 것이 아니다 — 이미 없었다
  });

  it("설치자가 고친 줄(기록 sha 와 다름)은 kept — 남기고 그렇게 말한다 · 이관 안내는 내지 않는다", () => {
    // 옛 판이 딸린 주석과 함께 적은 몫을 설치자가 자기 주석으로 고친 상태
    seedOldInstall((t) => t.replace(`${DIR_LINE}\n`, `# mine — keep out of git\n${DIR_LINE}\n`));
    const l = log();
    writeLog({
      ...l,
      portions: (l.portions ?? []).map((p) =>
        p.path === ".gitignore" && p.key === DIR_LINE
          ? { ...p, sha256: hashContent(`# harness state\n${DIR_LINE}`) }
          : p,
      ),
    });

    const screen = run(undefined);

    expect(gitignoreLines()).toContain(DIR_LINE);
    expect(read(".gitignore")).toContain(`# mine — keep out of git\n${DIR_LINE}\n`);
    for (const r of RUNTIME) expect(gitignoreLines()).toContain(r);
    expect(screen).toContain(`kept yours: ${DIR_LINE}`);
    expect(screen).not.toContain(NOTE);
  });

  it("설치자가 직접 둔 줄(기록에 없음)은 설치자 것 — 손대지 않고 안내도 없다", () => {
    write(".gitignore", `node_modules/\n${DIR_LINE}\n`);
    run(undefined);
    const before = read(".gitignore");

    const screen = run(undefined);

    expect(read(".gitignore")).toBe(before);
    expect(gitignoreLines()).toContain(DIR_LINE);
    expect(gitignoreKeys()).not.toContain(DIR_LINE);
    expect(screen).not.toContain(NOTE);
  });
});

/* ─── B4 — 기록 직렬화 정규화 ─────────────────────────────────────────────── */

describe("B4: install 직후 같은 판 update 는 기록 바이트를 바꾸지 않는다", () => {
  for (const cli of [["claude"], ["claude", "codex"]] as const) {
    it(`cli=${cli.join("+")}`, () => {
      write(".gitignore", "node_modules/\n");
      run(undefined, projectDir, { cli: [...cli] });
      const before = readFileSync(installLogPath(projectDir), "utf8");

      run("update", projectDir, { cli: [...cli] });

      expect(readFileSync(installLogPath(projectDir), "utf8")).toBe(before);
    });
  }
});

/* ─── B3 — 커밋 → 클론 ───────────────────────────────────────────────────── */

/** 사용자 전역 git 설정(훅 · 서명)이 끼지 않게 격리한 git. */
function git(cwd: string, ...args: string[]): string {
  return execFileSync(
    "git",
    [
      "-c",
      "user.name=t",
      "-c",
      "user.email=t@example.invalid",
      "-c",
      "commit.gpgsign=false",
      ...args,
    ],
    {
      cwd,
      encoding: "utf8",
      env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" },
    },
  );
}

function listIn(dir: string): { codes: number[]; out: string } {
  const out: string[] = [];
  const codes: number[] = [];
  listAction(
    { projectDir: dir },
    {
      log: (m: string) => out.push(m),
      err: (m: string) => out.push(m),
      exit: ((code: number) => codes.push(code)) as unknown as (code: number) => never,
    },
  );
  return { codes, out: out.join("\n") };
}

function uninstallPlan(dir: string): string {
  const out: string[] = [];
  uninstallAction(
    { projectDir: dir, dryRun: true },
    {
      log: (m: string) => out.push(m),
      err: (m: string) => out.push(m),
      exit: () => undefined as never,
      resolveHarnessRoot: () => HARNESS_ROOT,
    },
  );
  return out.join("\n").replaceAll(dir, "<project>");
}

describe("B3: 동료가 깔고 커밋한 저장소를 클론하면 관리 상태다", () => {
  it("클론에 기록 · 스크립트가 오고 런타임 파일은 안 온다 · list 가 읽는다 · 같은 판 update 뒤 작업트리가 깨끗하다 · uninstall 계획이 같다", () => {
    write(".gitignore", "node_modules/\n");
    run(undefined);
    write(".uzys-agent-harness/hook-blocks.log", "2026-10-04T00:00:00Z\tprotect-files\t.env\n");
    write(".uzys-agent-harness/update-backups.json", "[]\n");
    git(projectDir, "init", "-q");
    git(projectDir, "add", ".");
    git(projectDir, "commit", "-q", "-m", "harness");
    const clone = join(root, "clone");
    git(root, "clone", "-q", projectDir, clone);

    expect(existsSync(installLogPath(clone))).toBe(true);
    for (const s of ["protect-branch.sh", "spec-drift-check.sh", "check-absence.sh"]) {
      expect(existsSync(join(clone, ".uzys-agent-harness", s))).toBe(true);
    }
    for (const r of RUNTIME) expect(existsSync(join(clone, r))).toBe(false);

    const listed = listIn(clone);
    expect(listed.codes.filter((c) => c !== 0)).toEqual([]);
    expect(listed.out).toContain("tooling");
    // 같은 상태(둘 다 update 전)에서 잰다 — update 는 `.claude/` 사본을 남기고 계획이 그것을 알린다
    expect(uninstallPlan(clone)).toBe(uninstallPlan(projectDir));

    run("update", clone);
    // 작업트리가 깨끗하다 = 기록 바이트(B4) · 하네스 파일 · `.gitignore` 모두 그대로. update 의 `.claude.backup-*` 은 무시 대상
    expect(git(clone, "status", "--porcelain")).toBe("");
  });
});
