/**
 * #651/#653/#561 — P0 안전 핫픽스의 단위 계약.
 *
 * - backupIfLossyUtf8: 비UTF-8 바이트가 섞인 CLAUDE.md 를 문자열 왕복으로 재작성하기 전에
 *   원시 바이트를 옆에 보존한다(변형 후에는 uninstall 로도 원본이 돌아오지 않았다).
 * - lacksRemovalIntent: 터미널 없는 uninstall 가 플래그 없이 전량 제거하던 기본값의 거부 판정.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { lacksRemovalIntent, type UninstallOptions } from "../src/commands/uninstall.js";
import { backupIfLossyUtf8 } from "../src/fs-ops.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ah-p0-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("backupIfLossyUtf8 — 비UTF-8 바이트 보존 (#653)", () => {
  it("정상 UTF-8 파일은 백업하지 않는다", () => {
    const p = join(dir, "CLAUDE.md");
    writeFileSync(p, "# 정상\n", "utf8");
    expect(backupIfLossyUtf8(p)).toBeNull();
    expect(existsSync(`${p}.backup-`)).toBe(false);
  });

  it("비UTF-8 바이트가 섞인 파일은 원시 바이트를 옆에 보존한다", () => {
    const p = join(dir, "CLAUDE.md");
    // eslint-disable-next-line no-control-regex
    writeFileSync(p, Buffer.from([0x23, 0x20, 0xff, 0xfe, 0x0a])); // "# \xff\xfe\n"
    const backup = backupIfLossyUtf8(p);
    expect(backup).toMatch(/\.backup-/);
    expect(readFileSync(backup as string)).toEqual(Buffer.from([0x23, 0x20, 0xff, 0xfe, 0x0a]));
  });

  it("없는 파일은 조용히 넘어간다", () => {
    expect(backupIfLossyUtf8(join(dir, "nope.md"))).toBeNull();
  });
});

describe("lacksRemovalIntent — 비TTY uninstall 거부 판정 (#561)", () => {
  it("플래그가 하나도 없으면 true (거부 대상)", () => {
    expect(lacksRemovalIntent({} as UninstallOptions)).toBe(true);
  });

  it.each([
    ["--yes", { yes: true }],
    ["--dry-run", { dryRun: true }],
    ["--only", { only: "a" }],
    ["--cli", { cli: "codex" }],
  ])("%s 가 있으면 false", (_label, options) => {
    expect(lacksRemovalIntent(options as UninstallOptions)).toBe(false);
  });
});
