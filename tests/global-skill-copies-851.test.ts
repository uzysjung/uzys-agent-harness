/**
 * #851 AC3 (ADR-112) — 옛 update 가 프로젝트에 만든 global 외부 스킬 사본을 update · uninstall 이 회수한다.
 *
 * 설치자에게 달라지는 것: v26.174.0 이하의 update 가 global 로 깐 외부 스킬을 `-g` 없이 다시 받아 프로젝트 `.claude/skills/<id>` ·
 * `.agents/skills/<id>` 에 기록 밖 사본을 만들었다 — 이제 다음 update · uninstall 이 그 사본을 치운다. 홈의 global 사본과 같은
 * 파일은 그냥 지우고, 다른 파일(설치자 손이 닿았을 수 있다)은 그 파일 하나를 `<file>.backup-<time>` 으로 남긴다. 기록(global)은
 * 그대로다 — 홈 사본은 건드리지 않는다.
 */

import type { SpawnSyncReturns } from "node:child_process";
import {
  existsSync,
  lstatSync,
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
import { createInstallRenderer } from "../src/commands/install-render.js";
import { type UninstallOptions, uninstallAction } from "../src/commands/uninstall.js";
import {
  type ExternalInstallerDeps,
  reclaimGlobalSkillCopies,
  refreshExternalSkills,
} from "../src/external-installer.js";
import {
  hashContent,
  type InstallLog,
  readInstallLog,
  writeInstallLog,
} from "../src/install-log.js";
import { type BaselineReport, runInstall } from "../src/installer.js";
import type { InstallSpec } from "../src/types.js";
import { runUpdateMode, type UpdateModeReport } from "../src/update-mode.js";
import { createMockAsset } from "./helpers/mock-asset.js";

const HARNESS_ROOT = resolve(__dirname, "..");
const TEMPLATES = join(HARNESS_ROOT, "templates");

const SKILL_A = createMockAsset({
  id: "skill-a",
  condition: { kind: "any-track", tracks: ["tooling"] },
  method: { kind: "skill", source: "owner/a", skill: "a" },
});
const SKILL_G = createMockAsset({
  id: "skill-g",
  condition: { kind: "any-track", tracks: ["executive"] },
  method: { kind: "skill", source: "owner/g", skill: "g" },
});
const CATALOG = [SKILL_A, SKILL_G];

const BODY = "# g\nupstream body\n";
const NOTES = "upstream notes\n";
const EDITED = "upstream notes\nmy own line\n";

let projectDir = "";
let home = "";
beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "uzys-851-proj-"));
  home = mkdtempSync(join(tmpdir(), "uzys-851-home-"));
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

/** 실 설치(외부 자산 없이) 뒤 기록을 mixed 이력으로 — log.scope=project · skill-g 는 global(옛 판처럼 files 없음) · skill-a 는 project. */
function mixedInstall(): InstallLog {
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
  put(projectDir, ".claude/skills/a/SKILL.md", "# a\n");
  const next: InstallLog = {
    ...log,
    scope: "project",
    assets: [
      {
        id: "skill-a",
        category: "dev",
        method: "skill",
        scope: "project",
        detail: { source: "owner/a", skill: "a" },
        files: [{ path: ".claude/skills/a/SKILL.md", sha256: hashContent("# a\n") }],
      },
      {
        id: "skill-g",
        category: "dev",
        method: "skill",
        scope: "global",
        detail: { source: "owner/g", skill: "g" },
      },
    ],
  };
  writeInstallLog(projectDir, next);
  return next;
}

/** 홈의 global 사본 + 옛 update 가 프로젝트 두 자리에 만든 사본(Claude 자리의 notes.md 만 설치자가 고쳤다). */
function seedCopies(): void {
  put(home, ".claude/skills/g/SKILL.md", BODY);
  put(home, ".claude/skills/g/notes.md", NOTES);
  put(home, ".agents/skills/g/SKILL.md", BODY);
  put(projectDir, ".claude/skills/g/SKILL.md", BODY);
  put(projectDir, ".claude/skills/g/notes.md", EDITED);
  put(projectDir, ".agents/skills/g/SKILL.md", BODY);
}

function update(): UpdateModeReport {
  const spawn = vi.fn(okSpawn) as unknown as SpawnFn;
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

function updateScreen(report: UpdateModeReport): string {
  const spec: InstallSpec = {
    tracks: ["tooling"],
    options: { withCodexTrust: false },
    cli: ["claude", "codex"],
    projectDir,
  };
  const baseline: BaselineReport = {
    filesCopied: 0,
    dirsCopied: 0,
    skipped: 0,
    installedTracks: ["tooling"],
    mcpServers: [],
    codex: null,
    codexOptIn: null,
    opencode: null,
    antigravity: null,
    updateMode: report,
    mode: "update",
    envFiles: { envExampleCreated: false, gitignoreEnvAdded: false, gitignoreNpxSkillsAdded: [] },
    ciScaffold: null,
    rootClaudeMd: null,
    baselineExcluded: [],
    baselineExcludedOnDisk: [],
    baselineForeignOwned: [],
  };
  const out: string[] = [];
  createInstallRenderer((m) => out.push(m), spec, false).callbacks.onProgress?.({
    type: "baseline-complete",
    baseline,
  });
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI 색 코드를 벗긴다
  return out.join("\n").replace(/\x1b\[[0-9;]*m/g, "");
}

/** 공통 단언 — 사본 없음 · 고친 파일만 백업 1개(그 내용 그대로) · 홈 사본 그대로. */
function expectReclaimed(): void {
  expect(nonBackupsIn(".claude/skills/g"), "Claude 자리 사본이 남았다").toEqual([]);
  expect(existsSync(abs(".agents/skills/g")), "공유 자리 사본이 남았다").toBe(false);
  const backups = backupsIn(".claude/skills/g");
  expect(backups).toHaveLength(1);
  expect(backups[0]).toMatch(/^notes\.md\.backup-/);
  expect(readFileSync(abs(`.claude/skills/g/${backups[0]}`), "utf8")).toBe(EDITED);
  expect(readFileSync(join(home, ".claude/skills/g/SKILL.md"), "utf8")).toBe(BODY);
  expect(readFileSync(join(home, ".agents/skills/g/SKILL.md"), "utf8")).toBe(BODY);
}

describe("#851 AC3 — update 가 global 자산의 프로젝트 사본을 회수한다", () => {
  it("mixed 이력 + 사본(안 고친 파일 · 고친 파일) → 사본 없음 · 고친 파일만 백업 1개 · 기록 그대로(global) · 화면 줄", () => {
    const before = mixedInstall();
    seedCopies();
    const report = update();

    expectReclaimed();
    const after = readInstallLog(projectDir);
    expect(after?.assets.find((a) => a.id === "skill-g")).toEqual(
      before.assets.find((a) => a.id === "skill-g"),
    );
    // project 자산의 자리는 회수 대상이 아니다
    expect(existsSync(abs(".claude/skills/a/SKILL.md"))).toBe(true);
    expect(report.backups.map((b) => b.path)).toContain(".claude/skills/g/notes.md");

    const screen = updateScreen(report);
    expect(screen).toMatch(/\.claude\/skills\/g\s+removed — a project copy of skill-g/);
    expect(screen).toMatch(/\.agents\/skills\/g\s+removed — a project copy of skill-g/);
    expect(screen).toMatch(
      /backed up {2}\.claude\/skills\/g\/notes\.md — not the same as the global copy .*saved as \.claude\/skills\/g\/notes\.md\.backup-/,
    );
    // 안 고친 파일은 백업 줄이 없다
    expect(screen).not.toMatch(/backed up {2}\.claude\/skills\/g\/SKILL\.md/);
  });

  it("홈에 global 사본이 없으면 댈 수 없어 파일마다 백업하고 지운다", () => {
    mixedInstall();
    put(projectDir, ".claude/skills/g/SKILL.md", BODY);
    update();
    expect(nonBackupsIn(".claude/skills/g")).toEqual([]);
    expect(backupsIn(".claude/skills/g")).toHaveLength(1);
  });

  it("사본이 없으면 아무 줄도 없다 — 회귀 없음", () => {
    mixedInstall();
    const report = update();
    expect(report.globalCopiesReclaimed).toBeUndefined();
    expect(updateScreen(report)).not.toMatch(/a project copy of/);
  });

  it("다음 update 는 앞선 백업을 다시 백업하지 않는다", () => {
    mixedInstall();
    seedCopies();
    update();
    const second = update();
    expect(backupsIn(".claude/skills/g")).toHaveLength(1);
    expect(second.globalCopiesReclaimed).toBeUndefined();
  });

  it("자리가 링크면 따라가 대상을 지우지 않는다", () => {
    mixedInstall();
    const shared = mkdtempSync(join(tmpdir(), "uzys-851-shared-"));
    try {
      put(shared, "SKILL.md", BODY);
      mkdirSync(abs(".claude/skills"), { recursive: true });
      symlinkSync(shared, abs(".claude/skills/g"));
      update();
      expect(lstatSync(abs(".claude/skills/g")).isSymbolicLink()).toBe(true);
      expect(readFileSync(join(shared, "SKILL.md"), "utf8")).toBe(BODY);
      const un = uninstall({ yes: true });
      expect(un.code).toBe(0);
      expect(readFileSync(join(shared, "SKILL.md"), "utf8")).toBe(BODY);
    } finally {
      rmSync(shared, { recursive: true, force: true });
    }
  });

  it("자리가 프로젝트 안 폴더로의 링크여도 따라가지 않는다", () => {
    mixedInstall();
    put(projectDir, "my-skills/g/SKILL.md", BODY);
    mkdirSync(abs(".claude/skills"), { recursive: true });
    symlinkSync(abs("my-skills/g"), abs(".claude/skills/g"));
    update();
    uninstall({ yes: true });
    expect(lstatSync(abs(".claude/skills/g")).isSymbolicLink()).toBe(true);
    expect(readFileSync(abs("my-skills/g/SKILL.md"), "utf8")).toBe(BODY);
  });

  it("프로젝트가 홈이면(그 자리가 곧 global 사본) 지우지 않는다", () => {
    mixedInstall();
    vi.stubEnv("HOME", projectDir);
    put(projectDir, ".claude/skills/g/SKILL.md", BODY);
    update();
    expect(readFileSync(abs(".claude/skills/g/SKILL.md"), "utf8")).toBe(BODY);
  });
});

describe("#851 AC3 — uninstall 이 같은 판정으로 회수한다", () => {
  it("전량 uninstall → 사본 없음 · 고친 파일만 백업 1개 · 화면 줄 · global 안내는 그대로", () => {
    mixedInstall();
    seedCopies();
    const r = uninstall({ yes: true });
    expect(r.code).toBe(0);
    expectReclaimed();
    expect(r.text).toMatch(/removed {2}\.claude\/skills\/g — a project copy of skill-g/);
    expect(r.text).toMatch(
      /backed up {2}\.claude\/skills\/g\/notes\.md — not the same as the global copy .*saved as \.claude\/skills\/g\/notes\.md\.backup-/,
    );
    expect(r.text).toContain("npx skills remove -g g");
  });

  it("--only <global 자산> → 사본만 회수 · 기록의 그 자산은 남는다(global)", () => {
    mixedInstall();
    seedCopies();
    const r = uninstall({ only: "skill-g" });
    expect(r.code).toBe(0);
    expectReclaimed();
    expect(readInstallLog(projectDir)?.assets.find((a) => a.id === "skill-g")?.scope).toBe(
      "global",
    );
    expect(existsSync(abs(".claude/skills/a/SKILL.md")), "고르지 않은 자산은 그대로").toBe(true);
  });

  it("--only <다른 자산> 은 global 사본을 건드리지 않는다", () => {
    mixedInstall();
    seedCopies();
    uninstall({ only: "skill-a" });
    expect(readFileSync(abs(".claude/skills/g/notes.md"), "utf8")).toBe(EDITED);
    expect(existsSync(abs(".agents/skills/g/SKILL.md"))).toBe(true);
  });

  it("--dry-run 은 같은 판정으로 예고하고 아무것도 바꾸지 않는다", () => {
    mixedInstall();
    seedCopies();
    const r = uninstall({ dryRun: true });
    expect(r.text).toMatch(
      /○ remove \.claude\/skills\/g \(a project copy of skill-g.* — 1 with a copy saved beside as \*\.backup-<time>\)/,
    );
    expect(r.text).toMatch(/○ remove \.agents\/skills\/g \(a project copy of skill-g/);
    // 지울 사본을 "남는 설치자 파일" 로 다시 말하지 않는다
    expect(r.text).not.toMatch(/leave \.claude\/ — .*skills\/g\//);
    expect(readFileSync(abs(".claude/skills/g/notes.md"), "utf8")).toBe(EDITED);
    expect(backupsIn(".claude/skills/g")).toEqual([]);
  });
});

describe("#851 리뷰 — 회수의 가드가 문다", () => {
  it("설치자가 뺀 자산(excluded)의 사본은 update · uninstall 모두 회수하지 않는다", () => {
    const log = mixedInstall();
    writeInstallLog(projectDir, { ...log, excluded: ["skill-g"] });
    seedCopies();
    const report = update();
    expect(report.globalCopiesReclaimed).toBeUndefined();
    expect(readFileSync(abs(".claude/skills/g/notes.md"), "utf8")).toBe(EDITED);
    expect(readFileSync(abs(".agents/skills/g/SKILL.md"), "utf8")).toBe(BODY);
    const un = uninstall({ yes: true });
    expect(un.text).not.toMatch(/a project copy of skill-g/);
    expect(readFileSync(abs(".claude/skills/g/notes.md"), "utf8")).toBe(EDITED);
    expect(backupsIn(".claude/skills/g")).toEqual([]);
  });

  it("다른 자산 · 하네스 기록이 말하는 경로는 지우지 않는다", () => {
    const log = mixedInstall();
    // 하네스 번들 스킬 하나(실제 폴더 — 공유 스킬 링크 자리는 회수가 애초에 따라가지 않는다) — 같은 이름의 global 자산이 기록에 있다고 친다
    const bundled = readdirSync(abs(".claude/skills")).find(
      (n) =>
        n !== "a" &&
        lstatSync(abs(`.claude/skills/${n}`)).isDirectory() &&
        existsSync(abs(`.claude/skills/${n}/SKILL.md`)),
    );
    if (bundled === undefined) throw new Error("no bundled skill installed");
    const harnessFile = `.claude/skills/${bundled}/SKILL.md`;
    const harnessBytes = readFileSync(abs(harnessFile), "utf8");
    put(projectDir, ".claude/skills/g/SKILL.md", BODY);
    put(projectDir, ".claude/skills/g/extra.md", "other asset\n");
    const next: InstallLog = {
      ...log,
      assets: [
        ...log.assets.map((a) =>
          a.id === "skill-a"
            ? {
                ...a,
                files: [
                  ...(a.files ?? []),
                  { path: ".claude/skills/g/extra.md", sha256: hashContent("other asset\n") },
                ],
              }
            : a,
        ),
        {
          id: "harness-named",
          category: "dev",
          method: "skill",
          scope: "global",
          detail: { source: "owner/h", skill: bundled },
        },
      ],
    };
    const copies = reclaimGlobalSkillCopies(projectDir, next, { write: true });
    const removed = copies.flatMap((r) => r.removed);
    expect(removed).toContain(".claude/skills/g/SKILL.md");
    expect(removed).not.toContain(".claude/skills/g/extra.md");
    expect(removed).not.toContain(harnessFile);
    expect(readFileSync(abs(".claude/skills/g/extra.md"), "utf8")).toBe("other asset\n");
    expect(readFileSync(abs(harnessFile), "utf8")).toBe(harnessBytes);
  });

  it("스킬 루트가 프로젝트 밖으로의 링크면 그 안의 사본을 따라가 지우지 않는다", () => {
    const log = mixedInstall();
    const outside = mkdtempSync(join(tmpdir(), "uzys-851-outside-"));
    try {
      put(outside, "g/SKILL.md", BODY);
      rmSync(abs(".agents"), { recursive: true, force: true });
      mkdirSync(abs(".agents"), { recursive: true });
      symlinkSync(outside, abs(".agents/skills"));
      const copies = reclaimGlobalSkillCopies(projectDir, log, { write: true });
      expect(copies.map((r) => r.slot)).not.toContain(".agents/skills/g");
      expect(readFileSync(join(outside, "g/SKILL.md"), "utf8")).toBe(BODY);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it("사본 폴더 안의 링크는 지우지 않고 남긴 줄로 말한다", () => {
    const log = mixedInstall();
    put(projectDir, "shared.md", "shared\n");
    put(projectDir, ".claude/skills/g/SKILL.md", BODY);
    symlinkSync(abs("shared.md"), abs(".claude/skills/g/shared.md"));
    const copies = reclaimGlobalSkillCopies(projectDir, log, { write: true });
    expect(lstatSync(abs(".claude/skills/g/shared.md")).isSymbolicLink()).toBe(true);
    expect(copies.flatMap((r) => r.left.map((l) => l.path))).toContain(
      ".claude/skills/g/shared.md",
    );
    expect(copies.flatMap((r) => r.removed)).not.toContain(".claude/skills/g/shared.md");
  });

  it(".claude/skills 가 .agents/skills 로의 링크면 미리보기와 실행이 같은 한 자리를 말한다", () => {
    mixedInstall();
    rmSync(abs(".claude/skills/g"), { recursive: true, force: true });
    put(home, ".claude/skills/g/SKILL.md", BODY);
    put(projectDir, ".agents/skills/g/SKILL.md", BODY);
    // 하네스가 깐 .claude/skills 의 다른 스킬은 이 판정과 무관하다 — 루트를 링크로 바꾼다
    rmSync(abs(".claude/skills"), { recursive: true, force: true });
    symlinkSync(abs(".agents/skills"), abs(".claude/skills"));
    const dry = uninstall({ dryRun: true });
    const previewed = dry.text.match(/○ remove \S+ \(a project copy of skill-g/g) ?? [];
    const run = uninstall({ yes: true });
    const done = run.text.match(/removed {2}\S+ — a project copy of skill-g/g) ?? [];
    expect(previewed).toHaveLength(1);
    expect(done).toHaveLength(1);
  });

  it("uninstall --only <global 자산> 이 사본만 지우면 끝줄이 그 자산이 global 로 남는다고 말한다", () => {
    mixedInstall();
    seedCopies();
    const r = uninstall({ only: "skill-g" });
    expect(r.code).toBe(0);
    expect(r.text).toMatch(
      /uninstall complete \(0 asset\(s\)\) — removed the project copies; skill-g stays installed globally/,
    );
  });
});
