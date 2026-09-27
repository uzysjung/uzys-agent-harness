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
describe("uninstall — CLI 디렉터리(`.claude/` · `.codex/` · `.opencode/`)는 `<dir>.backup-<time>` 으로 옮겨 둔다", () => {
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
    if (cli.includes("claude")) {
      writeFileSync(join(projectDir, ".claude/settings.local.json"), MINE);
      mkdirSync(join(projectDir, ".claude/commands/mine"), { recursive: true });
      writeFileSync(join(projectDir, ".claude/commands/mine/deploy.md"), "# my command\n");
    }
    // `.codex/config.toml` 은 하네스가 쓰지만 설치자가 MCP 서버를 더하는 파일이다.
    if (cli.includes("codex")) {
      writeFileSync(
        join(projectDir, ".codex/config.toml"),
        `${readFileSync(join(projectDir, ".codex/config.toml"), "utf8")}${MY_MCP}`,
      );
    }
    // `.opencode/` 는 하네스가 더는 쓰지 않는다(ADR-081) — 거기 있는 것은 설치자 것이다.
    if (cli.includes("opencode")) {
      mkdirSync(join(projectDir, ".opencode/command"), { recursive: true });
      writeFileSync(join(projectDir, ".opencode/command/mine.md"), "# my opencode command\n");
    }
  };
  const MY_MCP = '\n[mcp_servers.mine]\ncommand = "my-mcp"\n';

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

  const backups = (dir = ".claude"): string[] =>
    readdirSync(projectDir).filter((n) => n.startsWith(`${dir}.backup-`));

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

  // #533 리뷰 B3 — 같은 이유가 `.codex/` · `.opencode/` 에도 성립한다(코디네이터 결정 2026-09-27).
  it("전량 uninstall — `.codex/` · `.opencode/` 도 옮겨 둔다 · 설치자 MCP · 커맨드가 백업에 남는다", () => {
    install(["claude", "codex", "opencode"]);

    const out = run({});

    expect(out.code).toBe(0);
    for (const dir of [".claude", ".codex", ".opencode"]) {
      expect(existsSync(join(projectDir, dir))).toBe(false);
      expect(backups(dir)).toHaveLength(1);
    }
    const [codexBk = "", opencodeBk = ""] = [backups(".codex")[0], backups(".opencode")[0]];
    expect(readFileSync(join(projectDir, codexBk, "config.toml"), "utf8")).toContain(MY_MCP);
    expect(existsSync(join(projectDir, opencodeBk, "command/mine.md"))).toBe(true);
  });

  it.each([
    ["codex", ".codex", "config.toml"],
    ["opencode", ".opencode", "command/mine.md"],
  ] as const)("uninstall --cli %s — 그 CLI 디렉터리를 옮겨 둔다", (cli, dir, mine) => {
    install(["claude", "codex", "opencode"]);

    const out = run({ cli });

    expect(out.code).toBe(0);
    expect(existsSync(join(projectDir, dir))).toBe(false);
    const [backup = ""] = backups(dir);
    expect(existsSync(join(projectDir, backup, mine))).toBe(true);
    expect(existsSync(join(projectDir, ".claude"))).toBe(true);
  });

  /**
   * `--dry-run` 이 "남긴다"(keep … preserved · strip … 본문 보존 · [ROOT] 자동으로 지우지 않는다)고
   * 말한 것은 실행 뒤에도 **그 자리에** 있어야 한다. 리뷰 B3 전에는 `keep .codex/config.toml (modified —
   * preserved)` 라 예고하고 `.codex/` 를 통째로 지웠다.
   */
  it("--dry-run 이 남긴다고 한 것은 실행 뒤에도 그 자리에 있다", () => {
    install(["claude", "codex", "opencode"]);
    // 하네스 기록 파일을 설치자가 고친다 — 루트(opencode.json · 앵커) · 공유 자리(.agents/skills).
    const edit = (rel: string, tail: string) =>
      writeFileSync(join(projectDir, rel), `${readFileSync(join(projectDir, rel), "utf8")}${tail}`);
    edit("opencode.json", "\n");
    edit("CLAUDE-uzys-harness.md", "\n<!-- my note -->\n");
    const agentsSkill = readdirSync(join(projectDir, ".agents/skills"))[0] ?? "";
    edit(`.agents/skills/${agentsSkill}/SKILL.md`, "\n<!-- my note -->\n");

    const preview = run({ dryRun: true }).lines.join("\n");
    const promised = [
      ...[...preview.matchAll(/○ keep (\S+) \(/g)].map((m) => m[1] ?? ""),
      ...[...preview.matchAll(/○ strip harness sections from (\S+)/g)].map((m) => m[1] ?? ""),
      ...(preview.includes("strip harness @import from CLAUDE.md") ? ["CLAUDE.md"] : []),
      ...[...preview.matchAll(/· (\S+) — (?:하네스가 생성|기존 사용자 파일에 병합)/g)].map(
        (m) => m[1] ?? "",
      ),
    ];
    // 전제 — 약속이 실제로 나왔다(비어 있으면 아래 대조가 헛통과한다).
    expect(promised).toEqual(
      expect.arrayContaining(["opencode.json", "CLAUDE-uzys-harness.md", "CLAUDE.md"]),
    );
    // 옮겨 둘 디렉터리 안의 것을 "그 자리에 남긴다"고 예고하지 않는다.
    expect(promised.filter((p) => /^\.(claude|codex|opencode)\//.test(p))).toEqual([]);
    const before = new Map(promised.map((p) => [p, readFileSync(join(projectDir, p), "utf8")]));

    expect(run({}).code).toBe(0);

    for (const p of promised) expect(existsSync(join(projectDir, p)), p).toBe(true);
    for (const p of ["opencode.json", "CLAUDE-uzys-harness.md"]) {
      expect(readFileSync(join(projectDir, p), "utf8"), p).toBe(before.get(p));
    }
  });
});
