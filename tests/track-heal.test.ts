import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInstallRenderer } from "../src/commands/install-render.js";
import {
  hashContent,
  type InstallLog,
  installLogPath,
  readInstallLog,
} from "../src/install-log.js";
import { type InstallMode, runInstall } from "../src/installer.js";
import { runInteractive } from "../src/interactive.js";
import type { InstallTargetId, Prompts } from "../src/prompts.js";
import { buildInstallRecordView, describeInstall } from "../src/router.js";
import { detectInstallState } from "../src/state.js";
import type { CliBase, CliTargets, InstallSpec, Track } from "../src/types.js";
import { buildUpdateSpec } from "../src/update-mode.js";

const HARNESS_ROOT = resolve(__dirname, "..");
const RULE = ".agents/rules/cli-development.md";

/**
 * 리뷰 B1 — 옛 판(v26.163.0 이하)이 마지막 install 의 트랙으로 덮어쓴 기록(#585 피해 상태)에서, 트랙 밖 회수(#677)가 정당하게
 * 깐 tooling 룰을 지우지 않는다. 기록 안의 근거(기록이 sha 를 보증하는 `.claude/.installed-tracks` · writer 기록의 claude 자리
 * 트랙 고유 파일)로 잘린 트랙을 한 번 되살린다. 근거가 없으면 지우되 화면이 기록된 트랙과 되돌리는 명령을 말한다.
 */
let dir = "";
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ah-track-heal-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const spec = (tracks: Track[], cli: CliBase[]): InstallSpec => ({
  tracks,
  options: { withCodexTrust: false },
  cli,
  projectDir: dir,
});

function run(s: InstallSpec, mode: InstallMode = "add"): string {
  const lines: string[] = [];
  const renderer = createInstallRenderer((m) => lines.push(m), s, false);
  runInstall({
    runExternal: null,
    harnessRoot: HARNESS_ROOT,
    projectDir: dir,
    spec: s,
    mode,
    onProgress: (event) => renderer.callbacks.onProgress?.(event),
  });
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI 색 코드를 벗긴다
  return lines.join("\n").replace(/\x1b\[[0-9;]*m/g, "");
}

const update = (): string => run(buildUpdateSpec(dir, detectInstallState(dir).tracks), "update");
const raw = (): InstallLog => JSON.parse(readFileSync(installLogPath(dir), "utf8")) as InstallLog;

/** 26.162.1 이 남긴 모습 — 트랙만 마지막 install 의 것으로 덮였다(디스크 · 파일 기록은 그대로). 표시도 없다. */
function truncate(over: (log: InstallLog) => InstallLog = (l) => l): void {
  const log = raw();
  const { tracksHealed: _t, ...rest } = log;
  writeFileSync(
    installLogPath(dir),
    JSON.stringify(over({ ...rest, spec: { ...rest.spec, tracks: ["data"] } })),
  );
}

/** S3 상태 — tooling(claude + antigravity) → data(codex), 기록 트랙은 `[data]` 로 덮였다. */
function s3(over?: (log: InstallLog) => InstallLog): void {
  run(spec(["tooling"], ["claude", "antigravity"]));
  run(spec(["data"], ["codex"]));
  truncate(over);
  expect(raw().spec.tracks).toEqual(["data"]); // 전제
  expect(existsSync(join(dir, RULE))).toBe(true);
}

describe("B1 — 덮어쓰인 기록에서 정당한 룰을 지우지 않는다", () => {
  it("S3 update — 룰이 남고, 머리글·헤더·기록이 data, tooling 을 말하고, 표시가 남는다", () => {
    s3();
    const state = detectInstallState(dir);
    expect(state.tracks).toEqual(["data", "tooling"]);
    expect(
      describeInstall(state, buildInstallRecordView(state, state.log as InstallLog, true)),
    ).toContain("tracks data, tooling ·");

    const screen = update();

    expect(existsSync(join(dir, RULE))).toBe(true);
    expect(screen).not.toContain("not in the recorded tracks");
    expect(buildUpdateSpec(dir, detectInstallState(dir).tracks).tracks).toEqual([
      "data",
      "tooling",
    ]);
    expect(raw().spec.tracks).toEqual(["data", "tooling"]);
    expect(raw().tracksHealed).toBe(true);
  });

  it("S3b install --track data --cli codex 재추가도 지우지 않는다", () => {
    s3();
    run(spec(["data"], ["codex"]));
    expect(existsSync(join(dir, RULE))).toBe(true);
    expect(raw().spec.tracks).toEqual(["data", "tooling"]);
  });

  it("S9 위저드에서 아무것도 안 바꾸면 update 로 돌고 트랙 잠금이 data, tooling 이다", async () => {
    s3();
    const prompts: Prompts = {
      intro: vi.fn(),
      outro: vi.fn(),
      cancel: vi.fn(),
      selectAction: vi.fn(async () => "update" as const),
      selectTracks: vi.fn(async (initial?: Track[]) => initial ?? []),
      selectCli: vi.fn(async (initial?: CliTargets) => initial ?? (["claude"] as CliTargets)),
      confirmInstall: vi.fn(async () => true),
      selectInstallTargets: vi.fn(async (initial: ReadonlyArray<InstallTargetId>) => initial),
    };
    const result = await runInteractive(dir, {
      prompts,
      detect: () => detectInstallState(dir),
      isTty: () => true,
    });
    expect(result.mode).toBe("update");
    expect(result.spec?.tracks).toEqual(["data", "tooling"]);
    update();
    expect(existsSync(join(dir, RULE))).toBe(true);
  });

  it("근거 하나로도 되살린다 — 메타파일만(기록에 sha) · claude 자리 파일만(writer 기록)", () => {
    // 파일 근거를 지운다(cli-development 의 claude 기록) — 메타파일만 남는다
    s3((l) => ({
      ...l,
      policyFiles: (l.policyFiles ?? []).filter((f) => f.path !== "rules/cli-development.md"),
    }));
    expect(readInstallLog(dir)?.spec.tracks).toEqual(["data", "tooling"]);

    rmSync(dir, { recursive: true, force: true });
    dir = mkdtempSync(join(tmpdir(), "ah-track-heal-"));
    // 메타파일의 sha 기록을 지운다 — 기록이 보증하지 않으니 근거가 아니다. claude 자리 파일만 남는다
    s3((l) => ({
      ...l,
      policyFiles: (l.policyFiles ?? []).filter((f) => f.path !== ".installed-tracks"),
    }));
    expect(readInstallLog(dir)?.spec.tracks).toEqual(["data", "tooling"]); // full 로 넓히지 않는다
  });

  it("claude 자리 파일 근거는 쓰는 순간 적은 기록만 — 옛 스캔 기록(records 없음)은 근거가 아니다", () => {
    s3((l) => {
      const { records: _r, ...rest } = l;
      return {
        ...rest,
        policyFiles: (l.policyFiles ?? []).filter((f) => f.path !== ".installed-tracks"),
      };
    });
    expect(readInstallLog(dir)?.spec.tracks).toEqual(["data"]);
  });
});

describe("B1 — 근거가 없으면 지우되, 기록된 트랙과 되돌리는 명령을 말한다", () => {
  it("claude 없이 antigravity 로 tooling → codex 로 data(덮인 기록): 지우고 화면이 사실대로 말한다 · 그 명령이 되돌린다", () => {
    run(spec(["tooling"], ["antigravity"]));
    run(spec(["data"], ["codex"]));
    truncate();

    const screen = update();

    expect(existsSync(join(dir, RULE))).toBe(false);
    expect(screen).toMatch(
      /cli-development\.md\s+not in the recorded tracks \(data\) — removed · if you picked tooling \(or full\) for Antigravity, bring it back: agent-harness install --track tooling --cli antigravity/,
    );
    expect(screen).not.toContain("your tracks");

    run(spec(["tooling"], ["antigravity"]));
    expect(existsSync(join(dir, RULE))).toBe(true);
    expect(raw().spec.tracks).toEqual(["data", "tooling"]);
  });

  it("#677 본래 대상(claude + antigravity 로 data, 옛 update 가 룰을 새게 함)은 근거가 없어 여전히 치운다", () => {
    run(spec(["data"], ["claude", "antigravity"]));
    // 옛 update 의 누수 — `.agents/rules/` 에만 생기고 기록에 남는다(claude 자리에는 새지 않았다)
    const text = readFileSync(join(HARNESS_ROOT, "templates/rules/cli-development.md"), "utf8");
    writeFileSync(join(dir, RULE), text);
    const log = raw();
    const externalFiles = [...(log.externalFiles ?? []), { path: RULE, sha256: hashContent(text) }];
    const { tracksHealed: _t, ...rest } = log;
    writeFileSync(installLogPath(dir), JSON.stringify({ ...rest, externalFiles }));

    update();

    expect(existsSync(join(dir, RULE))).toBe(false);
    expect(raw().spec.tracks).toEqual(["data"]);
  });
});
