/**
 * 백업 대상이 심볼릭 링크일 때 — R-3m 두 번째 결함.
 *
 * `npx skills add` 는 `.claude/skills/<id>` 를 바깥 저장소로 링크할 수 있고, `.claude` 자체를
 * 공유 dotfiles 로 링크해 쓰는 사용자도 있다. 링크 앞에서 "백업"이 무엇을 뜻하는지는 함수마다
 * 다르고, 그 판단이 곧 사용자가 무엇을 잃느냐를 가른다:
 *
 * | 함수 | 원본이 이후 어떻게 되나 | 그래서 링크를 |
 * |---|---|---|
 * | `backupFile` | 링크를 따라 덮어써진다 | **푼다** — 실체 내용을 떠 놔야 지켜진다 |
 *
 * 그래서 여기서 무는 것은 "죽지 않는다"가 아니라 **"백업을 만든 뒤 원본을 덮어써도 백업 내용이
 * 그대로다"** — 백업의 존재 이유 자체다.
 */

import { lstatSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { backupFile } from "../src/fs-ops.js";

const FIXED = new Date(Date.UTC(2026, 6, 26, 12, 34, 56));

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "ch-backup-symlink-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("backupFile — 링크 파일은 실체 내용으로 뜬다", () => {
  it("백업 후 링크를 통해 덮어써도 백업 내용이 그대로다", () => {
    const real = join(root, "store-settings.json");
    writeFileSync(real, '{"by":"user"}');
    const link = join(root, "settings.json");
    symlinkSync(real, link, "file");

    const backup = backupFile(link, FIXED);
    writeFileSync(link, '{"by":"harness"}'); // 링크를 따라 실체가 바뀐다

    expect(lstatSync(backup).isSymbolicLink()).toBe(false);
    expect(readFileSync(backup, "utf8")).toBe('{"by":"user"}');
  });
});
