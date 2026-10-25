/**
 * #887 — 설치 기록(`.uzys-agent-harness/.harness-install.json`)은 커밋되는 파일이라 믿을 수 없다. 조작된 기록의 displaced
 * 백업(`notes[0]`)이 프로젝트 밖을 가리키면 되돌리기가 그 파일을 프로젝트 안으로 옮겼다(원래 자리에서 사라지고, 안으로 들어온
 * 파일은 "기록에 없는 당신 파일" 로 안내돼 커밋될 수 있다).
 *
 * 설치자에게 달라지는 것: 남이 커밋한 기록을 받은 프로젝트에서 uninstall · update · `--reinstall` 을 돌려도 프로젝트 밖 파일
 * (`../`, 밖으로 나가는 폴더 링크)은 제자리에 남고, 화면은 "기록이 밖을 가리켜 되돌리지 않았다" 고 말한다. 하네스가 만든 정상
 * 백업(그 자리 옆)의 되돌리기와 #839 링크 백업(링크 자체를 옮긴다)은 그대로다.
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
import { isLegacyDisplaced, restoreDisplaced } from "../src/displaced.js";
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
const SECRET = "SECRET=do-not-move\n";

let root = "";
let projectDir = "";
let baitDir = "";
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "ah-887-"));
  projectDir = join(root, "proj");
  baitDir = join(root, "bait");
  mkdirSync(projectDir);
  mkdirSync(baitDir);
  writeFileSync(join(baitDir, "secret.txt"), SECRET);
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const put = (rel: string, text: string): void => {
  mkdirSync(dirname(join(projectDir, rel)), { recursive: true });
  writeFileSync(join(projectDir, rel), text);
};

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

describe("#887 조작된 기록의 displaced 백업이 프로젝트 밖이면 옮기지 않는다", () => {
  it("uninstall --yes — `../` 백업: 밖 파일이 제자리에 남고 프로젝트 안으로 들어오지 않으며 화면이 밖이라 말한다", () => {
    install();
    forge({ path: BAIT_SLOT, change: "displaced", notes: ["../bait/secret.txt"] });

    const preview = uninstall(true);
    const text = uninstall();

    expect(readFileSync(join(baitDir, "secret.txt"), "utf8")).toBe(SECRET);
    expect(existsSync(join(projectDir, BAIT_SLOT))).toBe(false);
    for (const screen of [preview, text]) {
      expect(screen).toContain(`${BAIT_SLOT} — not put back`);
      expect(screen).toContain("outside this project");
      expect(screen).not.toContain(`put back  ${BAIT_SLOT}`);
    }
  });

  it("프로젝트 안 폴더 링크가 밖을 가리키면(실제 경로 기준) 그 안의 백업도 밖이다 — 옮기지 않고 기록에서 뺀다", () => {
    const log = install();
    symlinkSync(baitDir, join(projectDir, "linked"));
    const entry: InstallLogRootFile = {
      path: BAIT_SLOT,
      change: "displaced",
      notes: ["linked/secret.txt"],
    };
    log.rootFiles = [entry];

    const [out] = restoreDisplaced(log, projectDir, { has: () => true, write: true });

    expect(readFileSync(join(baitDir, "secret.txt"), "utf8")).toBe(SECRET);
    expect(existsSync(join(projectDir, BAIT_SLOT))).toBe(false);
    expect(out).toMatchObject({ path: BAIT_SLOT, verdict: "advise", forget: true });
    expect(out?.line).toContain("outside this project");
  });

  it("회귀 없음 — 하네스가 그 자리 옆에 만든 백업은 그대로 되돌린다", () => {
    const log = install();
    put(`${BAIT_SLOT}.backup-20261025T000000`, "# mine\n");
    log.rootFiles = [
      { path: BAIT_SLOT, change: "displaced", notes: [`${BAIT_SLOT}.backup-20261025T000000`] },
    ];

    const [out] = restoreDisplaced(log, projectDir, { has: () => true, write: true });

    expect(out?.verdict).toBe("restore");
    expect(readFileSync(join(projectDir, BAIT_SLOT), "utf8")).toBe("# mine\n");
  });

  it("회귀 없음 — #839 링크 백업은 링크가 밖을 가리켜도 링크 그대로 되돌린다(옮기는 것은 링크 자체다)", () => {
    const log = install();
    const backup = `${BAIT_SLOT}.backup-20261025T000000`;
    mkdirSync(dirname(join(projectDir, backup)), { recursive: true });
    symlinkSync(join(baitDir, "secret.txt"), join(projectDir, backup));
    log.rootFiles = [{ path: BAIT_SLOT, change: "displaced", notes: [backup] }];

    const [out] = restoreDisplaced(log, projectDir, { has: () => true, write: true });

    expect(out?.verdict).toBe("restore");
    expect(lstatSync(join(projectDir, BAIT_SLOT)).isSymbolicLink()).toBe(true);
    expect(readlinkSync(join(projectDir, BAIT_SLOT))).toBe(join(baitDir, "secret.txt"));
    expect(readFileSync(join(baitDir, "secret.txt"), "utf8")).toBe(SECRET);
  });

  it("isLegacyDisplaced 는 밖 파일을 읽지 않는다 — 옛 하네스 바이트가 밖에 있어도 설치자 기록으로 둔다", () => {
    // #807 의 옛 판 지문 자리(tooling 트랙 밖 에이전트) — 원본이 옛 바이트면 true 가 되는 자리다
    const log = install(["tooling"]);
    const strategist = ".claude/agents/strategist.md";
    const oldBytes = readFileSync(
      join(__dirname, "fixtures", "legacy-26.125", "agents", "strategist.md"),
      "utf8",
    );
    put(`${strategist}.backup-20261025T000000`, oldBytes);
    const inside: InstallLogRootFile = {
      path: strategist,
      change: "displaced",
      notes: [`${strategist}.backup-20261025T000000`],
    };
    // 대조군 — 같은 바이트가 프로젝트 안에 있으면 옛 판 기록으로 읽힌다(이 자리가 #807 판정을 무는 자리라는 증거)
    expect(isLegacyDisplaced(log, projectDir, inside)).toBe(true);

    writeFileSync(join(baitDir, "strategist.md"), oldBytes);
    const outside: InstallLogRootFile = {
      path: strategist,
      change: "displaced",
      notes: ["../bait/strategist.md"],
    };
    expect(isLegacyDisplaced(log, projectDir, outside)).toBe(false);
  });
});
