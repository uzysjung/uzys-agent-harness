import type { SpawnSyncReturns } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInstallRenderer, renderFinalSummary } from "../src/commands/install-render.js";
import { type ExternalInstallerDeps, runExternalInstall } from "../src/external-installer.js";
import { readInstallLog, writeInstallLog } from "../src/install-log.js";
import type { BaselineReport, InstallReport, ProgressEvent } from "../src/installer.js";
import { runInstall } from "../src/installer.js";
import { outsideProjectTarget } from "../src/outside-project.js";
import { type CliBase, DEFAULT_OPTIONS, type InstallSpec, type Track } from "../src/types.js";
import { createMockAsset } from "./helpers/mock-asset.js";

const HARNESS_ROOT = resolve(__dirname, "..");
const USER = "USER ORIGINAL\n";

/** 폴더 아래 전부(경로 → 바이트) — 밖 폴더가 "바이트 그대로" 인지 한 번에 본다(쓰기 · 지우기 · 새로 만들기 · 백업 모두). */
function tree(dir: string): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (d: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out.set(relative(dir, p), readFileSync(p).toString("base64"));
    }
  };
  walk(dir);
  return out;
}

/**
 * #678 · ADR-098 — install · update 가 링크를 따라 **프로젝트 밖** 실체를 쓰지도 지우지도 않는다. 이슈의 두 재현을 그대로 옮기고
 * ((a) 파일 링크 + antigravity install · (b) 폴더 링크 + update), 리뷰 1회차가 짚은 자리(외부 스킬 · opencode 커맨드 은퇴 ·
 * 화면 범주 줄)와 **가드마다** 그것 없이는 실패하는 경우를 하나씩 둔다.
 */
describe("#678 링크 너머가 프로젝트 밖이면 install · update 가 쓰지 않는다", () => {
  let root: string;
  let projectDir: string;
  let outDir: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "uzys-678-"));
    projectDir = join(root, "proj");
    outDir = join(root, "dotfiles");
    mkdirSync(projectDir, { recursive: true });
    mkdirSync(outDir, { recursive: true });
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  const specOf = (cli: CliBase[], tracks: Track[]): InstallSpec => ({
    tracks,
    options: { withCodexTrust: false },
    cli,
    projectDir,
  });

  const run = (
    cli: CliBase[],
    tracks: Track[],
    mode: "fresh" | "update" = "fresh",
  ): { report: InstallReport; screen: string } => {
    let captured: BaselineReport | undefined;
    const report = runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: specOf(cli, tracks),
      mode,
      onProgress: (e: ProgressEvent) => {
        if (e.type === "baseline-complete") captured = e.baseline;
      },
    });
    if (captured === undefined) throw new Error("baseline-complete 이벤트가 오지 않았다");
    const lines: string[] = [];
    createInstallRenderer((m) => lines.push(m), specOf(cli, tracks), false).callbacks.onProgress?.({
      type: "baseline-complete",
      baseline: captured,
    });
    if (mode === "fresh")
      renderFinalSummary((m) => lines.push(m), specOf(cli, tracks), report, false);
    return { report, screen: lines.join("\n") };
  };

  /** 프로젝트의 `rel` 을 밖 폴더로 옮기고 그 자리에 링크를 건다. 밖 실체 경로를 돌려준다. */
  const moveOut = (rel: string): string => {
    const out = join(outDir, rel.replaceAll("/", "_"));
    renameSync(join(projectDir, rel), out);
    symlinkSync(out, join(projectDir, rel));
    return out;
  };

  /** 프로젝트의 `rel` 을 밖 파일로의 링크로 만든다. */
  const linkOutFile = (rel: string, content: string): string => {
    const out = join(outDir, rel.replaceAll("/", "_"));
    writeFileSync(out, content);
    mkdirSync(dirname(join(projectDir, rel)), { recursive: true });
    rmSync(join(projectDir, rel), { force: true });
    symlinkSync(out, join(projectDir, rel));
    return out;
  };

  const backupsIn = (dir: string): string[] =>
    readdirSync(dir).filter((f) => f.includes(".backup-"));

  it("(a) install: 밖 파일 링크는 바이트 그대로 · 화면이 경로와 대상을 말한다", () => {
    const outFile = linkOutFile(".agents/rules/git-policy.md", USER);

    const { report, screen } = run(["antigravity"], ["base"]);

    expect(readFileSync(outFile, "utf8")).toBe(USER);
    expect(backupsIn(outDir)).toEqual([]);
    expect(report.outsideLinks?.map((o) => o.path)).toContain(".agents/rules/git-policy.md");
    // 같은 폴더의 다른 룰은 프로젝트 안이라 평소대로 깔린다 — 설치 전체를 건너뛰는 회귀를 문다
    expect(existsSync(join(projectDir, ".agents/rules/uzys-harness.md"))).toBe(true);
    expect(screen).toContain(".agents/rules/git-policy.md — left as is");
    expect(screen).toContain(outFile);
  });

  it("install --cli claude: 하네스 파일 · settings.json · 루트 CLAUDE.md · 밖 hooks 폴더 모두 건드리지 않는다", () => {
    const outRule = linkOutFile(".claude/rules/git-policy.md", USER);
    const outSettings = linkOutFile(".claude/settings.json", '{"model":"mine"}\n');
    const outRoot = linkOutFile("CLAUDE.md", "# mine\n");
    const outMcp = linkOutFile(".mcp.json", '{"mcpServers":{"mine":{"command":"x"}}}\n');
    const outIgnore = linkOutFile(".gitignore", "node_modules\n");
    const outHooks = join(outDir, "hooks");
    mkdirSync(outHooks);
    writeFileSync(join(outHooks, "mine.sh"), "echo mine\n");
    chmodSync(join(outHooks, "mine.sh"), 0o644);
    symlinkSync(outHooks, join(projectDir, ".claude/hooks"));

    const { report } = run(["claude"], ["tooling"]);

    expect(readFileSync(outRule, "utf8")).toBe(USER);
    expect(readFileSync(outSettings, "utf8")).toBe('{"model":"mine"}\n');
    expect(readFileSync(outRoot, "utf8")).toBe("# mine\n");
    expect(readFileSync(outMcp, "utf8")).toBe('{"mcpServers":{"mine":{"command":"x"}}}\n');
    expect(readFileSync(outIgnore, "utf8")).toBe("node_modules\n");
    expect(readdirSync(outHooks)).toEqual(["mine.sh"]);
    expect(statSync(join(outHooks, "mine.sh")).mode & 0o777).toBe(0o644);
    expect(backupsIn(outDir)).toEqual([]);
    expect(report.outsideLinks?.map((o) => o.path)).toEqual(
      expect.arrayContaining([".claude/rules/git-policy.md", ".claude/settings.json", "CLAUDE.md"]),
    );
  });

  it("B3: `.claude` 가 밖이면 범주 줄을 세지 않고 NEXT 가 '켜졌다' 고 말하지 않는다", () => {
    mkdirSync(join(outDir, "claude"));
    symlinkSync(join(outDir, "claude"), join(projectDir, ".claude"));

    const { report, screen } = run(["claude"], ["tooling"]);

    expect(tree(join(outDir, "claude")).size).toBe(0);
    expect(report.categories?.rules).toEqual([]);
    expect(report.categories?.skills).toEqual([]);
    expect(screen).not.toMatch(/rules \(\d+\)/);
    expect(screen).not.toMatch(/skills \(\d+\)/);
    expect(screen).not.toContain("now active");
    expect(screen).toContain(".claude/ — left as is");
  });

  it("B3: `.claude/rules` 만 밖이면 rules 줄만 빠지고 나머지는 센다", () => {
    mkdirSync(join(outDir, "rules"));
    mkdirSync(join(projectDir, ".claude"), { recursive: true });
    symlinkSync(join(outDir, "rules"), join(projectDir, ".claude/rules"));

    const { report, screen } = run(["claude"], ["tooling"]);

    expect(report.categories?.rules).toEqual([]);
    expect(report.categories?.skills.length).toBeGreaterThan(0);
    expect(screen).not.toMatch(/rules \(\d+\)/);
    expect(screen).toContain("left outside the project");
  });

  it("codex install: 밖으로 링크된 함께 쓰는 파일(.codex/config.toml)에 몫을 얹지 않는다", () => {
    const out = linkOutFile(".codex/config.toml", 'model = "mine"\n');

    const { report } = run(["codex"], ["tooling"]);

    expect(readFileSync(out, "utf8")).toBe('model = "mine"\n');
    expect(report.outsideLinks?.map((o) => o.path)).toContain(".codex/config.toml");
  });

  it("B2: opencode 옛 커맨드 은퇴가 밖 링크 너머 파일을 지우지도 · 백업하지도 않는다", () => {
    const outCmds = join(outDir, "commands");
    mkdirSync(outCmds);
    writeFileSync(join(outCmds, "audit-harness-fit.md"), "shared cmd\n");
    mkdirSync(join(projectDir, ".opencode"));
    symlinkSync(outCmds, join(projectDir, ".opencode/commands"));
    const before = tree(outCmds);

    const { report } = run(["opencode"], ["tooling"]);

    expect(tree(outCmds)).toEqual(before);
    expect(report.outsideLinks?.map((o) => o.path)).toContain(
      ".opencode/commands/audit-harness-fit.md",
    );
  });

  it("(b) update: 밖 폴더 링크 안의 룰을 덮지도 · 새로 만들지도 · 고아로 지우지도 · 백업하지도 않는다", () => {
    run(["claude"], ["tooling"]);
    const outRules = moveOut(".claude/rules");
    writeFileSync(join(outRules, "git-policy.md"), USER);
    // installNewAssets — 지운 룰을 밖 폴더에 되살리지 않는다
    rmSync(join(outRules, "test-policy.md"));
    // pruneOrphans — 기록에 있는 고아라도 밖이면 지우지 않는다
    writeFileSync(join(outRules, "retired-rule.md"), "old\n");
    const log = readInstallLog(projectDir);
    if (log === null) throw new Error("설치 기록이 없다");
    writeInstallLog(projectDir, {
      ...log,
      policyFiles: [...(log.policyFiles ?? []), { path: "rules/retired-rule.md", sha256: "x" }],
    });
    const recordedSha = () =>
      readInstallLog(projectDir)?.policyFiles?.find((f) => f.path === "rules/git-policy.md")
        ?.sha256;
    const shaBefore = recordedSha();
    expect(shaBefore).toBeDefined();
    const before = tree(outRules);

    const { report, screen } = run(["claude"], ["tooling"], "update");

    expect(tree(outRules)).toEqual(before);
    const outside = report.updateMode?.outsideLinks ?? [];
    expect(outside.map((o) => o.path)).toContain(".claude/rules/git-policy.md");
    expect(outside.every((o) => o.link === ".claude/rules")).toBe(true);
    expect(report.updateMode?.policyBackedUp).toEqual([]);
    // 밖의 설치자 편집을 "하네스가 놓은 판" 으로 기록하지 않는다 — 기록하면 링크를 실파일로 바꾼 뒤 update 가 백업 없이 덮는다
    expect(recordedSha()).toBe(shaBefore);
    expect(screen).toContain(".claude/rules/ — left as is");
    expect(screen).toContain(outRules);
  });

  it("update: 밖 `.claude/skills` 의 스킬을 갱신 · 정리 · 되살리지 않고 기준선도 다시 찍지 않는다", () => {
    run(["claude"], ["tooling"]);
    const outSkills = moveOut(".claude/skills");
    const [edited, removed] = readdirSync(outSkills);
    if (edited === undefined || removed === undefined)
      throw new Error("스킬이 둘 이상 깔려야 한다");
    writeFileSync(join(outSkills, edited, "SKILL.md"), USER); // syncSkills 쓰기
    writeFileSync(join(outSkills, edited, "extra.md"), "mine\n"); // syncSkills 정리
    rmSync(join(outSkills, removed), { recursive: true }); // installNewSkillDirs 되살림
    const recordedSha = () =>
      readInstallLog(projectDir)?.skillFiles?.find((f) => f.path === `${edited}/SKILL.md`)?.sha256;
    const shaBefore = recordedSha();
    expect(shaBefore).toBeDefined();
    const before = tree(outSkills);

    const { report } = run(["claude"], ["tooling"], "update");

    expect(tree(outSkills)).toEqual(before);
    expect(recordedSha()).toBe(shaBefore);
    expect(report.updateMode?.outsideLinks?.length).toBeGreaterThan(0);
  });

  it("update: 밖으로 링크된 앵커 · settings.json 을 건드리지 않는다", () => {
    run(["claude"], ["tooling"]);
    const anchor = linkOutFile("CLAUDE-uzys-harness.md", USER);
    // settings.json — 없는 스크립트를 가리키는 훅(update 가 지우는 대상)
    const settings = linkOutFile(
      ".claude/settings.json",
      `${JSON.stringify({ hooks: { PreToolUse: [{ hooks: [{ type: "command", command: 'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/gone.sh"' }] }] } }, null, 2)}\n`,
    );
    const settingsBefore = readFileSync(settings, "utf8");

    run(["claude"], ["tooling"], "update");

    expect(readFileSync(anchor, "utf8")).toBe(USER);
    expect(readFileSync(settings, "utf8")).toBe(settingsBefore);
  });

  it("update: 앵커는 안에 있고 루트 CLAUDE.md 만 밖이면 import 블록을 얹지 않는다", () => {
    run(["claude"], ["tooling"]);
    const rootMd = linkOutFile("CLAUDE.md", "# mine — no import\n");

    run(["claude"], ["tooling"], "update");

    expect(readFileSync(rootMd, "utf8")).toBe("# mine — no import\n");
  });

  it("프로젝트 안을 가리키는 링크는 지금처럼 따라가 쓴다", () => {
    run(["claude"], ["tooling"]);
    const rules = join(projectDir, ".claude/rules");
    const shared = join(projectDir, "shared-rules");
    renameSync(rules, shared);
    symlinkSync(shared, rules);
    const file = join(shared, "git-policy.md");
    const harness = readFileSync(file, "utf8");
    writeFileSync(file, USER);

    const { report } = run(["claude"], ["tooling"], "update");

    expect(readFileSync(file, "utf8")).toBe(harness);
    expect(report.updateMode?.outsideLinks ?? []).toEqual([]);
  });
});

describe("#678 B1 외부 스킬(`npx skills add`) — 스킬 자리가 밖이면 그 자리로 도구를 부르지 않는다", () => {
  type SpawnFn = NonNullable<ExternalInstallerDeps["spawn"]>;
  type SpawnMock = SpawnFn & { mock: { calls: Array<Parameters<SpawnFn>> } };
  let root: string;
  let projectDir: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "uzys-678-ext-"));
    projectDir = join(root, "proj");
    mkdirSync(join(root, "out"), { recursive: true });
    mkdirSync(projectDir, { recursive: true });
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  const ASSET = createMockAsset({
    id: "fd",
    condition: { kind: "any-track", tracks: ["tooling"] },
    method: { kind: "skill", source: "owner/repo", skill: "fd" },
  });

  const agentsOf = (args: ReadonlyArray<string>): string[] =>
    args.flatMap((a, i) => (a === "--agent" ? [args[i + 1] as string] : []));

  /** 도구 흉내 — 받은 `--agent` 마다 그 자리에 스킬 파일을 놓는다(링크를 따라 쓰는 실제 도구처럼). */
  const fakeTool = (): SpawnMock =>
    vi.fn((cmd: string, args: ReadonlyArray<string>) => {
      if (cmd === "npx") {
        for (const a of agentsOf(args)) {
          const dir = join(
            projectDir,
            a === "claude-code" ? ".claude/skills" : ".agents/skills",
            "fd",
          );
          mkdirSync(dir, { recursive: true });
          writeFileSync(join(dir, "SKILL.md"), "upstream\n");
        }
      }
      const ok: SpawnSyncReturns<string> = {
        pid: 0,
        output: [],
        stdout: "",
        stderr: "",
        status: 0,
        signal: null,
      };
      return ok;
    }) as unknown as SpawnMock;

  const install = (cli: CliBase[], spawn: SpawnFn) =>
    runExternalInstall(
      { tracks: ["tooling"], options: DEFAULT_OPTIONS, cli, projectDir },
      { spawn, assets: [ASSET], log: () => {}, warn: () => {} },
    );

  const npxAgents = (spawn: SpawnMock): string[] =>
    spawn.mock.calls.filter((c) => c[0] === "npx").flatMap((c) => agentsOf(c[1]));

  it("`.claude` 가 밖이고 claude 만 골랐으면 도구를 부르지 않고, 결과가 그 사실과 경로를 말한다", () => {
    symlinkSync(join(root, "out"), join(projectDir, ".claude"));
    const spawn = fakeTool();

    const report = install(["claude"], spawn);

    expect(spawn.mock.calls.filter((c) => c[0] === "npx")).toEqual([]);
    expect(tree(join(root, "out")).size).toBe(0);
    const r = report.attempted[0];
    expect(r?.ok).toBe(false);
    expect(r?.message).toContain("outside the project");
    expect(r?.files).toBeUndefined();
  });

  it("두 CLI 중 한 자리만 밖이면 안쪽 자리로만 부르고, 기록에 밖 파일이 없다", () => {
    mkdirSync(join(projectDir, ".claude"));
    symlinkSync(join(root, "out"), join(projectDir, ".claude/skills"));
    const spawn = fakeTool();

    const report = install(["claude", "codex"], spawn);

    expect(npxAgents(spawn)).toEqual(["codex"]);
    expect(tree(join(root, "out")).size).toBe(0);
    const r = report.attempted[0];
    expect(r?.ok).toBe(true);
    expect(r?.files?.created.map((f) => f.path)).toEqual([".agents/skills/fd/SKILL.md"]);
    expect(r?.outside?.map((o) => o.root)).toEqual([".claude/skills"]);
  });

  it("도구가 그래도 밖 자리에 놓은 파일은 기록하지 않는다(에이전트 미지정 레거시 호출 등)", () => {
    mkdirSync(join(projectDir, ".claude"));
    symlinkSync(join(root, "out"), join(projectDir, ".claude/skills"));
    // 받은 에이전트와 무관하게 두 자리에 다 쓰는 도구
    const spawn = vi.fn((cmd: string) => {
      if (cmd === "npx") {
        for (const r of [".claude/skills", ".agents/skills"]) {
          mkdirSync(join(projectDir, r, "fd"), { recursive: true });
          writeFileSync(join(projectDir, r, "fd", "SKILL.md"), "upstream\n");
        }
      }
      const ok: SpawnSyncReturns<string> = {
        pid: 0,
        output: [],
        stdout: "",
        stderr: "",
        status: 0,
        signal: null,
      };
      return ok;
    }) as unknown as SpawnFn;

    const report = install(["codex"], spawn);

    expect(report.attempted[0]?.files?.created.map((f) => f.path)).toEqual([
      ".agents/skills/fd/SKILL.md",
    ]);
  });
});

describe("outsideProjectTarget — 아직 없는 자리 · 깨진 링크도 실체로 판정한다", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "uzys-678-u-"));
    mkdirSync(join(root, "proj/.claude"), { recursive: true });
    mkdirSync(join(root, "out"), { recursive: true });
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it("밖 폴더 링크 안에 새로 만들 파일은 밖이다 — 링크 자리를 함께 낸다", () => {
    const proj = join(root, "proj");
    symlinkSync(join(root, "out"), join(proj, ".claude/rules"));
    const hit = outsideProjectTarget(proj, join(proj, ".claude/rules/new.md"));
    expect(hit?.path).toBe(".claude/rules/new.md");
    expect(hit?.link).toBe(".claude/rules");
  });

  it("깨진 링크는 링크 문자열을 따라간다 — 쓰기가 그 대상을 만든다", () => {
    const proj = join(root, "proj");
    symlinkSync(join(root, "out/missing.md"), join(proj, ".claude/x.md"));
    expect(outsideProjectTarget(proj, join(proj, ".claude/x.md"))?.link).toBe(".claude/x.md");
  });

  it("링크가 없으면 null", () => {
    const proj = join(root, "proj");
    expect(outsideProjectTarget(proj, join(proj, ".claude/rules/a.md"))).toBeNull();
  });
});
