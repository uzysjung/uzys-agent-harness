import {
  chmodSync,
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
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { executeSpec } from "../src/commands/install.js";
import { createInstallRenderer } from "../src/commands/install-render.js";
import { uninstallAction } from "../src/commands/uninstall.js";
import { listFilesRecursive } from "../src/fs-ops.js";
import { installLogPath, readInstallLog } from "../src/install-log.js";
import { InstallInterruptedError, runInstall } from "../src/installer.js";
import type { InstallSpec } from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");

/**
 * #600 — install 이 도중에 멈춰도(EACCES · ENOTDIR …) 설치자가 하네스 명령으로 정리할 수 있다.
 *
 * 판정 기준: 멈춘 뒤 ⓐ 화면이 이미 쓴 것을 말하고 ⓑ 같은 install 재실행 또는 `uninstall` 이 그때까지 쓴
 * 하네스 몫을 걷으며 ⓒ 설치자 파일은 하나도 잃지 않는다. 전에는 기록이 파이프라인 맨 끝에만 쓰여, 멈추면
 * 파일 46개는 있는데 기록이 없었고 `uninstall` 은 "install log not found … Nothing to uninstall" 로 거절했다.
 */
describe("#600 멈춘 install 은 쓴 것을 기록에 남긴다", () => {
  let projectDir: string;

  const spec = (): InstallSpec => ({
    tracks: ["base"],
    options: { withCodexTrust: false },
    cli: ["claude", "codex"],
    projectDir,
  });
  const install = (): void => {
    runInstall({ runExternal: null, harnessRoot: HARNESS_ROOT, projectDir, spec: spec() });
  };
  /** 멈춘 install 을 돌린다. 판정은 각 테스트가 한다 — 여기서 타입을 단언하면 뒤 단언이 무는지 가려진다. */
  const interrupted = (): InstallInterruptedError => {
    try {
      install();
    } catch (e) {
      return e as InstallInterruptedError;
    }
    throw new Error("픽스처 자기검증 실패 — install 이 멈추지 않았다");
  };
  const uninstall = (): { code: number | null; errors: string[] } => {
    const errors: string[] = [];
    let code: number | null = null;
    uninstallAction(
      { projectDir, yes: true },
      {
        exit: (c: number) => {
          code ??= c;
          return undefined as never;
        },
        log: () => {},
        err: (l: string) => errors.push(l),
        resolveHarnessRoot: () => HARNESS_ROOT,
      },
    );
    return { code, errors };
  };
  const backups = (): string[] => listFilesRecursive(projectDir).filter((p) => /\.backup-/.test(p));

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "interrupted600-"));
  });
  afterEach(() => {
    const cfg = join(projectDir, ".codex/config.toml");
    if (existsSync(cfg)) chmodSync(cfg, 0o644);
    rmSync(projectDir, { recursive: true, force: true });
  });

  // 이슈 재현 그대로: 설치자의 `.codex/config.toml` 을 읽을 수 없다. root 는 권한을 무시하므로 재현이 안 된다.
  describe.skipIf(process.getuid?.() === 0)("읽을 수 없는 .codex/config.toml (이슈 재현)", () => {
    const MINE = "ok = true\n";
    // biome 은 `describe.skipIf` 를 새 범위로 보지 않는다(noDuplicateTestHooks) — 준비를 각 테스트 첫 줄로 둔다
    const unreadableConfig = (): void => {
      mkdirSync(join(projectDir, ".codex"));
      writeFileSync(join(projectDir, ".codex/config.toml"), MINE);
      chmodSync(join(projectDir, ".codex/config.toml"), 0);
    };

    it("멈춘 시점까지 쓴 것이 기록에 있다 — 멈춘 CLI 는 깔린 CLI 로 적지 않는다", () => {
      unreadableConfig();
      const e = interrupted();
      expect(e).toBeInstanceOf(InstallInterruptedError);
      expect(e.message).toMatch(/EACCES/);
      expect(e.record.path).toBe(installLogPath(projectDir));
      expect(e.written).toContain("AGENTS.md");
      expect(e.written.some((p) => p.startsWith(".claude/rules/"))).toBe(true);

      const log = readInstallLog(projectDir);
      expect(log?.spec.clis).toEqual(["claude"]);
      // codex 를 적으면 uninstall 이 하네스가 한 글자도 안 쓴 설치자 `.codex/` 를 통째로 옮긴다
      expect(log?.templates.codexDir).toBeUndefined();
      expect(log?.externalFiles?.map((f) => f.path)).toContain("AGENTS.md");
    });

    it("원인을 고치고 같은 install 을 다시 돌리면 마저 깔린다 — 그 뒤 uninstall 도 앞 실행이 만든 파일까지 걷는다", () => {
      unreadableConfig();
      interrupted();
      chmodSync(join(projectDir, ".codex/config.toml"), 0o644);
      install();
      expect(readInstallLog(projectDir)?.spec.clis).toEqual(["claude", "codex"]);
      expect(backups()).toEqual([]);
      expect(readFileSync(join(projectDir, ".codex/config.toml"), "utf8")).toContain("ok = true");
      // 멈춘 실행이 **만든** `.mcp.json` — 기록이 없으면 재실행은 그것을 설치자 파일로 읽어 몫만 얹고, uninstall 은
      // 몫만 걷은 빈 파일을 남긴다
      expect(uninstall().code).toBe(0);
      expect(existsSync(join(projectDir, ".mcp.json"))).toBe(false);
      // 이번엔 codex 까지 깔린 설치라 지금의 uninstall 은 `.codex/` 를 통째로 옮겨 둔다(#686 의 동작 — 이 이슈 밖).
      // 설치자 줄은 그 백업 안에 산다: 잃지 않았다
      const kept = readdirSync(projectDir)
        .filter((n) => n.startsWith(".codex"))
        .map((d) => readFileSync(join(projectDir, d, "config.toml"), "utf8"));
      expect(kept.some((t) => t.includes(MINE))).toBe(true);
    });

    it("uninstall 이 그때까지 쓴 하네스 몫을 걷고 설치자 파일은 그대로 둔다", () => {
      unreadableConfig();
      interrupted();
      const { code, errors } = uninstall();
      expect(errors.join("\n")).not.toMatch(/install log not found/);
      expect(code).toBe(0);
      for (const p of ["AGENTS.md", "CLAUDE-uzys-harness.md", ".mcp.json", ".claude"]) {
        expect(existsSync(join(projectDir, p)), p).toBe(false);
      }
      chmodSync(join(projectDir, ".codex/config.toml"), 0o644);
      expect(readFileSync(join(projectDir, ".codex/config.toml"), "utf8")).toBe(MINE);
      expect(readdirSync(projectDir).filter((n) => n.startsWith(".codex"))).toEqual([".codex"]);
    });
  });

  // root 와 무관한 트리거 — `.agents/skills` 가 설치자의 파일이다. codex 변환이 `AGENTS.md` · `.codex/config.toml`
  // 을 쓴 **뒤** 스킬 자리에서 멈춘다: 변환 결과가 돌아오지 않으므로 그 두 파일은 쓰는 즉시 적은 저널로만 기록된다.
  describe(".agents/skills 가 파일 (변환 도중)", () => {
    const MINE = "my skills index\n";
    beforeEach(() => {
      mkdirSync(join(projectDir, ".agents"));
      writeFileSync(join(projectDir, ".agents/skills"), MINE);
    });

    it("변환이 멈추기 전에 쓴 파일과 몫도 기록에 있다", () => {
      const e = interrupted();
      expect(e).toBeInstanceOf(InstallInterruptedError);
      expect(e.message).toMatch(/ENOTDIR/);
      const log = readInstallLog(projectDir);
      expect(log?.externalFiles?.map((f) => f.path)).toEqual(
        expect.arrayContaining(["AGENTS.md", ".codex/config.toml"]),
      );
      expect(log?.portions?.some((p) => p.path === ".codex/config.toml")).toBe(true);
      expect(readFileSync(join(projectDir, ".agents/skills"), "utf8")).toBe(MINE);
    });

    it("uninstall 이 변환 도중에 쓴 파일까지 걷고, 설치자 파일은 그대로 둔다", () => {
      interrupted();
      const { code } = uninstall();
      expect(code).toBe(0);
      for (const p of ["AGENTS.md", ".codex/config.toml", ".codex/hooks/session-start.sh"]) {
        expect(existsSync(join(projectDir, p)), p).toBe(false);
      }
      expect(readFileSync(join(projectDir, ".agents/skills"), "utf8")).toBe(MINE);
    });
  });

  it("기록 자리를 쓸 수 없으면 그 사실과 할 일을 말한다", () => {
    writeFileSync(join(projectDir, ".uzys-agent-harness"), "mine\n");
    const e = interrupted();
    expect(e.record.path).toBeNull();
    expect(e.record.error).not.toBeNull();
    expect(readFileSync(join(projectDir, ".uzys-agent-harness"), "utf8")).toBe("mine\n");
  });

  describe("화면", () => {
    const run = (): string[] => {
      const errs: string[] = [];
      executeSpec(spec(), {
        log: () => {},
        err: (l) => errs.push(l),
        exit: () => undefined as never,
        resolveHarnessRoot: () => HARNESS_ROOT,
        runPipeline: (s, root, _mode, cb) =>
          runInstall({
            runExternal: null,
            harnessRoot: root,
            projectDir: s.projectDir,
            spec: s,
            ...(cb?.onProgress ? { onProgress: cb.onProgress } : {}),
          }),
      });
      return errs;
    };

    it("멈추면 이미 깔린 자리 · 기록 위치 · 재실행과 uninstall 을 말한다", () => {
      mkdirSync(join(projectDir, ".agents"));
      writeFileSync(join(projectDir, ".agents/skills"), "x\n");
      const out = run().join("\n");
      expect(out).toMatch(/install failed — ENOTDIR/);
      expect(out).toMatch(
        /Already in place before it stopped — recorded in .*\.harness-install\.json/,
      );
      expect(out).toMatch(/\.claude\/ \(\d+ files\)/);
      expect(out).toMatch(/^ {4}AGENTS\.md$/m);
      expect(out).toMatch(/^ {4}CLAUDE\.md \(harness part\)$/m);
      expect(out).toMatch(/run the same install again/);
      expect(out).toMatch(/agent-harness uninstall/);
    });

    it("멈추기 전에 덮은 설치자 파일의 백업 자리를 말한다 — `.claude/` 쪽과 변환 쪽 모두", () => {
      mkdirSync(join(projectDir, ".claude/rules"), { recursive: true });
      writeFileSync(join(projectDir, ".claude/rules/git-policy.md"), "# my policy\n");
      mkdirSync(join(projectDir, ".codex/hooks"), { recursive: true });
      writeFileSync(join(projectDir, ".codex/hooks/session-start.sh"), "echo mine\n");
      mkdirSync(join(projectDir, ".agents"));
      writeFileSync(join(projectDir, ".agents/skills"), "x\n");
      const out = run().join("\n");
      expect(out).toMatch(/Your files it replaced were backed up first:/);
      expect(out).toMatch(/^ {4}\.claude\/rules\/git-policy\.md\.backup-\S+$/m);
      expect(out).toMatch(/^ {4}\.codex\/hooks\/session-start\.sh\.backup-\S+$/m);
    });

    it("기록을 못 남겼으면 uninstall 이 못 찾는다고 말한다", () => {
      writeFileSync(join(projectDir, ".uzys-agent-harness"), "mine\n");
      const out = run().join("\n");
      expect(out).toMatch(/Could not record them \(.+\) — uninstall will not find them/);
      expect(out).not.toMatch(/agent-harness uninstall/);
    });

    it("다 깔고 기록만 못 남긴 경우도 알린다 (전에는 조용했다)", () => {
      const lines: string[] = [];
      createInstallRenderer((l) => lines.push(l), spec(), false).callbacks.onProgress?.({
        type: "install-log-error",
        message: "EACCES: permission denied",
      });
      expect(lines.join("\n")).toMatch(
        /could not record this install \(EACCES: permission denied\) — uninstall and update will not see it/,
      );
    });
  });
});
