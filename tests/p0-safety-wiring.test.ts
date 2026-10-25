/**
 * #653 — P0 안전 핫픽스의 **배선** 계약(보조 함수가 아니라 쓰는 자리).
 *
 * (#651 의 ROLLBACK 줄은 update 가 `.claude/` 폴더 사본을 뜨지 않게 되면서 사라졌다 — #746.)
 * - 비UTF-8 CLAUDE.md: 덮어쓰는 세 지점(installer · update · uninstall)이 각각 원시 바이트를 보존하는가.
 * - #847 — 공유 파일 몫 걷기(`stripShared`)와 settings.json 은퇴 배선 걷기(`removeRetiredHookRefs`)도 같다.
 */
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ADAPTERS } from "../src/adapters/index.js";
import { uninstallAction } from "../src/commands/uninstall.js";
import { removeRetiredHookRefs } from "../src/hook-ref.js";
import { runInstall } from "../src/installer.js";
import { createOwnedWriter } from "../src/owned-write.js";
import { stripShared, writeShared } from "../src/shared-write.js";

const HARNESS_ROOT = resolve(__dirname, "..");
const BAD = Buffer.from([0x23, 0x20, 0xff, 0xfe, 0x0a]); // "# \xff\xfe\n" — UTF-8 아님

describe("비UTF-8 CLAUDE.md — 덮어쓰는 지점마다 원시 바이트를 보존한다 (#653)", () => {
  let dir = "";
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "ah-lossy-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const install = (mode: "add" | "update" = "add"): void => {
    runInstall({
      harnessRoot: HARNESS_ROOT,
      projectDir: dir,
      spec: {
        tracks: ["tooling"],
        options: { withCodexTrust: false },
        cli: ["claude"],
        projectDir: dir,
      },
      mode,
      runExternal: null,
    });
  };
  const backups = (): string[] => readdirSync(dir).filter((n) => n.startsWith("CLAUDE.md.backup-"));
  const claude = (): string => join(dir, "CLAUDE.md");

  it("install(installer.writeRootClaudeMd): import 를 더하기 전에 백업한다", () => {
    writeFileSync(claude(), BAD);
    install();
    expect(backups()).toHaveLength(1);
    expect(readFileSync(join(dir, backups()[0] as string))).toEqual(BAD);
  });

  it("update(update-mode.upsertRootImport): 관리 블록을 갱신하기 전에 백업한다", () => {
    install();
    // import 가 없는 비UTF-8 본문 — upsert 가 파일을 다시 쓰는 입력.
    writeFileSync(claude(), BAD);
    expect(backups()).toHaveLength(0);
    install("update");
    expect(backups()).toHaveLength(1);
    expect(readFileSync(join(dir, backups()[0] as string))).toEqual(BAD);
  });

  it("uninstall(uninstall.stripRootImport): import 를 걷기 전에 백업한다", () => {
    install();
    const withBad = Buffer.concat([readFileSync(claude()), BAD]);
    writeFileSync(claude(), withBad);
    uninstallAction(
      { projectDir: dir, yes: true },
      {
        log: () => undefined,
        err: () => undefined,
        exit: () => undefined as never,
        resolveHarnessRoot: () => HARNESS_ROOT,
      },
    );
    expect(backups()).toHaveLength(1);
    expect(readFileSync(join(dir, backups()[0] as string))).toEqual(withBad);
  });
});

describe("공유 파일을 문자열 왕복으로 다시 쓰는 걷기도 원시 바이트를 보존한다 (#847)", () => {
  let dir = "";
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "ah-lossy-shared-"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(dir, { recursive: true, force: true });
  });
  const backupsOf = (name: string): string[] =>
    readdirSync(dir).filter((n) => n.startsWith(`${name}.backup-`));

  // 설치자 줄 + 기록된 하네스 몫(.env) — uninstall 의 stripShared 입력
  const stripGitignore = (userLine: Buffer): Buffer => {
    const u = ADAPTERS.lines.upsert("", {
      render: new Map([[".env", "# Secret env\n.env"]]),
      recorded: new Map(),
      excluded: new Set(),
    });
    if (!u.ok) throw new Error("upsert failed");
    const bytes = Buffer.concat([userLine, Buffer.from(u.text)]);
    writeFileSync(join(dir, ".gitignore"), bytes);
    const portions = [...u.portions].map(([key, sha256]) => ({
      path: ".gitignore",
      adapter: "lines" as const,
      key,
      sha256,
    }));
    const r = stripShared({
      projectDir: dir,
      path: ".gitignore",
      portions,
      excluded: [],
      remnant: () => [],
      remnantLine: () => "",
      write: true,
    });
    expect(r.action).toBe("removed");
    return bytes;
  };

  it("stripShared(.gitignore): 몫을 걷기 전에 백업하고, 정상 UTF-8 이면 백업하지 않는다", () => {
    const bytes = stripGitignore(Buffer.from([0x23, 0x20, 0xff, 0x0a])); // "# \xff\n"
    expect(backupsOf(".gitignore")).toHaveLength(1);
    expect(readFileSync(join(dir, backupsOf(".gitignore")[0] as string))).toEqual(bytes);
    rmSync(join(dir, backupsOf(".gitignore")[0] as string));
    stripGitignore(Buffer.from("# mine\n"));
    expect(backupsOf(".gitignore")).toHaveLength(0);
  });

  it("removeRetiredHookRefs(settings.json): 은퇴 배선을 걷기 전에 백업한다 — update · uninstall 이 같은 함수다", () => {
    const claudeDir = join(dir, ".claude");
    const settings = join(dir, "settings.json");
    const ref = "skills/continuous-learning-v2/hooks/observe.sh";
    const handler = { type: "command", command: `bash "$CLAUDE_PROJECT_DIR/.claude/${ref}" pre` };
    const hooks = JSON.stringify({ PreToolUse: [{ matcher: "*", hooks: [handler] }] });
    const json = (model: Buffer): Buffer =>
      Buffer.concat([Buffer.from('{"model":"'), model, Buffer.from(`","hooks":${hooks}}\n`)]);
    const bad = json(Buffer.from([0x78, 0xff])); // "x\xff"
    writeFileSync(settings, bad);
    const opts = { evenIfScriptExists: true };
    expect(removeRetiredHookRefs(settings, claudeDir, [ref], opts)).toEqual([ref]);
    expect(backupsOf("settings.json")).toHaveLength(1);
    expect(readFileSync(join(dir, backupsOf("settings.json")[0] as string))).toEqual(bad);
    rmSync(join(dir, backupsOf("settings.json")[0] as string));
    writeFileSync(settings, json(Buffer.from("x")));
    expect(removeRetiredHookRefs(settings, claudeDir, [ref], opts)).toEqual([ref]);
    expect(backupsOf("settings.json")).toHaveLength(0);
  });
});

describe("공유 파일에 하네스 몫을 더하는·갈아 끼우는 쓰기도 원시 바이트를 보존한다 (#847 AC3)", () => {
  let dir = "";
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "ah-lossy-upsert-"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(dir, { recursive: true, force: true });
  });
  const backups = (): string[] =>
    readdirSync(dir).filter((n) => n.startsWith(".gitignore.backup-"));
  const gitignore = (): string => join(dir, ".gitignore");

  // 설치자 줄 + 기록된 하네스 몫(.env) — 릴리즈가 그 몫의 머리 주석을 바꿨다
  const refresh = (userLine: Buffer): Buffer => {
    const u = ADAPTERS.lines.upsert("", {
      render: new Map([[".env", "# old header\n.env"]]),
      recorded: new Map(),
      excluded: new Set(),
    });
    if (!u.ok) throw new Error("upsert failed");
    const bytes = Buffer.concat([userLine, Buffer.from(u.text)]);
    writeFileSync(gitignore(), bytes);
    const portions = [...u.portions].map(([key, sha256]) => ({
      path: ".gitignore",
      adapter: "lines" as const,
      key,
      sha256,
    }));
    const r = writeShared({
      projectDir: dir,
      path: ".gitignore",
      render: new Map([[".env", "# new header\n.env"]]),
      record: { portions },
      baseline: new Map(),
      writer: createOwnedWriter(dir, new Map()),
      refreshOnly: true,
    });
    expect(r.action).toBe("updated");
    return bytes;
  };

  it("writeShared(update 의 설치자 파일 갱신): 쓰기 전에 백업하고, 정상 UTF-8 이면 백업하지 않는다", () => {
    const bytes = refresh(Buffer.from([0x23, 0x20, 0xff, 0x0a])); // "# \xff\n"
    expect(backups()).toHaveLength(1);
    expect(readFileSync(join(dir, backups()[0] as string))).toEqual(bytes);
    rmSync(join(dir, backups()[0] as string));
    refresh(Buffer.from("# mine\n"));
    expect(backups()).toHaveLength(0);
  });

  it("install-writes sharedWrite(update 가 .gitignore 몫을 되돌린다): 쓰기 전에 백업한다", () => {
    const install = (mode: "add" | "update"): void => {
      runInstall({
        harnessRoot: HARNESS_ROOT,
        projectDir: dir,
        spec: {
          tracks: ["tooling"],
          options: { withCodexTrust: false },
          cli: ["claude"],
          projectDir: dir,
        },
        mode,
        runExternal: null,
      });
    };
    writeFileSync(gitignore(), "node_modules\n"); // 있을 때만 몫을 더한다
    install("add");
    expect(readFileSync(gitignore(), "utf8")).toContain(".env"); // 전제 — 하네스 몫이 기록돼 있다
    // 설치자가 하네스 몫을 지우고 비UTF-8 줄만 남겼다 → update 가 몫을 되돌리며 파일을 다시 쓴다
    const bad = Buffer.from([0x23, 0x20, 0xff, 0x0a]);
    writeFileSync(gitignore(), bad);
    install("update");
    expect(readFileSync(gitignore(), "utf8")).toContain(".env");
    expect(backups()).toHaveLength(1);
    expect(readFileSync(join(dir, backups()[0] as string))).toEqual(bad);
  });
});
