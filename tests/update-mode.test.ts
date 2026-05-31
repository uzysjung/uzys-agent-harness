import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanStaleHookRefs, pruneOrphans, runUpdateMode, updateDir } from "../src/update-mode.js";

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
