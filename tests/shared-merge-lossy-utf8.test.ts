/**
 * #878 — install · update 가 설치자 공유 파일(첫 접촉 `AGENTS.md` · `.codex/config.toml` · `opencode.json`)에 하네스 몫을 병합해
 * 다시 쓸 때도 #653 손실 클래스를 지킨다: 문자열 왕복이 비UTF-8 바이트를 U+FFFD 로 영구 치환하기 **전에** 원시 바이트를
 * `<file>.backup-<시각>` 으로 남기고 경고한다. 정상 UTF-8 파일은 백업 0 · 몫이 그대로인 update 는 다시 쓰지 않는다.
 *
 * 쓰는 자리는 CLI 변환 쪽 `shared-write.ts` `writeShared` 의 설치자 파일 분기와 install 쪽 `install-writes.ts` `sharedWrite`
 * 둘이다(#847 의 같은 가드 — `backupIfLossyUtf8`). `.gitignore` 로 본 update 쪽 배선은 `p0-safety-wiring.test.ts` 가 본다 —
 * 여기는 이슈가 지목한 파일을 실제 install · update 로 돈다.
 */

import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";
import { AGENTS_BLOCK } from "../src/agents-md-merge.js";
import { runInstall } from "../src/installer.js";
import type { CliBase } from "../src/types.js";
import { runUpdateMode } from "../src/update-mode.js";

const HARNESS_ROOT = resolve(__dirname, "..");
const FFFD = Buffer.from([0xef, 0xbf, 0xbd]);
const latin1 = (s: string): Buffer => Buffer.from(s, "latin1");

let dir = "";
let warn: MockInstance;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ah-878-"));
  warn = vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  rmSync(dir, { recursive: true, force: true });
});

function put(rel: string, bytes: Buffer): void {
  mkdirSync(dirname(join(dir, rel)), { recursive: true });
  writeFileSync(join(dir, rel), bytes);
}

function backupsOf(rel: string): string[] {
  return readdirSync(dirname(join(dir, rel)))
    .filter((n) => n.startsWith(`${basename(rel)}.backup-`))
    .map((n) => join(dirname(join(dir, rel)), n));
}

function install(cli: CliBase): void {
  runInstall({
    runExternal: null,
    harnessRoot: HARNESS_ROOT,
    projectDir: dir,
    mode: "add",
    spec: { tracks: ["tooling"], options: { withCodexTrust: false }, cli: [cli], projectDir: dir },
  });
}

const update = (): void => {
  runUpdateMode(dir, join(HARNESS_ROOT, "templates"), HARNESS_ROOT);
};

const lossyWarned = (): boolean =>
  warn.mock.calls.some((args) => String(args[0]).includes("not valid UTF-8"));

/** 설치자 파일 — 본문 어딘가에 비UTF-8 바이트(Latin-1 0xFF) 하나. 각 형식이 그대로 읽히는 자리에 둔다. */
const CASES: ReadonlyArray<{ cli: CliBase; rel: string; lossy: Buffer; clean: Buffer }> = [
  {
    cli: "codex",
    rel: "AGENTS.md",
    lossy: latin1("# My project\n\nnotes with \xff latin-1 byte\n"),
    clean: Buffer.from("# My project\n\nnotes — plain UTF-8\n"),
  },
  {
    cli: "codex",
    rel: ".codex/config.toml",
    lossy: latin1('# my \xff comment\nmodel = "o3"\n'),
    clean: Buffer.from('# my comment — UTF-8\nmodel = "o3"\n'),
  },
  {
    cli: "opencode",
    rel: "opencode.json",
    lossy: latin1('{ "theme": "x\xff" }\n'),
    clean: Buffer.from('{ "theme": "x—y" }\n'),
  },
  // install 쪽 쌍둥이(`install-writes.ts` `sharedWrite`) — 같은 가드
  {
    cli: "claude",
    rel: ".gitignore",
    lossy: latin1("# mine \xff\nnode_modules\n"),
    clean: Buffer.from("# mine — UTF-8\nnode_modules\n"),
  },
  {
    cli: "claude",
    rel: ".claude/settings.json",
    lossy: latin1('{ "model": "x\xff" }\n'),
    clean: Buffer.from('{ "model": "x—y" }\n'),
  },
];

describe("#878 install — 첫 접촉 병합 전에 비UTF-8 원시 바이트를 백업한다", () => {
  it.each(CASES)("$cli · $rel", ({ cli, rel, lossy }) => {
    put(rel, lossy);
    install(cli);

    const after = readFileSync(join(dir, rel));
    expect(after.equals(lossy), "전제 — 하네스 몫이 병합돼 파일이 다시 쓰였다").toBe(false);
    expect(after.includes(FFFD), "전제 — 문자열 왕복이 0xFF 를 U+FFFD 로 바꿨다").toBe(true);
    const backups = backupsOf(rel);
    expect(
      backups,
      `${rel} 의 원시 바이트 백업이 없다 — 0xFF 가 되돌릴 길 없이 사라졌다`,
    ).toHaveLength(1);
    expect(readFileSync(backups[0] as string)).toEqual(lossy);
    expect(lossyWarned()).toBe(true);
  });

  it.each(CASES)("정상 UTF-8 이면 백업하지 않는다 — $cli · $rel", ({ cli, rel, clean }) => {
    put(rel, clean);
    install(cli);

    expect(readFileSync(join(dir, rel)).equals(clean), "전제 — 병합했다").toBe(false);
    expect(backupsOf(rel)).toEqual([]);
    expect(lossyWarned()).toBe(false);
  });
});

describe("#878 update — 첫 접촉 AGENTS.md(블록 모델)", () => {
  const blockStart = (text: string): number => text.indexOf(AGENTS_BLOCK.start);

  it("하네스 몫을 되돌리며 다시 쓸 때 비UTF-8 원시 바이트를 백업한다", () => {
    put("AGENTS.md", Buffer.from("# My project\n"));
    install("codex");
    // 설치자가 하네스 블록을 지우고 비UTF-8 줄을 남겼다 → update 가 기록된 블록을 되돌리며 파일을 다시 쓴다
    const bad = latin1("# My project\n\nnotes with \xff latin-1 byte\n");
    put("AGENTS.md", bad);

    update();

    expect(blockStart(readFileSync(join(dir, "AGENTS.md"), "utf8"))).toBeGreaterThan(0);
    const backups = backupsOf("AGENTS.md");
    expect(backups).toHaveLength(1);
    expect(readFileSync(backups[0] as string)).toEqual(bad);
  });

  it("몫이 그대로면 다시 쓰지 않는다 — 비UTF-8 바이트도 백업도 그대로", () => {
    put("AGENTS.md", Buffer.from("# My project\n\nnotes here\n"));
    install("codex");
    // 블록은 손대지 않고 설치자 본문에만 0xFF — 하네스 몫이 바뀌지 않는 update
    const now = readFileSync(join(dir, "AGENTS.md"));
    const bad = Buffer.concat([latin1("# My project \xff\n"), now.subarray(now.indexOf("\n") + 1)]);
    put("AGENTS.md", bad);

    update();

    expect(readFileSync(join(dir, "AGENTS.md"))).toEqual(bad);
    expect(backupsOf("AGENTS.md")).toEqual([]);
  });
});
