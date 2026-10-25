import type { SpawnSyncReturns } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { judgedRow } from "../src/commands/install-render.js";
import { uninstallAction } from "../src/commands/uninstall.js";
import { EXTERNAL_ASSETS } from "../src/external-assets.js";
import {
  type ExternalInstallerDeps,
  type ExternalInstallReport,
  refreshExternalSkills,
  runExternalInstall,
} from "../src/external-installer.js";
import { listFilesRecursive } from "../src/fs-ops.js";
import {
  buildAssetEntries,
  hashContent,
  type InstallLog,
  type InstallLogAsset,
  readInstallLog,
  writeInstallLog,
} from "../src/install-log.js";
import { runInstall } from "../src/installer.js";
import type { CliTargets, InstallSpec } from "../src/types.js";
import { runUpdateMode } from "../src/update-mode.js";
import { createMockAsset } from "./helpers/mock-asset.js";

/**
 * #902 — 외부 스킬 기록에 파일 목록(`files`)이 없는 옛 판 설치본(v26.163.0 이하가 깐 자산 — 그 뒤 판도 목록을 잇지 않았다).
 * 외부 스킬 도구(`npx skills add --copy`)는 스킬 폴더를 새로 만든다. 그 폴더 안 설치자 파일이 update · 기설치 위 install 에서
 * 백업 없이 사라졌다. 이제 옛 기록 자리도 호출 전에 비켜 두고, 무엇이 도구 것인지 모르므로 다른 바이트 · 도구가 새로 쓴 폴더에서
 * 빠진 파일은 그 파일 하나를 백업만 하고(되살리지 않는다 — 상류가 바꾼 · 뺀 옛 도구 파일을 설치자 원본으로 남기지 않게) 화면이 말한다.
 * 이번 결과로 목록을 처음 적어 두 번째 실행부터는 기록대로(설치자 파일 남김 · 고친 도구 파일 백업) 판정한다.
 * 실 도구 대신 "폴더째 지우고 상류판을 쓰는" 목을 쓴다(`update-external-skill-backup-770` 과 같은 방식).
 */

const SKILL = createMockAsset({
  id: "skill-a",
  condition: { kind: "any-track", tracks: ["tooling"] },
  method: { kind: "skill", source: "owner/a", skill: "a" },
});

const V1 = "# skill a v1\n";
const V2 = "# skill a v2\n";
const REF = "reference\n";
const CLAUDE_SKILL = ".claude/skills/a/SKILL.md";
const AGENTS_SKILL = ".agents/skills/a/SKILL.md";
const CLAUDE_REF = ".claude/skills/a/ref.md";
const NOTE = ".claude/skills/a/mine.md";
const NOTE_BODY = "my own note — not from the skill\n";

const dirs: string[] = [];
afterEach(() => {
  vi.useRealTimers();
  while (dirs.length > 0) rmSync(dirs.pop() as string, { recursive: true, force: true });
});

function put(dir: string, rel: string, body: string): void {
  mkdirSync(dirname(join(dir, rel)), { recursive: true });
  writeFileSync(join(dir, rel), body);
}

function read(dir: string, rel: string): string {
  return readFileSync(join(dir, rel), "utf8");
}

function ok(): SpawnSyncReturns<string> {
  return { pid: 0, output: [], stdout: "", stderr: "", status: 0, signal: null };
}

function assetRecord(files?: InstallLogAsset["files"]): InstallLogAsset {
  return {
    id: SKILL.id,
    category: "dev-tools",
    method: "skill",
    scope: "project",
    detail: { source: "owner/a", skill: "a" },
    ...(files !== undefined ? { files } : {}),
  } as InstallLogAsset;
}

/** 옛 판이 깐 모양 — 도구 사본은 디스크에 있고, 자산 기록에 파일 목록이 없다. `listed` 면 현행 판처럼 목록이 있다(대조군). */
function installedProject(opts: { listed?: boolean } = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "uzys-902-"));
  dirs.push(dir);
  put(dir, CLAUDE_SKILL, V1);
  put(dir, AGENTS_SKILL, V1);
  put(dir, CLAUDE_REF, REF);
  const files = opts.listed
    ? [
        { path: CLAUDE_SKILL, sha256: hashContent(V1) },
        { path: AGENTS_SKILL, sha256: hashContent(V1) },
        { path: CLAUDE_REF, sha256: hashContent(REF) },
      ]
    : undefined;
  writeInstallLog(dir, {
    schemaVersion: 1,
    installedAt: "2026-10-01T00:00:00.000Z",
    scope: "project",
    spec: { tracks: ["tooling"], cli: ["claude", "codex"] },
    templates: { claudeDir: ".claude/" },
    assets: [assetRecord(files)],
  } as InstallLog);
  return dir;
}

/** `npx skills add --copy` 처럼 두 자리를 폴더째 지우고 상류판으로 다시 쓴다. `status` 를 주면 그 코드로 실패한다(쓰지 않는다). */
function toolWriting(
  dir: string,
  upstream: string,
  status = 0,
): NonNullable<ExternalInstallerDeps["spawn"]> {
  return (cmd) => {
    if (cmd === "npx" && status === 0) {
      for (const slot of [".claude/skills/a", ".agents/skills/a"])
        rmSync(join(dir, slot), { recursive: true, force: true });
      put(dir, CLAUDE_SKILL, upstream);
      put(dir, AGENTS_SKILL, upstream);
      put(dir, CLAUDE_REF, REF);
    }
    return { ...ok(), status, stderr: status === 0 ? "" : "boom" };
  };
}

function refresh(dir: string, upstream: string, status = 0) {
  return refreshExternalSkills(dir, {
    spawn: toolWriting(dir, upstream, status),
    assets: [SKILL],
    log: () => {},
    warn: () => {},
  });
}

function backupsOf(dir: string, rel: string): string[] {
  const folder = dirname(rel);
  return listFilesRecursive(join(dir, folder))
    .map((f) => `${folder}/${f}`)
    .filter((p) => p.startsWith(`${rel}.backup-`));
}

function recordedPaths(dir: string): string[] | undefined {
  return readInstallLog(dir)
    ?.assets.find((a) => a.id === SKILL.id)
    ?.files?.map((f) => f.path)
    .sort();
}

describe("#902 — 파일 목록 없는 옛 기록의 외부 스킬 폴더: update 가 설치자 파일을 백업 없이 지우지 않는다", () => {
  it("폴더 안 설치자 노트 → 바이트가 백업으로 남고, 그 줄이 화면에 나온다 · 상류판에 없는 파일이라 되살리지 않는다", () => {
    const dir = installedProject();
    put(dir, NOTE, NOTE_BODY);

    const r = refresh(dir, V2);

    expect(r.refreshed).toBe(1);
    const saved = backupsOf(dir, NOTE);
    expect(saved, "노트의 바이트가 백업 하나로 남는다").toHaveLength(1);
    expect(read(dir, saved[0] as string)).toBe(NOTE_BODY);
    expect(existsSync(join(dir, NOTE)), "도구 것인지 모르는 파일은 되살리지 않는다").toBe(false);
    const row = r.judged?.find((j) => j.path === NOTE);
    expect(row).toEqual(
      expect.objectContaining({
        verdict: "backup+remove",
        recorded: "no-sha",
        backup: saved[0],
        line: `no file list on record (an older version installed this skill) — saved as ${saved[0]}, removed from live (if it was yours, rename it back)`,
      }),
    );
    expect(judgedRow(row as NonNullable<typeof row>)).toContain(`backed up  ${NOTE} — `);
    // 설치자 원본이라 단정하지 않는다 — uninstall 이 되살릴 displaced 로 적지 않는다
    expect(readInstallLog(dir)?.rootFiles ?? []).toEqual([]);
  });

  it("바이트가 다른 도구 자리 파일(고쳤거나 상류가 바꿨다) → 앞 바이트를 백업하고 상류판이 들어간다 · 같은 바이트는 조용히 둔다", () => {
    const dir = installedProject();
    put(dir, CLAUDE_SKILL, `${V1}MY EDIT\n`);

    const r = refresh(dir, V1);

    const saved = backupsOf(dir, CLAUDE_SKILL);
    expect(saved).toHaveLength(1);
    expect(read(dir, saved[0] as string)).toBe(`${V1}MY EDIT\n`);
    expect(read(dir, CLAUDE_SKILL)).toBe(V1);
    expect(r.judged).toContainEqual(
      expect.objectContaining({
        path: CLAUDE_SKILL,
        verdict: "backup+overwrite",
        recorded: "no-sha",
        line: `no file list on record (an older version installed this skill) — saved as ${saved[0]}`,
      }),
    );
    // 같은 바이트(도구가 다시 놓은 같은 판)는 백업 · 줄이 없다
    expect(backupsOf(dir, AGENTS_SKILL)).toEqual([]);
    expect(backupsOf(dir, CLAUDE_REF)).toEqual([]);
    expect(r.judged?.map((j) => j.path)).toEqual([CLAUDE_SKILL]);
  });

  it("이번 결과로 목록을 처음 적는다 — 도구가 놓은 파일만(노트 · 백업 제외) · 두 번째 update 는 기록대로 판정한다", () => {
    // 두 실행의 백업 시각이 같은 초로 겹치지 않게(실 update 는 초 단위로 겹치지 않는다)
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-25T01:00:00Z") });
    const dir = installedProject();
    put(dir, NOTE, NOTE_BODY);
    refresh(dir, V2);
    const noteBackup = backupsOf(dir, NOTE)[0] as string;
    // 상류가 V1 → V2 로 바꾼 SKILL.md 는 고쳤는지 몰라 이번 한 번 백업됐다(두 자리)
    const firstAgents = backupsOf(dir, AGENTS_SKILL);
    const firstClaude = backupsOf(dir, CLAUDE_SKILL);
    expect([firstAgents.length, firstClaude.length]).toEqual([1, 1]);

    expect(recordedPaths(dir)).toEqual([AGENTS_SKILL, CLAUDE_REF, CLAUDE_SKILL].sort());
    const files = readInstallLog(dir)?.assets[0]?.files ?? [];
    expect(files.find((f) => f.path === CLAUDE_SKILL)?.sha256).toBe(hashContent(V2));

    // 두 번째 update — 앞의 백업(설치자 몫)은 제자리에 남고, 고친 도구 파일은 "you edited it" 으로 백업, 안 고친 파일은 조용히 갱신
    put(dir, AGENTS_SKILL, `${V2}MY CODEX EDIT\n`);
    vi.setSystemTime(new Date("2026-10-26T01:00:00Z"));
    const second = refresh(dir, "# skill a v3\n");

    expect(read(dir, noteBackup)).toBe(NOTE_BODY);
    expect(backupsOf(dir, NOTE)).toEqual([noteBackup]);
    expect(backupsOf(dir, CLAUDE_SKILL), "안 고친 파일은 상류가 바뀌어도 백업하지 않는다").toEqual(
      firstClaude,
    );
    const edited = backupsOf(dir, AGENTS_SKILL).filter((p) => !firstAgents.includes(p));
    expect(edited).toHaveLength(1);
    expect(read(dir, edited[0] as string)).toBe(`${V2}MY CODEX EDIT\n`);
    expect(read(dir, firstAgents[0] as string)).toBe(V1);
    expect(second.judged).toEqual([
      expect.objectContaining({
        path: AGENTS_SKILL,
        recorded: "sha",
        line: `you edited it — saved as ${edited[0]}`,
      }),
    ]);
    expect(recordedPaths(dir)).toEqual([AGENTS_SKILL, CLAUDE_REF, CLAUDE_SKILL].sort());
  });

  it("도구가 실패하면 옛 기록 자리의 파일도 전부 제자리로 돌아오고 목록을 적지 않는다", () => {
    const dir = installedProject();
    put(dir, NOTE, NOTE_BODY);
    put(dir, CLAUDE_SKILL, `${V1}MY EDIT\n`);

    const r = refresh(dir, V2, 1);

    expect(r.failed).toHaveLength(1);
    expect(read(dir, NOTE)).toBe(NOTE_BODY);
    expect(read(dir, CLAUDE_SKILL)).toBe(`${V1}MY EDIT\n`);
    expect(read(dir, AGENTS_SKILL)).toBe(V1);
    expect(backupsOf(dir, NOTE)).toEqual([]);
    expect(r.judged ?? []).toEqual([]);
    expect(recordedPaths(dir)).toBeUndefined();
  });

  it("runUpdateMode — 백업이 보고 · 목록에 '체크섬 없음' 으로 실리고 판정의 줄이 화면 행으로 올라온다", () => {
    const dir = installedProject();
    put(dir, NOTE, NOTE_BODY);
    const report = runUpdateMode(dir, join(__dirname, "..", "templates"), join(__dirname, ".."), {
      refreshSkills: (d) => refresh(d, V2),
    });
    const pair = report.backups.find((b) => b.path === NOTE);
    expect(pair, JSON.stringify(report.backups)).toEqual(
      expect.objectContaining({ removed: true }),
    );
    expect(report.noChecksum ?? []).toContain(NOTE);
    expect(report.judged).toContainEqual(
      expect.objectContaining({ path: NOTE, recorded: "no-sha", backup: pair?.backup }),
    );
  });

  it("대조군 — 목록이 있는 기록은 현행 그대로: 노트는 제자리 · 고친 파일은 'you edited it' 백업", () => {
    const dir = installedProject({ listed: true });
    put(dir, NOTE, NOTE_BODY);
    put(dir, CLAUDE_SKILL, `${V1}MY EDIT\n`);

    const r = refresh(dir, V2);

    expect(read(dir, NOTE)).toBe(NOTE_BODY);
    expect(backupsOf(dir, NOTE)).toEqual([]);
    const saved = backupsOf(dir, CLAUDE_SKILL);
    expect(saved).toHaveLength(1);
    expect(r.judged).toEqual([
      expect.objectContaining({
        path: CLAUDE_SKILL,
        recorded: "sha",
        line: `you edited it — saved as ${saved[0]}`,
      }),
    ]);
    expect(recordedPaths(dir)).not.toContain(NOTE);
  });
});

describe("#902 — 소스 전체를 까는 옛 기록 자산(루트 자리): 도구가 새로 쓴 폴더만 '모름' 으로 다룬다", () => {
  const WHOLE = createMockAsset({
    id: "whole",
    condition: { kind: "any-track", tracks: ["tooling"] },
    method: { kind: "skill", source: "owner/whole" },
  });

  it("도구 폴더 안 노트는 백업으로 남고, 도구가 건드리지 않은 설치자 자신의 스킬 폴더는 바이트 그대로 제자리다", () => {
    const dir = mkdtempSync(join(tmpdir(), "uzys-902-whole-"));
    dirs.push(dir);
    put(dir, ".claude/skills/x/SKILL.md", "# x v1\n");
    put(dir, ".claude/skills/x/mine.md", NOTE_BODY);
    put(dir, ".claude/skills/my-own/SKILL.md", "# my own skill\n");
    writeInstallLog(dir, {
      schemaVersion: 1,
      installedAt: "2026-10-01T00:00:00.000Z",
      scope: "project",
      spec: { tracks: ["tooling"], cli: ["claude"] },
      templates: { claudeDir: ".claude/" },
      assets: [
        {
          id: "whole",
          category: "dev-tools",
          method: "skill",
          scope: "project",
          detail: { source: "owner/whole" },
        },
      ],
    } as InstallLog);

    const r = refreshExternalSkills(dir, {
      spawn: (cmd) => {
        if (cmd === "npx") {
          rmSync(join(dir, ".claude/skills/x"), { recursive: true, force: true });
          put(dir, ".claude/skills/x/SKILL.md", "# x v2\n");
        }
        return ok();
      },
      assets: [WHOLE],
      log: () => {},
      warn: () => {},
    });

    expect(r.refreshed).toBe(1);
    expect(read(dir, ".claude/skills/my-own/SKILL.md")).toBe("# my own skill\n");
    expect(backupsOf(dir, ".claude/skills/my-own/SKILL.md")).toEqual([]);
    const saved = backupsOf(dir, ".claude/skills/x/mine.md");
    expect(saved).toHaveLength(1);
    expect(read(dir, saved[0] as string)).toBe(NOTE_BODY);
    // 상류가 바꾼 SKILL.md 도 고쳤는지 몰라 한 번 백업한다 — 도구가 건드리지 않은 폴더에는 줄이 없다
    expect(r.judged?.map((j) => j.path).sort()).toEqual([
      ".claude/skills/x/SKILL.md",
      ".claude/skills/x/mine.md",
    ]);
    expect(readInstallLog(dir)?.assets[0]?.files?.map((f) => f.path)).toEqual([
      ".claude/skills/x/SKILL.md",
    ]);
  });
});

describe("#902 — 기설치 위 install 도 같은 판정이다", () => {
  const HARNESS_ROOT = resolve(__dirname, "..");
  const found = EXTERNAL_ASSETS.find((a) => a.id === "frontend-design");
  if (found === undefined) throw new Error("catalog has no frontend-design");
  const FD = found;
  const FD_SKILL = ".agents/skills/frontend-design/SKILL.md";
  const FD_NOTE = ".agents/skills/frontend-design/mine.md";
  const FD_CLAUDE = ".claude/skills/frontend-design/SKILL.md";

  /** `npx skills add --agent … --copy` 처럼 고른 에이전트의 자리마다 스킬 폴더를 지우고 `body` 로 다시 쓴다. */
  function fakeTool(dir: string, body: string): NonNullable<ExternalInstallerDeps["spawn"]> {
    return (cmd, args) => {
      if (cmd !== "npx" || args[1] !== "add") return ok();
      const agents = args.flatMap((a, i) => (args[i - 1] === "--agent" ? [a] : []));
      for (const agent of new Set(agents)) {
        const root = agent === "claude-code" ? ".claude/skills" : ".agents/skills";
        rmSync(join(dir, root, "frontend-design"), { recursive: true, force: true });
        put(dir, `${root}/frontend-design/SKILL.md`, body);
      }
      return ok();
    };
  }

  function install(dir: string, cli: CliTargets, body = "# frontend-design\n") {
    return runInstall({
      harnessRoot: HARNESS_ROOT,
      projectDir: dir,
      spec: {
        tracks: ["tooling"],
        options: { withCodexTrust: false },
        cli,
        projectDir: dir,
        userOverride: { forceInclude: ["frontend-design"], forceExclude: [] },
      } satisfies InstallSpec,
      mode: "add",
      runExternal: (ctx, deps) =>
        runExternalInstall({ ...ctx, cli }, { ...deps, assets: [FD], spawn: fakeTool(dir, body) }),
    });
  }

  /** 옛 판(파일 목록을 적지 않던 판)으로 깐 모양 — 실제 설치 뒤 자산 기록에서 `files` 를 뺀다. */
  function legacyInstall(cli: CliTargets, body?: string): string {
    const dir = mkdtempSync(join(tmpdir(), "uzys-902-install-"));
    dirs.push(dir);
    install(dir, cli, body);
    const log = readInstallLog(dir) as InstallLog;
    writeFileSync(
      join(dir, ".uzys-agent-harness/.harness-install.json"),
      JSON.stringify({ ...log, assets: log.assets.map(({ files: _f, ...a }) => a) }),
    );
    return dir;
  }

  function fdRecord(dir: string): InstallLogAsset | undefined {
    return readInstallLog(dir)?.assets.find((a) => a.id === "frontend-design");
  }

  function uninstallOnly(dir: string): { out: string; code: number | null } {
    const lines: string[] = [];
    let code: number | null = null;
    uninstallAction(
      { projectDir: dir, only: "frontend-design" },
      {
        exit: (c: number) => {
          code ??= c;
          return undefined as never;
        },
        // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI 색 코드를 벗긴다
        log: (l: string) => lines.push(l.replace(/\x1b\[[0-9;]*m/g, "")),
        // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI 색 코드를 벗긴다
        err: (l: string) => lines.push(l.replace(/\x1b\[[0-9;]*m/g, "")),
        spawn: (() => ok()) as never,
        resolveHarnessRoot: () => HARNESS_ROOT,
      },
    );
    return { out: lines.join("\n"), code };
  }

  it("옛 기록 + 폴더 안 설치자 노트 → 재설치 뒤 노트 바이트가 백업으로 남고 보고의 백업에 든다 · 목록이 처음 적힌다", () => {
    const dir = legacyInstall(["codex"]);
    put(dir, FD_NOTE, NOTE_BODY);

    const result = install(dir, ["codex"]);

    const saved = backupsOf(dir, FD_NOTE);
    expect(saved).toHaveLength(1);
    expect(read(dir, saved[0] as string)).toBe(NOTE_BODY);
    expect((result.backups ?? []).map((b) => b.replace(`${dir}/`, ""))).toContain(saved[0]);
    expect(fdRecord(dir)?.files?.map((f) => f.path)).toEqual([FD_SKILL]);
  });

  it("옛 판 claude+codex → CLI 일부(claude)만 고른 install → update → uninstall --only: 옛 .agents 사본을 설치자 원본으로 되살리지 않는다 (PR #906 리뷰 BLOCKER-1)", () => {
    const dir = legacyInstall(["claude", "codex"], "# frontend-design V1\n");

    // 이번 실행은 .agents 자리를 비우지 않았다 — 거기 옛 사본이 비교에 안 잡히므로 목록을 적지 않는다("모름" 그대로)
    install(dir, ["claude"], "# frontend-design V2\n");
    expect(fdRecord(dir), "대조군: 자산 기록은 남는다").toBeDefined();
    expect(fdRecord(dir)?.files).toBeUndefined();
    expect(read(dir, FD_SKILL)).toBe("# frontend-design V1\n");

    // update 는 깔린 CLI 전부(claude+codex)를 비우고 다시 받는다 — 그때 두 자리의 목록이 처음 적힌다
    const r = refreshExternalSkills(dir, {
      spawn: fakeTool(dir, "# frontend-design V3\n"),
      assets: [FD],
      log: () => {},
      warn: () => {},
    });
    expect(r.refreshed).toBe(1);
    expect(
      fdRecord(dir)
        ?.files?.map((f) => f.path)
        .sort(),
    ).toEqual([FD_SKILL, FD_CLAUDE]);
    // 옛 도구 사본을 "had a file with this name — yours" 로 읽지 않는다
    expect(r.judged?.filter((j) => j.recorded === "none") ?? []).toEqual([]);
    expect((readInstallLog(dir)?.rootFiles ?? []).filter((f) => f.change === "displaced")).toEqual(
      [],
    );

    const run = uninstallOnly(dir);
    expect(run.code).toBe(0);
    expect(run.out).not.toContain("put back");
    expect(existsSync(join(dir, FD_SKILL)), "옛 V1 이 되살아나지 않는다").toBe(false);
    expect(existsSync(join(dir, FD_CLAUDE))).toBe(false);
  });
});

describe("#902 — 목록을 처음 적는 것은 hold 가 그 자산의 자리를 전부 비운 실행뿐", () => {
  it("buildAssetEntries — hold 를 거친 보고의 도구 파일로 옛 기록의 목록을 처음 적는다", () => {
    const report: ExternalInstallReport = {
      attempted: [
        {
          asset: SKILL,
          ok: true,
          files: { created: [{ path: CLAUDE_SKILL, sha256: hashContent(V2) }], changed: [] },
        },
      ],
      succeeded: 1,
      skipped: 0,
      excludedByCli: [],
    };
    const [entry] = buildAssetEntries(report, "project", [assetRecord()]);
    expect(entry?.files).toEqual([{ path: CLAUDE_SKILL, sha256: hashContent(V2) }]);
  });

  it("기록 scope 가 global 인데 자산은 project(mixed 이력) → hold 가 프로젝트 자리를 들지 않으므로 '모름' 그대로", () => {
    const dir = installedProject();
    const path = join(dir, ".uzys-agent-harness/.harness-install.json");
    writeFileSync(
      path,
      JSON.stringify({ ...(readInstallLog(dir) as InstallLog), scope: "global" }),
    );

    const r = refresh(dir, V2);

    expect(r.refreshed).toBe(1);
    expect(recordedPaths(dir)).toBeUndefined();
  });
});
