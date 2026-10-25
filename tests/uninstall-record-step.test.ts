import type { SpawnSyncReturns } from "node:child_process";
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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type UninstallOptions, uninstallAction } from "../src/commands/uninstall.js";
import {
  INSTALL_LOG_DIR,
  type InstallLog,
  installLogPath,
  readInstallLog,
  writeInstallLog,
} from "../src/install-log.js";
import { runInstall } from "../src/installer.js";
import { detectInstallState } from "../src/state.js";

const HARNESS_ROOT = resolve(__dirname, "..");

/** `install --with openspec` 가 남기는 기록 한 줄 — 테스트는 외부 도구를 돌리지 않으므로 기록에 직접 더한다. */
const OPENSPEC = {
  id: "openspec",
  category: "workflow",
  method: "npm",
  scope: "project",
  detail: { pkg: "@fission-ai/openspec" },
} as const;

/** 자동 되돌리기 경로가 없는 자산(fire-and-forget) — uninstall 은 말만 한다. */
const NPX_RUN = {
  id: "gsd",
  category: "workflow",
  method: "npx-run",
  scope: "project",
  detail: {},
} as const;

/** 하네스가 자리를 빌린 설치자 파일 — install 이 백업으로 비켜 두고, uninstall 이 원래 이름으로 되돌린다(displaced). */
const MINE_PATH = ".claude/rules/git-policy.md";
const MINE = "MINE — 우리 팀 git 규칙\n";

let projectDir = "";
beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "un889-"));
});
afterEach(() => {
  vi.useRealTimers();
  rmSync(projectDir, { recursive: true, force: true });
});

const abs = (rel: string): string => join(projectDir, rel);
const read = (rel: string): string => readFileSync(abs(rel), "utf8");

/** tooling · claude 설치 + 설치자 파일 하나가 하네스 자리에 있던 상태 + `--with openspec` 의 기록. */
function installWithNpmAsset(extra: ReadonlyArray<InstallLog["assets"][number]> = []): void {
  mkdirSync(dirname(abs(MINE_PATH)), { recursive: true });
  writeFileSync(abs(MINE_PATH), MINE);
  runInstall({
    runExternal: null,
    harnessRoot: HARNESS_ROOT,
    projectDir,
    spec: { tracks: ["tooling"], options: { withCodexTrust: false }, cli: ["claude"], projectDir },
  });
  const log = readInstallLog(projectDir);
  if (log === null) throw new Error("install log missing");
  writeInstallLog(projectDir, { ...log, assets: [...log.assets, { ...OPENSPEC }, ...extra] });
  // 시나리오 자기검증 — 하네스 판이 설치자 파일 자리를 차지했고, 기록이 그 자리를 displaced 로 안다
  expect(read(MINE_PATH)).not.toBe(MINE);
  expect(readInstallLog(projectDir)?.rootFiles?.some((f) => f.path === MINE_PATH)).toBe(true);
}

const spawnResult = (status: number, stderr = ""): SpawnSyncReturns<string> => ({
  pid: 0,
  output: [],
  stdout: "",
  stderr,
  status,
  signal: null,
});

function uninstall(options: Omit<UninstallOptions, "projectDir">, npmFails = false) {
  const out = { lines: [] as string[], errors: [] as string[], code: null as number | null };
  const calls: string[][] = [];
  uninstallAction(
    { projectDir, ...options },
    {
      log: (l: string) => out.lines.push(l),
      err: (l: string) => out.errors.push(l),
      exit: (code: number) => {
        out.code ??= code;
        return undefined as never;
      },
      spawn: (cmd, args) => {
        calls.push([cmd, ...args]);
        return npmFails ? spawnResult(1, "simulated registry timeout") : spawnResult(0);
      },
      resolveHarnessRoot: () => HARNESS_ROOT,
    },
  );
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI 색 코드를 벗긴다
  const strip = (l: string[]) => l.join("\n").replace(/\x1b\[[0-9;]*m/g, "");
  return { ...out, calls, text: strip(out.lines), errText: strip(out.errors) };
}

const backups = (): string[] =>
  readdirSync(projectDir, { recursive: true })
    .map(String)
    .filter((p) => p.includes(".backup-"));

/**
 * #889 — 전량 uninstall 중 되돌리기(npm · plugin)가 실패해도 기록을 통째로 지우던 결함. 기록이 사라지면 남은 devDependency 를
 * 뺄 길(같은 명령 · `--only`)이 영영 막히고, 다시 돌리면 "설치가 없다" 며 install 을 권했다.
 */
describe("#889 전량 uninstall — 되돌리기에 실패한 자산은 기록에 남는다", () => {
  it("npm 제거가 실패하면 기록이 남고, 남은 자산과 이어 가는 명령을 말한다", () => {
    installWithNpmAsset();

    const out = uninstall({ yes: true }, true);

    expect(out.code).toBe(1);
    expect(out.text).toContain("npm uninstall --save-dev @fission-ai/openspec");
    expect(out.text).toContain("simulated registry timeout");
    expect(out.text).not.toContain("install log removed");
    expect(out.text).toContain("install log kept");
    expect(out.text).toContain("agent-harness uninstall --only openspec");
    // 기록은 남고 그 자산만 든다 — 하네스 파일은 회수돼 기록에서도 빠졌다
    expect(existsSync(installLogPath(projectDir))).toBe(true);
    expect(detectInstallState(projectDir).state).toBe("installed");
    const log = readInstallLog(projectDir);
    expect(log?.assets.map((a) => a.id)).toContain("openspec");
    expect(log?.policyFiles ?? []).toEqual([]);
    expect(log?.templates.rootClaudeMd, "지운 앵커도 기록에서 빠진다").toBeUndefined();
    expect(log?.rootFiles?.some((f) => f.path === MINE_PATH && f.change === "displaced")).toBe(
      false,
    );
    // 하네스 파일 회수 · 설치자 파일 되돌리기는 그대로 일어났다
    expect(read(MINE_PATH)).toBe(MINE);
  });

  it("원인을 고치고 같은 명령을 다시 돌리면 이어서 끝난다 — 되돌린 설치자 파일은 그대로다", () => {
    // 백업 이름은 초 단위 시각이다 — 같은 초에 다시 돌리면 이름이 겹쳐 결함이 가려진다. 실제처럼 시간을 띄운다
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-22T01:00:00Z"));
    installWithNpmAsset();
    uninstall({ yes: true }, true);
    vi.setSystemTime(new Date("2026-10-22T02:00:00Z"));

    const again = uninstall({ yes: true });

    expect(again.errText).not.toContain("No harness install found");
    expect(again.code).toBe(0);
    expect(again.calls).toContainEqual(["npm", "uninstall", "--save-dev", "@fission-ai/openspec"]);
    expect(again.text).toContain("install log removed");
    expect(existsSync(abs(INSTALL_LOG_DIR))).toBe(false);
    // 첫 실행이 되돌린 설치자 파일을 두 번째 실행이 "고친 하네스 파일" 로 읽어 백업 이름으로 치우지 않는다
    expect(read(MINE_PATH)).toBe(MINE);
    expect(backups()).toEqual([]);
  });

  it("남은 자산만 `--only` 로 뺄 수도 있다", () => {
    installWithNpmAsset();
    uninstall({ yes: true }, true);

    const only = uninstall({ only: "openspec" });

    expect(only.code).toBe(0);
    expect(only.calls).toContainEqual(["npm", "uninstall", "--save-dev", "@fission-ai/openspec"]);
    expect(readInstallLog(projectDir)?.assets.map((a) => a.id)).not.toContain("openspec");
  });

  it("회귀 — 전부 되돌리면 지금처럼 기록을 지운다", () => {
    installWithNpmAsset();

    const out = uninstall({ yes: true });

    expect(out.code).toBe(0);
    expect(out.text).toContain("install log removed");
    expect(out.text).not.toContain("install log kept");
    expect(existsSync(abs(INSTALL_LOG_DIR))).toBe(false);
    expect(read(MINE_PATH)).toBe(MINE);
  });

  it("회귀 — `--only` 실패는 지금처럼 그 자산을 남기고 기록을 다시 쓴다", () => {
    installWithNpmAsset();
    const before = readInstallLog(projectDir) as InstallLog;

    const out = uninstall({ only: "openspec" }, true);

    expect(out.code).toBe(1);
    expect(out.text).toContain(`install log updated (${before.assets.length} asset(s) remain)`);
    expect(out.text).not.toContain("install log kept");
    expect(readInstallLog(projectDir)?.assets.map((a) => a.id)).toContain("openspec");
  });
});

/**
 * #883 — `uninstall --only <id> --dry-run` 이 실제로는 일어나지 않는 "기록 전체 삭제" 를 미리 말하던 결함. 실행은 기록을
 * 남은 자산으로 다시 쓴다 — 미리보기도 같은 단계를 같은 말로 낸다.
 */
describe("#883 --only 미리보기는 실행과 같은 기록 단계를 말한다", () => {
  it("`--only --dry-run` 은 기록 삭제가 아니라 실행이 낼 '기록 갱신' 줄을 낸다", () => {
    installWithNpmAsset([{ ...NPX_RUN }]);
    const before = readFileSync(installLogPath(projectDir), "utf8");

    const preview = uninstall({ only: "openspec", dryRun: true });

    expect(preview.code).toBe(0);
    expect(preview.text).not.toContain("remove install record");
    expect(readFileSync(installLogPath(projectDir), "utf8")).toBe(before); // 미리보기는 쓰지 않는다
    const run = uninstall({ only: "openspec" });
    expect(run.text, "실행은 남은 자산으로 기록을 다시 쓴다").toContain(
      "✓ install log updated (1 asset(s) remain)",
    );
    expect(preview.text).toContain("○ install log updated (1 asset(s) remain)");
  });

  it("회귀 — 전량 `--dry-run` 은 지금처럼 기록 삭제 단계를 말한다", () => {
    installWithNpmAsset();

    const preview = uninstall({ dryRun: true });

    expect(preview.code).toBe(0);
    expect(preview.text).toContain("○ remove install record (.uzys-agent-harness/");
    expect(preview.text).not.toContain("install log updated");
  });

  it("자동 경로 없는 자산의 '기록 유지' 는 기록이 남는 실행에서만 말한다 — 미리보기 · 실행이 같은 말", () => {
    installWithNpmAsset([{ ...NPX_RUN }]);
    const line = "gsd (npx-run) — 자동 되돌리기 경로 없음";

    const fullPreview = uninstall({ dryRun: true });
    const onlyPreview = uninstall({ only: "gsd", dryRun: true });
    expect(fullPreview.text).toContain(line);
    expect(fullPreview.text, "전량은 기록을 지운다").not.toContain(`${line}, 기록 유지`);
    expect(onlyPreview.text).toContain(`${line}, 기록 유지`);

    const failedRun = uninstall({ yes: true }, true);
    expect(failedRun.text, "실패로 기록이 남으면 그렇게 말한다").toContain(`${line}, 기록 유지`);
    const fullRun = uninstall({ yes: true });
    expect(fullRun.text).toContain(line);
    expect(fullRun.text).not.toContain(`${line}, 기록 유지`);
    expect(existsSync(abs(INSTALL_LOG_DIR))).toBe(false);
  });
});
