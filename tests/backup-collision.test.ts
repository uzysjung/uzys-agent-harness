/**
 * 같은 초에 백업이 두 번 나면 어떻게 되나 — R-3m.
 *
 * 백업 경로는 `<target>.backup-<stamp>` 이고 stamp 는 **초 해상도**다 (`fs-ops.ts` formatStamp).
 * 사용자가 `update` 를 연달아 돌리면 같은 이름이 두 번 나오는데, 그때 세 함수가 서로 다르게
 * 망가져 있었다:
 *
 *   - `copyBackupDir` (update 의 `.claude/` 스냅샷) → 조용히 앞선 백업을 **덮는다**
 *   - `backupFile`    (사용자 편집 파일 보존)      → 조용히 앞선 백업을 **덮는다**
 *   - `backupDir`     (재설치의 `.claude/` 밀어내기) → ENOTEMPTY 로 **죽는다**
 *
 * 덮어쓰기 쪽이 더 나쁘다: 백업은 "사용자가 고친 걸 지키려고" 만드는 건데, 두 번째 실행이
 * 지키려던 원본 대신 **이미 하네스가 덮어쓴 내용**을 백업본 자리에 넣는다. 즉 보호 장치가
 * 있는 채로 사용자 편집분이 사라진다. 크래시는 최소한 눈에 보인다.
 *
 * 그래서 여기서 무는 것은 "두 번째가 실패하지 않는다"가 아니라 **"첫 백업의 내용이 그대로
 * 남아 있다"** 이다.
 */

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
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { backupDir, backupFile, copyBackupDir } from "../src/fs-ops.js";
import { runInstall } from "../src/installer.js";
import type { InstallSpec } from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");
/** 두 백업이 같은 stamp 를 받는 상황 — 실제 sleep 없이 "같은 초"를 고정한다. */
const SAME_SECOND = new Date(Date.UTC(2026, 6, 26, 12, 34, 56));

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ch-backup-collision-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function seedDir(name: string, content: string): string {
  const target = join(dir, name);
  mkdirSync(target, { recursive: true });
  writeFileSync(join(target, "note.md"), content);
  return target;
}

describe("fs-ops — 같은 stamp 로 두 번 백업 (R-3m)", () => {
  it("copyBackupDir: 두 번째 백업이 첫 스냅샷을 덮지 않는다", () => {
    const target = seedDir("payload", "사용자가 고친 내용");

    const first = copyBackupDir(target, SAME_SECOND);
    writeFileSync(join(target, "note.md"), "하네스가 덮어쓴 내용");
    const second = copyBackupDir(target, SAME_SECOND);

    expect(second).not.toBe(first);
    // 이게 깨지면 백업본에 "지키려던 원본" 대신 덮어쓴 내용이 들어 있다 = 보호 실패.
    expect(readFileSync(join(`${first}`, "note.md"), "utf8")).toBe("사용자가 고친 내용");
    expect(readFileSync(join(`${second}`, "note.md"), "utf8")).toBe("하네스가 덮어쓴 내용");
  });

  it("backupDir: 같은 초에 두 번 밀어내도 ENOTEMPTY 로 죽지 않는다", () => {
    const target = seedDir("payload", "1회차");

    const first = backupDir(target, SAME_SECOND);
    seedDir("payload", "2회차");
    const second = backupDir(target, SAME_SECOND);

    expect(second).not.toBe(first);
    expect(existsSync(target)).toBe(false);
    expect(readFileSync(join(`${first}`, "note.md"), "utf8")).toBe("1회차");
    expect(readFileSync(join(`${second}`, "note.md"), "utf8")).toBe("2회차");
  });

  it("backupFile: 두 번째 백업이 첫 백업본을 덮지 않는다", () => {
    const target = join(dir, "settings.json");
    writeFileSync(target, '{"by":"user"}');

    const first = backupFile(target, SAME_SECOND);
    writeFileSync(target, '{"by":"harness"}');
    const second = backupFile(target, SAME_SECOND);

    expect(second).not.toBe(first);
    expect(readFileSync(first, "utf8")).toBe('{"by":"user"}');
    expect(readFileSync(second, "utf8")).toBe('{"by":"harness"}');
  });

  it("EEXIST 가 아닌 오류는 재시도하지 않고 그대로 올린다", () => {
    // 이름 충돌만 재시도 사유다. 원본 부재를 재시도로 삼키면 백업 실패가 조용해진다.
    expect(() => backupFile(join(dir, "absent.json"), SAME_SECOND)).toThrow(/ENOENT/);
  });

  it("같은 초 백업 상한을 넘으면 조용히 덮는 대신 실패한다", () => {
    const target = join(dir, "settings.json");
    writeFileSync(target, "v");
    const base = backupFile(target, SAME_SECOND);
    for (let n = 2; n <= 100; n++) writeFileSync(`${base}-${n}`, "taken");

    expect(() => backupFile(target, SAME_SECOND)).toThrow(/Cannot allocate a backup path/);
  });
});

/**
 * 위 단위 테스트는 헬퍼가 고쳐졌음만 보인다. `update` 가 실제로 그 경로를 타는지는 별개다
 * (한 경로의 증거를 다른 경로에 전용하지 않는다 — no-false-ship).
 */
describe("update — 같은 초에 두 번 돌려도 첫 스냅샷이 살아남는다 (R-3m)", () => {
  let projectDir: string;

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "ch-backup-update-"));
  });

  afterEach(() => {
    vi.useRealTimers();
    rmSync(projectDir, { recursive: true, force: true });
  });

  function spec(): InstallSpec {
    return {
      tracks: ["tooling"],
      options: { withPrune: false, withCodexTrust: false },
      cli: ["claude"],
      projectDir,
    };
  }

  it("두 번째 update 가 첫 update 의 .claude 백업을 덮어쓰지 않는다", () => {
    runInstall({
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: spec(),
      mode: "add",
      runExternal: null,
    });
    // update 가 손대지 않는 사용자 파일 — 백업 스냅샷의 세대를 구분하는 표식으로 쓴다.
    const marker = join(projectDir, ".claude/my-notes.md");
    writeFileSync(marker, "1세대");

    // 실제 sleep 없이 두 실행을 같은 초에 묶는다 (resolveBackupPath 는 new Date() 를 직접 읽는다).
    vi.useFakeTimers();
    vi.setSystemTime(SAME_SECOND);
    const first = runInstall({
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: spec(),
      mode: "update",
      runExternal: null,
    });
    writeFileSync(marker, "2세대");
    const second = runInstall({
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: spec(),
      mode: "update",
      runExternal: null,
    });

    expect(first.backup).not.toBeNull();
    expect(second.backup).not.toBe(first.backup);
    // 덮어쓰기가 나면 여기가 "2세대" — 사용자가 첫 update 직전 상태로 못 돌아간다.
    expect(readFileSync(join(`${first.backup}`, "my-notes.md"), "utf8")).toBe("1세대");
    expect(readFileSync(join(`${second.backup}`, "my-notes.md"), "utf8")).toBe("2세대");
    // 백업이 둘 다 남았는지 — 이름이 겹치면 디렉터리가 하나만 보인다.
    const snapshots = readdirSync(projectDir).filter((f) => f.startsWith(".claude.backup-"));
    expect(snapshots).toHaveLength(2);
  });
});
