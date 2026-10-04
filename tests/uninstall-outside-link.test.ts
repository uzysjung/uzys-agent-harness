import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type UninstallOptions, uninstallAction } from "../src/commands/uninstall.js";
import { hashContent, type InstallLog, installLogPath } from "../src/install-log.js";
import { runInstall } from "../src/installer.js";
import type { CliBase } from "../src/types.js";
import { runInteractiveUninstall, type UninstallPrompts } from "../src/uninstall-interactive.js";

const HARNESS_ROOT = resolve(__dirname, "..");

/**
 * #692 — 설치자가 `.claude` · `.codex` · `.opencode` 를 프로젝트 밖(dotfiles 등)으로 링크해 두었으면 uninstall 은
 * 그 링크를 `<dir>.backup-<ts>` 로 옮기지 않는다. 옮기면 프로젝트에서 링크가 사라져 그 CLI 가 공유 설정을 못 읽는다.
 * 링크도 그 아래도 그대로 두고, 확인 전 화면과 결과 화면이 "남김 + 링크 → 대상" 을 말한다(ADR-098 과 같은 판정).
 */
describe("uninstall — 프로젝트 밖으로 나가는 CLI 폴더 링크는 옮기지 않는다 (#692)", () => {
  let projectDir = "";
  let outsideDir = "";

  const install = (cli: ReadonlyArray<CliBase>): void => {
    runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: { tracks: ["tooling"], options: { withCodexTrust: false }, cli: [...cli], projectDir },
    });
  };

  /** 설치된 폴더를 밖으로 옮기고 그 자리에 링크를 건다 — dotfiles 로 링크해 둔 설치자의 모습. */
  const linkOutside = (dir: string): string => {
    const real = join(outsideDir, dir.slice(1));
    renameSync(join(projectDir, dir), real);
    symlinkSync(real, join(projectDir, dir));
    return realpathSync(real);
  };

  /** 폴더 아래 파일 전부의 내용 — 밖이 그대로인지 대조한다. */
  const snapshot = (root: string): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const e of readdirSync(root, { withFileTypes: true, recursive: true })) {
      if (!e.isFile()) continue;
      const abs = join(e.parentPath, e.name);
      out[abs.slice(root.length)] = readFileSync(abs, "utf8");
    }
    return out;
  };

  const backups = (dir: string): string[] =>
    readdirSync(projectDir).filter((n) => n.startsWith(`${dir}.backup-`));

  const run = (options: Omit<UninstallOptions, "projectDir">) => {
    const out = { lines: [] as string[], code: null as number | null };
    uninstallAction(
      { projectDir, ...options },
      {
        log: (l: string) => out.lines.push(l),
        err: (l: string) => out.lines.push(l),
        exit: (code: number) => {
          out.code ??= code;
          return undefined as never;
        },
        resolveHarnessRoot: () => HARNESS_ROOT,
      },
    );
    return { ...out, text: out.lines.join("\n") };
  };

  const expectLinkKept = (dir: string, target: string): void => {
    expect(lstatSync(join(projectDir, dir)).isSymbolicLink()).toBe(true);
    expect(realpathSync(join(projectDir, dir))).toBe(target);
    expect(backups(dir)).toEqual([]);
  };

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "un-outside-link-"));
    outsideDir = mkdtempSync(join(tmpdir(), "un-outside-link-dotfiles-"));
  });
  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
    rmSync(outsideDir, { recursive: true, force: true });
  });

  it("전량 uninstall — `.codex` 링크가 제자리에 남고 밖 내용은 그대로 · 결과 화면이 남김 + 링크 → 대상을 말한다", () => {
    install(["claude", "codex"]);
    const target = linkOutside(".codex");
    const before = snapshot(target);

    const out = run({ yes: true });

    expect(out.code).toBe(0);
    expectLinkKept(".codex", target);
    expect(snapshot(target)).toEqual(before);
    expect(out.text).toContain(
      `⊘ .codex — left as is: the link points outside the project (.codex → ${target})`,
    );
    // 같은 실행에서 기록이 지워진다 — 링크 아래 남는 하네스 파일을 그 줄이 댄다(리뷰 NOTE-1).
    expect(out.text).toContain(
      "harness files there on record: .codex/config.toml · .codex/hooks/session-start.sh — clean them up by hand",
    );
    // 폴더 줄 하나로 말한다 — 그 아래 파일마다 "kept" 를 다시 늘어놓지 않는다.
    expect(out.text).not.toMatch(/\.codex\/\S* kept/);
    // 일반 폴더는 그대로 옮겨진다.
    expect(backups(".claude")).toHaveLength(1);
  });

  it("--dry-run(전량) — 계획 화면이 같은 줄을 말하고 옮기겠다고 하지 않는다", () => {
    install(["claude", "codex"]);
    const target = linkOutside(".codex");

    const out = run({ dryRun: true });

    expect(out.text).toContain(
      `⊘ .codex — left as is: the link points outside the project (.codex → ${target})`,
    );
    expect(out.text).not.toContain("move .codex/ aside");
    expect(out.text).toContain("move .claude/ aside");
  });

  it.each([
    ["실행", false],
    ["--dry-run", true],
  ] as const)("uninstall --cli codex(%s) — 같은 판정: 링크가 남고 남김 + 링크 → 대상을 말한다", (_l, dryRun) => {
    install(["claude", "codex"]);
    const target = linkOutside(".codex");
    const before = snapshot(target);

    const out = run({ cli: "codex", dryRun });

    expect(out.code).toBe(0);
    expectLinkKept(".codex", target);
    expect(snapshot(target)).toEqual(before);
    expect(out.text).toContain(
      `⊘ .codex — left as is: the link points outside the project (.codex → ${target})`,
    );
    expect(out.text).not.toMatch(/\.codex\/\S* (kept|link target outside)/);
  });

  it("`.claude` 링크도 같다 — 기록된 스킬 파일 · 옛 기록 자리도 밖이면 건드리지 않는다", () => {
    install(["claude"]);
    const target = linkOutside(".claude");
    // 링크 너머에 놓인 하네스 기록 파일 — 파일 단위 회수가 밖을 건너뛰는지 본다.
    mkdirSync(join(target, "skills/sk"), { recursive: true });
    const skill = "# sk\n";
    writeFileSync(join(target, "skills/sk/SKILL.md"), skill);
    // 같은 dotfiles 를 쓰는 다른 프로젝트의 옛 기록 자리(`.claude/.harness-install.json`).
    writeFileSync(join(target, ".harness-install.json"), "{}");
    const log = JSON.parse(readFileSync(installLogPath(projectDir), "utf8")) as InstallLog;
    const sk: InstallLog["assets"][number] = {
      id: "sk",
      category: "dev-tools",
      method: "skill",
      scope: "project",
      detail: { skill: "sk" },
      files: [{ path: ".claude/skills/sk/SKILL.md", sha256: hashContent(skill) }],
    };
    writeFileSync(
      installLogPath(projectDir),
      JSON.stringify({ ...log, assets: [...log.assets, sk] }),
    );
    const before = snapshot(target);

    const out = run({ yes: true });

    expect(out.code).toBe(0);
    expectLinkKept(".claude", target);
    expect(snapshot(target)).toEqual(before);
    expect(out.text).toContain(
      `⊘ .claude — left as is: the link points outside the project (.claude → ${target})`,
    );
    // 정책·번들 스킬 기록(`.claude/` 상대)도 링크 아래 경로로 대고, 많으면 앞 몇 개 + 남은 수로 줄인다.
    expect(out.text).toMatch(
      /harness files there on record: \.claude\/\S+ · \.claude\/\S+ · \.claude\/\S+ \+\d+ more/,
    );
    expect(out.text).toContain(
      "left .claude/skills/sk/SKILL.md — link target is outside the project",
    );
  });

  it("회귀 — 프로젝트 **안**을 가리키는 `.codex` 링크는 지금처럼 옮긴다", () => {
    install(["claude", "codex"]);
    renameSync(join(projectDir, ".codex"), join(projectDir, "shared-codex"));
    symlinkSync("shared-codex", join(projectDir, ".codex"));

    const out = run({ yes: true });

    expect(out.code).toBe(0);
    expect(existsSync(join(projectDir, ".codex"))).toBe(false);
    const [backup] = backups(".codex");
    if (!backup) throw new Error("안을 가리키는 링크가 옮겨지지 않았다");
    expect(readlinkSync(join(projectDir, backup))).toBe("shared-codex");
    expect(out.text).not.toContain("left as is");
  });

  it("확인 전 대화형 화면(전량 · CLI 하나)도 남김 + 링크 → 대상을 말한다", async () => {
    install(["claude", "codex"]);
    const target = linkOutside(".codex");
    const line = `.codex stays — the link points outside the project (.codex → ${target})`;
    const prompts = (over: Partial<UninstallPrompts>): UninstallPrompts => ({
      intro: vi.fn(),
      outro: vi.fn(),
      cancel: vi.fn(),
      selectMode: vi.fn(async () => "all" as const),
      selectCli: vi.fn(async () => "codex" as const),
      selectAssets: vi.fn(async () => [] as string[]),
      confirm: vi.fn(async () => false),
      ...over,
    });
    for (const mode of ["all", "cli"] as const) {
      const confirm = vi.fn(async (_summary: string) => false);
      await runInteractiveUninstall(projectDir, {
        prompts: prompts({ selectMode: vi.fn(async () => mode), confirm }),
        isTty: () => true,
      });
      expect(confirm.mock.calls[0]?.[0]).toContain(line);
    }
  });
});
