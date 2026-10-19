import type { SpawnSyncReturns } from "node:child_process";
import {
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
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { type ExternalInstallerDeps, refreshExternalSkills } from "../src/external-installer.js";
import { hashContent, type InstallLog, writeInstallLog } from "../src/install-log.js";
import { createMockAsset } from "./helpers/mock-asset.js";

/**
 * 외부 스킬 도구 앞의 hold(#770 · #780)가 링크 구성에서도 설치자 파일을 지킨다.
 *   #838 `.claude/skills/<id>` 가 `.agents/skills/<id>` 로의 링크(#524 구성) — 한 파일이 두 경로로 잡혀 두 번 옮기다 죽지 않는다
 * 도구는 실 도구처럼 스킬 폴더를 지우고 새로 만든다(링크 자리는 실제 폴더가 된다 — `refreshExternalSkills` 주석의 실측).
 */

const SKILL = createMockAsset({
  id: "skill-a",
  condition: { kind: "any-track", tracks: ["tooling"] },
  method: { kind: "skill", source: "owner/a", skill: "a" },
});

const V1 = "# skill a v1\n";
const CLAUDE_SLOT = ".claude/skills/a";
const AGENTS_SLOT = ".agents/skills/a";

const dirs: string[] = [];
afterEach(() => {
  while (dirs.length > 0) rmSync(dirs.pop() as string, { recursive: true, force: true });
});

function put(dir: string, rel: string, body: string): void {
  mkdirSync(dirname(join(dir, rel)), { recursive: true });
  writeFileSync(join(dir, rel), body);
}

function link(dir: string, rel: string, target: string): void {
  mkdirSync(dirname(join(dir, rel)), { recursive: true });
  symlinkSync(target, join(dir, rel));
}

/** claude+codex 설치 기록 — 도구가 두 자리에 놓은 SKILL.md 와 그 sha. 디스크 모양은 테스트가 정한다. */
function project(): string {
  const dir = mkdtempSync(join(tmpdir(), "uzys-hold-links-"));
  dirs.push(dir);
  writeInstallLog(dir, {
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
          { path: `${CLAUDE_SLOT}/SKILL.md`, sha256: hashContent(V1) },
          { path: `${AGENTS_SLOT}/SKILL.md`, sha256: hashContent(V1) },
        ],
      },
    ],
  } as InstallLog);
  return dir;
}

/** `npx skills add --copy` — 두 자리를 지우고 상류판으로 새로 만든다. `extra` = 상류가 같이 놓는 파일(슬롯 상대). */
function tool(
  dir: string,
  extra: Record<string, string> = {},
): NonNullable<ExternalInstallerDeps["spawn"]> {
  return (cmd) => {
    if (cmd === "npx") {
      for (const slot of [CLAUDE_SLOT, AGENTS_SLOT]) {
        rmSync(join(dir, slot), { recursive: true, force: true });
        put(dir, `${slot}/SKILL.md`, "# skill a v2\n");
        for (const [rel, body] of Object.entries(extra)) put(dir, `${slot}/${rel}`, body);
      }
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

function refresh(dir: string, extra?: Record<string, string>) {
  return refreshExternalSkills(dir, {
    spawn: tool(dir, extra),
    assets: [SKILL],
    log: () => {},
    warn: () => {},
  });
}

function asideDirsLeft(dir: string): string[] {
  return [".claude", ".agents"].flatMap((root) =>
    readdirSync(join(dir, root)).filter((n) => n.includes(".backup-")),
  );
}

describe("#838 — 두 스킬 자리가 링크로 한 폴더면 그 안의 설치자 파일을 한 번만 옮긴다", () => {
  it("`.claude/skills/<id>` → `.agents/skills/<id>` 링크 + 기록 밖 파일: 갱신이 끝까지 돌고 파일은 원래 폴더로 돌아온다", () => {
    const dir = project();
    put(dir, `${AGENTS_SLOT}/SKILL.md`, V1);
    put(dir, `${AGENTS_SLOT}/notes.md`, "my notes\n");
    link(dir, CLAUDE_SLOT, "../../.agents/skills/a");

    const r = refresh(dir);

    expect(r.refreshed).toBe(1);
    // 도구가 링크 자리를 실제 폴더로 바꿔도 설치자 파일은 실제로 있던 폴더(`.agents`)로 돌아간다
    expect(readFileSync(join(dir, AGENTS_SLOT, "notes.md"), "utf8")).toBe("my notes\n");
    expect(asideDirsLeft(dir)).toEqual([]);
  });

  it("링크 겹침이 없으면 각 자리의 설치자 파일이 제 자리로 돌아온다 — 회귀 없음", () => {
    const dir = project();
    put(dir, `${CLAUDE_SLOT}/SKILL.md`, V1);
    put(dir, `${AGENTS_SLOT}/SKILL.md`, V1);
    put(dir, `${CLAUDE_SLOT}/notes.md`, "claude notes\n");
    put(dir, `${AGENTS_SLOT}/notes.md`, "agents notes\n");

    refresh(dir);

    expect(readFileSync(join(dir, CLAUDE_SLOT, "notes.md"), "utf8")).toBe("claude notes\n");
    expect(readFileSync(join(dir, AGENTS_SLOT, "notes.md"), "utf8")).toBe("agents notes\n");
    expect(lstatSync(join(dir, CLAUDE_SLOT)).isDirectory()).toBe(true);
    expect(asideDirsLeft(dir)).toEqual([]);
  });
});
