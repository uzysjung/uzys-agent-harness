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
import { basename, dirname, join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { holdSkillSlots, refreshExternalSkills } from "../src/external-installer.js";
import { hashContent, type InstallLog, writeInstallLog } from "../src/install-log.js";
import { createMockAsset } from "./helpers/mock-asset.js";

/**
 * #890 — macOS 외장 볼륨(exFAT · FAT · SMB 등 — 확장 속성을 같은 폴더의 `._<name>` 파일로 두는 볼륨)에서 외부 스킬 도구 앞의
 * hold(#770 · #780)가 `._<name>` 을 따로 옮겼다가 되돌리지 못해 install 이 "could not put back N file(s)" 로 멈췄다.
 *
 * 그런 볼륨은 `<name>` 을 옮기면 `._<name>` 을 함께 옮기고, 짝 없이 옮겨 온 파일은 도착한 자리의 `._<name>` 을 지우고, `<name>` 을
 * 지우면 `._<name>` 도 지운다(실측 2026-10-25 — `hdiutil create -fs ExFAT` 이미지, 그 이미지에서 실제 hold 로 재현 · 해소 확인). CI 는
 * Linux 라 그 동작을 `node:fs` 에서 모사한다 — `appleDouble.on` 이 켜진 동안만, 이름이 `._` 로 시작하지 않는 대상에 짝을 붙여 다룬다.
 * 꺼져 있으면 실물 그대로다(일반 볼륨 — `._<name>` 도 평범한 파일).
 */
const appleDouble = { on: false };
vi.mock("node:fs", async (importOriginal) => {
  const real = await importOriginal<typeof import("node:fs")>();
  const pair = (p: unknown): string | null => {
    const s = String(p);
    return appleDouble.on && !basename(s).startsWith("._")
      ? join(dirname(s), `._${basename(s)}`)
      : null;
  };
  return {
    ...real,
    renameSync: (from: string, to: string) => {
      real.renameSync(from, to);
      const [a, b] = [pair(from), pair(to)];
      if (a === null || b === null) return;
      if (real.existsSync(a)) real.renameSync(a, b);
      else real.rmSync(b, { force: true });
    },
    rmSync: (p: string, opts?: Parameters<typeof real.rmSync>[1]) => {
      real.rmSync(p, opts);
      const a = pair(p);
      if (a !== null) real.rmSync(a, { force: true });
    },
    unlinkSync: (p: string) => {
      real.unlinkSync(p);
      const a = pair(p);
      if (a !== null) real.rmSync(a, { force: true });
    },
    rmdirSync: (p: string) => {
      real.rmdirSync(p);
      const a = pair(p);
      if (a !== null) real.rmSync(a, { force: true });
    },
  };
});

const dirs: string[] = [];
afterEach(() => {
  appleDouble.on = false;
  while (dirs.length > 0) rmSync(dirs.pop() as string, { recursive: true, force: true });
});

function put(dir: string, rel: string, body: string): void {
  mkdirSync(dirname(join(dir, rel)), { recursive: true });
  writeFileSync(join(dir, rel), body);
}

/** 파일 · 폴더 하나와 그 AppleDouble 짝 — 짝 내용은 그 대상의 확장 속성이다(바이트로 대조한다). */
function withPair(dir: string, rel: string, body: string | null): void {
  if (body === null) mkdirSync(join(dir, rel), { recursive: true });
  else put(dir, rel, body);
  put(dir, join(dirname(rel), `._${basename(rel)}`), `xattr of ${rel}\n`);
}

function walk(dir: string, prefix = ""): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory()
        ? [`${prefix}${e.name}/`, ...walk(join(dir, e.name), `${prefix}${e.name}/`)]
        : [`${prefix}${e.name}=${readFileSync(join(dir, e.name), "utf8")}`],
    )
    .sort();
}

/**
 * #890 신고 그대로의 모양 — 기록 없는 첫 install(하네스 번들 스킬을 막 쓴 뒤) · 소스 전체를 까는 외부 자산이라 자리가 스킬 루트 전체.
 * 하네스 스킬 폴더 · 그 안 하위 폴더 · 앞선 update 의 백업 · 설치자 노트마다 짝이 있다.
 */
function reportedLayout(): string {
  const dir = mkdtempSync(join(tmpdir(), "uzys-890-"));
  dirs.push(dir);
  withPair(dir, ".agents/skills/audit-harness-fit", null);
  withPair(dir, ".agents/skills/audit-harness-fit/SKILL.md", "harness skill\n");
  withPair(dir, ".agents/skills/audit-harness-fit/references", null);
  withPair(dir, ".agents/skills/audit-harness-fit/references/apply.md", "harness ref\n");
  withPair(dir, ".agents/skills/north-star", null);
  withPair(dir, ".agents/skills/north-star/SKILL.md", "harness skill\n");
  withPair(dir, ".agents/skills/north-star/SKILL.md.backup-20260915T113015", "old backup\n");
  withPair(dir, ".claude/skills/keep", null);
  withPair(dir, ".claude/skills/keep/NOTE.md", "my note\n");
  return dir;
}

/** 도구 — 소스의 스킬 `jk` 를 두 루트에 새로 만든다(그 볼륨이면 도구 파일에도 짝이 생긴다). */
function runTool(dir: string): void {
  for (const root of [".claude/skills", ".agents/skills"]) {
    rmSync(join(dir, root, "jk"), { recursive: true, force: true });
    put(dir, `${root}/jk/SKILL.md`, "# jk upstream\n");
    if (appleDouble.on) put(dir, `${root}/._jk`, "xattr of jk\n");
  }
}

const OK = { attempted: [], succeeded: 0, skipped: 0, excludedByCli: [] };

function installHold(dir: string) {
  return holdSkillSlots(dir, {
    recorded: [],
    slots: [".agents/skills", ".claude/skills"],
    log: null,
    clis: ["claude", "codex"],
    scope: "project",
  });
}

describe("#890 — AppleDouble 짝을 두는 볼륨에서 외부 스킬 hold 가 끝까지 돌고 아무것도 잃지 않는다", () => {
  it("신고 모양(기록 없음 · 스킬 루트 전체 자리): 되돌리기가 실패하지 않고 파일 · 짝 · 앞선 백업이 원래 바이트로 제자리에 있다", () => {
    appleDouble.on = true;
    const dir = reportedLayout();
    const before = walk(dir);

    const settle = installHold(dir);
    runTool(dir);
    const settled = settle(OK);

    expect(settled.backups).toEqual([]);
    expect(settled.displaced).toEqual([]);
    const tool = [
      ".agents/skills/._jk=xattr of jk\n",
      ".agents/skills/jk/",
      ".agents/skills/jk/SKILL.md=# jk upstream\n",
      ".claude/skills/._jk=xattr of jk\n",
      ".claude/skills/jk/",
      ".claude/skills/jk/SKILL.md=# jk upstream\n",
    ];
    // 옮겨 둔 백업 폴더(`<root>.backup-<시각>/`)까지 걷혔다 — 남았으면 이 목록에 그 폴더가 보인다
    expect(walk(dir)).toEqual([...before, ...tool].sort());
  });

  it("도구가 예외로 끝나도(전부 제자리로) 짝을 잃지 않는다", () => {
    appleDouble.on = true;
    const dir = reportedLayout();
    const before = walk(dir);

    installHold(dir)(null);

    expect(walk(dir)).toEqual(before);
  });

  it("update — 손대지 않은 외부 스킬 파일의 짝은 '설치자 파일' 로 백업 · displaced 되지 않는다", () => {
    appleDouble.on = true;
    const dir = mkdtempSync(join(tmpdir(), "uzys-890-upd-"));
    dirs.push(dir);
    const SKILL = createMockAsset({
      id: "skill-a",
      condition: { kind: "any-track", tracks: ["tooling"] },
      method: { kind: "skill", source: "owner/a", skill: "a" },
    });
    writeInstallLog(dir, {
      schemaVersion: 1,
      installedAt: "2026-10-12T00:00:00.000Z",
      scope: "project",
      spec: { tracks: ["tooling"], cli: ["codex"] },
      templates: { claudeDir: ".claude/" },
      assets: [
        {
          id: SKILL.id,
          category: "dev-tools",
          method: "skill",
          scope: "project",
          detail: { source: "owner/a", skill: "a" },
          files: [{ path: ".agents/skills/a/SKILL.md", sha256: hashContent("# a v1\n") }],
        },
      ],
    } as InstallLog);
    withPair(dir, ".agents/skills/a", null);
    withPair(dir, ".agents/skills/a/SKILL.md", "# a v1\n");
    const spawn = (cmd: string) => {
      if (cmd === "npx") {
        rmSync(join(dir, ".agents/skills/a"), { recursive: true, force: true });
        put(dir, ".agents/skills/a/SKILL.md", "# a v2\n");
        put(dir, ".agents/skills/a/._SKILL.md", "xattr of the new file\n");
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

    const r = refreshExternalSkills(dir, { spawn, assets: [SKILL], log: () => {}, warn: () => {} });

    expect(r.refreshed).toBe(1);
    expect(r.judged ?? []).toEqual([]);
    expect(readdirSync(join(dir, ".agents/skills/a")).sort()).toEqual(["._SKILL.md", "SKILL.md"]);
  });

  it("짝을 두지 않는 볼륨(일반 볼륨)에서는 `._<name>` 도 평범한 설치자 파일로 지금처럼 지킨다 — 회귀 없음", () => {
    const dir = reportedLayout();
    const before = walk(dir);

    const settle = installHold(dir);
    // 일반 볼륨의 `._<name>` 은 그냥 파일이다 — hold 가 비켜 두지 않으면 도구가 폴더를 새로 만들 때 사라진다
    expect(existsSync(join(dir, ".claude/skills/keep/._NOTE.md"))).toBe(false);
    runTool(dir);
    settle(OK);

    expect(walk(dir)).toEqual(
      [
        ...before,
        ".agents/skills/jk/",
        ".agents/skills/jk/SKILL.md=# jk upstream\n",
        ".claude/skills/jk/",
        ".claude/skills/jk/SKILL.md=# jk upstream\n",
      ].sort(),
    );
  });
});
