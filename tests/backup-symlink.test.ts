/**
 * 백업 대상이 심볼릭 링크일 때 — R-3m 두 번째 결함.
 *
 * `npx skills add` 는 `.claude/skills/<id>` 를 바깥 저장소로 링크할 수 있고, `.claude` 자체를
 * 공유 dotfiles 로 링크해 쓰는 사용자도 있다. 링크 앞에서 "백업"이 무엇을 뜻하는지는 함수마다
 * 다르고, 그 판단이 곧 사용자가 무엇을 잃느냐를 가른다:
 *
 * | 함수 | 원본이 이후 어떻게 되나 | 그래서 링크를 |
 * |---|---|---|
 * | `copyBackupDir` | 제자리에 남아 계속 덮어써진다 | **최상위는 푼다** — 링크 사본은 원본과 함께 변해 되돌릴 수 없다 |
 * | `copyBackupDir` (안쪽) | — | **링크로 둔다** — 남의 저장소를 복제하지 않는다 |
 * | `backupDir` | 통째로 옮겨진다(rename) | **푼다는 개념이 없다** — 링크째 옮기면 원본이 그대로 보존된다 |
 * | `backupFile` | 링크를 따라 덮어써진다 | **푼다** — 실체 내용을 떠 놔야 지켜진다 |
 *
 * 그래서 여기서 무는 것은 "죽지 않는다"가 아니라 **"백업을 만든 뒤 원본을 덮어써도 백업 내용이
 * 그대로다"** — 백업의 존재 이유 자체다.
 */

import {
  lstatSync,
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
import { backupDir, backupFile, copyBackupDir } from "../src/fs-ops.js";

const FIXED = new Date(Date.UTC(2026, 6, 26, 12, 34, 56));

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "ch-backup-symlink-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("copyBackupDir — target 자체가 심볼릭 링크 (.claude → 공유 dotfiles)", () => {
  it("링크가 아니라 실체 스냅샷을 남긴다 — 원본을 덮어써도 백업이 변하지 않는다", () => {
    const store = join(root, "dotfiles", "claude");
    mkdirSync(join(store, "rules"), { recursive: true });
    writeFileSync(join(store, "rules", "team.md"), "update 직전 내용");
    const claude = join(root, ".claude");
    symlinkSync(store, claude, "dir");

    const backup = copyBackupDir(claude, FIXED);
    // update 는 링크를 통해 원본을 덮어쓴다. 백업이 링크 사본이면 여기서 같이 바뀐다.
    writeFileSync(join(claude, "rules", "team.md"), "하네스가 덮어쓴 내용");

    expect(lstatSync(`${backup}`).isSymbolicLink()).toBe(false);
    expect(readFileSync(join(`${backup}`, "rules", "team.md"), "utf8")).toBe("update 직전 내용");
  });

  it("안쪽 링크(skills/<id> → 바깥 저장소)는 링크인 채로 남는다 — 저장소를 복제하지 않는다", () => {
    const store = join(root, "skill-store", "my-skill");
    mkdirSync(store, { recursive: true });
    writeFileSync(join(store, "SKILL.md"), "저장소 실체");
    const skills = join(root, ".claude", "skills");
    mkdirSync(skills, { recursive: true });
    symlinkSync(store, join(skills, "my-skill"), "dir");

    const backup = copyBackupDir(join(root, ".claude"), FIXED);

    // 실체를 복제해 넣으면 백업이 남의 저장소 사본을 품고, 복원 시 사용자의 링크가 사본으로 바뀐다.
    expect(lstatSync(join(`${backup}`, "skills", "my-skill")).isSymbolicLink()).toBe(true);
    expect(readFileSync(join(`${backup}`, "skills", "my-skill", "SKILL.md"), "utf8")).toBe(
      "저장소 실체",
    );
  });

  it("안쪽에 끊어진 링크가 있어도 백업이 죽지 않는다", () => {
    const skills = join(root, ".claude", "skills");
    mkdirSync(skills, { recursive: true });
    symlinkSync(join(root, "지워진-저장소"), join(skills, "dead"), "dir");

    const backup = copyBackupDir(join(root, ".claude"), FIXED);

    // 링크를 풀려고 들면 여기서 ENOENT 로 죽는다 — 스킬 하나 지웠다고 update 가 멈추면 안 된다.
    expect(lstatSync(join(`${backup}`, "skills", "dead")).isSymbolicLink()).toBe(true);
  });
});

describe("backupDir — 링크는 링크째 옮긴다", () => {
  it("target 이 링크면 백업 자리에 링크가 가고, 가리키던 내용은 건드려지지 않는다", () => {
    const store = join(root, "dotfiles", "claude");
    mkdirSync(store, { recursive: true });
    writeFileSync(join(store, "keep.md"), "사용자 저장소");
    const claude = join(root, ".claude");
    symlinkSync(store, claude, "dir");

    const backup = backupDir(claude, FIXED);

    // 실체를 복사해 버리면 재설치 후 사용자의 링크 구성이 사라진다 — rename 은 그럴 이유가 없다.
    expect(lstatSync(`${backup}`).isSymbolicLink()).toBe(true);
    expect(readFileSync(join(store, "keep.md"), "utf8")).toBe("사용자 저장소");
  });
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
