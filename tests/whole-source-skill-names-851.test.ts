/**
 * #851 (ADR-112, 사용자 확정 2026-10-19 "소스 전체를 까는 자산(예: jakubkrehel/skills) 기록해줘") — 소스 전체를 까는 global 외부
 * 스킬(`detail.skill` 없음)도 깐 스킬 이름을 기록에 남기고, update · uninstall 이 그 이름으로 옛 update 가 만든 프로젝트 사본을 회수한다.
 *
 * 설치자에게 달라지는 것: `jakubkrehel/skills` 처럼 한 소스에서 여러 스킬을 홈에 깐 경우에도, 옛 update 가 프로젝트 `.claude/skills/<이름>`
 * · `.agents/skills/<이름>` 에 남긴 사본이 다음 update · uninstall 에서 치워진다. 기록에 이름이 없던 옛 설치본은 다음 update 가 이름을
 * 재 채우고 같은 실행에서 치운다. 홈에 있던 설치자 자신의 스킬은 이름에 들지 않는다.
 */

import type { SpawnSyncReturns } from "node:child_process";
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
import { dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type UninstallOptions, uninstallAction } from "../src/commands/uninstall.js";
import {
  type ExternalInstallerDeps,
  refreshExternalSkills,
  runExternalInstall,
} from "../src/external-installer.js";
import {
  hashContent,
  type InstallLog,
  type InstallLogAsset,
  readInstallLog,
  writeInstallLog,
} from "../src/install-log.js";
import { runInstall } from "../src/installer.js";
import { runUpdateMode, type UpdateModeReport } from "../src/update-mode.js";
import { createMockAsset } from "./helpers/mock-asset.js";

const HARNESS_ROOT = resolve(__dirname, "..");
const TEMPLATES = join(HARNESS_ROOT, "templates");

const WHOLE = createMockAsset({
  id: "whole",
  condition: { kind: "any-track", tracks: ["tooling"] },
  method: { kind: "skill", source: "owner/whole" },
});
const SKILL_G = createMockAsset({
  id: "skill-g",
  condition: { kind: "any-track", tracks: ["executive"] },
  method: { kind: "skill", source: "owner/g", skill: "g" },
});
const CATALOG = [WHOLE, SKILL_G];

/** 소스 `owner/whole` 이 담은 스킬 두 개 · 상류 본문. */
const NAMES = ["x", "y"];
const BODY = (n: string): string => `# ${n}\nupstream body\n`;
const NEW_BODY = (n: string): string => `# ${n}\nupstream body v2\n`;
const EDITED = "# x\nupstream body\nmy own line\n";

let projectDir = "";
let home = "";
beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "uzys-851w-proj-"));
  home = mkdtempSync(join(tmpdir(), "uzys-851w-home-"));
  vi.stubEnv("HOME", home);
  vi.stubEnv("CLAUDE_CONFIG_DIR", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(projectDir, { recursive: true, force: true });
  rmSync(home, { recursive: true, force: true });
});

const abs = (rel: string): string => join(projectDir, rel);
const put = (base: string, rel: string, text: string): void => {
  mkdirSync(dirname(join(base, rel)), { recursive: true });
  writeFileSync(join(base, rel), text);
};
const backupsIn = (rel: string): string[] =>
  existsSync(abs(rel)) ? readdirSync(abs(rel)).filter((n) => /\.backup-/.test(n)) : [];
const nonBackupsIn = (rel: string): string[] =>
  existsSync(abs(rel)) ? readdirSync(abs(rel)).filter((n) => !/\.backup-/.test(n)) : [];

const okSpawn = (): SpawnSyncReturns<string> => ({
  pid: 0,
  output: [],
  stdout: "",
  stderr: "",
  status: 0,
  signal: null,
});
type SpawnFn = NonNullable<ExternalInstallerDeps["spawn"]>;

/**
 * `npx skills add <source> --agent … --copy -g` 의 흉내 — `skills@1.5.11` 처럼 까는 스킬 폴더마다 지우고 새로 만든다
 * (`cleanAndCreateDirectory`). `-g` 가 아니면 아무것도 하지 않는다(이 파일의 대상은 global 자산이다).
 */
function fakeTool(body: (n: string) => string = BODY): SpawnFn {
  return vi.fn((_cmd: string, args: ReadonlyArray<string>) => {
    if (args.includes("-g") && args.includes("owner/whole")) {
      const agents = args.flatMap((a, i) => (args[i - 1] === "--agent" ? [a] : []));
      const roots = new Set(
        agents.map((a) => (a === "claude-code" ? ".claude/skills" : ".agents/skills")),
      );
      for (const root of roots) {
        for (const n of NAMES) {
          rmSync(join(home, root, n), { recursive: true, force: true });
          put(home, `${root}/${n}/SKILL.md`, body(n));
        }
      }
    }
    return okSpawn();
  }) as unknown as SpawnFn;
}

/** 외부 자산 없이 실 설치한 뒤 기록을 mixed 이력으로 — log.scope=project · 주어진 자산들. */
function seedLog(assets: InstallLogAsset[]): InstallLog {
  runInstall({
    runExternal: null,
    harnessRoot: HARNESS_ROOT,
    projectDir,
    mode: "add",
    spec: {
      tracks: ["tooling"],
      options: { withCodexTrust: false },
      cli: ["claude", "codex"],
      projectDir,
    },
  });
  const log = readInstallLog(projectDir);
  if (!log) throw new Error("install log missing");
  const next: InstallLog = { ...log, scope: "project", assets };
  writeInstallLog(projectDir, next);
  return next;
}

const wholeEntry = (extra: Partial<InstallLogAsset> = {}): InstallLogAsset => ({
  id: "whole",
  category: "dev",
  method: "skill",
  scope: "global",
  detail: { source: "owner/whole" },
  ...extra,
});

/** 홈의 global 사본(이번 갱신 전 판) + 옛 update 가 프로젝트 두 자리에 만든 사본(Claude 자리의 x 만 설치자가 고쳤다). */
function seedCopies(): void {
  for (const n of NAMES) {
    put(home, `.claude/skills/${n}/SKILL.md`, BODY(n));
    put(home, `.agents/skills/${n}/SKILL.md`, BODY(n));
    put(projectDir, `.agents/skills/${n}/SKILL.md`, BODY(n));
  }
  put(projectDir, ".claude/skills/x/SKILL.md", EDITED);
  put(projectDir, ".claude/skills/y/SKILL.md", BODY("y"));
}

function update(spawn: SpawnFn = fakeTool()): UpdateModeReport {
  return runUpdateMode(projectDir, TEMPLATES, HARNESS_ROOT, {
    refreshSkills: (d) => refreshExternalSkills(d, { spawn, assets: CATALOG, log: () => {} }),
  });
}

function uninstall(options: Omit<UninstallOptions, "projectDir">) {
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
      spawn: () => okSpawn(),
      resolveHarnessRoot: () => HARNESS_ROOT,
    },
  );
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI 색 코드를 벗긴다
  return { ...out, text: out.lines.join("\n").replace(/\x1b\[[0-9;]*m/g, "") };
}

/** 사본 없음 · 고친 파일(x 의 Claude 자리)만 백업 1개(그 내용 그대로) · 홈 사본은 남는다. */
function expectReclaimed(): void {
  expect(nonBackupsIn(".claude/skills/x"), "Claude 자리 x 사본이 남았다").toEqual([]);
  expect(existsSync(abs(".claude/skills/y")), "Claude 자리 y 사본이 남았다").toBe(false);
  for (const n of NAMES) {
    expect(existsSync(abs(`.agents/skills/${n}`)), `공유 자리 ${n} 사본이 남았다`).toBe(false);
  }
  const backups = backupsIn(".claude/skills/x");
  expect(backups).toHaveLength(1);
  expect(readFileSync(abs(`.claude/skills/x/${backups[0]}`), "utf8")).toBe(EDITED);
  for (const n of NAMES) expect(existsSync(join(home, `.claude/skills/${n}/SKILL.md`))).toBe(true);
}

describe("#851 — 소스 전체를 까는 global 자산이 깐 스킬 이름을 잰다", () => {
  it("install --global → 기록에 이번에 깐 이름 · 이미 있던 같은 바이트의 폴더도 든다 · 설치자 자신의 홈 스킬은 들지 않는다", () => {
    put(home, ".claude/skills/x/SKILL.md", BODY("x")); // 앞서 깔려 있던 같은 판
    put(home, ".claude/skills/mine/SKILL.md", "# mine\n"); // 설치자 스킬 — 도구가 건드리지 않는다
    const spawn = fakeTool();
    runInstall({
      // installer 는 cli · scope 도 넘긴다(`runExternalPhase`) — 주입점의 타입이 그 둘을 적지 않을 뿐이다
      runExternal: (ctx, deps) =>
        runExternalInstall(ctx as Parameters<typeof runExternalInstall>[0], {
          ...deps,
          assets: [WHOLE],
          spawn,
        }),
      harnessRoot: HARNESS_ROOT,
      projectDir,
      mode: "add",
      spec: {
        tracks: ["tooling"],
        options: { withCodexTrust: false },
        cli: ["claude", "codex"],
        projectDir,
        scope: "global",
        userOverride: { forceInclude: ["whole"], forceExclude: [] },
      },
    });
    const entry = readInstallLog(projectDir)?.assets.find((a) => a.id === "whole");
    expect(entry?.scope).toBe("global");
    expect(entry?.skills).toEqual(["x", "y"]);
    expect(entry?.files).toBeUndefined();
  });

  it("project 로 깐 소스 전체 자산은 이름을 두지 않는다(그 자리는 files 가 말한다)", () => {
    const spawn = vi.fn(() => {
      put(projectDir, ".claude/skills/x/SKILL.md", BODY("x"));
      return okSpawn();
    }) as unknown as SpawnFn;
    const r = runExternalInstall(
      {
        tracks: ["tooling"],
        options: { withCodexTrust: false },
        cli: ["claude"],
        scope: "project",
        projectDir,
        userOverride: { forceInclude: ["whole"], forceExclude: [] },
      },
      { assets: [WHOLE], spawn, log: () => {}, warn: () => {} },
    );
    expect(r.attempted[0]?.skills).toBeUndefined();
    expect(r.attempted[0]?.files?.created.map((f) => f.path)).toEqual([
      ".claude/skills/x/SKILL.md",
    ]);
  });
});

describe("#851 — 기록된 이름으로 프로젝트 사본을 회수한다", () => {
  it("update → 이름마다 두 자리 사본 없음 · 고친 파일만 백업 1개 · 기록의 이름 그대로", () => {
    seedLog([wholeEntry({ skills: ["x", "y"] })]);
    seedCopies();
    const report = update();
    expectReclaimed();
    expect(report.backups.map((b) => b.path)).toContain(".claude/skills/x/SKILL.md");
    expect(report.globalCopiesReclaimed?.map((r) => r.slot).sort()).toEqual([
      ".agents/skills/x",
      ".agents/skills/y",
      ".claude/skills/x",
      ".claude/skills/y",
    ]);
    expect(readInstallLog(projectDir)?.assets.find((a) => a.id === "whole")?.skills).toEqual([
      "x",
      "y",
    ]);
  });

  it("uninstall → 같은 판정으로 회수 · 화면 줄", () => {
    seedLog([wholeEntry({ skills: ["x", "y"] })]);
    seedCopies();
    const r = uninstall({ yes: true });
    expect(r.code).toBe(0);
    expectReclaimed();
    expect(r.text).toMatch(/removed {2}\.claude\/skills\/y — a project copy of whole/);
    expect(r.text).toMatch(
      /backed up {2}\.claude\/skills\/x\/SKILL\.md — not the same as the global copy/,
    );
  });

  it("기록에 없는 이름의 프로젝트 폴더는 건드리지 않는다", () => {
    seedLog([wholeEntry({ skills: ["x", "y"] })]);
    seedCopies();
    put(projectDir, ".claude/skills/mine/SKILL.md", "# mine\n");
    update();
    uninstall({ yes: true });
    expect(readFileSync(abs(".claude/skills/mine/SKILL.md"), "utf8")).toBe("# mine\n");
  });

  it("손으로 고친 기록의 루트 밖 이름(../)은 따라가지 않는다", () => {
    seedLog([wholeEntry({ skills: ["../../src"] })]);
    put(projectDir, "src/keep.ts", "keep\n");
    uninstall({ yes: true });
    expect(readFileSync(abs("src/keep.ts"), "utf8")).toBe("keep\n");
  });
});

describe("#851 — 이름이 없던 옛 기록은 update 가 이름을 채우고 같은 실행에서 회수한다", () => {
  it("옛 기록 + 사본 → 기록에 이름 · 사본 없음 · 홈이 새 판이라 다른 파일은 백업하고 지운다(무손실)", () => {
    seedLog([wholeEntry()]);
    seedCopies();
    const report = update(fakeTool(NEW_BODY));

    expect(readInstallLog(projectDir)?.assets.find((a) => a.id === "whole")?.skills).toEqual([
      "x",
      "y",
    ]);
    for (const n of NAMES) {
      expect(nonBackupsIn(`.claude/skills/${n}`), `Claude 자리 ${n} 사본이 남았다`).toEqual([]);
      expect(nonBackupsIn(`.agents/skills/${n}`), `공유 자리 ${n} 사본이 남았다`).toEqual([]);
    }
    // 홈은 이미 새 판 — 비교 대상과 달라 파일마다 백업이 남는다. 설치자가 고친 x 의 바이트도 그대로 남는다
    const xBackup = backupsIn(".claude/skills/x");
    expect(xBackup).toHaveLength(1);
    expect(readFileSync(abs(`.claude/skills/x/${xBackup[0]}`), "utf8")).toBe(EDITED);
    expect(backupsIn(".agents/skills/y")).toHaveLength(1);
    expect(report.globalCopiesReclaimed?.length).toBe(4);
    expect(report.backups.map((b) => b.path)).toContain(".agents/skills/y/SKILL.md");
  });

  it("다음 update 는 다시 회수할 것이 없다(앞선 백업은 다시 백업하지 않는다)", () => {
    seedLog([wholeEntry()]);
    seedCopies();
    update(fakeTool(NEW_BODY));
    const second = update(fakeTool(NEW_BODY));
    expect(second.globalCopiesReclaimed).toBeUndefined();
    expect(backupsIn(".claude/skills/x")).toHaveLength(1);
  });
});

describe("#851 — 이름 기록은 project 자산 · detail.skill 자산의 동작을 바꾸지 않는다", () => {
  it("project 자산에 이름이 적혀 있어도 그 자리를 회수하지 않는다", () => {
    seedLog([
      {
        id: "whole",
        category: "dev",
        method: "skill",
        scope: "project",
        detail: { source: "owner/whole" },
        files: [{ path: ".claude/skills/a/SKILL.md", sha256: hashContent("# a\n") }],
        skills: ["x"],
      },
    ]);
    put(projectDir, ".claude/skills/a/SKILL.md", "# a\n");
    put(projectDir, ".claude/skills/x/SKILL.md", BODY("x"));
    put(home, ".claude/skills/x/SKILL.md", BODY("x"));
    const report = update(vi.fn(okSpawn) as unknown as SpawnFn);
    expect(report.globalCopiesReclaimed).toBeUndefined();
    expect(readFileSync(abs(".claude/skills/x/SKILL.md"), "utf8")).toBe(BODY("x"));
    uninstall({ yes: true });
    expect(readFileSync(abs(".claude/skills/x/SKILL.md"), "utf8")).toBe(BODY("x"));
  });

  it("detail.skill 자산은 detail.skill 자리만 본다 — 적힌 이름은 쓰지 않는다", () => {
    seedLog([
      {
        id: "skill-g",
        category: "dev",
        method: "skill",
        scope: "global",
        detail: { source: "owner/g", skill: "g" },
        skills: ["x"],
      },
    ]);
    put(home, ".claude/skills/g/SKILL.md", BODY("g"));
    put(projectDir, ".claude/skills/g/SKILL.md", BODY("g"));
    put(home, ".claude/skills/x/SKILL.md", BODY("x"));
    put(projectDir, ".claude/skills/x/SKILL.md", BODY("x"));
    const report = update(vi.fn(okSpawn) as unknown as SpawnFn);
    expect(report.globalCopiesReclaimed?.map((r) => r.slot)).toEqual([".claude/skills/g"]);
    expect(readFileSync(abs(".claude/skills/x/SKILL.md"), "utf8")).toBe(BODY("x"));
  });
});
