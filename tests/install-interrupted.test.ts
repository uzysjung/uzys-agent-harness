import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
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

  const spec = (over: Partial<InstallSpec> = {}): InstallSpec => ({
    tracks: ["base"],
    options: { withCodexTrust: false },
    cli: ["claude", "codex"],
    projectDir,
    ...over,
  });
  const install = (over: Partial<InstallSpec> = {}): void => {
    runInstall({ runExternal: null, harnessRoot: HARNESS_ROOT, projectDir, spec: spec(over) });
  };
  /** 멈춘 install 을 돌린다. 판정은 각 테스트가 한다 — 여기서 타입을 단언하면 뒤 단언이 무는지 가려진다. */
  const interrupted = (over: Partial<InstallSpec> = {}): InstallInterruptedError => {
    try {
      install(over);
    } catch (e) {
      return e as InstallInterruptedError;
    }
    throw new Error("픽스처 자기검증 실패 — install 이 멈추지 않았다");
  };
  const uninstall = (): { code: number | null; errors: string[]; out: string[] } => {
    const errors: string[] = [];
    const out: string[] = [];
    let code: number | null = null;
    uninstallAction(
      { projectDir, yes: true },
      {
        exit: (c: number) => {
          code ??= c;
          return undefined as never;
        },
        log: (l: string) => out.push(l),
        err: (l: string) => errors.push(l),
        resolveHarnessRoot: () => HARNESS_ROOT,
      },
    );
    return { code, errors, out };
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
    const run = (over: Partial<InstallSpec> = {}): string[] => {
      const errs: string[] = [];
      executeSpec(spec(over), {
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

  // PR #691 리뷰 HIGH-2 — 옛 설치 위에서 멈춘 경우. 이번 실행이 안 다시 쓴 옛 기록 항목이 중단 기록에서 사라지면
  // 앞 설치분이 기록 밖으로 떨어진다(uninstall 이 못 걷는다).
  describe("옛 설치 위에서 멈춘 install", () => {
    it("앞 설치의 기록이 중단 뒤에도 그대로 남고, 화면은 uninstall 이 설치 전체를 뺀다고 말한다", () => {
      install({ cli: ["claude"] });
      const before = readInstallLog(projectDir);
      expect(before?.policyFiles?.length ?? 0).toBeGreaterThan(0);
      mkdirSync(join(projectDir, ".agents"));
      writeFileSync(join(projectDir, ".agents/skills"), "mine\n");
      const e = interrupted({ cli: ["codex"] });
      expect(e).toBeInstanceOf(InstallInterruptedError);
      const after = readInstallLog(projectDir);
      // 이번 실행(codex 만)은 `.claude/` 를 다시 쓰지 않았다 — 남아 있으면 옛 기록에서 이어받은 것이다
      expect(after?.policyFiles).toEqual(before?.policyFiles);
      expect(after?.skillFiles).toEqual(before?.skillFiles);
      expect(after?.templates.claudeDir).toBe(".claude/");
      expect(after?.spec.clis).toEqual(["claude"]);
      expect(after?.externalFiles?.map((f) => f.path)).toEqual(
        expect.arrayContaining([...(before?.externalFiles ?? []).map((f) => f.path), "AGENTS.md"]),
      );
    });

    it("화면: 옛 설치가 있었으면 uninstall 안내가 설치 전체를 뺀다고 분명히 한다", () => {
      install({ cli: ["claude"] });
      mkdirSync(join(projectDir, ".agents"));
      writeFileSync(join(projectDir, ".agents/skills"), "mine\n");
      const errs: string[] = [];
      executeSpec(spec({ cli: ["codex"] }), {
        log: () => {},
        err: (l) => errs.push(l),
        exit: () => undefined as never,
        resolveHarnessRoot: () => HARNESS_ROOT,
        runPipeline: (sp, root) =>
          runInstall({ runExternal: null, harnessRoot: root, projectDir: sp.projectDir, spec: sp }),
      });
      const out = errs.join("\n");
      expect(out).toMatch(
        /remove the whole harness install \(earlier runs included\): agent-harness uninstall/,
      );
      expect(out).not.toMatch(/remove what was written/);
    });
  });

  // PR #691 리뷰 M9 — `.claude/` 에 하네스 파일을 하나도 못 쓰고 멈췄으면 claude 를 깔린 CLI 로 적지 않는다.
  // 적으면 uninstall 이 하네스가 한 파일도 안 쓴 설치자 `.claude/` 를 통째로 옮긴다.
  it("`.claude/` 에 아무것도 못 쓰고 멈추면 claude 를 깔린 CLI 로 적지 않는다", () => {
    // 룰을 전부 빼면 첫 쓰기는 앵커 · 헬퍼(`.claude/` 밖)이고, 그다음 에이전트 자리에서 멈춘다
    mkdirSync(join(projectDir, ".claude/agents/reviewer.md"), { recursive: true });
    writeFileSync(join(projectDir, ".claude/agents/reviewer.md/mine.txt"), "mine\n");
    const rules = [
      "change-management",
      "doc-governance",
      "git-policy",
      "ship-checklist",
      "test-policy",
    ];
    const e = interrupted({
      cli: ["claude"],
      baselineExclude: rules.map((r) => `baseline:rules/${r}`),
    });
    expect(e).toBeInstanceOf(InstallInterruptedError);
    expect(e.written.some((p) => p.startsWith(".uzys-agent-harness/"))).toBe(true);
    const log = readInstallLog(projectDir);
    expect(log?.templates.claudeDir).toBeUndefined();
    expect(log?.spec.clis ?? []).not.toContain("claude");
  });

  // PR #691 리뷰 HIGH-1 — `--with-codex-trust` 로 홈 파일에 넣은 trust 항목도 하네스가 쓴 것이다.
  describe("홈 Codex trust 항목을 넣은 뒤 멈춘 install", () => {
    let home: string;
    let prevHome: string | undefined;
    beforeEach(() => {
      prevHome = process.env.HOME;
      home = mkdtempSync(join(tmpdir(), "interrupted600-home-"));
      process.env.HOME = home;
      // opencode 변환이 codex(trust 등록) 뒤에 돈다 — 그 자리를 디렉터리로 막아 root 와 무관하게 멈춘다
      mkdirSync(join(projectDir, "opencode.json"));
    });
    afterEach(() => {
      if (prevHome === undefined) Reflect.deleteProperty(process.env, "HOME");
      else process.env.HOME = prevHome;
      rmSync(home, { recursive: true, force: true });
    });
    const trustSpec = (): Partial<InstallSpec> => ({
      cli: ["codex", "opencode"],
      options: { withCodexTrust: true },
    });

    it("기록 · 화면 · uninstall 안내에 그 항목이 있고, 재실행 뒤에도 하네스 몫으로 남는다", () => {
      const e = interrupted(trustSpec());
      expect(e).toBeInstanceOf(InstallInterruptedError);
      const configPath = join(home, ".codex/config.toml");
      expect(readFileSync(configPath, "utf8")).toContain(`[projects."${projectDir}"]`);
      expect(readInstallLog(projectDir)?.codexTrust).toEqual({ configPath, projectDir });
      expect(e.written).toContain(`${configPath} (Codex trust entry for this folder)`);

      // 원인을 치우고 다시 돌리면 opt-in 은 "already present" 다 — 기록은 앞 실행의 것을 이어받아야 한다
      rmSync(join(projectDir, "opencode.json"), { recursive: true });
      install(trustSpec());
      expect(readInstallLog(projectDir)?.codexTrust).toEqual({ configPath, projectDir });
      const { out } = uninstall();
      expect(out.join("\n")).toMatch(/Codex trust entry — remove by hand/);
    });

    it("이미 있던 항목은 설치자 몫이다 — 중단 기록에 적지 않는다", () => {
      mkdirSync(join(home, ".codex"));
      writeFileSync(
        join(home, ".codex/config.toml"),
        `[projects."${projectDir}"]\ntrust_level = "trusted"\n`,
      );
      interrupted(trustSpec());
      expect(readInstallLog(projectDir)?.codexTrust).toBeUndefined();
    });
  });

  // PR #691 리뷰 MEDIUM-1 — 백업을 만든 직후 쓰기가 실패하면 원본은 그대로다. "replaced" 라고 하면 거짓이다.
  describe.skipIf(process.getuid?.() === 0)("백업 뒤 쓰기가 실패한 설치자 파일", () => {
    const readOnlyRule = (name: string): void => {
      mkdirSync(join(projectDir, ".claude/rules"), { recursive: true });
      writeFileSync(join(projectDir, `.claude/rules/${name}.md`), "# mine\n");
      chmodSync(join(projectDir, `.claude/rules/${name}.md`), 0o444);
    };
    const screen = (): string => {
      const errs: string[] = [];
      executeSpec(spec({ cli: ["claude"] }), {
        log: () => {},
        err: (l) => errs.push(l),
        exit: () => undefined as never,
        resolveHarnessRoot: () => HARNESS_ROOT,
        runPipeline: (sp, root) =>
          runInstall({ runExternal: null, harnessRoot: root, projectDir: sp.projectDir, spec: sp }),
      });
      return errs.join("\n");
    };

    it("첫 쓰기에서 멈추면 '아무것도 안 깔렸다' 와 함께 원본이 그대로이고 사본이 어디 있는지 말한다", () => {
      readOnlyRule("change-management");
      const out = screen();
      expect(out).toMatch(/Nothing was installed\./);
      expect(out).toMatch(
        /Backed up but not replaced — the original is unchanged:\n {4}\.claude\/rules\/change-management\.md \(copy: \.claude\/rules\/change-management\.md\.backup-\S+\)/,
      );
      expect(readFileSync(join(projectDir, ".claude/rules/change-management.md"), "utf8")).toBe(
        "# mine\n",
      );
    });

    it("중간에서 멈추면 그 파일을 'replaced' 로 말하지 않는다", () => {
      readOnlyRule("git-policy");
      const out = screen();
      expect(out).toMatch(/Already in place before it stopped/);
      expect(out).not.toMatch(/Your files it replaced/);
      expect(out).toMatch(
        / {4}\.claude\/rules\/git-policy\.md \(copy: \.claude\/rules\/git-policy\.md\.backup-\S+\)/,
      );
      expect(readFileSync(join(projectDir, ".claude/rules/git-policy.md"), "utf8")).toBe(
        "# mine\n",
      );
    });
  });

  // main 병합(ADR-098) — 링크 너머가 프로젝트 밖인 자리는 쓰지도 기록하지도 않는다. 멈춘 install 의 저널 · 장부도
  // 같은 규칙이다: 밖이라 건너뛴 쓰기가 중단 기록에 하네스 몫으로 적히면 uninstall 이 남의 프로젝트와 함께 쓰는
  // 자리를 하네스 것으로 다룬다.
  describe("밖 링크 자리를 둔 채 멈춘 install", () => {
    let elsewhere: string;
    beforeEach(() => {
      elsewhere = mkdtempSync(join(tmpdir(), "interrupted600-outside-"));
      mkdirSync(join(elsewhere, "claude"));
      mkdirSync(join(elsewhere, "codex"));
      // `.claude` 폴더째(장부 쪽) · `.codex` 폴더째(변환 저널 쪽) 밖으로 링크하고, 뒤 단계(스킬 자리)에서 멈춘다
      symlinkSync(join(elsewhere, "claude"), join(projectDir, ".claude"));
      symlinkSync(join(elsewhere, "codex"), join(projectDir, ".codex"));
      mkdirSync(join(projectDir, ".agents"));
      writeFileSync(join(projectDir, ".agents/skills"), "mine\n");
    });
    afterEach(() => {
      rmSync(elsewhere, { recursive: true, force: true });
    });

    it("중단 기록 · 화면에 밖 경로가 하나도 없고, 밖에는 아무것도 쓰지 않았다", () => {
      const e = interrupted();
      expect(e).toBeInstanceOf(InstallInterruptedError);
      expect(e.message).toMatch(/ENOTDIR/);
      // 픽스처 자기검증 — 기록이 실제로 남았다(빈 기록이라 0 인 것이 아니다)
      expect(e.record.path).toBe(installLogPath(projectDir));
      const log = readInstallLog(projectDir);
      expect(log?.externalFiles?.map((f) => f.path)).toContain("AGENTS.md");

      const outsidePrefix = (p: string): boolean =>
        p.startsWith(".claude/") || p.startsWith(".codex/");
      const recorded = [
        ...(log?.policyFiles ?? []).map((f) => `.claude/${f.path}`),
        ...(log?.skillFiles ?? []).map((f) => `.claude/skills/${f.path}`),
        ...(log?.externalFiles ?? []).map((f) => f.path),
        ...(log?.portions ?? []).map((p) => p.path),
        ...(log?.rootFiles ?? []).map((f) => f.path),
      ];
      expect(recorded.filter(outsidePrefix)).toEqual([]);
      expect(log?.templates.claudeDir).toBeUndefined();
      expect(log?.templates.codexDir).toBeUndefined();
      expect(e.written.filter(outsidePrefix)).toEqual([]);
      expect(e.backups).toEqual([]);
      expect(listFilesRecursive(elsewhere)).toEqual([]);
    });
  });
});
