/**
 * #796 PR-0 회귀(`docs/plans/796-reviews/pra-review-loss.md` HIGH-1) — v26.126–161 기록(`skillFiles` 있음 · `records` 없음) 위에서
 * 설치자가 손으로 만든 하네스 이름 스킬 폴더를 v26.170.0 과 같게 다룬다(루트 CLAUDE.md §설치자 디스크 · ADR-097 결정 3·7).
 *
 * - ⓐ 이번 릴리즈 기본 이름 — update 는 원본을 백업하고 `displaced` 로 적는다 · uninstall 은 하네스 판을 치우고 원본을 제자리로
 * - ⓑ 하네스가 쓴 적 없는 opt-in 이름 — update · uninstall 모두 건드리지 않는다(백업도 없다)
 *
 * 옛 스캔은 `.claude/skills/` 를 한 번에 다 적었다 — 그 판이 깔지 않은 이름의 폴더는 기록에 없고, 그것이 "하네스가 깔지 않았다" 의 증거다.
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
import { buildAssetSpec, buildManifest } from "../src/manifest.js";
import { DEFAULT_OPTIONS } from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");
/** tooling 기본 번들 스킬(그 판이 안 깔았다고 꾸민다) · 기본이 아닌 번들 스킬. 전제는 각 테스트가 manifest 로 확인한다. */
const DEFAULT_ID = "natural-korean";
const OPT_IN = "gemini-delegate";
const MINE = "MINE — my own skill\n";

let projectDir = "";
beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "legacy-skill-read-"));
});
afterEach(() => rmSync(projectDir, { recursive: true, force: true }));

const abs = (rel: string): string => join(projectDir, rel);
const read = (rel: string): string => readFileSync(abs(rel), "utf8");
const put = (rel: string, text: string): void => {
  mkdirSync(dirname(abs(rel)), { recursive: true });
  writeFileSync(abs(rel), text);
};
const backupsOf = (rel: string): string[] => {
  const dir = dirname(abs(rel));
  if (!existsSync(dir)) return [];
  const base = rel.slice(rel.lastIndexOf("/") + 1);
  return readdirSync(dir).filter((f) => f.startsWith(`${base}.backup-`));
};

function defaultSkills(): string[] {
  const spec = buildAssetSpec({ tracks: ["tooling"], options: DEFAULT_OPTIONS });
  return buildManifest(spec)
    .filter((e) => e.type === "dir" && e.target.startsWith(".claude/skills/") && e.applies(spec))
    .map((e) => e.target.slice(".claude/skills/".length));
}

function run(mode: "add" | "update"): void {
  runInstall({
    runExternal: null,
    harnessRoot: HARNESS_ROOT,
    projectDir,
    mode,
    spec: { tracks: ["tooling"], options: { withCodexTrust: false }, cli: ["claude"], projectDir },
  });
}

function uninstall(options: Omit<UninstallOptions, "projectDir">): number | null {
  let code: number | null = null;
  uninstallAction(
    { projectDir, ...options },
    {
      log: () => {},
      err: () => {},
      exit: (c: number) => {
        code ??= c;
        return undefined as never;
      },
      resolveHarnessRoot: () => HARNESS_ROOT,
    },
  );
  return code;
}

/**
 * v26.161 설치본의 모양 — 그 판은 `DEFAULT_ID` 를 깔지 않았다(디스크 · 기록 모두 없음). 기록은 `records` · `portions` 가 없고 스캔 필드는
 * 그 판이 깐 스킬만 담는다.
 */
function legacyInstall(): void {
  run("add");
  rmSync(abs(`.claude/skills/${DEFAULT_ID}`), { recursive: true, force: true });
  const log = readInstallLog(projectDir);
  if (log === null) throw new Error("전제 — 설치 기록");
  const { records: _r, portions: _p, ...rest } = log;
  writeInstallLog(projectDir, {
    ...rest,
    skillFiles: (log.skillFiles ?? []).filter((f) => !f.path.startsWith(`${DEFAULT_ID}/`)),
  });
  expect(readInstallLog(projectDir)?.records, "전제 — 옛 기록").toBeUndefined();
  expect(readInstallLog(projectDir)?.skillFiles?.length, "전제 — 스캔 필드").toBeGreaterThan(0);
}

describe("#796 HIGH-1 — v26.161 기록 위 손으로 만든 하네스 이름 스킬 폴더", () => {
  it("ⓐ 기본 이름 — update 는 백업 + displaced · uninstall 뒤 설치자 원본이 바이트 그대로 제자리", () => {
    expect(defaultSkills(), "전제 — tooling 기본").toContain(DEFAULT_ID);
    legacyInstall();
    const rel = `.claude/skills/${DEFAULT_ID}/SKILL.md`;
    put(rel, MINE);

    run("update");

    expect(read(rel)).not.toBe(MINE); // 하네스 판이 자리를 잡았다(결정 7)
    const backups = backupsOf(rel);
    expect(backups).toHaveLength(1);
    expect(read(`.claude/skills/${DEFAULT_ID}/${backups[0]}`)).toBe(MINE);
    const displaced = (readInstallLog(projectDir)?.rootFiles ?? []).filter(
      (f) => f.path === rel && f.change === "displaced",
    );
    expect(displaced.map((f) => f.notes)).toEqual([[`.claude/skills/${DEFAULT_ID}/${backups[0]}`]]);

    expect(uninstall({ yes: true })).toBe(0);

    expect(read(rel)).toBe(MINE);
  });

  it("ⓑ 하네스가 쓴 적 없는 opt-in 이름 — update · uninstall 모두 바이트 그대로 · 백업 0", () => {
    expect(defaultSkills(), "전제 — tooling 기본이 아니다").not.toContain(OPT_IN);
    legacyInstall();
    const rel = `.claude/skills/${OPT_IN}/SKILL.md`;
    put(rel, MINE);

    run("update");
    expect(read(rel)).toBe(MINE);
    expect(backupsOf(rel)).toEqual([]);

    expect(uninstall({ yes: true })).toBe(0);

    expect(read(rel)).toBe(MINE);
    expect(backupsOf(rel)).toEqual([]);
  });
});
