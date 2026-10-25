import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hashContent, writeInstallLog } from "../src/install-log.js";
import { runUpdateMode } from "../src/update-mode.js";

/**
 * #868 — update 의 스킬 폴더 정리(#477)에서 **백업은 됐는데 원본 지우기만 실패**하면(immutable 속성 · 잠긴 파일) 원본이 그대로 남는다.
 * 그때 방금 만든 백업이 디스크에 남으면 화면은 "left in place" 라 하고 BACKUPS 목록(`collectRunBackups` — 디스크를 줍는다)에는 그
 * 백업이 오르며, 다음 update 가 다시 시도할 때마다 같은 파일의 백업이 하나씩 쌓인다.
 *
 * 지우기 실패는 권한으로 재현할 수 없다 — 폴더를 막으면 백업부터 실패하고, 파일 속성(chattr +i)은 root 가 필요하다. 그래서 그 파일의
 * `unlinkSync` 만 실패시킨다(나머지 fs 는 실물).
 */
const unlinkFails = new Set<string>();
vi.mock("node:fs", async (importOriginal) => {
  const real = await importOriginal<typeof import("node:fs")>();
  return {
    ...real,
    unlinkSync: (p: Parameters<typeof real.unlinkSync>[0]) => {
      if (unlinkFails.has(basename(String(p)))) {
        throw Object.assign(new Error(`EPERM: operation not permitted, unlink '${p}'`), {
          code: "EPERM",
        });
      }
      real.unlinkSync(p);
    },
  };
});

const HARNESS_ROOT = join(__dirname, "..");

describe("#868 — 번들 밖 스킬 파일을 백업했지만 지우지 못하면", () => {
  let projectDir = "";
  let templatesDir = "";
  const demo = (): string => join(projectDir, ".claude/skills/demo");

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "ch-868-p-"));
    templatesDir = mkdtempSync(join(tmpdir(), "ch-868-t-"));
    mkdirSync(join(templatesDir, "skills/demo"), { recursive: true });
    mkdirSync(demo(), { recursive: true });
    writeFileSync(join(templatesDir, "skills/demo/SKILL.md"), "s\n");
    writeFileSync(join(demo(), "SKILL.md"), "s\n");
    writeFileSync(join(demo(), "locked.md"), "mine — immutable\n");
    writeFileSync(join(demo(), "other.md"), "mine too\n");
    writeInstallLog(projectDir, {
      schemaVersion: 1,
      installedAt: new Date(0).toISOString(),
      scope: "project",
      spec: { tracks: ["tooling"], cli: ["claude"] },
      templates: { claudeDir: ".claude" },
      assets: [],
      records: "writer",
      skillFiles: [{ path: "demo/SKILL.md", sha256: hashContent("s\n") }],
    });
    unlinkFails.add("locked.md");
  });
  afterEach(() => {
    unlinkFails.clear();
    rmSync(projectDir, { recursive: true, force: true });
    rmSync(templatesDir, { recursive: true, force: true });
  });

  const update = () => runUpdateMode(projectDir, templatesDir, HARNESS_ROOT, {}, ["skills"]);
  const backupsOf = (name: string): string[] =>
    readdirSync(demo()).filter((f) => f.startsWith(`${name}.backup-`));

  it("화면(남겼다)과 BACKUPS 목록이 같은 말을 하고, 반복해도 그 파일의 백업이 쌓이지 않는다", () => {
    const first = update();

    expect(first.skillsPruneFailed).toEqual(["demo/locked.md"]);
    expect(existsSync(join(demo(), "locked.md"))).toBe(true);
    expect(backupsOf("locked.md")).toEqual([]);
    expect(first.backups.map((b) => b.path)).not.toContain(".claude/skills/demo/locked.md");
    // 대조군 — 같은 실행의 다른 번들 밖 파일은 지금처럼 백업하고 지운다(백업 목록에도 오른다)
    expect(first.skillsPruned).toEqual(["demo/other.md"]);
    expect(backupsOf("other.md")).toHaveLength(1);
    expect(first.backups.map((b) => b.path)).toContain(".claude/skills/demo/other.md");

    const second = update();

    expect(second.skillsPruneFailed).toEqual(["demo/locked.md"]);
    expect(backupsOf("locked.md")).toEqual([]);
  });
});
