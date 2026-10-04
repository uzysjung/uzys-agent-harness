/**
 * 백업 복사기·동일성 판정의 경계 (#594 · #556).
 * - 일반 파일이 아닌 항목(FIFO)에서 멈추지 않는다.
 * - 읽을 수 없는 파일 때문에 실패하면 반쯤 만든 백업을 남기지 않고 원인을 알린다.
 * - 동일성 판정은 바이트·링크까지 본다.
 */
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { copyBackupDir, dirTreesIdentical } from "../src/fs-ops.js";

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "ch-bk-safe-"));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("copyBackupDir 경계", () => {
  it.skipIf(process.platform === "win32")(
    "FIFO 가 있어도 멈추지 않고 일반 파일만 백업한다",
    () => {
      const claude = join(root, ".claude");
      mkdirSync(claude);
      writeFileSync(join(claude, "a.md"), "a");
      execFileSync("mkfifo", [join(claude, "pipe")]);
      const backup = copyBackupDir(claude) as string;
      expect(readdirSync(backup)).toEqual(["a.md"]);
    },
    5000,
  );

  it.skipIf(process.platform === "win32" || process.getuid?.() === 0)(
    "읽을 수 없는 파일로 실패하면 반쯤 만든 백업을 남기지 않고 원인을 알린다",
    () => {
      const claude = join(root, ".claude");
      mkdirSync(claude);
      writeFileSync(join(claude, "a.md"), "a");
      writeFileSync(join(claude, "z-locked.md"), "z");
      chmodSync(join(claude, "z-locked.md"), 0o000);
      expect(() => copyBackupDir(claude)).toThrow(/backup of .*failed.*partial copy removed/);
      expect(readdirSync(root).filter((n) => n.includes(".backup-"))).toEqual([]);
      chmodSync(join(claude, "z-locked.md"), 0o644);
    },
  );
});

describe("dirTreesIdentical — 변경을 놓치지 않는다", () => {
  const pair = (): [string, string] => {
    const a = join(root, "a");
    const b = join(root, "b");
    mkdirSync(a);
    mkdirSync(b);
    return [a, b];
  };

  it("같은 트리는 동일", () => {
    const [a, b] = pair();
    writeFileSync(join(a, "f"), "x");
    writeFileSync(join(b, "f"), "x");
    expect(dirTreesIdentical(a, b)).toBe(true);
  });

  it("잘못된 UTF-8 바이트만 다른 파일도 다르다고 본다", () => {
    const [a, b] = pair();
    writeFileSync(join(a, "f"), Buffer.from([0xff, 0x41]));
    writeFileSync(join(b, "f"), Buffer.from([0xfe, 0x41]));
    expect(dirTreesIdentical(a, b)).toBe(false);
  });

  it("심링크가 사라지거나 다른 곳을 가리키면 다르다고 본다", () => {
    const [a, b] = pair();
    symlinkSync("/one", join(a, "l"));
    symlinkSync("/one", join(b, "l"));
    expect(dirTreesIdentical(a, b)).toBe(true);
    unlinkSync(join(b, "l"));
    symlinkSync("/two", join(b, "l"));
    expect(dirTreesIdentical(a, b)).toBe(false);
    unlinkSync(join(b, "l"));
    expect(dirTreesIdentical(a, b)).toBe(false);
    expect(existsSync(a)).toBe(true);
  });
});
