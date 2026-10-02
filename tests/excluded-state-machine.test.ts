/**
 * #623/#632 — 빼기(excluded) 상태머신: 일시 상태가 "사용자 명시 제외"로 영구 기록되던 것.
 *
 * 세 사건 모두 같은 병이다:
 *   - #623 `uninstall --cli codex` 가 portions 를 기록에 남김 → 사용자가 자체 config.toml 을
 *     만들면 재설치가 아무 리전도 안 넣고 허위 excluded 까지 적는다
 *   - #632 훅 스크립트 삭제 → update 의 치유(죽은 참조 정리)가 빼기 기록으로 굳어
 *     install/--reinstall 모두 배선 복구를 거부한다
 *
 * 여기서 무는 것 — 일시 상태는 몫(portions)·빼기(excluded) 어느 쪽에도 남지 않는다:
 *   1. CLI 제거는 그 CLI 디렉터리 아래 몫을 기록에서 걷는다(#623)
 *   2. 치유된 훅 참조는 몫 기록에서 걷혀 첫 접촉으로 돌아온다(#632)
 */

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { uninstallAction } from "../src/commands/uninstall.js";
import { readInstallLog } from "../src/install-log.js";
import { runInstall } from "../src/installer.js";
import type { CliBase, InstallSpec } from "../src/types.js";
import { runUpdateMode } from "../src/update-mode.js";

const HARNESS_ROOT = resolve(__dirname, "..");

let projectDir: string;

beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "ah-excluded-"));
});

afterEach(() => {
  rmSync(projectDir, { recursive: true, force: true });
});

function install(clis: ReadonlyArray<CliBase>): void {
  runInstall({
    runExternal: null,
    harnessRoot: HARNESS_ROOT,
    projectDir,
    spec: {
      tracks: ["tooling"],
      options: { withCodexTrust: false },
      cli: [...clis],
      projectDir,
    } satisfies InstallSpec,
  });
}

const configToml = () => join(projectDir, ".codex", "config.toml");

describe("#623 — uninstall --cli codex 가 .codex/ 아래 몫을 기록에서 걷는다", () => {
  it("CLI 제거 후 사용자가 자체 config.toml 을 만들면 재설치가 리전을 넣는다 (허위 excluded 없음)", () => {
    install(["claude", "codex"]);
    uninstallAction(
      { projectDir, cli: "codex" },
      { exit: () => undefined as never, log: () => {}, err: () => {} },
    );

    const log = readInstallLog(projectDir);
    expect(log).not.toBeNull();
    const codexPortions = (log?.portions ?? []).filter((p) => p.path.startsWith(".codex/"));
    expect(codexPortions).toEqual([]);

    // 사용자가 자체 config 를 만든다 — 예전엔 여기서 "설치자가 지운 몫"으로 읽혔다
    // (uninstall 은 .codex/ 를 통째로 백업으로 옮겼으므로 디렉터리부터 다시 만든다)
    mkdirSync(join(projectDir, ".codex"), { recursive: true });
    writeFileSync(configToml(), 'model = "gpt-5"\n', "utf8");
    install(["claude", "codex"]);

    const after = readFileSync(configToml(), "utf8");
    expect(after).toContain("uzys-harness:top");
    expect(after).toContain("uzys-harness:tables");
    const logAfter = readInstallLog(projectDir);
    expect(logAfter?.excluded ?? []).not.toContain("codex:top");
    expect(logAfter?.excluded ?? []).not.toContain("codex:tables");
  });
});

// #641(마커 오타 복구 시 리전 삭제)은 이 PR 에서 다루지 않는다 — 완전한 해법이 portions 계약
// 변경(빼기 키의 마지막 기록 sha 를 유지해 "복구 제스처"를 알아보는 것)을 필요로 하는 설계
// 결정이어서 이슈에 제안으로 남긴다. 여기 담긴 두 수정(#623 #632)은 그 계약을 건드리지 않는다.

describe("#632 — 치유된 훅 참조가 빼기 기록으로 굳지 않는다", () => {
  it("훅 스크립트 삭제 → update 치유 → 재설치가 배선을 복구한다", () => {
    install(["claude"]);
    const settingsPath = join(projectDir, ".claude", "settings.json");
    expect(JSON.parse(readFileSync(settingsPath, "utf8")).hooks).toBeTruthy();

    for (const f of readdirSync(join(projectDir, ".claude", "hooks"))) {
      unlinkSync(join(projectDir, ".claude", "hooks", f));
    }
    runUpdateMode(projectDir, join(HARNESS_ROOT, "templates"), HARNESS_ROOT);

    // 치유 시점의 기록: 훅 몫이 걷혀 있고 빼기에도 없다
    const log = readInstallLog(projectDir);
    expect(log?.excluded ?? []).toEqual(
      expect.not.arrayContaining([expect.stringMatching(/session-start|protect-files/)]),
    );

    // 재설치: 스크립트가 돌아오면 배선도 돌아온다 (예전: "you removed — not added back")
    install(["claude"]);
    const settings = JSON.parse(readFileSync(settingsPath, "utf8")) as {
      hooks?: Record<string, unknown>;
    };
    expect(existsSync(join(projectDir, ".claude", "hooks", "session-start.sh"))).toBe(true);
    expect(settings.hooks?.SessionStart).toBeTruthy();
    expect(settings.hooks?.PreToolUse).toBeTruthy();
  });
});
