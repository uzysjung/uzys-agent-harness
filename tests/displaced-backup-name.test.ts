/**
 * #894 (#887 의 안쪽 쌍둥이) — 설치 기록(`.uzys-agent-harness/.harness-install.json`)은 커밋되는 파일이라 믿을 수 없다. 조작된 기록의
 * displaced 백업(`notes[0]`)이 프로젝트 **안**의 아무 파일(`.env`)을 가리키면 되돌리기가 그 파일을 하네스 자리로 옮겼다(`.env` 가
 * 사라지고 같은 내용이 추적되는 경로에 나타난다). 하네스 백업은 늘 `<자리>.backup-<시각>[-n]` 이라 그 이름이 아니면 옮기지 않는다.
 *
 * 설치자에게 달라지는 것: 남이 커밋한 기록을 받은 프로젝트에서 uninstall · update · `--reinstall` 을 돌려도 `.env` 같은 프로젝트 안
 * 파일은 제자리에 남고, 화면은 "기록이 댄 백업이 이 파일의 백업 이름이 아니라 되돌리지 않았다" 고 말한다. 하네스가 만든 정상 백업
 * (그 자리 옆 · `-n` · #839 링크 백업)의 되돌리기는 그대로다.
 */

import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { uninstallAction } from "../src/commands/uninstall.js";
import { restoreDisplaced } from "../src/displaced.js";
import {
  type InstallLog,
  type InstallLogRootFile,
  readInstallLog,
  writeInstallLog,
} from "../src/install-log.js";
import { runInstall } from "../src/installer.js";
import type { Track } from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");
const BAIT_SLOT = ".claude/rules/zz-bait.md";
const REAL_RULE = ".claude/rules/git-policy.md";
const STAMP = "20261025T000000";
const SECRET = "SECRET=do-not-move\n";
const MINE = "# my own team rule — not the harness one\n";

let root = "";
let projectDir = "";
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "ah-894-"));
  projectDir = join(root, "proj");
  mkdirSync(projectDir);
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const put = (rel: string, text: string): void => {
  mkdirSync(dirname(join(projectDir, rel)), { recursive: true });
  writeFileSync(join(projectDir, rel), text);
};
const read = (rel: string): string => readFileSync(join(projectDir, rel), "utf8");

function install(tracks: Track[] = ["tooling"]): InstallLog {
  runInstall({
    runExternal: null,
    harnessRoot: HARNESS_ROOT,
    projectDir,
    mode: "add",
    spec: { tracks, options: { withCodexTrust: false }, cli: ["claude"], projectDir },
  });
  const log = readInstallLog(projectDir);
  if (log === null) throw new Error("install log missing");
  return log;
}

function forge(entry: InstallLogRootFile): void {
  const log = readInstallLog(projectDir);
  if (log === null) throw new Error("install log missing");
  log.rootFiles = [...(log.rootFiles ?? []), entry];
  writeInstallLog(projectDir, log);
}

function uninstall(dryRun = false): string {
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

describe("#894 조작된 기록의 displaced 백업이 이 자리의 백업 이름이 아니면 프로젝트 안 파일도 옮기지 않는다", () => {
  it("uninstall --yes — `.env` 를 백업이라 적은 기록: .env 가 제자리에 남고 하네스 자리에 나타나지 않으며 화면이 되돌리지 않았다고 말한다", () => {
    install();
    put(".env", SECRET);
    forge({ path: BAIT_SLOT, change: "displaced", notes: [".env"] });

    const preview = uninstall(true);
    const text = uninstall();

    expect(read(".env")).toBe(SECRET);
    expect(existsSync(join(projectDir, BAIT_SLOT))).toBe(false);
    for (const screen of [preview, text]) {
      expect(screen).toContain(`${BAIT_SLOT} — not put back`);
      expect(screen).toContain("not a backup this tool made for this file");
      expect(screen).not.toContain(`put back  ${BAIT_SLOT}`);
    }
  });

  // 같은 자리에 적힌 조작된 이름들 — 전부 프로젝트 안이거나 정규화하면 안으로 떨어진다. 이름이 이 자리의 `.backup-<시각>` 이 아니다
  const FORGED: Array<[string, string]> = [
    ["프로젝트 안 비밀 파일", ".env"],
    ["프로젝트 안 소스 파일", "src/app.ts"],
    ["다른 파일의 정상 모양 백업", `.claude/rules/other.md.backup-${STAMP}`],
    ["`../` 로 돌아 .env 에 닿는 경로", ".claude/rules/../../.env"],
    ["백업 이름을 앞세우고 올라가 .env 에 닿는 경로", `${BAIT_SLOT}.backup-${STAMP}/../../../.env`],
    ["이름 끝에 글자가 더 붙은 모양", `${BAIT_SLOT}.backup-${STAMP}x`],
    ["시각이 모자란 모양", `${BAIT_SLOT}.backup-2026`],
    ["백업 접미사만 있는 다른 폴더의 같은 파일명", `other/zz-bait.md.backup-${STAMP}`],
  ];
  it.each(FORGED)("restoreDisplaced — %s", (_label, forged) => {
    const log = install();
    put(".env", SECRET);
    put("src/app.ts", "export const app = 1;\n");
    put(`.claude/rules/other.md.backup-${STAMP}`, "# other\n");
    put(`${BAIT_SLOT}.backup-${STAMP}x`, "# x\n");
    put(`${BAIT_SLOT}.backup-2026`, "# short\n");
    put(`other/zz-bait.md.backup-${STAMP}`, "# elsewhere\n");
    log.rootFiles = [{ path: BAIT_SLOT, change: "displaced", notes: [forged] }];

    const [out] = restoreDisplaced(log, projectDir, { has: () => true, write: true });

    expect(out).toMatchObject({ path: BAIT_SLOT, verdict: "advise", forget: true });
    expect(out?.line).toContain("not a backup this tool made for this file");
    expect(existsSync(join(projectDir, BAIT_SLOT))).toBe(false);
    expect(read(".env")).toBe(SECRET);
    expect(read("src/app.ts")).toBe("export const app = 1;\n");
    expect(read(`.claude/rules/other.md.backup-${STAMP}`)).toBe("# other\n");
    expect(read(`${BAIT_SLOT}.backup-${STAMP}x`)).toBe("# x\n");
    expect(read(`${BAIT_SLOT}.backup-2026`)).toBe("# short\n");
    expect(read(`other/zz-bait.md.backup-${STAMP}`)).toBe("# elsewhere\n");
  });

  it("회귀 없음 — 하네스가 그 자리 옆에 만든 백업은 `-n` 이 붙어도 · 중복 구분자와 `./` 를 정규화하면 같은 이름이어도 되돌린다", () => {
    const log = install();
    // [기록의 글자, 디스크의 실제 백업]
    const cases: Array<[string, string]> = [
      [`${BAIT_SLOT}.backup-${STAMP}`, `${BAIT_SLOT}.backup-${STAMP}`],
      [`${BAIT_SLOT}.backup-${STAMP}-2`, `${BAIT_SLOT}.backup-${STAMP}-2`],
      [`.claude//rules/./zz-bait.md.backup-${STAMP}`, `${BAIT_SLOT}.backup-${STAMP}`],
    ];
    for (const [recorded, real] of cases) {
      put(real, `# mine ${recorded}\n`);
      log.rootFiles = [{ path: BAIT_SLOT, change: "displaced", notes: [recorded] }];

      const [out] = restoreDisplaced(log, projectDir, { has: () => true, write: true });

      expect(out?.verdict, recorded).toBe("restore");
      expect(read(BAIT_SLOT)).toBe(`# mine ${recorded}\n`);
      expect(existsSync(join(projectDir, real))).toBe(false);
      rmSync(join(projectDir, BAIT_SLOT));
    }
  });

  it("회귀 없음 — #839 링크 백업은 `-n` 이름이어도 링크 그대로 되돌린다(밖을 가리켜도 옮기는 것은 링크 자체다)", () => {
    const log = install();
    const backup = `${BAIT_SLOT}.backup-${STAMP}-2`;
    mkdirSync(join(root, "bait"));
    writeFileSync(join(root, "bait", "secret.txt"), SECRET);
    mkdirSync(dirname(join(projectDir, backup)), { recursive: true });
    symlinkSync(join(root, "bait", "secret.txt"), join(projectDir, backup));
    log.rootFiles = [{ path: BAIT_SLOT, change: "displaced", notes: [backup] }];

    const [out] = restoreDisplaced(log, projectDir, { has: () => true, write: true });

    expect(out?.verdict).toBe("restore");
    expect(lstatSync(join(projectDir, BAIT_SLOT)).isSymbolicLink()).toBe(true);
    expect(readlinkSync(join(projectDir, BAIT_SLOT))).toBe(join(root, "bait", "secret.txt"));
  });

  it("회귀 없음 — 지금 판 install 이 설치자 파일 위에 깔며 적은 기록은 그 이름 규칙에 맞고 uninstall 이 원본을 되돌린다", () => {
    put(REAL_RULE, MINE);
    const log = install();
    const entry = log.rootFiles?.find((f) => f.path === REAL_RULE && f.change === "displaced");
    expect(entry?.notes, "전제 — 하네스가 백업하고 displaced 로 적었다").toHaveLength(1);
    expect(entry?.notes[0]).toMatch(
      new RegExp(`^${REAL_RULE.replace(/\./g, "\\.")}\\.backup-\\d{8}T\\d{6}(-\\d+)?$`),
    );
    expect(read(REAL_RULE), "전제 — 하네스 판이 자리를 잡았다").not.toBe(MINE);

    const text = uninstall();

    expect(read(REAL_RULE)).toBe(MINE);
    expect(text).toContain(`put back  ${REAL_RULE}`);
  });
});
