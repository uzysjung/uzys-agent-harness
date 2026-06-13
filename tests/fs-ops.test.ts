import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  backupDir,
  backupFileIfChanged,
  copyDir,
  copyFile,
  ensureProjectSkeleton,
} from "../src/fs-ops.js";

describe("fs-ops", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "ch-fsops-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("copyFile creates parent dirs and copies content", () => {
    writeFileSync(join(dir, "src.txt"), "hello");
    copyFile(join(dir, "src.txt"), join(dir, "out/nested/x.txt"));
    expect(readFileSync(join(dir, "out/nested/x.txt"), "utf8")).toBe("hello");
  });

  it("copyFile throws when source does not exist", () => {
    expect(() => copyFile(join(dir, "no-such.txt"), join(dir, "out.txt"))).toThrow(
      /Source not found/,
    );
  });

  it("copyDir copies recursively (file + nested file)", () => {
    mkdirSync(join(dir, "src/nested"), { recursive: true });
    writeFileSync(join(dir, "src/a.txt"), "A");
    writeFileSync(join(dir, "src/nested/b.txt"), "B");
    copyDir(join(dir, "src"), join(dir, "dst"));
    expect(readFileSync(join(dir, "dst/a.txt"), "utf8")).toBe("A");
    expect(readFileSync(join(dir, "dst/nested/b.txt"), "utf8")).toBe("B");
  });

  it("copyDir throws when source missing", () => {
    expect(() => copyDir(join(dir, "missing"), join(dir, "out"))).toThrow(/Source dir not found/);
  });

  it("backupDir returns null when target missing", () => {
    expect(backupDir(join(dir, "absent"))).toBeNull();
  });

  it("backupDir renames an existing dir to .backup-<stamp>", () => {
    mkdirSync(join(dir, "target"));
    writeFileSync(join(dir, "target/keep.txt"), "k");
    const fixed = new Date(Date.UTC(2026, 4, 25, 12, 34, 56)); // 2026-05-25T12:34:56Z
    const result = backupDir(join(dir, "target"), fixed);
    expect(result).toMatch(/target\.backup-/);
    expect(existsSync(join(dir, "target"))).toBe(false);
    expect(existsSync(`${result}`)).toBe(true);
    expect(readFileSync(join(`${result}`, "keep.txt"), "utf8")).toBe("k");
  });

  // backupFileIfChanged — audit SEC-1/CODE-2: 사용자 settings.json·CLAUDE.md 를 덮어쓰기 전 보존.
  it("backupFileIfChanged returns null when target missing (백업 불필요)", () => {
    expect(backupFileIfChanged(join(dir, "absent.json"), "new")).toBeNull();
  });

  it("backupFileIfChanged returns null when content identical (idempotent 재설치 — 백업 안 함)", () => {
    writeFileSync(join(dir, "settings.json"), "same");
    expect(backupFileIfChanged(join(dir, "settings.json"), "same")).toBeNull();
  });

  it("backupFileIfChanged preserves existing file when content differs (데이터 손실 방지)", () => {
    const target = join(dir, "settings.json");
    writeFileSync(target, '{"hooks":"user-custom"}'); // 사용자가 손수 만든 설정
    const fixed = new Date(Date.UTC(2026, 4, 25, 12, 34, 56));
    const backup = backupFileIfChanged(target, '{"hooks":"template"}', fixed);
    expect(backup).toMatch(/settings\.json\.backup-/);
    // 백업본에 사용자 원본이 보존되어야 한다 (덮어쓰기 자체는 호출자 책임 — 헬퍼는 보존만).
    expect(readFileSync(`${backup}`, "utf8")).toBe('{"hooks":"user-custom"}');
  });

  it("ensureProjectSkeleton creates the expected .claude/ subtree", () => {
    ensureProjectSkeleton(dir);
    for (const sub of [
      ".claude/commands/uzys",
      ".claude/commands/ecc",
      ".claude/rules",
      ".claude/skills",
      ".claude/agents",
      ".claude/hooks",
      "docs/decisions",
    ]) {
      expect(existsSync(join(dir, sub))).toBe(true);
    }
  });
});
