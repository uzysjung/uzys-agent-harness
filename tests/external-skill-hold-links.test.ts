import type { SpawnSyncReturns } from "node:child_process";
import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { restoreDisplaced } from "../src/displaced.js";
import { type ExternalInstallerDeps, refreshExternalSkills } from "../src/external-installer.js";
import {
  hashContent,
  type InstallLog,
  readInstallLog,
  writeInstallLog,
} from "../src/install-log.js";
import { createMockAsset } from "./helpers/mock-asset.js";

/**
 * 외부 스킬 도구 앞의 hold(#770 · #780)가 링크 구성에서도 설치자 파일을 지킨다.
 *   #838 `.claude/skills/<id>` 가 `.agents/skills/<id>` 로의 링크(#524 구성) — 한 파일이 두 경로로 잡혀 두 번 옮기다 죽지 않는다
 *   #839 스킬 폴더 안의 링크(파일 · 폴더) — 링크 자체를 옮겼다가 돌려놓는다(따라가지 않는다)
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

describe("#839 — 스킬 폴더 안의 링크(파일 · 폴더)도 도구가 폴더를 새로 만든 뒤 제자리에 있다", () => {
  function linkedSlot(): string {
    const dir = project();
    put(dir, `${CLAUDE_SLOT}/SKILL.md`, V1);
    put(dir, `${AGENTS_SLOT}/SKILL.md`, V1);
    put(dir, "outside-ref.pdf", "pdf\n");
    put(dir, "shared/logo.svg", "<svg/>\n");
    link(dir, `${CLAUDE_SLOT}/ref.pdf`, "../../../outside-ref.pdf");
    link(dir, `${CLAUDE_SLOT}/assets`, "../../../shared");
    put(dir, `${CLAUDE_SLOT}/notes.md`, "notes\n");
    return dir;
  }

  it("링크 파일 · 링크 폴더가 가리키던 글자 그대로 돌아오고, 가리키던 본체는 그대로다", () => {
    const dir = linkedSlot();

    expect(refresh(dir).refreshed).toBe(1);

    for (const [rel, target] of [
      ["ref.pdf", "../../../outside-ref.pdf"],
      ["assets", "../../../shared"],
    ] as const) {
      expect(lstatSync(join(dir, CLAUDE_SLOT, rel)).isSymbolicLink(), rel).toBe(true);
      expect(readlinkSync(join(dir, CLAUDE_SLOT, rel))).toBe(target);
    }
    expect(readFileSync(join(dir, CLAUDE_SLOT, "assets/logo.svg"), "utf8")).toBe("<svg/>\n");
    expect(readFileSync(join(dir, CLAUDE_SLOT, "notes.md"), "utf8")).toBe("notes\n");
    expect(asideDirsLeft(dir)).toEqual([]);
  });

  it("상류가 링크와 같은 이름을 들여오면 링크를 링크 그대로 백업으로 남기고 displaced 로 적는다 — uninstall 이 되돌린다", () => {
    const dir = linkedSlot();

    refresh(dir, { "assets/upstream.svg": "<upstream/>\n" });

    expect(readFileSync(join(dir, CLAUDE_SLOT, "assets/upstream.svg"), "utf8")).toBe(
      "<upstream/>\n",
    );
    const backups = readdirSync(join(dir, CLAUDE_SLOT)).filter((n) =>
      n.startsWith("assets.backup-"),
    );
    expect(backups).toHaveLength(1);
    const backup = `${CLAUDE_SLOT}/${backups[0]}`;
    expect(readlinkSync(join(dir, backup))).toBe("../../../shared");
    expect(readInstallLog(dir)?.rootFiles).toContainEqual({
      path: `${CLAUDE_SLOT}/assets`,
      change: "displaced",
      notes: [backup],
    });
    expect(readFileSync(join(dir, "shared/logo.svg"), "utf8")).toBe("<svg/>\n");
    expect(asideDirsLeft(dir)).toEqual([]);
    // 자산이 자리를 떠나면(uninstall) 같은 함수가 링크를 제자리로 되돌린다
    rmSync(join(dir, CLAUDE_SLOT, "assets"), { recursive: true });
    restoreDisplaced(readInstallLog(dir) as InstallLog, dir, { has: () => true, write: true });
    expect(readlinkSync(join(dir, CLAUDE_SLOT, "assets"))).toBe("../../../shared");
  });

  it("도구가 실패하면 링크를 바로 제자리로 돌린다", () => {
    const dir = linkedSlot();
    refreshExternalSkills(dir, {
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
    expect(readlinkSync(join(dir, CLAUDE_SLOT, "assets"))).toBe("../../../shared");
    expect(readlinkSync(join(dir, CLAUDE_SLOT, "ref.pdf"))).toBe("../../../outside-ref.pdf");
    expect(asideDirsLeft(dir)).toEqual([]);
  });
});
