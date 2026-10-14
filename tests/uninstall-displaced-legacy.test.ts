/**
 * #807 — v26.162~v26.170 의 update 가 트랙 밖 옛 하네스 파일을 displaced 로 적은 설치본의 uninstall.
 *
 * 설치자에게 달라지는 것: 옛 판(트랙과 무관하게 에이전트를 전부 깔던 판)으로 tooling 을 깔고 v26.162~v26.170 으로 update 하면
 * `agents/strategist.md` 는 백업 + displaced("yours, put back on uninstall"), `agents/data-analyst.md` 는 백업 없는 displaced 로
 * 적혔다(실측 `docs/plans/v26.170.0-design-evidence/container/26.140.0-A/new-update-1.txt`:55 · :59 · record-2). 그 뒤 uninstall 은
 * 하네스 판을 못 알아보고 "the spot is taken" 이라 말하며 하네스 파일을 남겼다. 이제 그 나쁜 update 를 거치지 않은 설치자와
 * 같은 결말이다 — 하네스 바이트는 라이브에서 빠지고, 옛 하네스 바이트를 "당신 파일" 로 되돌리지 않는다. 설치자가 만든 파일
 * (지문과 다른 바이트)의 displaced 기록과 트랙 안 하네스 자리의 기록(ADR-097 결정 3·7)은 그대로다.
 *
 * 픽스처 = 태그 v26.125.0 의 `templates/` 바이트(`tests/fixtures/legacy-26.125/`) · 현행 `templates/` 바이트.
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
import {
  hashContent,
  type InstallLog,
  readInstallLog,
  writeInstallLog,
} from "../src/install-log.js";
import { runInstall } from "../src/installer.js";
import type { Track } from "../src/types.js";
import { runUpdateMode } from "../src/update-mode.js";

const HARNESS_ROOT = resolve(__dirname, "..");
const old = (rel: string): string =>
  readFileSync(join(__dirname, "fixtures", "legacy-26.125", rel), "utf8");
const current = (rel: string): string => readFileSync(join(HARNESS_ROOT, "templates", rel), "utf8");

const STRATEGIST = ".claude/agents/strategist.md";
const DATA_ANALYST = ".claude/agents/data-analyst.md";
const BAD_BACKUP = `${STRATEGIST}.backup-20261012T092142`;

const dirs: string[] = [];
let projectDir = "";
beforeEach(() => {
  projectDir = fresh();
});
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function fresh(): string {
  const d = mkdtempSync(join(tmpdir(), "un-displaced-legacy-"));
  dirs.push(d);
  return d;
}

const abs = (rel: string, dir = projectDir): string => join(dir, rel);
const read = (rel: string, dir = projectDir): string => readFileSync(abs(rel, dir), "utf8");
const put = (rel: string, text: string, dir = projectDir): void => {
  mkdirSync(dirname(abs(rel, dir)), { recursive: true });
  writeFileSync(abs(rel, dir), text);
};

function install(tracks: Track[], dir = projectDir) {
  return runInstall({
    runExternal: null,
    harnessRoot: HARNESS_ROOT,
    projectDir: dir,
    mode: "add",
    spec: { tracks, options: { withCodexTrust: false }, cli: ["claude"], projectDir: dir },
  });
}

function uninstall(options: Omit<UninstallOptions, "projectDir"> = {}, dir = projectDir) {
  const lines: string[] = [];
  uninstallAction(
    { projectDir: dir, yes: true, ...options },
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

function editLog(dir: string, edit: (l: InstallLog) => void): void {
  const l = readInstallLog(dir);
  if (!l) throw new Error("install log missing");
  edit(l);
  writeInstallLog(dir, l);
}

/**
 * 옛 판 tooling 설치본의 기록 모양(writer 표시 없음 — update 는 그 표시를 쓰지 않는다) + 옛 판이 트랙과 무관하게 깐 두 에이전트.
 * `bad` 면 v26.162~v26.170 update 가 남긴 모양(record-2): strategist 자리에 그 판의 하네스 판 · 옛 바이트 백업 · `displaced+sha`,
 * data-analyst 는 백업 없는 `displaced`(내용이 하네스 판과 같아 그대로 둔 자리).
 */
function oldToolingInstall(dir: string, bad: boolean): void {
  install(["tooling"], dir);
  if (bad) {
    put(STRATEGIST, current("agents/strategist.md"), dir);
    put(BAD_BACKUP, old("agents/strategist.md"), dir);
  } else {
    put(STRATEGIST, old("agents/strategist.md"), dir);
  }
  put(DATA_ANALYST, current("agents/data-analyst.md"), dir);
  editLog(dir, (l) => {
    delete l.records;
    l.policyFiles = [
      ...(l.policyFiles ?? []),
      { path: "agents/strategist.md", sha256: hashContent(read(STRATEGIST, dir)) },
      ...(bad
        ? []
        : [{ path: "agents/data-analyst.md", sha256: hashContent(read(DATA_ANALYST, dir)) }]),
    ];
    if (bad)
      l.rootFiles = [
        ...(l.rootFiles ?? []),
        { path: DATA_ANALYST, change: "displaced", notes: [] },
        { path: STRATEGIST, change: "displaced", notes: [BAD_BACKUP] },
      ];
  });
}

/** 라이브 파일(하네스 백업 `*.backup-*` 제외) — 프로젝트 상대 경로. */
function liveFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && !e.name.includes(".backup-"))
    .map((e) => join(e.parentPath, e.name).slice(dir.length + 1))
    .sort();
}

describe("#807 트랙 밖 옛 하네스 파일의 displaced 기록", () => {
  it("uninstall 이 하네스 판을 치운다 — 나쁜 update 를 거치지 않은 설치자와 같은 라이브 · 옛 바이트를 되돌리지 않는다", () => {
    oldToolingInstall(projectDir, true);
    const good = fresh();
    oldToolingInstall(good, false);

    const text = uninstall();
    uninstall({}, good);

    expect(existsSync(abs(STRATEGIST))).toBe(false);
    expect(existsSync(abs(DATA_ANALYST))).toBe(false);
    expect(liveFiles(projectDir)).toEqual(liveFiles(good));
    // 그 update 가 만든 백업은 그대로(지우지 않는다) — 라이브로 되돌리지도 않는다
    expect(read(BAD_BACKUP)).toBe(old("agents/strategist.md"));
    expect(text).not.toContain("spot is taken");
    expect(text).not.toContain("put back");
  });

  it("현행 update 를 한 번 더 거쳐도 — update 는 그 자리를 설치자 것이라 다시 말하지 않고 uninstall 결말도 같다", () => {
    oldToolingInstall(projectDir, true);
    const good = fresh();
    oldToolingInstall(good, false);

    const report = runUpdateMode(projectDir, join(HARNESS_ROOT, "templates"), HARNESS_ROOT);
    runUpdateMode(good, join(HARNESS_ROOT, "templates"), HARNESS_ROOT);
    const mentioned = [
      ...(report.displaced ?? []),
      ...(report.displacedSame ?? []),
      ...(report.displacedRestored ?? []).map((d) => d.path),
    ];
    expect(mentioned).not.toContain(STRATEGIST);
    expect(mentioned).not.toContain(DATA_ANALYST);
    uninstall();
    uninstall({}, good);

    expect(existsSync(abs(STRATEGIST))).toBe(false);
    expect(existsSync(abs(DATA_ANALYST))).toBe(false);
    expect(liveFiles(projectDir)).toEqual(liveFiles(good));
  });

  it("미리보기도 되돌린다고 말하지 않는다", () => {
    oldToolingInstall(projectDir, true);

    const text = uninstall({ dryRun: true });

    expect(text).not.toContain("put back");
    expect(read(STRATEGIST)).toBe(current("agents/strategist.md"));
  });

  it("백업이 설치자가 만든 파일(지문과 다른 바이트)이면 그 기록은 설치자 것이다 — 바이트가 남고 화면이 그 자리를 댄다", () => {
    oldToolingInstall(projectDir, true);
    put(BAD_BACKUP, "# my strategist\n");

    const text = uninstall();

    expect(read(BAD_BACKUP)).toBe("# my strategist\n");
    // 되돌렸든(put back) 자리가 막혔든(your earlier file is at) — 설치자 파일을 말한다
    expect(text).toMatch(
      /your earlier file is at \.claude\/agents\/strategist\.md\.backup-|put back {2}\.claude\/agents\/strategist\.md/,
    );
  });
});

describe("#807 회귀 — 트랙 안 하네스 자리의 displaced 는 기록 그대로", () => {
  it("설치자 파일(지문과 다른 바이트)을 비켜 쓴 자리는 uninstall 이 제자리로 되돌린다", () => {
    put(".claude/agents/reviewer.md", "# my reviewer\n");
    install(["tooling"]);
    expect(read(".claude/agents/reviewer.md")).not.toBe("# my reviewer\n");

    uninstall();

    expect(read(".claude/agents/reviewer.md")).toBe("# my reviewer\n");
  });

  it("하네스 판과 같아 그대로 둔 설치자 파일(백업 없는 displaced)은 옛 판 바이트와 같아도 남는다(ADR-097 결정 7)", () => {
    put(DATA_ANALYST, current("agents/data-analyst.md"));
    install(["data"]);
    expect(readInstallLog(projectDir)?.rootFiles).toContainEqual({
      path: DATA_ANALYST,
      change: "displaced",
      notes: [],
    });

    uninstall();

    expect(read(DATA_ANALYST)).toBe(current("agents/data-analyst.md"));
  });
});
