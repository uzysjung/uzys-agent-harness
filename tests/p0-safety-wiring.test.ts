/**
 * #653 — P0 안전 핫픽스의 **배선** 계약(보조 함수가 아니라 쓰는 자리).
 *
 * (#651 의 ROLLBACK 줄은 update 가 `.claude/` 폴더 사본을 뜨지 않게 되면서 사라졌다 — #746.)
 * - 비UTF-8 CLAUDE.md: 덮어쓰는 세 지점(installer · update · uninstall)이 각각 원시 바이트를 보존하는가.
 */
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { uninstallAction } from "../src/commands/uninstall.js";
import { runInstall } from "../src/installer.js";

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
