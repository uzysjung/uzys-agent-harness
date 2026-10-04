import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readInstallLog } from "../src/install-log.js";
import { runInstall } from "../src/installer.js";
import { runInteractive } from "../src/interactive.js";
import type { InstallTargetId, Prompts } from "../src/prompts.js";
import { buildInstallRecordView, describeInstall } from "../src/router.js";
import { detectInstallState } from "../src/state.js";
import type { CliBase, CliTargets, Track } from "../src/types.js";
import { buildUpdateSpec } from "../src/update-mode.js";

const HARNESS_ROOT = resolve(__dirname, "..");

/**
 * #585 — 설치 기록의 트랙은 CLI 처럼 누적된다. claude 없이 다른 트랙으로 CLI 를 더 깔아도 claude 로 깐 트랙이 기록에서
 * 사라지지 않고, 아무것도 안 바꾼 Update 가 추가 설치(`add`)로 돌지 않는다. 첫 화면 머리글 · update 헤더는 기록 트랙을 말한다.
 */
describe("#585 — 기록 트랙 누적", () => {
  let dir = "";
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "rec-tracks-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const install = (tracks: Track[], cli: CliBase[]): void => {
    runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir: dir,
      spec: { tracks, options: { withCodexTrust: false }, cli, projectDir: dir },
    });
  };

  const prompts = (confirmInstall = vi.fn(async (_summary: string) => true)): Prompts => ({
    intro: vi.fn(),
    outro: vi.fn(),
    cancel: vi.fn(),
    selectAction: vi.fn(async () => "update" as const),
    selectTracks: vi.fn(async (initial?: Track[]) => initial ?? []),
    selectCli: vi.fn(async (initial?: CliTargets) => initial ?? (["claude"] as CliTargets)),
    confirmInstall,
    selectInstallTargets: vi.fn(async (initial: ReadonlyArray<InstallTargetId>) => initial),
  });

  it("claude(tooling) → codex(data): 기록은 [data, tooling] · 무변경 Update 는 update 엔진 · 머리글·헤더는 기록 트랙", async () => {
    install(["tooling"], ["claude"]);
    install(["data"], ["codex"]);

    const log = readInstallLog(dir);
    expect(log?.spec.tracks).toEqual(["data", "tooling"]);
    expect(log?.spec.clis).toEqual(["claude", "codex"]);

    // codex 단독 실행은 `.claude/` 를 건드리지 않는다 — 감지 트랙(메타파일)은 tooling 그대로
    const state = detectInstallState(dir);
    expect(state.tracks).toEqual(["tooling"]);
    const header = describeInstall(state, buildInstallRecordView(state, log ?? null, true));
    expect(header).toContain("Installed here: tracks data, tooling ·");
    expect(buildUpdateSpec(dir, state.tracks).tracks).toEqual(["data", "tooling"]);

    const confirmInstall = vi.fn(async (_summary: string) => true);
    const result = await runInteractive(dir, {
      prompts: prompts(confirmInstall),
      detect: () => detectInstallState(dir),
      isTty: () => true,
    });
    const summary = String(confirmInstall.mock.calls[0]?.[0] ?? "");
    expect(result.mode).toBe("update");
    expect(summary).not.toContain("+tooling");
    expect(result.spec?.tracks).toEqual(["data", "tooling"]);
  });

  it("claude 로 트랙을 더 깔면 `.claude/.installed-tracks` 도 기록과 같은 합집합이다", () => {
    install(["tooling"], ["claude"]);
    install(["data"], ["claude"]);

    expect(readInstallLog(dir)?.spec.tracks).toEqual(["data", "tooling"]);
    expect(readFileSync(join(dir, ".claude/.installed-tracks"), "utf8")).toBe("data\ntooling\n");
    expect(detectInstallState(dir).tracks).toEqual(["data", "tooling"]);
  });
});
