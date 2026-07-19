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
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hashContent, readInstallLog, writeInstallLog } from "../src/install-log.js";
import {
  cleanStaleHookRefs,
  pruneOrphans,
  runUpdateMode,
  syncSkills,
  updateDir,
} from "../src/update-mode.js";

describe("updateDir", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "ch-up-"));
    mkdirSync(join(dir, "target"));
    mkdirSync(join(dir, "source"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("overwrites only files that exist in target (Track 혼입 방지)", () => {
    writeFileSync(join(dir, "target", "a.md"), "old-a");
    writeFileSync(join(dir, "target", "b.md"), "old-b");
    writeFileSync(join(dir, "source", "a.md"), "new-a");
    writeFileSync(join(dir, "source", "b.md"), "new-b");
    writeFileSync(join(dir, "source", "c.md"), "new-c"); // c.md not in target

    const count = updateDir(join(dir, "target"), join(dir, "source"), ".md");
    expect(count).toBe(2);
    expect(readFileSync(join(dir, "target", "a.md"), "utf8")).toBe("new-a");
    expect(readFileSync(join(dir, "target", "b.md"), "utf8")).toBe("new-b");
    expect(existsSync(join(dir, "target", "c.md"))).toBe(false); // c.md NOT added
  });

  it("returns 0 when target/source missing", () => {
    expect(updateDir("/nonexistent", "/also-nope", ".md")).toBe(0);
  });

  it("filters by extension", () => {
    writeFileSync(join(dir, "target", "x.md"), "");
    writeFileSync(join(dir, "target", "y.txt"), "");
    writeFileSync(join(dir, "source", "x.md"), "x");
    writeFileSync(join(dir, "source", "y.txt"), "y");
    expect(updateDir(join(dir, "target"), join(dir, "source"), ".md")).toBe(1);
  });
});

describe("pruneOrphans", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "ch-pr-"));
    mkdirSync(join(dir, "target"));
    mkdirSync(join(dir, "source"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("removes files in target that don't exist in source", () => {
    writeFileSync(join(dir, "target", "alive.md"), "");
    writeFileSync(join(dir, "target", "orphan.md"), "");
    writeFileSync(join(dir, "source", "alive.md"), "");

    const removed = pruneOrphans(join(dir, "target"), join(dir, "source"), ".md");
    expect(removed).toEqual(["orphan.md"]);
    expect(existsSync(join(dir, "target", "alive.md"))).toBe(true);
    expect(existsSync(join(dir, "target", "orphan.md"))).toBe(false);
  });

  it("returns empty when nothing to prune", () => {
    writeFileSync(join(dir, "target", "x.md"), "");
    writeFileSync(join(dir, "source", "x.md"), "");
    expect(pruneOrphans(join(dir, "target"), join(dir, "source"), ".md")).toEqual([]);
  });

  it("ignores files with different extension", () => {
    writeFileSync(join(dir, "target", "stale.txt"), "");
    expect(pruneOrphans(join(dir, "target"), join(dir, "source"), ".md")).toEqual([]);
    expect(existsSync(join(dir, "target", "stale.txt"))).toBe(true);
  });
});

describe("cleanStaleHookRefs", () => {
  let dir: string;
  let hooksDir: string;
  let settingsPath: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "ch-st-"));
    hooksDir = join(dir, "hooks");
    settingsPath = join(dir, "settings.json");
    mkdirSync(hooksDir);
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("removes hook refs whose script file is missing", () => {
    writeFileSync(join(hooksDir, "alive.sh"), "");
    writeFileSync(
      settingsPath,
      JSON.stringify({
        hooks: {
          PreToolUse: [
            {
              matcher: "Bash",
              hooks: [
                { type: "command", command: 'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/alive.sh"' },
                { type: "command", command: 'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/dead.sh"' },
              ],
            },
          ],
        },
      }),
    );
    const removed = cleanStaleHookRefs(settingsPath, hooksDir);
    expect(removed).toEqual(["dead.sh"]);
    const after = JSON.parse(readFileSync(settingsPath, "utf8"));
    const cmds = after.hooks.PreToolUse[0].hooks.map((h: { command: string }) => h.command);
    expect(cmds.some((c: string) => c.includes("alive.sh"))).toBe(true);
    expect(cmds.some((c: string) => c.includes("dead.sh"))).toBe(false);
  });

  it("returns empty when settings.json malformed", () => {
    writeFileSync(settingsPath, "{ not json");
    expect(cleanStaleHookRefs(settingsPath, hooksDir)).toEqual([]);
  });

  it("preserves non-hook commands (e.g. statusLine)", () => {
    writeFileSync(
      settingsPath,
      JSON.stringify({
        statusLine: { type: "command", command: "npx -y @owloops/claude-powerline" },
        hooks: {
          PreToolUse: [
            {
              matcher: "Bash",
              hooks: [{ type: "command", command: "echo hi" }], // not a hook ref
            },
          ],
        },
      }),
    );
    const removed = cleanStaleHookRefs(settingsPath, hooksDir);
    expect(removed).toEqual([]);
  });

  // characterization — 리팩터 전 현재 동작 고정 (엣지케이스 회귀 방지)
  it("entry 의 hooks 가 모두 stale 이면 entry 자체 제거, 다른 top-level 키는 보존", () => {
    writeFileSync(
      settingsPath,
      JSON.stringify({
        statusLine: { type: "command", command: "npx powerline" },
        hooks: {
          PreToolUse: [
            {
              matcher: "Bash",
              hooks: [
                { type: "command", command: 'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/dead.sh"' },
              ],
            },
          ],
        },
      }),
    );
    const removed = cleanStaleHookRefs(settingsPath, hooksDir);
    expect(removed).toEqual(["dead.sh"]);
    const after = JSON.parse(readFileSync(settingsPath, "utf8"));
    expect(after.hooks.PreToolUse).toEqual([]); // hooks 빈 entry 통째 제거
    expect(after.statusLine).toEqual({ type: "command", command: "npx powerline" }); // 보존
  });

  it("non-array hook event 는 write 발생 시에도 그대로 보존", () => {
    writeFileSync(
      settingsPath,
      JSON.stringify({
        hooks: {
          PreToolUse: [
            {
              matcher: "Bash",
              hooks: [
                { type: "command", command: 'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/dead.sh"' },
              ],
            },
          ],
          WeirdEvent: "not-an-array-value",
        },
      }),
    );
    const removed = cleanStaleHookRefs(settingsPath, hooksDir);
    expect(removed).toEqual(["dead.sh"]); // stale 제거로 write 트리거
    const after = JSON.parse(readFileSync(settingsPath, "utf8"));
    expect(after.hooks.WeirdEvent).toBe("not-an-array-value"); // non-array event 불변
  });
});

describe("runUpdateMode (E2E with templates)", () => {
  let projectDir: string;
  let templatesDir: string;
  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "ch-um-proj-"));
    templatesDir = mkdtempSync(join(tmpdir(), "ch-um-tpl-"));
    // minimal layout
    for (const d of ["rules", "agents", "commands/uzys", "hooks"]) {
      mkdirSync(join(templatesDir, d), { recursive: true });
      mkdirSync(join(projectDir, ".claude", d), { recursive: true });
    }
    writeFileSync(join(templatesDir, "CLAUDE.md"), "template-CLAUDE\n");
    writeFileSync(join(projectDir, ".claude/CLAUDE.md"), "old-CLAUDE\n");
    writeFileSync(join(templatesDir, "rules/git-policy.md"), "v2\n");
    writeFileSync(join(projectDir, ".claude/rules/git-policy.md"), "v1\n");
    writeFileSync(join(projectDir, ".claude/rules/orphan-rule.md"), "stale\n"); // not in template
    writeFileSync(join(templatesDir, "hooks/session-start.sh"), "echo new\n");
    writeFileSync(join(projectDir, ".claude/hooks/session-start.sh"), "echo old\n");
  });
  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
    rmSync(templatesDir, { recursive: true, force: true });
  });

  it("updates files + prunes orphans + refreshes CLAUDE.md", () => {
    const report = runUpdateMode(projectDir, templatesDir);
    expect(readFileSync(join(projectDir, ".claude/rules/git-policy.md"), "utf8")).toBe("v2\n");
    expect(existsSync(join(projectDir, ".claude/rules/orphan-rule.md"))).toBe(false);
    expect(readFileSync(join(projectDir, ".claude/CLAUDE.md"), "utf8")).toBe("template-CLAUDE\n");
    expect(report.updated[".claude/rules"]).toBe(1);
    expect(report.pruned[".claude/rules"]).toEqual(["orphan-rule.md"]);
    expect(report.claudeMdUpdated).toBe(true);
  });
});

/**
 * v26.126.0 (R-3a · ADR-046) — `.claude/skills/` 갱신.
 *
 * 왜 중요한가: 이전까지 update 의 대상 목록에 `skills` 가 없어서, 한 번 설치된 스킬은
 * 영원히 그 시점에 고정됐다. 스킬을 아무리 개선해도 **기존 사용자에게 갈 통로가 없었다.**
 * 통로를 뚫되 사용자가 고친 내용은 잃지 않는다는 것이 ADR-046 의 결정이다.
 */
describe("syncSkills (R-3a)", () => {
  let target = "";
  let source = "";

  beforeEach(() => {
    target = mkdtempSync(join(tmpdir(), "ch-sk-t-"));
    source = mkdtempSync(join(tmpdir(), "ch-sk-s-"));
  });
  afterEach(() => {
    rmSync(target, { recursive: true, force: true });
    rmSync(source, { recursive: true, force: true });
  });

  /** templates 에 스킬 하나, 프로젝트에도 설치돼 있는 상태를 만든다. */
  function seed(skill: string, file: string, sourceText: string, targetText: string): void {
    mkdirSync(join(source, skill), { recursive: true });
    mkdirSync(join(target, skill), { recursive: true });
    writeFileSync(join(source, skill, file), sourceText);
    writeFileSync(join(target, skill, file), targetText);
  }

  function backupsOf(skill: string): string[] {
    return readdirSync(join(target, skill)).filter((f) => f.includes(".backup-"));
  }

  it("사용자가 안 고쳤으면 백업 없이 덮어쓴다 — 개선분이 그대로 도달해야 한다", () => {
    seed("demo", "SKILL.md", "new\n", "old\n");
    const baseline = new Map([["demo/SKILL.md", hashContent("old\n")]]);

    const result = syncSkills(target, source, baseline);

    expect(readFileSync(join(target, "demo/SKILL.md"), "utf8")).toBe("new\n");
    expect(result.backedUp).toEqual([]);
    expect(backupsOf("demo")).toEqual([]);
    expect(result.updated).toBe(1);
  });

  it("사용자가 고쳤으면 백업을 남기고 최신판을 자리에 놓는다 — 둘 다 지켜야 한다", () => {
    seed("demo", "SKILL.md", "new\n", "my-edit\n");
    // 기준선은 설치 시점 원본. 디스크가 그와 다르다 = 사용자가 고쳤다.
    const baseline = new Map([["demo/SKILL.md", hashContent("original\n")]]);

    const result = syncSkills(target, source, baseline);

    // 최신판이 활성 (ADR-046: 최신판이 활성, 편집분이 백업 — 반대가 아니다)
    expect(readFileSync(join(target, "demo/SKILL.md"), "utf8")).toBe("new\n");
    expect(result.backedUp).toEqual(["demo/SKILL.md"]);
    // 편집분이 백업에 살아 있어야 한다 — 이게 깨지면 사용자 작업이 소실된다
    const backups = backupsOf("demo");
    expect(backups).toHaveLength(1);
    expect(readFileSync(join(target, "demo", backups[0] as string), "utf8")).toBe("my-edit\n");
  });

  it("기준선 기록이 없으면(레거시 설치) 보수적으로 백업한다 — 증명 없이 편집분을 지우지 않는다", () => {
    seed("demo", "SKILL.md", "new\n", "unknown-origin\n");

    const result = syncSkills(target, source, new Map());

    expect(result.backedUp).toEqual(["demo/SKILL.md"]);
    expect(readFileSync(join(target, "demo/SKILL.md"), "utf8")).toBe("new\n");
  });

  it("이미 최신이면 아무것도 안 한다 — 재실행이 백업 노이즈를 쌓으면 안 된다", () => {
    seed("demo", "SKILL.md", "same\n", "same\n");

    const result = syncSkills(target, source, new Map()); // 기준선 없어도 내용이 같으면 무동작

    expect(result.updated).toBe(0);
    expect(result.backedUp).toEqual([]);
    expect(backupsOf("demo")).toEqual([]);
  });

  it("설치 안 된 스킬은 새로 깔지 않는다 — update 가 고르지 않은 자산을 들이면 안 된다", () => {
    mkdirSync(join(source, "not-chosen"), { recursive: true });
    writeFileSync(join(source, "not-chosen", "SKILL.md"), "x\n");

    const result = syncSkills(target, source, new Map());

    expect(existsSync(join(target, "not-chosen"))).toBe(false);
    expect(result.updated).toBe(0);
  });

  it("설치된 스킬 안에 새로 생긴 파일은 가져온다 — 스킬의 일부다", () => {
    seed("demo", "SKILL.md", "s\n", "s\n");
    mkdirSync(join(source, "demo/references"), { recursive: true });
    writeFileSync(join(source, "demo/references/deep.md"), "ref\n");

    const result = syncSkills(target, source, new Map());

    expect(readFileSync(join(target, "demo/references/deep.md"), "utf8")).toBe("ref\n");
    expect(result.updated).toBe(1);
  });

  it("templates 에 없는 사용자 파일은 지우지 않는다 — prune 하면 사용자 파일 삭제다", () => {
    seed("demo", "SKILL.md", "new\n", "old\n");
    writeFileSync(join(target, "demo/my-notes.md"), "mine\n");

    syncSkills(target, source, new Map([["demo/SKILL.md", hashContent("old\n")]]));

    expect(readFileSync(join(target, "demo/my-notes.md"), "utf8")).toBe("mine\n");
  });
});

/**
 * 기준선 갱신 회귀 (v26.126.0).
 *
 * `runUpdateInstall`(installer.ts) 은 install log 를 쓰지 않는 **단축 경로**다. 그래서
 * `runUpdateMode` 가 갱신 직후 기준선을 다시 찍지 않으면, 다음 update 가 **자기가 방금
 * 덮어쓴 파일**을 "사용자가 고쳤다"로 오판해 백업본을 매 릴리즈마다 쌓는다.
 * 이 테스트가 죽으면 사용자의 `.claude/skills/` 가 백업 파일로 오염된다.
 */
describe("스킬 기준선 갱신 (R-3a)", () => {
  let projectDir = "";
  let templatesDir = "";

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "ch-base-p-"));
    templatesDir = mkdtempSync(join(tmpdir(), "ch-base-t-"));
    for (const d of ["rules", "agents", "commands/uzys", "hooks"]) {
      mkdirSync(join(templatesDir, d), { recursive: true });
      mkdirSync(join(projectDir, ".claude", d), { recursive: true });
    }
    mkdirSync(join(templatesDir, "skills/demo"), { recursive: true });
    mkdirSync(join(projectDir, ".claude/skills/demo"), { recursive: true });
    writeFileSync(join(projectDir, ".claude/skills/demo/SKILL.md"), "v1\n");
  });
  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
    rmSync(templatesDir, { recursive: true, force: true });
  });

  function writeLog(): void {
    writeInstallLog(projectDir, {
      schemaVersion: 1,
      installedAt: new Date().toISOString(),
      scope: "project",
      spec: { tracks: ["tooling"], cli: ["claude"] },
      templates: { claudeDir: ".claude/" },
      assets: [],
      skillFiles: [{ path: "demo/SKILL.md", sha256: hashContent("v1\n") }],
    });
  }

  function backupCount(): number {
    return readdirSync(join(projectDir, ".claude/skills/demo")).filter((f) =>
      f.includes(".backup-"),
    ).length;
  }

  it("연속 update 가 백업본을 쌓지 않는다 — 기준선이 매번 갱신되기 때문", () => {
    writeLog();

    writeFileSync(join(templatesDir, "skills/demo/SKILL.md"), "v2\n");
    const first = runUpdateMode(projectDir, templatesDir);
    expect(first.skillsBackedUp).toEqual([]);

    // 두 번째 릴리즈. 기준선이 v2 로 갱신됐어야 "사용자가 안 고쳤다"로 올바르게 판정된다.
    writeFileSync(join(templatesDir, "skills/demo/SKILL.md"), "v3\n");
    const second = runUpdateMode(projectDir, templatesDir);

    expect(second.skillsBackedUp).toEqual([]);
    expect(backupCount()).toBe(0);
    expect(readFileSync(join(projectDir, ".claude/skills/demo/SKILL.md"), "utf8")).toBe("v3\n");
    expect(readInstallLog(projectDir)?.skillFiles).toEqual([
      { path: "demo/SKILL.md", sha256: hashContent("v3\n") },
    ]);
  });

  it("사용자가 중간에 고치면 그때는 백업한다 — 갱신이 판정을 무디게 만들면 안 된다", () => {
    writeLog();
    writeFileSync(join(templatesDir, "skills/demo/SKILL.md"), "v2\n");
    runUpdateMode(projectDir, templatesDir);

    // 사용자가 v2 를 자기 것으로 고친다
    writeFileSync(join(projectDir, ".claude/skills/demo/SKILL.md"), "my-edit\n");
    writeFileSync(join(templatesDir, "skills/demo/SKILL.md"), "v3\n");
    const report = runUpdateMode(projectDir, templatesDir);

    expect(report.skillsBackedUp).toEqual(["demo/SKILL.md"]);
    expect(backupCount()).toBe(1);
  });

  it("install log 가 없으면 만들지 않는다 — update 가 설치 기록을 날조하면 uninstall 이 그걸 믿는다", () => {
    writeFileSync(join(templatesDir, "skills/demo/SKILL.md"), "v2\n");

    runUpdateMode(projectDir, templatesDir);

    expect(readInstallLog(projectDir)).toBeNull();
  });
});
