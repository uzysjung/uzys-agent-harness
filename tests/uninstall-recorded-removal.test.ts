/**
 * uninstall 이 **하네스가 넣은 것만, 설치 기록에 적힌 대로** 뺀다 — #573 · #569 · #610 · #676.
 *
 * 무는 것:
 *   #573 외부 스킬 — install 이 도구 호출 전후를 비교해 도구가 놓은 경로만 기록하고, uninstall 은 외부 도구의 제거
 *        명령 대신 그 경로만 지운다. 하네스가 깐 적 없는 사본(호출 전부터 있던 다른 에이전트 자리의 설치자 사본)은 남고,
 *        설치자가 고친 파일은 그 파일 하나를 백업한 뒤 지우고, 프로젝트 밖 링크 너머는 남기고 말한다. 옛 기록(파일 목록
 *        없음)은 지우지 않고 남는 자리를 말한다.
 *   #569 `.mcp.json` · `.gitignore` 는 기록된 하네스 몫만 빠지고(설치자 서버·줄은 바이트 그대로) · 하네스가 만든
 *        `.mcp.json` 은 파일째 사라지고 · 고친 하네스 서버는 남기고 말하고 · `.env.example` 은 "yours now" 로 남는다.
 *   #610 `skills-lock.json` 은 내용을 고치지 않고 남는 것 안내에 나온다.
 *   #676 쓸 수 없는 자리가 있으면 아무것도 지우지 않고 멈추고 · 중간에 멈추면 이미 한 일을 말하고 기록을 남긴다.
 */

import type { SpawnSyncReturns } from "node:child_process";
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
import { dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { uninstallAction } from "../src/commands/uninstall.js";
import { EXTERNAL_ASSETS } from "../src/external-assets.js";
import { runExternalInstall } from "../src/external-installer.js";
import { type InstallLog, readInstallLog } from "../src/install-log.js";
import { runInstall } from "../src/installer.js";
import type { CliBase, CliTargets, InstallSpec, Track } from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");
const found = EXTERNAL_ASSETS.find((a) => a.id === "frontend-design");
if (found === undefined) throw new Error("catalog has no frontend-design");
const FD = found;

let projectDir: string;
let outsideDir: string;

beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "un-recorded-"));
  outsideDir = mkdtempSync(join(tmpdir(), "un-recorded-outside-"));
});

afterEach(() => {
  for (const d of [projectDir, outsideDir]) {
    try {
      chmodSync(d, 0o755);
    } catch {
      /* 이미 없다 */
    }
    rmSync(d, { recursive: true, force: true });
  }
});

function put(rel: string, content: string): void {
  const abs = join(projectDir, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
}

function read(rel: string): string {
  return readFileSync(join(projectDir, rel), "utf8");
}

function ok(): SpawnSyncReturns<string> {
  return { pid: 0, output: [], stdout: "", stderr: "", status: 0, signal: null };
}

/**
 * `npx skills add <src> --skill <name> --agent … --copy` 의 디스크 효과만 흉내 낸다 — claude-code 는 `.claude/skills/`,
 * 그 밖의 에이전트는 공용 `.agents/skills/`. 다시 부르면 같은 내용을 다시 쓴다(실 도구의 `--copy` 재설치와 같다).
 */
function fakeSkillsSpawn(body = "# frontend-design\n") {
  return vi.fn((cmd: string, args: ReadonlyArray<string>, opts: { cwd?: string }) => {
    if (cmd !== "npx" || args[1] !== "add") return ok();
    const cwd = opts.cwd ?? projectDir;
    const name = args[args.indexOf("--skill") + 1] ?? "unknown";
    const agents = args.flatMap((a, i) => (args[i - 1] === "--agent" ? [a] : []));
    const roots = new Set(
      agents.map((a) => (a === "claude-code" ? ".claude/skills" : ".agents/skills")),
    );
    for (const root of roots) {
      const dir = join(cwd, root, name);
      mkdirSync(join(dir, "refs"), { recursive: true });
      writeFileSync(join(dir, "SKILL.md"), body);
      writeFileSync(join(dir, "refs", "typography.md"), "type scale\n");
    }
    return ok();
  });
}

function install(
  cli: CliBase[],
  opts: { tracks?: Track[]; spawn?: ReturnType<typeof fakeSkillsSpawn> | null } = {},
): void {
  const spawn = opts.spawn === undefined ? fakeSkillsSpawn() : opts.spawn;
  runInstall({
    harnessRoot: HARNESS_ROOT,
    projectDir,
    spec: {
      tracks: opts.tracks ?? ["tooling"],
      options: { withCodexTrust: false },
      cli,
      projectDir,
      userOverride: { forceInclude: ["frontend-design"], forceExclude: [] },
    } satisfies InstallSpec,
    mode: "add",
    runExternal:
      spawn === null
        ? null
        : (ctx, deps) =>
            runExternalInstall(
              { ...ctx, cli: cli as CliTargets },
              { ...deps, assets: [FD], spawn },
            ),
  });
}

interface Run {
  out: string;
  code: number | null;
}

function uninstall(
  extra: { dryRun?: boolean; only?: string; cli?: string } = {},
  deps: { moveAside?: (p: string) => string | null; spawn?: ReturnType<typeof vi.fn> } = {},
): Run {
  const lines: string[] = [];
  let code: number | null = null;
  const spawn = deps.spawn ?? vi.fn(() => ok());
  uninstallAction(
    { projectDir, ...extra },
    {
      exit: (c: number) => {
        code ??= c;
        return undefined as never;
      },
      // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI 색 코드를 벗긴다
      log: (l: string) => lines.push(l.replace(/\x1b\[[0-9;]*m/g, "")),
      // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI 색 코드를 벗긴다
      err: (l: string) => lines.push(l.replace(/\x1b\[[0-9;]*m/g, "")),
      spawn: spawn as never,
      resolveHarnessRoot: () => HARNESS_ROOT,
      ...(deps.moveAside ? { moveAside: deps.moveAside } : {}),
    },
  );
  return { out: lines.join("\n"), code };
}

function fdFiles(): string[] {
  const log = readInstallLog(projectDir) as InstallLog;
  return (log.assets.find((a) => a.id === "frontend-design")?.files ?? []).map((f) => f.path);
}

describe("#573 — 외부 스킬은 기록된 경로만 지운다", () => {
  it("install 은 도구가 이번에 놓은 파일만 기록한다 — 호출 전부터 있던 설치자 사본은 기록하지 않는다", () => {
    put(".agents/skills/frontend-design/SKILL.md", "MY OWN COPY\n");
    install(["claude"]);
    expect(fdFiles().sort()).toEqual([
      ".claude/skills/frontend-design/SKILL.md",
      ".claude/skills/frontend-design/refs/typography.md",
    ]);
  });

  it("claude 만 깐 설치의 --only 는 .claude 쪽 사본만 지우고 .agents 의 설치자 사본은 그대로 둔다 (#573 BLOCKER-3)", () => {
    put(".agents/skills/frontend-design/SKILL.md", "MY OWN COPY\n");
    install(["claude"]);
    const spawn = vi.fn(() => ok());

    const run = uninstall({ only: "frontend-design" }, { spawn });

    expect(run.code).toBe(0);
    expect(spawn).not.toHaveBeenCalled(); // 외부 도구의 제거 명령을 부르지 않는다
    expect(existsSync(join(projectDir, ".claude/skills/frontend-design"))).toBe(false);
    expect(read(".agents/skills/frontend-design/SKILL.md")).toBe("MY OWN COPY\n");
    expect(run.out).toContain("remove frontend-design — 2 file(s) on record");
    const log = readInstallLog(projectDir) as InstallLog;
    expect(log.assets.map((a) => a.id)).not.toContain("frontend-design");
  });

  it("전량 uninstall 은 .agents/skills/<id> 를 실제로 지운다 — 옆의 설치자 스킬은 남는다", () => {
    put(".agents/skills/my-skill/SKILL.md", "mine\n");
    install(["claude", "codex"]);
    expect(fdFiles()).toContain(".agents/skills/frontend-design/SKILL.md");

    const run = uninstall();

    expect(run.code).toBe(0);
    expect(existsSync(join(projectDir, ".agents/skills/frontend-design"))).toBe(false);
    expect(read(".agents/skills/my-skill/SKILL.md")).toBe("mine\n");
  });

  it("설치자가 고친 파일은 그 파일 하나만 백업하고 지운다", () => {
    install(["codex"]);
    put(".agents/skills/frontend-design/SKILL.md", "EDITED BY ME\n");

    const run = uninstall({ only: "frontend-design" });

    expect(run.code).toBe(0);
    const left = readdirSync(join(projectDir, ".agents/skills/frontend-design"));
    expect(left).toHaveLength(1);
    expect(left[0]).toMatch(/^SKILL\.md\.backup-\d{8}T\d{6}/);
    expect(read(`.agents/skills/frontend-design/${left[0]}`)).toBe("EDITED BY ME\n");
    expect(run.out).toMatch(
      /backed up \.agents\/skills\/frontend-design\/SKILL\.md → .*changed since install/,
    );
  });

  it("스킬 자리가 프로젝트 밖으로 이어지는 링크면 따라가지 않고 남김 + 경로", () => {
    symlinkSync(outsideDir, join(projectDir, ".agents"), "dir");
    install(["codex"]);
    expect(existsSync(join(outsideDir, "skills/frontend-design/SKILL.md"))).toBe(true);

    const run = uninstall({ only: "frontend-design" });

    expect(existsSync(join(outsideDir, "skills/frontend-design/SKILL.md"))).toBe(true);
    expect(run.out).toContain(
      "left .agents/skills/frontend-design/SKILL.md — link target is outside the project",
    );
  });

  it("다시 깔면 기록이 이어진다 — 앞서 기록한 파일은 남고 새로 놓인 파일이 더해진다", () => {
    install(["claude"]);
    install(["claude", "codex"]);
    expect(fdFiles().sort()).toEqual([
      ".agents/skills/frontend-design/SKILL.md",
      ".agents/skills/frontend-design/refs/typography.md",
      ".claude/skills/frontend-design/SKILL.md",
      ".claude/skills/frontend-design/refs/typography.md",
    ]);
  });

  it("옛 기록(파일 목록 없음)은 지우지 않고 남는 자리를 한 줄로 말한다", () => {
    install(["codex"]);
    const log = readInstallLog(projectDir) as InstallLog;
    writeFileSync(
      join(projectDir, ".uzys-agent-harness/.harness-install.json"),
      JSON.stringify({ ...log, assets: log.assets.map(({ files: _f, ...a }) => a) }),
    );

    const run = uninstall({ only: "frontend-design" });

    expect(existsSync(join(projectDir, ".agents/skills/frontend-design/SKILL.md"))).toBe(true);
    expect(run.out).toContain("not on record");
    expect(run.out).toContain(".agents/skills/frontend-design/");
    expect(run.code).toBe(1); // 지운 것이 없다 — 성공이라 하지 않는다
  });

  it("옛 기록 위에서 다시 깔아도 '모름' 은 '0개' 가 되지 않는다 — 남는 자리를 계속 말한다 (PR #686 리뷰 B1)", () => {
    install(["codex"]);
    const log = readInstallLog(projectDir) as InstallLog;
    writeFileSync(
      join(projectDir, ".uzys-agent-harness/.harness-install.json"),
      JSON.stringify({ ...log, assets: log.assets.map(({ files: _f, ...a }) => a) }),
    );
    install(["codex"]); // 새 판으로 재설치 — 옛 판이 놓은 파일은 호출 전부터 있어 이번 비교에 안 잡힌다

    const asset = readInstallLog(projectDir)?.assets.find((a) => a.id === "frontend-design");
    expect(asset, "대조군: 재설치 뒤에도 자산 기록이 있다").toBeDefined();
    expect(asset?.files).toBeUndefined();
    const run = uninstall({ only: "frontend-design" });
    expect(existsSync(join(projectDir, ".agents/skills/frontend-design/SKILL.md"))).toBe(true);
    expect(run.out).toContain("not on record");
    expect(run.code).toBe(1);
  });

  it("--cli claude 는 .claude 아래 도구 파일 기록을 뺀다 — 디렉터리와 함께 백업으로 갔다", () => {
    install(["claude", "codex"]);
    const run = uninstall({ cli: "claude" });
    expect(run.code).toBe(0);
    expect(fdFiles().sort()).toEqual([
      ".agents/skills/frontend-design/SKILL.md",
      ".agents/skills/frontend-design/refs/typography.md",
    ]);
  });
});

describe("#569 — 루트의 함께 쓰는 파일은 기록된 하네스 몫만 뺀다", () => {
  const MINE_MCP = `${JSON.stringify({ mcpServers: { mine: { command: "node", args: ["mine.js"] } } }, null, 2)}\n`;
  const MINE_GITIGNORE = "node_modules/\n# my secrets\n.env.local\n";

  it("설치자 .mcp.json · .gitignore 는 바이트 그대로 돌아온다", () => {
    put(".mcp.json", MINE_MCP);
    put(".gitignore", MINE_GITIGNORE);
    install(["claude"], { spawn: null });
    expect(JSON.parse(read(".mcp.json")).mcpServers).toHaveProperty("context7");
    expect(read(".gitignore")).toContain(".uzys-agent-harness/");

    const run = uninstall();

    expect(run.code).toBe(0);
    expect(JSON.parse(read(".mcp.json"))).toEqual(JSON.parse(MINE_MCP));
    expect(read(".gitignore")).toBe(MINE_GITIGNORE);
    expect(run.out).toMatch(/\.mcp\.json — removed the harness part: .*context7.*\(yours stays\)/);
    expect(run.out).not.toContain("삭제해도 안전");
  });

  it("하네스가 만든 .mcp.json 은 몫을 걷으면 파일째 사라진다", () => {
    install(["claude"], { spawn: null });
    expect(existsSync(join(projectDir, ".mcp.json"))).toBe(true);

    const preview = uninstall({ dryRun: true });
    expect(preview.out).toContain("○ remove .mcp.json (the harness created it");
    const run = uninstall();

    expect(existsSync(join(projectDir, ".mcp.json"))).toBe(false);
    expect(run.out).toContain(".mcp.json — removed (the harness created it");
  });

  it("고친 하네스 서버는 남기고 말한다", () => {
    put(".mcp.json", MINE_MCP);
    install(["claude"], { spawn: null });
    const cfg = JSON.parse(read(".mcp.json"));
    cfg.mcpServers.github = { command: "my-github" };
    put(".mcp.json", JSON.stringify(cfg, null, 2));

    const run = uninstall();

    const after = JSON.parse(read(".mcp.json")).mcpServers;
    expect(Object.keys(after).sort()).toEqual(["github", "mine"]);
    expect(run.out).toMatch(/\.mcp\.json — kept github: changed since install/);
  });

  it(".env.example 은 지우지 않고 'yours now' 로 말한다", () => {
    install(["claude"], { tracks: ["csr-supabase"], spawn: null });
    expect(existsSync(join(projectDir, ".env.example"))).toBe(true);

    const run = uninstall();

    expect(existsSync(join(projectDir, ".env.example"))).toBe(true);
    expect(run.out).toMatch(/\.env\.example — yours now/);
  });
});

describe("#610 — skills-lock.json 은 고치지 않고 남는 것으로 말한다", () => {
  it("전량 · --only 모두 잔여 안내에 경로를 적고 내용은 그대로 둔다", () => {
    install(["codex"]);
    const lock = `${JSON.stringify({ version: 1, skills: { "frontend-design": {} } })}\n`;
    put("skills-lock.json", lock);

    const only = uninstall({ only: "frontend-design" });
    expect(only.out).toMatch(/skills-lock\.json — written by npx skills/);

    install(["codex"]);
    const all = uninstall();
    expect(all.out).toMatch(/\[ROOT\][\s\S]*skills-lock\.json — written by npx skills/);
    expect(read("skills-lock.json")).toBe(lock);
  });
});

describe("#676 — 지우기 전에 쓸 수 있는지 먼저 본다 · 멈추면 한 일을 말한다", () => {
  const isRoot = typeof process.getuid === "function" && process.getuid() === 0;

  it.skipIf(isRoot)(
    "프로젝트 폴더에 쓸 수 없으면 아무것도 지우지 않는다 — 외부 제거도 하지 않는다",
    () => {
      install(["codex"]);
      const spawn = vi.fn(() => ok());
      chmodSync(projectDir, 0o555);

      const run = uninstall({}, { spawn });

      chmodSync(projectDir, 0o755);
      expect(run.code).toBe(1);
      expect(run.out).toContain("nothing was removed");
      expect(run.out).toContain("the project folder");
      expect(spawn).not.toHaveBeenCalled();
      expect(existsSync(join(projectDir, ".agents/skills/frontend-design/SKILL.md"))).toBe(true);
      expect(existsSync(join(projectDir, ".uzys-agent-harness/.harness-install.json"))).toBe(true);
    },
  );

  it("중간에 멈추면 이미 한 일을 말하고 기록을 남긴다 — 다시 돌리면 나머지가 이어진다", () => {
    install(["claude", "codex"]);
    const failing = (): string | null => {
      throw new Error("EACCES: permission denied, mkdir '.claude.backup-x'");
    };

    const run = uninstall({}, { moveAside: failing });

    expect(run.code).toBe(1);
    expect(run.out).toContain("stopped partway");
    expect(run.out).toMatch(/Already done:[\s\S]*removed frontend-design/);
    expect(existsSync(join(projectDir, ".uzys-agent-harness/.harness-install.json"))).toBe(true);

    const again = uninstall();
    expect(again.code).toBe(0);
    expect(existsSync(join(projectDir, ".uzys-agent-harness"))).toBe(false);
  });
});
