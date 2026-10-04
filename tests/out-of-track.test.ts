import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createInstallRenderer, renderUpdateSummary } from "../src/commands/install-render.js";
import { hashContent, type InstallLog, installLogPath } from "../src/install-log.js";
import { type InstallReport, runInstall } from "../src/installer.js";
import type { CliBase, InstallSpec, Track } from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");
/** 트랙 밖 룰 — #601 이전 판이 data 트랙 antigravity 설치본에 깔던 것. */
const LEAKED = ".agents/rules/cli-development.md";
const LEAKED_TEXT = readFileSync(join(HARNESS_ROOT, "templates/rules/cli-development.md"), "utf8");

let projectDir = "";
let outsideDir = "";

beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "ah-out-of-track-"));
  outsideDir = mkdtempSync(join(tmpdir(), "ah-out-of-track-outside-"));
});
afterEach(() => {
  rmSync(projectDir, { recursive: true, force: true });
  rmSync(outsideDir, { recursive: true, force: true });
});

const spec = (tracks: Track[], cli: CliBase[], over: Partial<InstallSpec> = {}): InstallSpec => ({
  tracks,
  options: { withCodexTrust: false },
  cli,
  projectDir,
  ...over,
});

const install = (tracks: Track[], cli: CliBase[] = ["antigravity"], over = {}): InstallReport =>
  runInstall({
    runExternal: null,
    harnessRoot: HARNESS_ROOT,
    projectDir,
    spec: spec(tracks, cli, over),
  });

/** 실행 1회 — 보고와 색을 벗긴 화면. */
function run(mode: "update" | "add", tracks: Track[] = ["data"]) {
  const lines: string[] = [];
  const s = spec(tracks, ["antigravity"]);
  const renderer = createInstallRenderer((m) => lines.push(m), s, false);
  const report = runInstall({
    runExternal: null,
    harnessRoot: HARNESS_ROOT,
    projectDir,
    spec: s,
    mode,
    onProgress: (event) => renderer.callbacks.onProgress?.(event),
  });
  if (mode === "update") renderUpdateSummary((m) => lines.push(m), s, report);
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI 색 코드를 벗긴다
  const screen = lines.join("\n").replace(/\x1b\[[0-9;]*m/g, "");
  return { report, screen };
}

const rawLog = (): InstallLog =>
  JSON.parse(readFileSync(installLogPath(projectDir), "utf8")) as InstallLog;
const recordedPaths = (): string[] => (rawLog().externalFiles ?? []).map((f) => f.path);

/** #601 이전 판의 상태 — 트랙 밖 룰이 디스크와 기록(`externalFiles`)에 하네스 몫으로 있다. */
function leak(text = LEAKED_TEXT, over: Partial<InstallLog> = {}): void {
  const abs = join(projectDir, LEAKED);
  if (!existsSync(abs)) writeFileSync(abs, text);
  const log = rawLog();
  const externalFiles = [
    ...(log.externalFiles ?? []).filter((f) => f.path !== LEAKED),
    { path: LEAKED, sha256: hashContent(text) },
  ];
  writeFileSync(installLogPath(projectDir), JSON.stringify({ ...log, externalFiles, ...over }));
}

const backups = (): string[] =>
  readdirSync(join(projectDir, ".agents/rules")).filter((n) => n.includes(".backup-"));

describe("#677 — 기록에 있으나 기록 트랙 밖인 하네스 룰은 update 1회가 치운다", () => {
  it("설치자가 안 고쳤으면 지우고 기록에서도 뺀다 · 트랙 룰과 앵커는 그대로 · 화면은 한 줄로 말한다", () => {
    install(["data"]);
    leak();
    const before = readdirSync(join(projectDir, ".agents/rules")).sort();

    const { report, screen } = run("update");

    expect(existsSync(join(projectDir, LEAKED))).toBe(false);
    expect(recordedPaths()).not.toContain(LEAKED);
    expect(backups()).toEqual([]);
    expect(report.updateMode?.outOfTrack?.removed).toEqual([LEAKED]);
    expect(readdirSync(join(projectDir, ".agents/rules")).sort()).toEqual(
      before.filter((n) => n !== "cli-development.md"),
    );
    expect(screen).toMatch(
      /cli-development\.md\s+not in the recorded tracks \(data\) — removed · if you picked tooling/,
    );
  });

  it("설치자가 고쳤으면 그 파일 하나만 백업한 뒤 치운다", () => {
    install(["data"]);
    const edited = `${LEAKED_TEXT}\n내가 더한 줄\n`;
    leak(LEAKED_TEXT);
    writeFileSync(join(projectDir, LEAKED), edited);

    const { report, screen } = run("update");

    expect(existsSync(join(projectDir, LEAKED))).toBe(false);
    expect(recordedPaths()).not.toContain(LEAKED);
    const saved = backups();
    expect(saved).toHaveLength(1);
    expect(readFileSync(join(projectDir, ".agents/rules", saved[0] ?? ""), "utf8")).toBe(edited);
    expect(report.updateMode?.outOfTrack?.backedUp.map((b) => b.path)).toEqual([LEAKED]);
    expect(screen).toMatch(
      /cli-development\.md\s+not in the recorded tracks \(data\) — you edited it, saved as .+\.backup-\d{8}T\d{6}, removed · if you picked tooling/,
    );
    // 리뷰 N1 — 회수 백업은 "지우기 전" 이다 · 다시 얹을 새 판이 없으니 NEXT 를 내지 않는다
    expect(screen).toMatch(/BACKUPS\s+1 file\(s\) saved before removing/);
    expect(screen).not.toContain("re-apply your edits");
  });

  it("이미 없으면 기록만 뺀다 — 화면은 말하지 않는다", () => {
    install(["data"]);
    leak();
    rmSync(join(projectDir, LEAKED));

    const { report, screen } = run("update");

    expect(recordedPaths()).not.toContain(LEAKED);
    expect(report.updateMode?.outOfTrack).toBeUndefined();
    expect(screen).not.toContain("not in the recorded tracks");
  });

  it("install 도 같은 판정으로 치운다(누적 트랙 기준)", () => {
    install(["data"]);
    leak();

    const { report, screen } = run("add");

    expect(existsSync(join(projectDir, LEAKED))).toBe(false);
    expect(recordedPaths()).not.toContain(LEAKED);
    expect(report.outOfTrack?.removed).toEqual([LEAKED]);
    expect(screen).toMatch(/cli-development\.md\s+not in the recorded tracks \(data\) — removed/);
  });
});

describe("#677 — 이 회수가 지우지 않는 것", () => {
  it("트랙이 누적돼 아직 렌더되는 룰(앞 설치가 깐 tooling) — update 도 data 만 다시 까는 install 도 지우지 않는다", () => {
    install(["tooling"]);
    install(["data"]);
    expect(rawLog().spec.tracks).toEqual(["data", "tooling"]);
    expect(recordedPaths()).toContain(LEAKED);

    run("update");
    expect(existsSync(join(projectDir, LEAKED))).toBe(true);
    run("add", ["data"]);
    expect(existsSync(join(projectDir, LEAKED))).toBe(true);
    expect(recordedPaths()).toContain(LEAKED);
  });

  it("`excluded` 에 있는 룰 — 뺐지만 디스크에 남은 것은 지우지 않는다(ADR-099 R3)", () => {
    install(["data"]);
    leak(LEAKED_TEXT, { excluded: ["baseline:rules/cli-development"] });

    const { report } = run("update");

    expect(readFileSync(join(projectDir, LEAKED), "utf8")).toBe(LEAKED_TEXT);
    expect(recordedPaths()).toContain(LEAKED);
    expect(report.updateMode?.outOfTrack).toBeUndefined();
  });

  it("기록에 없는 설치자 파일 — 같은 자리의 다른 룰 파일은 건드리지 않는다", () => {
    install(["data"]);
    writeFileSync(join(projectDir, ".agents/rules/my-team.md"), "# 우리 팀 룰\n");
    writeFileSync(join(projectDir, LEAKED), LEAKED_TEXT); // 기록 없이 같은 이름 — 설치자 것

    run("update");

    expect(readFileSync(join(projectDir, ".agents/rules/my-team.md"), "utf8")).toBe(
      "# 우리 팀 룰\n",
    );
    expect(readFileSync(join(projectDir, LEAKED), "utf8")).toBe(LEAKED_TEXT);
  });

  it("프로젝트 밖 링크(ADR-098) — `.agents/` 가 밖을 가리키면 그 아래 기록 항목도 지우지 않는다", () => {
    install(["data"]);
    leak();
    const real = join(outsideDir, "agents");
    renameSync(join(projectDir, ".agents"), real);
    symlinkSync(real, join(projectDir, ".agents"));

    run("update");

    expect(readFileSync(join(real, "rules/cli-development.md"), "utf8")).toBe(LEAKED_TEXT);
    expect(recordedPaths()).toContain(LEAKED);
  });

  it("파일 링크 — 기록 자리가 링크면 링크도 대상도 그대로 둔다", () => {
    install(["data"]);
    leak();
    const target = join(projectDir, "docs-rule.md");
    renameSync(join(projectDir, LEAKED), target);
    symlinkSync(target, join(projectDir, LEAKED));

    run("update");

    expect(readFileSync(join(projectDir, LEAKED), "utf8")).toBe(LEAKED_TEXT);
    expect(readFileSync(target, "utf8")).toBe(LEAKED_TEXT);
  });
});
