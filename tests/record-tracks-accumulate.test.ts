import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInstallRenderer } from "../src/commands/install-render.js";
import { type InstallLog, installLogPath, readInstallLog } from "../src/install-log.js";
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

    // 화면이 읽는 트랙은 기록 하나다(#699 NR-1) — 누적된 기록이면 머리글 · update 헤더가 둘 다 말한다
    const state = detectInstallState(dir);
    const header = describeInstall(state, buildInstallRecordView(state, log as InstallLog, true));
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

  /** update 1회 — 색을 벗긴 화면. */
  const update = (): string => {
    const lines: string[] = [];
    const spec = buildUpdateSpec(dir, detectInstallState(dir).tracks);
    const renderer = createInstallRenderer((m) => lines.push(m), spec, false);
    runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir: dir,
      spec,
      mode: "update",
      onProgress: (event) => renderer.callbacks.onProgress?.(event),
    });
    // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI 색 코드를 벗긴다
    return lines.join("\n").replace(/\x1b\[[0-9;]*m/g, "");
  };
  const line = (screen: string, path: string): string =>
    screen.split("\n").find((l) => l.includes(`${path} `)) ?? "";

  it("트랙이 쌓인 뒤 update 가 다른 CLI 자리에 채운 기록 트랙의 몫은 그 트랙을 말한다 — 릴리즈 신규라 하지 않는다", () => {
    install(["tooling"], ["claude"]);
    install(["data"], ["antigravity"]);

    const screen = update();

    // 까는 것은 그대로다 — 화면만 다르다
    expect(existsSync(join(dir, ".claude/agents/data-analyst.md"))).toBe(true);
    expect(existsSync(join(dir, ".agents/rules/cli-development.md"))).toBe(true);
    for (const [path, track] of [
      [".claude/agents/data-analyst.md", "data"],
      [".agents/rules/cli-development.md", "tooling"],
    ] as const) {
      expect(line(screen, path)).toContain(`recorded track ${track} — installed for this CLI too`);
      expect(line(screen, path)).not.toContain("added by this release");
    }
  });

  it("이 CLI 에 이미 깔린 트랙에 새로 생긴 파일은 여전히 'added by this release' 다", () => {
    install(["tooling"], ["claude"]);
    // 이 릴리즈가 처음 더한 파일처럼 만든다 — 디스크에도 기록에도 없다(tooling 의 다른 몫은 기록에 있다)
    const NEW = "rules/test-policy.md";
    rmSync(join(dir, ".claude", NEW));
    const log = JSON.parse(readFileSync(installLogPath(dir), "utf8")) as InstallLog;
    const policyFiles = (log.policyFiles ?? []).filter((f) => f.path !== NEW);
    writeFileSync(installLogPath(dir), JSON.stringify({ ...log, policyFiles }));

    const screen = update();

    expect(existsSync(join(dir, ".claude", NEW))).toBe(true);
    expect(line(screen, `.claude/${NEW}`)).toContain("added by this release");
    expect(screen).not.toContain("installed for this CLI too");
  });
});
