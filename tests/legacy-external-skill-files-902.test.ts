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
  refreshExternalSkills,
  runExternalInstall,
} from "../src/external-installer.js";
import { listFilesRecursive } from "../src/fs-ops.js";
import {
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
 * #902 — 파일 목록(`files`) 없는 옛 기록(v26.163.0 이하가 깐 외부 스킬)의 폴더 안 설치자 파일이 update · 재설치에서 백업 없이 사라졌다.
 * 이제 그 자리도 비켜 두고, 새 판과 다르거나 빠진 파일은 그 파일 하나를 백업만 하고 화면이 말한다 — 되살리지도 displaced · 추론한
 * 목록으로 적지도 않는다(기록은 계속 "모름"). 실 도구 대신 "폴더째 지우고 상류판을 쓰는" 목(`update-external-skill-backup-770` 방식).
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
const UNLISTED = "no file list on record (an older version installed this skill) — saved as";

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

/** 옛 판이 깐 모양 — 도구 사본은 디스크에 있고 자산 기록에 파일 목록이 없다. `listed` 면 현행 판처럼 목록이 있다(대조군). */
function installedProject(opts: { listed?: boolean; logScope?: "global" } = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "uzys-902-"));
  dirs.push(dir);
  put(dir, CLAUDE_SKILL, V1);
  put(dir, AGENTS_SKILL, V1);
  put(dir, CLAUDE_REF, REF);
  const body = (path: string) => (path === CLAUDE_REF ? REF : V1);
  const files = [CLAUDE_SKILL, AGENTS_SKILL, CLAUDE_REF].map((path) => ({
    path,
    sha256: hashContent(body(path)),
  }));
  writeInstallLog(dir, {
    schemaVersion: 1,
    installedAt: "2026-10-01T00:00:00.000Z",
    scope: opts.logScope ?? "project",
    spec: { tracks: ["tooling"], cli: ["claude", "codex"] },
    templates: { claudeDir: ".claude/" },
    assets: [
      {
        id: SKILL.id,
        category: "dev-tools",
        method: "skill",
        scope: "project",
        detail: { source: "owner/a", skill: "a" },
        ...(opts.listed ? { files } : {}),
      },
    ],
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

function recordOf(dir: string, id = SKILL.id): InstallLogAsset | undefined {
  return readInstallLog(dir)?.assets.find((a) => a.id === id);
}

function displacedIn(dir: string): string[] {
  return (readInstallLog(dir)?.rootFiles ?? [])
    .filter((f) => f.change === "displaced")
    .map((f) => f.path);
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
        line: `${UNLISTED} ${saved[0]}, removed from live (if it was yours, keep it outside this skill folder)`,
      }),
    );
    expect(judgedRow(row as NonNullable<typeof row>)).toContain(`backed up  ${NOTE} — `);
    // 소유를 모른다 — uninstall 이 되살릴 displaced 로도, 추론한 목록으로도 적지 않는다
    expect(displacedIn(dir)).toEqual([]);
    expect(recordOf(dir)?.files).toBeUndefined();
  });

  it("바이트가 다른 도구 자리 파일(고쳤거나 상류가 바꿨다) → 앞 바이트를 백업하고 상류판이 들어간다 · 같은 바이트는 조용히 둔다", () => {
    const dir = installedProject();
    put(dir, CLAUDE_SKILL, `${V1}MY EDIT\n`);

    const r = refresh(dir, V1);

    const saved = backupsOf(dir, CLAUDE_SKILL);
    expect(saved).toHaveLength(1);
    expect(read(dir, saved[0] as string)).toBe(`${V1}MY EDIT\n`);
    expect(read(dir, CLAUDE_SKILL)).toBe(V1);
    expect(r.judged).toEqual([
      expect.objectContaining({
        path: CLAUDE_SKILL,
        verdict: "backup+overwrite",
        recorded: "no-sha",
        line: `${UNLISTED} ${saved[0]}`,
      }),
    ]);
  });

  it("두 번째 update — 목록은 계속 '모름' · 앞 update 가 남긴 백업은 다시 백업하지 않고 제자리 · 상류가 안 바뀐 파일은 조용히 (R1-M1)", () => {
    // 두 실행의 백업 시각이 같은 초로 겹치지 않게(실 update 는 초 단위로 겹치지 않는다)
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-25T01:00:00Z") });
    const dir = installedProject();
    put(dir, NOTE, NOTE_BODY);
    refresh(dir, V2);
    const noteBackup = backupsOf(dir, NOTE)[0] as string;
    const firstSkill = backupsOf(dir, CLAUDE_SKILL); // V1 → V2 는 고쳤는지 몰라 한 번 백업됐다

    vi.setSystemTime(new Date("2026-10-26T01:00:00Z"));
    const second = refresh(dir, V2);

    expect(read(dir, noteBackup)).toBe(NOTE_BODY);
    expect(backupsOf(dir, NOTE), "백업의 백업이 생기지 않는다").toEqual([noteBackup]);
    expect(backupsOf(dir, CLAUDE_SKILL)).toEqual(firstSkill);
    expect(second.judged ?? []).toEqual([]);
    expect(recordOf(dir)?.files).toBeUndefined();
  });

  it("도구가 실패하면 옛 기록 자리의 파일도 전부 제자리로 돌아온다", () => {
    const dir = installedProject();
    put(dir, NOTE, NOTE_BODY);
    put(dir, CLAUDE_SKILL, `${V1}MY EDIT\n`);

    const r = refresh(dir, V2, 1);

    expect(r.failed).toHaveLength(1);
    expect(read(dir, NOTE)).toBe(NOTE_BODY);
    expect(read(dir, CLAUDE_SKILL)).toBe(`${V1}MY EDIT\n`);
    expect(r.judged ?? []).toEqual([]);
  });

  it("기록 scope 가 global(project 로 깐 뒤 `install --scope global`)이어도 project 자산 폴더의 노트가 백업으로 남는다 (R1-BLOCKER-1)", () => {
    const dir = installedProject({ logScope: "global" });
    put(dir, NOTE, NOTE_BODY);

    const r = refresh(dir, V2);

    expect(r.refreshed).toBe(1);
    const saved = backupsOf(dir, NOTE);
    expect(saved).toHaveLength(1);
    expect(read(dir, saved[0] as string)).toBe(NOTE_BODY);
    expect(r.judged?.map((j) => j.path)).toContain(NOTE);
  });

  it("runUpdateMode — 백업이 보고 · 목록에 '체크섬 없음' 으로 실리고 판정의 줄이 화면 행으로 올라온다", () => {
    const dir = installedProject();
    put(dir, NOTE, NOTE_BODY);
    const report = runUpdateMode(dir, join(__dirname, "..", "templates"), join(__dirname, ".."), {
      refreshSkills: (d) => refresh(d, V2),
    });
    const pair = report.backups.find((b) => b.path === NOTE);
    expect(pair?.removed, JSON.stringify(report.backups)).toBe(true);
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
    const saved = backupsOf(dir, ".claude/skills/x/mine.md");
    expect(saved).toHaveLength(1);
    expect(read(dir, saved[0] as string)).toBe(NOTE_BODY);
    // 상류가 바꾼 SKILL.md 도 고쳤는지 몰라 백업한다 — 도구가 건드리지 않은 폴더에는 줄이 없다
    expect(r.judged?.map((j) => j.path).sort()).toEqual([
      ".claude/skills/x/SKILL.md",
      ".claude/skills/x/mine.md",
    ]);
  });
});

describe("#902 — 기설치 위 install · CLI 를 빼고 더하는 이력도 옛 사본을 설치자 원본으로 되살리지 않는다", () => {
  const HARNESS_ROOT = resolve(__dirname, "..");
  const found = EXTERNAL_ASSETS.find((a) => a.id === "frontend-design");
  if (found === undefined) throw new Error("catalog has no frontend-design");
  const FD = found;
  const FD_SKILL = ".agents/skills/frontend-design/SKILL.md";
  const FD_NOTE = ".agents/skills/frontend-design/mine.md";
  const FD_V1 = "# frontend-design V1\n";
  // 실행마다 시계를 하루씩 민다 — 한 테스트 안의 여러 실행이 같은 초의 백업 이름으로 겹치지 않게(실사용은 초 단위로 겹치지 않는다)
  let day = 0;
  const tick = (): void => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date(Date.UTC(2026, 9, 1 + ++day)) });
  };

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
    tick();
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

  function update(dir: string, body: string) {
    tick();
    return refreshExternalSkills(dir, {
      spawn: fakeTool(dir, body),
      assets: [FD],
      log: () => {},
      warn: () => {},
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

  function uninstall(dir: string, extra: { only?: string; cli?: string }) {
    tick();
    const lines: string[] = [];
    uninstallAction(
      { projectDir: dir, ...extra },
      {
        exit: () => undefined as never,
        // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI 색 코드를 벗긴다
        log: (l: string) => lines.push(l.replace(/\x1b\[[0-9;]*m/g, "")),
        // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI 색 코드를 벗긴다
        err: (l: string) => lines.push(l.replace(/\x1b\[[0-9;]*m/g, "")),
        spawn: (() => ok()) as never,
        resolveHarnessRoot: () => HARNESS_ROOT,
      },
    );
    return lines.join("\n");
  }

  /** 옛 `.agents` 사본(V1)이 "yours" 로 기록되지도 되살아나지도 않고, 기록은 "모름" 이라 uninstall 이 남기고 말한다. */
  function expectNotRevived(dir: string): void {
    expect(displacedIn(dir)).toEqual([]);
    expect(recordOf(dir, "frontend-design")?.files).toBeUndefined();
    const out = uninstall(dir, { only: "frontend-design" });
    expect(out).not.toContain("put back");
    expect(out).toContain("not on record");
    expect(read(dir, FD_SKILL)).not.toBe(FD_V1);
  }

  it("옛 기록 + 폴더 안 설치자 노트 → 재설치 뒤 노트 바이트가 백업으로 남고 보고의 백업에 든다", () => {
    const dir = legacyInstall(["codex"]);
    put(dir, FD_NOTE, NOTE_BODY);

    const result = install(dir, ["codex"]);

    const saved = backupsOf(dir, FD_NOTE);
    expect(saved).toHaveLength(1);
    expect(read(dir, saved[0] as string)).toBe(NOTE_BODY);
    expect((result.backups ?? []).map((b) => b.replace(`${dir}/`, ""))).toContain(saved[0]);
    expect(recordOf(dir, "frontend-design")?.files).toBeUndefined();
  });

  it("옛 판 claude+codex → CLI 일부(claude)만 고른 install → update → uninstall --only (리뷰 회차 0 BLOCKER-1)", () => {
    const dir = legacyInstall(["claude", "codex"], FD_V1);
    install(dir, ["claude"], "# frontend-design V2\n");
    const r = update(dir, "# frontend-design V3\n");

    expect(r.refreshed).toBe(1);
    expect(r.judged?.filter((j) => j.recorded === "none") ?? []).toEqual([]);
    expectNotRevived(dir);
  });

  it("옛 판 claude+codex → uninstall --cli codex → update → codex 를 다시 더하는 install → uninstall --only (리뷰 R1-BLOCKER-2)", () => {
    const dir = legacyInstall(["claude", "codex"], FD_V1);
    uninstall(dir, { cli: "codex" });
    expect(read(dir, FD_SKILL), "대조군: 옛 .agents 사본이 남아 있다").toBe(FD_V1);
    update(dir, "# frontend-design V2\n");
    install(dir, ["claude", "codex"], "# frontend-design V3\n");

    expectNotRevived(dir);
  });
});
