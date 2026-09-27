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
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type UninstallOptions, uninstallAction } from "../src/commands/uninstall.js";
import { runInstall } from "../src/installer.js";
import type { CliBase } from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");

/**
 * 사용자 결정 2026-09-27 — uninstall 은 `.claude/` 를 **지우지 않고 옮겨 둔다**.
 *
 * `.claude/` 는 하네스 전용 디렉터리가 아니다. 설치자가 거기 `settings.local.json` · 직접 만든
 * 커맨드 · `settings.json` 에 더한 권한 줄을 둔다. 전량 `uninstall` 과 `uninstall --cli claude` 가
 * 그 디렉터리를 `rm -rf` 해 설치자 파일이 백업 없이 사라졌다. 위저드 메뉴에 Uninstall 이 올라오면
 * (#533) 더 많은 설치자가 그 경로를 탄다.
 */
describe("uninstall — `.claude/` 는 `.claude.backup-<time>` 으로 옮겨 둔다", () => {
  let projectDir = "";
  const MINE = '{ "permissions": { "allow": ["Bash(make build)"] } }\n';

  const install = (cli: ReadonlyArray<CliBase>): void => {
    runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: {
        tracks: ["tooling"],
        options: { withCodexTrust: false },
        cli: [...cli],
        projectDir,
      },
    });
    // 설치자가 `.claude/` 에 둔 자기 파일 — 하네스 기록에 없다.
    writeFileSync(join(projectDir, ".claude/settings.local.json"), MINE);
    mkdirSync(join(projectDir, ".claude/commands/mine"), { recursive: true });
    writeFileSync(join(projectDir, ".claude/commands/mine/deploy.md"), "# my command\n");
  };

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
    return out;
  };

  const backups = (): string[] =>
    readdirSync(projectDir).filter((n) => n.startsWith(".claude.backup-"));

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "un-claude-bk-"));
  });
  afterEach(() => rmSync(projectDir, { recursive: true, force: true }));

  it("전량 uninstall — `.claude/` 는 사라지고 백업 안에 설치자 파일이 그대로 있다", () => {
    install(["claude"]);

    const out = run({});

    expect(out.code).toBe(0);
    expect(existsSync(join(projectDir, ".claude"))).toBe(false);
    const [backup, ...more] = backups();
    expect(more).toEqual([]);
    if (!backup) throw new Error("`.claude.backup-*` 이 없다 — 설치자 파일이 백업 없이 사라졌다");
    expect(readFileSync(join(projectDir, backup, "settings.local.json"), "utf8")).toBe(MINE);
    expect(existsSync(join(projectDir, backup, "commands/mine/deploy.md"))).toBe(true);
    expect(out.lines.join("\n")).toContain(`moved aside → ${backup}`);
  });

  it("uninstall --cli claude — 같은 규칙 (codex 는 남는다)", () => {
    install(["claude", "codex"]);

    const out = run({ cli: "claude" });

    expect(out.code).toBe(0);
    expect(existsSync(join(projectDir, ".claude"))).toBe(false);
    const [backup] = backups();
    if (!backup) throw new Error("`.claude.backup-*` 이 없다 — 설치자 파일이 백업 없이 사라졌다");
    expect(readFileSync(join(projectDir, backup, "settings.local.json"), "utf8")).toBe(MINE);
    expect(existsSync(join(projectDir, ".codex"))).toBe(true);
    expect(out.lines.join("\n")).toContain(`moved aside → ${backup}`);
  });

  it.each([
    ["전량", {}],
    ["--cli claude", { cli: "claude" }],
  ] as const)("--dry-run(%s) 은 옮기겠다고 말만 하고 아무것도 옮기지 않는다", (_label, extra) => {
    install(["claude", "codex"]);

    const out = run({ ...extra, dryRun: true });

    expect(out.lines.join("\n")).toContain("move .claude/ aside → .claude.backup-<time>");
    expect(existsSync(join(projectDir, ".claude/settings.local.json"))).toBe(true);
    expect(backups()).toEqual([]);
  });
});
