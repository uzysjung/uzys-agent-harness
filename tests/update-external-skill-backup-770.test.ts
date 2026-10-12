import type { SpawnSyncReturns } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { type ExternalInstallerDeps, refreshExternalSkills } from "../src/external-installer.js";
import { listFilesRecursive } from "../src/fs-ops.js";
import {
  hashContent,
  type InstallLog,
  readInstallLog,
  writeInstallLog,
} from "../src/install-log.js";
import { runUpdateMode } from "../src/update-mode.js";
import { createMockAsset } from "./helpers/mock-asset.js";

/**
 * #770 (ADR-097 결정 3·5) — update 의 외부 스킬 갱신(`npx skills add --copy` 재실행)이 설치자가 고친 스킬 파일을
 * 상류판으로 덮는다. 갱신 전에 기록 sha 와 디스크를 대조해 다른 파일 하나만 `<file>.backup-<시각>` 으로 남기고,
 * 안 고친 파일은 조용히 갱신된다. 실 도구로의 재현은 docker `scenario-update-external-skills` ②' 가 맡는다 —
 * 여기서는 도구를 "기록된 자리에 상류판을 다시 쓰는" 목으로 대신한다.
 */

const SKILL = createMockAsset({
  id: "skill-a",
  condition: { kind: "any-track", tracks: ["tooling"] },
  method: { kind: "skill", source: "owner/a", skill: "a" },
});

const V1 = "# skill a v1\n";
const REF = "reference\n";
const CLAUDE_SKILL = ".claude/skills/a/SKILL.md";
const AGENTS_SKILL = ".agents/skills/a/SKILL.md";
const CLAUDE_REF = ".claude/skills/a/ref.md";

const dirs: string[] = [];
afterEach(() => {
  while (dirs.length > 0) rmSync(dirs.pop() as string, { recursive: true, force: true });
});

function put(dir: string, rel: string, body: string): void {
  mkdirSync(dirname(join(dir, rel)), { recursive: true });
  writeFileSync(join(dir, rel), body);
}

/** install 직후 모양 — 도구가 두 자리에 놓은 파일과 그 sha 가 자산 기록(`assets[].files`)에 있다. */
function installedProject(): string {
  const dir = mkdtempSync(join(tmpdir(), "uzys-770-"));
  dirs.push(dir);
  put(dir, CLAUDE_SKILL, V1);
  put(dir, AGENTS_SKILL, V1);
  put(dir, CLAUDE_REF, REF);
  const log: InstallLog = {
    schemaVersion: 1,
    installedAt: "2026-10-12T00:00:00.000Z",
    scope: "project",
    spec: { tracks: ["tooling"], cli: ["claude", "codex"] },
    templates: { claudeDir: ".claude/" },
    assets: [
      {
        id: SKILL.id,
        category: "dev-tools",
        method: "skill",
        scope: "project",
        detail: { source: "owner/a", skill: "a" },
        files: [
          { path: CLAUDE_SKILL, sha256: hashContent(V1) },
          { path: AGENTS_SKILL, sha256: hashContent(V1) },
          { path: CLAUDE_REF, sha256: hashContent(REF) },
        ],
      },
    ],
  } as InstallLog;
  writeInstallLog(dir, log);
  return dir;
}

/**
 * `npx skills add --copy` 처럼 두 자리를 상류판(`upstream`)으로 다시 쓴다 — 실 도구는 스킬 폴더를 **새로 만든다**
 * (컨테이너 실측: 호출 전 그 폴더에 둔 `*.backup-*` 이 사라졌다). 그래서 폴더째 지우고 쓴다.
 */
function toolWriting(dir: string, upstream: string): NonNullable<ExternalInstallerDeps["spawn"]> {
  return (cmd) => {
    if (cmd === "npx") {
      for (const slot of [".claude/skills/a", ".agents/skills/a"])
        rmSync(join(dir, slot), { recursive: true, force: true });
      put(dir, CLAUDE_SKILL, upstream);
      put(dir, AGENTS_SKILL, upstream);
      put(dir, CLAUDE_REF, REF);
    }
    return {
      pid: 0,
      output: [],
      stdout: "",
      stderr: "",
      status: 0,
      signal: null,
    } as SpawnSyncReturns<string>;
  };
}

function backupsUnder(dir: string): string[] {
  return [".claude", ".agents"]
    .flatMap((root) => listFilesRecursive(join(dir, root)).map((rel) => `${root}/${rel}`))
    .filter((p) => /\.backup-\d{8}T\d{6}/.test(p));
}

function refresh(dir: string, upstream: string) {
  return refreshExternalSkills(dir, {
    spawn: toolWriting(dir, upstream),
    assets: [SKILL],
    log: () => {},
    warn: () => {},
  });
}

describe("#770 — update 의 외부 스킬 갱신은 고친 파일 하나만 백업하고 덮는다", () => {
  it("고친 SKILL.md 는 편집을 담은 *.backup-<시각> 하나로 남고, 안 고친 파일은 백업 없이 상류판이 된다", () => {
    const dir = installedProject();
    put(dir, CLAUDE_SKILL, `${V1}MY PROJECT NOTE\n`);

    const r = refresh(dir, "# skill a v2\n");

    expect(r.refreshed).toBe(1);
    const backups = backupsUnder(dir);
    expect(backups).toHaveLength(1);
    expect(backups[0]?.startsWith(`${CLAUDE_SKILL}.backup-`)).toBe(true);
    expect(readFileSync(join(dir, backups[0] as string), "utf8")).toContain("MY PROJECT NOTE");
    expect(readFileSync(join(dir, CLAUDE_SKILL), "utf8")).toBe("# skill a v2\n");
    expect(readFileSync(join(dir, AGENTS_SKILL), "utf8")).toBe("# skill a v2\n");
  });

  it("갱신 뒤 기준선이 새 판으로 이어진다 — 상류가 바뀐 다음 update 는 안 고친 파일을 백업하지 않는다", () => {
    const dir = installedProject();
    refresh(dir, "# skill a v2\n");
    expect(backupsUnder(dir)).toEqual([]);
    const files = readInstallLog(dir)?.assets[0]?.files ?? [];
    expect(files.find((f) => f.path === CLAUDE_SKILL)?.sha256).toBe(hashContent("# skill a v2\n"));
    expect(files.find((f) => f.path === AGENTS_SKILL)?.sha256).toBe(hashContent("# skill a v2\n"));

    refresh(dir, "# skill a v3\n");
    expect(backupsUnder(dir)).toEqual([]);
  });

  it("도구가 실패해 파일을 다시 쓰지 않았으면 백업을 남기지 않는다 — 바꾸지 않은 것을 '바꾸기 전에 남겼다' 고 하지 않는다", () => {
    const dir = installedProject();
    put(dir, CLAUDE_SKILL, `${V1}MY PROJECT NOTE\n`);
    const r = refreshExternalSkills(dir, {
      spawn: () =>
        ({
          pid: 0,
          output: [],
          stdout: "",
          stderr: "boom",
          status: 1,
          signal: null,
        }) as SpawnSyncReturns<string>,
      assets: [SKILL],
      log: () => {},
      warn: () => {},
    });
    expect(r.failed).toHaveLength(1);
    expect(backupsUnder(dir)).toEqual([]);
    expect(readFileSync(join(dir, CLAUDE_SKILL), "utf8")).toContain("MY PROJECT NOTE");
  });

  it("도구가 고친 파일을 지웠으면(상류에서 빠졌다) 그 편집을 백업으로 남긴다", () => {
    const dir = installedProject();
    put(dir, CLAUDE_REF, "my edited reference\n");
    refreshExternalSkills(dir, {
      spawn: (cmd) => {
        if (cmd === "npx") rmSync(join(dir, CLAUDE_REF));
        return {
          pid: 0,
          output: [],
          stdout: "",
          stderr: "",
          status: 0,
          signal: null,
        } as SpawnSyncReturns<string>;
      },
      assets: [SKILL],
      log: () => {},
      warn: () => {},
    });
    const backups = backupsUnder(dir);
    expect(backups).toHaveLength(1);
    expect(readFileSync(join(dir, backups[0] as string), "utf8")).toBe("my edited reference\n");
  });

  it("스킬 폴더의 설치자 파일(기록 밖 — 노트 · 앞선 백업)은 도구가 폴더를 새로 만들어도 제자리에 남는다", () => {
    const dir = installedProject();
    put(dir, ".claude/skills/a/my-notes.md", "installer note\n");
    put(dir, `${CLAUDE_SKILL}.backup-20260101T000000`, "older edit\n");

    refresh(dir, "# skill a v2\n");

    expect(readFileSync(join(dir, ".claude/skills/a/my-notes.md"), "utf8")).toBe(
      "installer note\n",
    );
    expect(readFileSync(join(dir, `${CLAUDE_SKILL}.backup-20260101T000000`), "utf8")).toBe(
      "older edit\n",
    );
    expect(backupsUnder(dir)).toEqual([`${CLAUDE_SKILL}.backup-20260101T000000`]);
    // 되돌린 설치자 파일을 하네스 몫으로 기록하지 않는다(ADR-096)
    const recorded = (readInstallLog(dir)?.assets[0]?.files ?? []).map((f) => f.path);
    expect(recorded).not.toContain(".claude/skills/a/my-notes.md");
  });

  it("상류가 설치자 파일과 같은 이름의 파일을 들여오면 설치자 내용을 백업으로 남긴다", () => {
    const dir = installedProject();
    put(dir, ".claude/skills/a/extra.md", "installer extra\n");
    refreshExternalSkills(dir, {
      spawn: (cmd) => {
        if (cmd === "npx") put(dir, ".claude/skills/a/extra.md", "upstream extra\n");
        return {
          pid: 0,
          output: [],
          stdout: "",
          stderr: "",
          status: 0,
          signal: null,
        } as SpawnSyncReturns<string>;
      },
      assets: [SKILL],
      log: () => {},
      warn: () => {},
    });
    const backups = backupsUnder(dir);
    expect(backups).toHaveLength(1);
    expect(backups[0]?.startsWith(".claude/skills/a/extra.md.backup-")).toBe(true);
    expect(readFileSync(join(dir, backups[0] as string), "utf8")).toBe("installer extra\n");
  });

  it("runUpdateMode — 백업 쌍이 보고(`backups`)에 실리고 '체크섬 없음' 으로 분류되지 않는다", () => {
    const dir = installedProject();
    put(dir, AGENTS_SKILL, `${V1}MY CODEX NOTE\n`);
    const report = runUpdateMode(dir, join(__dirname, "..", "templates"), join(__dirname, ".."), {
      refreshSkills: (d) => refresh(d, "# skill a v2\n"),
    });
    const pair = report.backups.find((b) => b.path === AGENTS_SKILL);
    expect(pair, JSON.stringify(report.backups)).toBeDefined();
    expect(report.backups.filter((b) => b.path.includes("/skills/a/"))).toHaveLength(1);
    expect(report.noChecksum ?? []).not.toContain(AGENTS_SKILL);
    const list = JSON.parse(
      readFileSync(join(dir, ".uzys-agent-harness", "update-backups.json"), "utf8"),
    ) as { backups: Array<{ path: string; noChecksum?: boolean }> };
    expect(list.backups.find((b) => b.path === AGENTS_SKILL)).toEqual(
      expect.not.objectContaining({ noChecksum: true }),
    );
  });
});
