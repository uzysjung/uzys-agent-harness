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
 * 그 링크 너머를 건드리지 않는다. 링크도 그 아래도 그대로 두고, 확인 전 화면과 결과 화면이 "남김 + 링크 → 대상" 을
 * 말한다(ADR-098 과 같은 판정). #746 뒤로는 CLI 폴더를 통째로 옮기지 않으므로 판정 단위가 "회수할 기록 경로의 실체" 다.
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
    // 일반 폴더는 하네스 파일만 하나씩 회수된다 — 설치자 파일이 없으면 비어 걷힌다(옮기지 않는다, #746)
    expect(backups(".claude")).toEqual([]);
    expect(existsSync(join(projectDir, ".claude"))).toBe(false);
  });

  it("#846 — 설치 뒤 밖으로 옮겨 링크한 루트 CLAUDE.md 는 import 를 걷지 않고 남김 + 대상을 말한다 (실행 · 미리보기 같은 판정)", () => {
    writeFileSync(join(projectDir, "CLAUDE.md"), "# my project\n\nmy own notes\n", "utf8");
    install(["claude"]);
    const target = linkOutside("/CLAUDE.md");
    const before = readFileSync(target, "utf8");
    expect(before).toContain("uzys-harness:import:start"); // 전제: 밖 실체에 하네스 import 가 있다
    const line = `⊘ CLAUDE.md kept — link target is outside the project (${target})`;

    const preview = run({ dryRun: true });
    expect(preview.text).toContain(line);
    expect(preview.text).not.toContain("strip harness @import from CLAUDE.md");

    const out = run({ yes: true });
    expect(out.code).toBe(0);
    expect(readFileSync(target, "utf8")).toBe(before); // 밖 파일은 바이트 그대로
    expect(lstatSync(join(projectDir, "CLAUDE.md")).isSymbolicLink()).toBe(true);
    expect(out.text).toContain(line);
    expect(out.text).not.toContain("harness @import removed");

    // 리뷰 MEDIUM — 같은 실행이 앵커를 지우므로 밖 파일의 import 는 없는 파일을 가리킨다. 손으로 걷을 것을 같은 줄이 말한다
    expect(existsSync(join(projectDir, "CLAUDE-uzys-harness.md"))).toBe(false);
    const said = (text: string) => text.split("\n").find((l) => l.includes(line)) ?? "";
    expect(said(out.text)).toContain(
      "its harness @import block (@CLAUDE-uzys-harness.md) is left in it, pointing at the anchor this uninstall removes — delete that block by hand",
    );
    expect(said(preview.text)).toBe(said(out.text)); // 미리보기도 같은 문구
    expect(out.text.split(line)).toHaveLength(2); // 한 줄로 말한다 — 일반 "kept" 줄과 겹치지 않는다
  });

  it("#846 회귀 — 프로젝트 안 루트 CLAUDE.md 는 지금처럼 import 를 걷는다", () => {
    writeFileSync(join(projectDir, "CLAUDE.md"), "# my project\n\nmy own notes\n", "utf8");
    install(["claude"]);

    const out = run({ yes: true });
    expect(out.text).toContain("CLAUDE.md — harness @import removed");
    expect(readFileSync(join(projectDir, "CLAUDE.md"), "utf8")).toBe(
      "# my project\n\nmy own notes\n",
    );
  });

  it("--dry-run(전량) — 계획 화면이 같은 줄을 말하고 옮기겠다고 하지 않는다", () => {
    install(["claude", "codex"]);
    const target = linkOutside(".codex");

    const out = run({ dryRun: true });

    expect(out.text).toContain(
      `⊘ .codex — left as is: the link points outside the project (.codex → ${target})`,
    );
    expect(out.text).not.toContain("aside");
    expect(out.text).not.toMatch(/○ remove \d+ harness file\(s\) under \.codex\//);
    expect(out.text).toMatch(/○ remove \d+ harness file\(s\) under \.claude\//);
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

  it.each([
    ["실행", false],
    ["--dry-run", true],
  ] as const)("전량 uninstall(%s) — 밖 링크 `.claude` 너머 파일을 '삭제해도 안전'으로 나열하지 않고 남김 + 링크 → 대상을 말한다 (#694 · #746)", (_l, dryRun) => {
    install(["claude"]);
    const target = linkOutside(".claude");
    const before = snapshot(target);

    const out = run({ yes: true, dryRun });

    expect(out.code).toBe(0);
    expectLinkKept(".claude", target);
    expect(snapshot(target)).toEqual(before);
    expect(out.text).toContain(
      `.claude — left as is: the link points outside the project (.claude → ${target})`,
    );
    // 밖 파일 어느 것도 "삭제해도 안전" 줄로 나오지 않는다 — 공유 dotfiles 면 다른 프로젝트의 설정이다.
    expect(out.text).not.toMatch(
      /\.claude\/\S* — 하네스가 생성 \(수정한 적 없으면 삭제해도 안전\)/,
    );
    // 밖이라 지우지 않는 것을 "설치자 파일이 남는다" 로 다시 세지 않는다
    expect(out.text).not.toContain("left  .claude/");
  });

  it("회귀 — 프로젝트 **안**을 가리키는 `.codex` 링크는 따라가 파일 단위로 회수하고 링크는 남는다 (#746)", () => {
    install(["claude", "codex"]);
    renameSync(join(projectDir, ".codex"), join(projectDir, "shared-codex"));
    symlinkSync("shared-codex", join(projectDir, ".codex"));

    const out = run({ yes: true });

    expect(out.code).toBe(0);
    expect(lstatSync(join(projectDir, ".codex")).isSymbolicLink()).toBe(true);
    expect(readlinkSync(join(projectDir, ".codex"))).toBe("shared-codex");
    // 하네스가 쓴 것(config.toml · hooks/)은 실체에서 회수됐다
    expect(readdirSync(join(projectDir, "shared-codex"))).toEqual([]);
    expect(backups(".codex")).toEqual([]);
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
      selectTrack: vi.fn(async () => null),
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
