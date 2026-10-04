/**
 * update 화면이 실제 원인과 한 일을 말하는가 — 두 경우.
 *
 *   - #557 — 기록에 체크섬이 없어(체크섬 이전 옛 판) 편집 여부를 잴 수 없던 백업을 "edited" 로 부르지 않는다. 기록 sha 와
 *     디스크가 다른 진짜 편집과 화면 행 · 요약(BACKUPS · NEXT) · `update-backups.json` 색인에서 가른다
 *   - #625 — `.codex/config.toml` 하네스 리전 안을 고친 뒤 update 하면 편집을 남기고(백업 없음 — 덮어쓴 것이 없다, 계약 ⓑ)
 *     화면이 그 사실을 한 줄로 말한다. 전에는 update 가 이 결과를 버려 화면 · 요약 · 색인 모두 무음이었다
 */

import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hasLegacyHarnessHook } from "../src/codex/config-toml.js";
import { createInstallRenderer, renderUpdateSummary } from "../src/commands/install-render.js";
import { type InstallLog, installLogPath } from "../src/install-log.js";
import { type InstallReport, runInstall } from "../src/installer.js";
import type { CliBase, InstallSpec } from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");

let projectDir: string;

beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "ah-update-honesty-"));
});

afterEach(() => {
  rmSync(projectDir, { recursive: true, force: true });
});

function spec(cli: CliBase[]): InstallSpec {
  return { tracks: ["tooling"], options: { withCodexTrust: false }, cli, projectDir };
}

function install(cli: CliBase[]): void {
  runInstall({
    runExternal: null,
    harnessRoot: HARNESS_ROOT,
    projectDir,
    spec: spec(cli),
    mode: "add",
  });
}

/** update 1회 — 보고와 색을 벗긴 화면(진행 행 + 요약). */
function update(cli: CliBase[]): { report: InstallReport; screen: string } {
  const lines: string[] = [];
  const renderer = createInstallRenderer((m) => lines.push(m), spec(cli), false);
  const report = runInstall({
    runExternal: null,
    harnessRoot: HARNESS_ROOT,
    projectDir,
    spec: spec(cli),
    mode: "update",
    onProgress: (event) => renderer.callbacks.onProgress?.(event),
  });
  renderUpdateSummary((m) => lines.push(m), spec(cli), report);
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI 색 코드를 벗긴다
  const screen = lines.join("\n").replace(/\x1b\[[0-9;]*m/g, "");
  return { report, screen };
}

const read = (rel: string): string => readFileSync(join(projectDir, rel), "utf8");
const put = (rel: string, text: string): void => writeFileSync(join(projectDir, rel), text);
const backupIndex = (): { backups: Array<{ path: string; noChecksum?: boolean }> } =>
  JSON.parse(read(".uzys-agent-harness/update-backups.json")) as {
    backups: Array<{ path: string; noChecksum?: boolean }>;
  };

/** 체크섬 이전 옛 판의 기록 — 정책 · 스킬 기준선이 없다(`docs/USAGE.md` "No checksum on record"). */
function dropChecksums(): void {
  const log = JSON.parse(readFileSync(installLogPath(projectDir), "utf8")) as InstallLog;
  delete log.policyFiles;
  delete log.skillFiles;
  writeFileSync(installLogPath(projectDir), `${JSON.stringify(log, null, 2)}\n`);
}

const RULE = ".claude/rules/git-policy.md";

describe("#557 — 기록에 체크섬이 없던 백업은 '당신이 고쳤다' 고 부르지 않는다", () => {
  it("옛 판의 템플릿 차이(기록 없음)는 'no checksum on record' 로 · 요약은 다시 얹으라 하지 않는다 · 색인에 noChecksum", () => {
    install(["claude"]);
    dropChecksums();
    // 릴리즈 사이에 바뀐 템플릿 — 설치자는 아무것도 고치지 않았다
    put(RULE, `${read(RULE)}\nold release wording\n`);

    const { report, screen } = update(["claude"]);

    expect(report.updateMode?.noChecksum).toEqual([RULE]);
    expect(screen).not.toContain("edited policy files");
    expect(screen).toMatch(/no checksum on record\s+1 backed up once/);
    expect(screen).toContain("may not be your edits");
    expect(screen).toContain("nothing to re-apply unless you remember editing one of them");
    expect(screen).not.toContain("to re-apply your edits on the new version");
    expect(backupIndex().backups).toEqual([
      expect.objectContaining({ path: RULE, noChecksum: true }),
    ]);
  });

  it("대조 — 기록 sha 와 다른 파일(진짜 편집)은 전처럼 'edited' 로 · 다시 얹으라는 안내 · 색인에 noChecksum 없음", () => {
    install(["claude"]);
    put(RULE, `${read(RULE)}\nmy team rule\n`);

    const { report, screen } = update(["claude"]);

    expect(report.updateMode?.noChecksum).toBeUndefined();
    expect(screen).toMatch(/edited policy files\s+1 backed up/);
    expect(screen).not.toContain("no checksum on record");
    expect(screen).toContain("to re-apply your edits on the new version");
    const [entry] = backupIndex().backups;
    expect(entry?.path).toBe(RULE);
    expect(entry).not.toHaveProperty("noChecksum");
  });
});

describe("#625 — 고친 .codex/config.toml 하네스 리전을 남기고 update 화면이 말한다", () => {
  const CONFIG = ".codex/config.toml";
  const MARK = "# my edit inside the top region";

  it("리전 안 편집은 그대로 · 백업 없음(덮어쓴 것이 없다) · 화면에 'left as you edited it: top' 한 줄", () => {
    install(["codex"]);
    put(
      CONFIG,
      read(CONFIG).replace("# uzys-harness:top:start\n", `# uzys-harness:top:start\n${MARK}\n`),
    );

    const { report, screen } = update(["codex"]);

    expect(read(CONFIG)).toContain(MARK);
    expect(report.updateMode?.sharedLeft).toEqual([
      { path: CONFIG, edited: ["top"], unrecorded: [], kept: [] },
    ]);
    expect(screen).toMatch(/\.codex\/config\.toml\s+harness part left as you edited it: top/);
    expect(screen).toContain("not updated to this release");
    // 대조 — 훅이 현행 형식이면 '옛 형식' 덧붙임이 없다
    expect(screen).not.toContain("old format");
    // 정책 — 함께 쓰는 파일의 하네스 몫은 남기고 말한다(백업 · 색인은 바꾼 파일에만)
    expect(readdirSync(join(projectDir, ".codex")).filter((f) => f.includes(".backup-"))).toEqual(
      [],
    );
    expect(existsSync(join(projectDir, ".uzys-agent-harness/update-backups.json"))).toBe(false);
  });

  it("남긴 리전의 훅이 옛 [[hooks.session_start]] 형식이면 '현행 Codex 가 무시해 훅이 돌지 않는다' 를 덧붙인다 (#627)", () => {
    install(["codex"]);
    // 옛 판(5be0f56 이전) 템플릿의 등록 형식 — flat 이벤트 + command 배열
    const nested =
      /\[\[hooks\.SessionStart\]\]\nname = "session-start"\n\n\[\[hooks\.SessionStart\.hooks\]\]\ncommand = "([^"]+)"\n/;
    const before = read(CONFIG);
    expect(before).toMatch(nested);
    put(
      CONFIG,
      before.replace(nested, '[[hooks.session_start]]\nname = "session-start"\ncommand = ["$1"]\n'),
    );

    const { report, screen } = update(["codex"]);

    expect(read(CONFIG)).toContain("[[hooks.session_start]]");
    expect(report.updateMode?.sharedLeft).toEqual([
      { path: CONFIG, edited: ["tables"], unrecorded: [], kept: [], legacyHook: true },
    ]);
    expect(screen).toMatch(/harness part left as you edited it: tables/);
    expect(screen).toContain(
      "its [[hooks.session_start]] is the old format — current Codex ignores it, so the session-start hook does not run",
    );
  });

  it("같은 줄 — 설치자가 쓴 AGENTS.md 의 하네스 블록 안을 고쳐도 남기고 말한다", () => {
    put("AGENTS.md", "# my project\n\nmy own text\n");
    install(["codex"]);
    const agents = read("AGENTS.md");
    const start = agents.indexOf("<!-- uzys-harness:");
    expect(start).toBeGreaterThan(0);
    const lineEnd = agents.indexOf("\n", start) + 1;
    put("AGENTS.md", `${agents.slice(0, lineEnd)}${MARK}\n${agents.slice(lineEnd)}`);

    const { report, screen } = update(["codex"]);

    expect(read("AGENTS.md")).toContain(MARK);
    const left = report.updateMode?.sharedLeft?.find((f) => f.path === "AGENTS.md");
    expect(left?.edited.length).toBe(1);
    expect(screen).toMatch(/AGENTS\.md\s+harness part left as you edited it: /);
    expect(existsSync(join(projectDir, ".uzys-agent-harness/update-backups.json"))).toBe(false);
  });

  it("대조 — 리전을 고치지 않았으면 그 줄이 없다", () => {
    install(["codex"]);

    const { report, screen } = update(["codex"]);

    expect(report.updateMode?.sharedLeft).toBeUndefined();
    expect(screen).not.toContain("harness part left");
  });
});

describe("hasLegacyHarnessHook — '훅이 돌지 않는다' 가 참인 경우만 (#627 형식 차이)", () => {
  const FLAT =
    '[[hooks.session_start]]\nname = "session-start"\ncommand = ["/p/.codex/hooks/session-start.sh"]\n';
  const NESTED =
    '[[hooks.SessionStart]]\nname = "session-start"\n\n[[hooks.SessionStart.hooks]]\ncommand = "/p/.codex/hooks/session-start.sh"\ntype = "command"\n';

  it("옛 flat 하네스 훅만 있으면 true", () => {
    expect(hasLegacyHarnessHook(FLAT)).toBe(true);
  });
  it("현행 중첩 하네스 훅이 함께 있으면 false — 훅은 그쪽으로 돈다", () => {
    expect(hasLegacyHarnessHook(`${FLAT}\n${NESTED}`)).toBe(false);
  });
  it("현행 형식만 · 하네스 훅이 아닌 flat 항목 · 못 읽는 파일은 false", () => {
    expect(hasLegacyHarnessHook(NESTED)).toBe(false);
    expect(
      hasLegacyHarnessHook(FLAT.replace("/p/.codex/hooks/session-start.sh", "/x/mine.sh")),
    ).toBe(false);
    expect(hasLegacyHarnessHook("[[hooks.session_start\n")).toBe(false);
  });
});
