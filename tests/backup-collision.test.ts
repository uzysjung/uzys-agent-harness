/**
 * 같은 초에 백업이 두 번 나면 어떻게 되나 — R-3m.
 *
 * 백업 경로는 `<target>.backup-<stamp>` 이고 stamp 는 **초 해상도**다 (`fs-ops.ts` formatStamp).
 * 사용자가 `update` 를 연달아 돌리면 같은 이름이 두 번 나오는데, 그때 함수마다 다르게
 * 망가져 있었다(폴더 단위 백업은 #746 에서 update · uninstall 모두 없앴다 — 백업은 파일 단위뿐이다):
 *
 *   - `backupFile`    (사용자 편집 파일 보존)      → 조용히 앞선 백업을 **덮는다**
 *
 * 덮어쓰기 쪽이 더 나쁘다: 백업은 "사용자가 고친 걸 지키려고" 만드는 건데, 두 번째 실행이
 * 지키려던 원본 대신 **이미 하네스가 덮어쓴 내용**을 백업본 자리에 넣는다. 즉 보호 장치가
 * 있는 채로 사용자 편집분이 사라진다. 크래시는 최소한 눈에 보인다.
 *
 * 그래서 여기서 무는 것은 "두 번째가 실패하지 않는다"가 아니라 **"첫 백업의 내용이 그대로
 * 남아 있다"** 이다.
 */

import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { backupFile } from "../src/fs-ops.js";
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

describe("fs-ops — 같은 stamp 로 두 번 백업 (R-3m)", () => {
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
describe("update — 같은 초에 두 번 돌려도 첫 파일 백업이 살아남는다 (R-3m · #746)", () => {
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
      options: { withCodexTrust: false },
      cli: ["claude"],
      projectDir,
    };
  }

  it("고친 룰은 그 파일 하나만 백업된다 — 두 번째 update 가 첫 백업을 덮지 않고, .claude 폴더 사본은 없다", () => {
    runInstall({
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: spec(),
      mode: "add",
      runExternal: null,
    });
    const rule = join(projectDir, ".claude/rules/git-policy.md");
    const shipped = readFileSync(rule, "utf8");
    // update 가 손대지 않는 설치자 파일 — 폴더 사본이 없으니 이 파일은 제자리에서만 산다.
    const mine = join(projectDir, ".claude/settings.local.json");
    writeFileSync(mine, '{"permissions":{"allow":["Bash(ls)"]}}');

    // 실제 sleep 없이 두 실행을 같은 초에 묶는다 (backupFile 은 new Date() 를 직접 읽는다).
    vi.useFakeTimers();
    vi.setSystemTime(SAME_SECOND);
    writeFileSync(rule, "1세대 — 설치자 편집");
    runInstall({
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: spec(),
      mode: "update",
      runExternal: null,
    });
    writeFileSync(rule, "2세대 — 설치자 편집");
    runInstall({
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: spec(),
      mode: "update",
      runExternal: null,
    });

    const rulesDir = join(projectDir, ".claude/rules");
    const backups = readdirSync(rulesDir).filter((f) => f.startsWith("git-policy.md.backup-"));
    // 덮어쓰기가 나면 백업이 하나뿐이거나 둘 다 "2세대" — 첫 편집이 사라진다.
    expect(backups).toHaveLength(2);
    expect(backups.map((b) => readFileSync(join(rulesDir, b), "utf8")).sort()).toEqual([
      "1세대 — 설치자 편집",
      "2세대 — 설치자 편집",
    ]);
    expect(readFileSync(rule, "utf8")).toBe(shipped);
    // #746 — update 는 `.claude/` 를 통째로 복사하지 않는다. 설치자 파일은 제자리 그대로다.
    expect(readdirSync(projectDir).filter((f) => f.startsWith(".claude.backup-"))).toEqual([]);
    expect(readFileSync(mine, "utf8")).toBe('{"permissions":{"allow":["Bash(ls)"]}}');
  });
});
