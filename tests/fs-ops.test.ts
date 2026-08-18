import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
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
    copyDir(join(dir, "src"), join(dir, "dst"), () => null);
    expect(readFileSync(join(dir, "dst/a.txt"), "utf8")).toBe("A");
    expect(readFileSync(join(dir, "dst/nested/b.txt"), "utf8")).toBe("B");
  });

  it("copyDir: foreignOf 가 지목한 파일은 건너뛰고 그 자리를 돌려준다 (#343)", () => {
    mkdirSync(join(dir, "s2/sub"), { recursive: true });
    writeFileSync(join(dir, "s2/keep.txt"), "K");
    writeFileSync(join(dir, "s2/sub/x.txt"), "X");
    writeFileSync(join(dir, "s2/sub/y.txt"), "Y");

    const skipped = copyDir(join(dir, "s2"), join(dir, "d2"), (rel) =>
      rel.startsWith("sub/") ? "sub" : null,
    );

    expect(readFileSync(join(dir, "d2/keep.txt"), "utf8")).toBe("K");
    expect(existsSync(join(dir, "d2/sub/x.txt"))).toBe(false);
    // 한 자리가 여러 파일을 가리면 그 자리가 그만큼 담긴다 — 거르는 것은 호출자 몫이다.
    expect(skipped).toEqual(["sub", "sub"]);
  });

  it("copyDir: source 쪽 심볼릭 링크와 빈 디렉터리는 재현되지 않는다 (좁아진 계약)", () => {
    mkdirSync(join(dir, "s3/empty"), { recursive: true });
    writeFileSync(join(dir, "s3/real.txt"), "R");
    symlinkSync(join(dir, "s3/real.txt"), join(dir, "s3/link.txt"));

    copyDir(join(dir, "s3"), join(dir, "d3"), () => null);

    expect(readFileSync(join(dir, "d3/real.txt"), "utf8")).toBe("R");
    // 링크는 **내용으로도 링크로도** 복사되지 않는다 — listFilesRecursive 가 링크를 파일로 세지 않는다.
    expect(existsSync(join(dir, "d3/link.txt"))).toBe(false);
    expect(existsSync(join(dir, "d3/empty"))).toBe(false);
  });

  it("copyDir throws when source missing", () => {
    expect(() => copyDir(join(dir, "missing"), join(dir, "out"), () => null)).toThrow(
      /Source dir not found/,
    );
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
