import {
  existsSync,
  mkdirSync,
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
import { createInstallRenderer } from "../src/commands/install-render.js";
import { readInstallLog } from "../src/install-log.js";
import type { BaselineReport, InstallReport, ProgressEvent } from "../src/installer.js";
import { runInstall } from "../src/installer.js";
import { outsideProjectTarget } from "../src/outside-project.js";
import type { CliBase, InstallSpec, Track } from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");
const USER = "USER ORIGINAL\n";

/**
 * #678 — install · update 가 링크를 따라 **프로젝트 밖** 파일을 하네스 내용으로 덮어쓰지 않는다. uninstall 이 #668 에서
 * 이미 쓰는 판정(실체가 밖이면 남김 + 경로)을 쓰기 쪽에도 건다. 이슈의 두 재현을 그대로 옮긴다:
 *   (a) `.agents/rules/git-policy.md` → 밖 파일, `install --track base --cli antigravity`
 *   (b) `.claude/rules` → 밖 폴더, 밖 파일 편집 후 `update`
 * 판정 기준 = 밖 파일이 바이트 그대로 · 밖 폴더에 백업이 생기지 않는다 · 화면이 그 사실과 경로를 말한다.
 */
describe("#678 링크 너머가 프로젝트 밖이면 install · update 가 쓰지 않는다", () => {
  let root: string;
  let projectDir: string;
  let outDir: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "uzys-678-"));
    projectDir = join(root, "proj");
    outDir = join(root, "dotfiles");
    mkdirSync(projectDir, { recursive: true });
    mkdirSync(outDir, { recursive: true });
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  const specOf = (cli: CliBase[], tracks: Track[]): InstallSpec => ({
    tracks,
    options: { withCodexTrust: false },
    cli,
    projectDir,
  });

  const run = (
    cli: CliBase[],
    tracks: Track[],
    mode: "fresh" | "update" = "fresh",
  ): { report: InstallReport; screen: string } => {
    let captured: BaselineReport | undefined;
    const report = runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: specOf(cli, tracks),
      mode,
      onProgress: (e: ProgressEvent) => {
        if (e.type === "baseline-complete") captured = e.baseline;
      },
    });
    if (captured === undefined) throw new Error("baseline-complete 이벤트가 오지 않았다");
    const lines: string[] = [];
    createInstallRenderer((m) => lines.push(m), specOf(cli, tracks), false).callbacks.onProgress?.({
      type: "baseline-complete",
      baseline: captured,
    });
    return { report, screen: lines.join("\n") };
  };

  const backupsIn = (dir: string): string[] =>
    readdirSync(dir).filter((f) => f.includes(".backup-"));

  it("(a) install: 밖 파일 링크는 바이트 그대로 · 화면이 경로와 대상을 말한다", () => {
    const outFile = join(outDir, "rule.md");
    writeFileSync(outFile, USER);
    mkdirSync(join(projectDir, ".agents/rules"), { recursive: true });
    symlinkSync(outFile, join(projectDir, ".agents/rules/git-policy.md"));

    const { report, screen } = run(["antigravity"], ["base"]);

    expect(readFileSync(outFile, "utf8")).toBe(USER);
    expect(backupsIn(outDir)).toEqual([]);
    expect(report.outsideLinks?.map((o) => o.path)).toContain(".agents/rules/git-policy.md");
    // 같은 폴더의 다른 룰은 프로젝트 안이라 평소대로 깔린다 — 설치 전체를 건너뛰는 회귀를 문다
    expect(existsSync(join(projectDir, ".agents/rules/uzys-harness.md"))).toBe(true);
    expect(screen).toContain(".agents/rules/git-policy.md — left as is");
    expect(screen).toContain(outFile);
  });

  it("install --cli claude: 하네스 파일 · 함께 쓰는 파일(settings.json) 모두 밖 링크면 쓰지 않는다", () => {
    const outRule = join(outDir, "rule.md");
    const outSettings = join(outDir, "settings.json");
    writeFileSync(outRule, USER);
    writeFileSync(outSettings, '{"model":"mine"}\n');
    mkdirSync(join(projectDir, ".claude/rules"), { recursive: true });
    symlinkSync(outRule, join(projectDir, ".claude/rules/git-policy.md"));
    symlinkSync(outSettings, join(projectDir, ".claude/settings.json"));

    const { report } = run(["claude"], ["tooling"]);

    expect(readFileSync(outRule, "utf8")).toBe(USER);
    expect(readFileSync(outSettings, "utf8")).toBe('{"model":"mine"}\n');
    expect(backupsIn(outDir)).toEqual([]);
    expect(report.outsideLinks?.map((o) => o.path).sort()).toEqual([
      ".claude/rules/git-policy.md",
      ".claude/settings.json",
    ]);
  });

  it("(b) update: 밖 폴더 링크 안의 편집한 룰을 덮지도 · 그 옆에 백업을 만들지도 않는다", () => {
    run(["claude"], ["tooling"]);
    const rules = join(projectDir, ".claude/rules");
    const outRules = join(outDir, "rules");
    renameSync(rules, outRules);
    symlinkSync(outRules, rules);
    const edited = join(outRules, "git-policy.md");
    writeFileSync(edited, USER);
    const before = new Map(readdirSync(outRules).map((f) => [f, readFileSync(join(outRules, f))]));
    const recordedSha = () =>
      readInstallLog(projectDir)?.policyFiles?.find((f) => f.path === "rules/git-policy.md")
        ?.sha256;
    const shaBefore = recordedSha();
    expect(shaBefore).toBeDefined();

    const { report, screen } = run(["claude"], ["tooling"], "update");

    expect(readFileSync(edited, "utf8")).toBe(USER);
    expect(backupsIn(outRules)).toEqual([]);
    // 폴더 전체가 바이트 그대로다(편집 안 한 룰도 · 지울 뻔한 고아도)
    expect(new Map(readdirSync(outRules).map((f) => [f, readFileSync(join(outRules, f))]))).toEqual(
      before,
    );
    const outside = report.updateMode?.outsideLinks ?? [];
    expect(outside.map((o) => o.path)).toContain(".claude/rules/git-policy.md");
    expect(outside.every((o) => o.link === ".claude/rules")).toBe(true);
    expect(report.updateMode?.policyBackedUp).toEqual([]);
    // 밖의 설치자 편집을 "하네스가 놓은 판" 으로 기록하지 않는다 — 기록하면 링크를 실파일로 바꾼 뒤 update 가 백업 없이 덮는다
    expect(recordedSha()).toBe(shaBefore);
    expect(screen).toContain(".claude/rules/ — left as is");
    expect(screen).toContain(outRules);
  });

  it("프로젝트 안을 가리키는 링크는 지금처럼 따라가 쓴다", () => {
    run(["claude"], ["tooling"]);
    const rules = join(projectDir, ".claude/rules");
    const shared = join(projectDir, "shared-rules");
    renameSync(rules, shared);
    symlinkSync(shared, rules);
    const file = join(shared, "git-policy.md");
    const harness = readFileSync(file, "utf8");
    writeFileSync(file, USER);

    const { report } = run(["claude"], ["tooling"], "update");

    expect(readFileSync(file, "utf8")).toBe(harness);
    expect(report.updateMode?.outsideLinks ?? []).toEqual([]);
  });
});

describe("outsideProjectTarget — 아직 없는 자리 · 깨진 링크도 실체로 판정한다", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "uzys-678-u-"));
    mkdirSync(join(root, "proj/.claude"), { recursive: true });
    mkdirSync(join(root, "out"), { recursive: true });
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it("밖 폴더 링크 안에 새로 만들 파일은 밖이다 — 링크 자리를 함께 낸다", () => {
    const proj = join(root, "proj");
    symlinkSync(join(root, "out"), join(proj, ".claude/rules"));
    const hit = outsideProjectTarget(proj, join(proj, ".claude/rules/new.md"));
    expect(hit?.path).toBe(".claude/rules/new.md");
    expect(hit?.link).toBe(".claude/rules");
  });

  it("깨진 링크는 링크 문자열을 따라간다 — 쓰기가 그 대상을 만든다", () => {
    const proj = join(root, "proj");
    symlinkSync(join(root, "out/missing.md"), join(proj, ".claude/x.md"));
    expect(outsideProjectTarget(proj, join(proj, ".claude/x.md"))?.link).toBe(".claude/x.md");
  });

  it("링크가 없으면 null", () => {
    const proj = join(root, "proj");
    expect(outsideProjectTarget(proj, join(proj, ".claude/rules/a.md"))).toBeNull();
  });
});
