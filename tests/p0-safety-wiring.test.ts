/**
 * #651/#653 — P0 안전 핫픽스의 **배선** 계약(보조 함수가 아니라 쓰는 자리).
 *
 * - ROLLBACK 줄: renderUpdateSummary 가 인쇄하는 명령이 공백·따옴표 경로에서 셸 안전한가.
 * - 비UTF-8 CLAUDE.md: 덮어쓰는 세 지점(installer · update · uninstall)이 각각 원시 바이트를 보존하는가.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { stripVTControlCharacters } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderUpdateSummary } from "../src/commands/install-render.js";
import { uninstallAction } from "../src/commands/uninstall.js";
import { type InstallReport, runInstall } from "../src/installer.js";
import type { InstallSpec } from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");
const BAD = Buffer.from([0x23, 0x20, 0xff, 0xfe, 0x0a]); // "# \xff\xfe\n" — UTF-8 아님

describe("renderUpdateSummary — ROLLBACK 줄은 셸에서 그대로 실행 가능 (#651)", () => {
  const spec = {
    tracks: ["tooling"],
    options: { withCodexTrust: false },
    cli: ["claude"],
    projectDir: "/x",
  } as InstallSpec;

  it.each([
    ["공백", "my proj"],
    ["작은따옴표", "it's proj"],
    ["50자 넘는 긴 경로", `${"long-segment-".repeat(6)}proj`],
  ])("%s 경로: 인쇄된 명령을 bash 로 실행하면 .claude 가 복원된다", (_n, name) => {
    const root = mkdtempSync(join(tmpdir(), "ah-rb-"));
    try {
      const proj = join(root, name);
      const backup = join(proj, ".claude.backup-1");
      mkdirSync(join(backup, "sub"), { recursive: true });
      mkdirSync(join(proj, ".claude"), { recursive: true });
      const lines: string[] = [];
      renderUpdateSummary((m) => lines.push(m), spec, { backup } as unknown as InstallReport);
      const row = lines.find((l) => l.includes("ROLLBACK"));
      expect(row).toBeDefined();
      const cmd = stripVTControlCharacters(row as string).replace(/^.*?ROLLBACK\s*/, "");
      const r = spawnSync("bash", ["-c", cmd], { cwd: proj, encoding: "utf8" });
      expect(r.status, r.stderr).toBe(0);
      expect(readdirSync(join(proj, ".claude"))).toEqual(["sub"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

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
