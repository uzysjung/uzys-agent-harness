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
import { basename, dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { uninstallAction } from "../src/commands/uninstall.js";
import { EXTERNAL_ASSETS } from "../src/external-assets.js";
import {
  type ExternalInstallerDeps,
  holdSkillSlots,
  refreshExternalSkills,
  runExternalInstall,
} from "../src/external-installer.js";
import {
  hashContent,
  type InstallLog,
  readInstallLog,
  writeInstallLog,
} from "../src/install-log.js";
import { runInstall } from "../src/installer.js";
import type { InstallSpec } from "../src/types.js";
import { runUpdateMode } from "../src/update-mode.js";
import { createMockAsset } from "./helpers/mock-asset.js";

/**
 * #890 · #897 — macOS 외장 볼륨(exFAT · FAT · SMB 등 — 확장 속성을 같은 폴더의 `._<name>` 파일로 두는 볼륨)에서 하네스가 그 짝을
 * 독립 파일로 다뤄 install 이 "could not put back N file(s)" 로 멈추고(외부 스킬 hold), 기록에 적힌 짝 때문에 다음 install · update 가
 * ENOTDIR 로 멈추고, update 는 짝을 "번들 밖 파일" 로 백업 · 삭제하고, uninstall 은 짝을 "당신 파일" 로 안내했다.
 *
 * 그런 볼륨은 `<name>` 을 옮기면 `._<name>` 을 함께 옮기고, 짝 없이 옮겨 온 파일은 도착한 자리의 `._<name>` 을 지우고, `<name>` 을
 * 지우면 짝도 지운다 · 새 파일 · 폴더마다 짝이 생긴다(실측 2026-10-25 — `hdiutil create -fs ExFAT` 이미지). CI 는 Linux 라 그 동작을
 * `node:fs` 에서 모사한다 — `volume.pairs` 가 켜진 동안 이름이 `._` 로 시작하지 않는 대상에 짝을 붙여 옮기고 지우며, `volume.stamp` 가
 * 켜져 있으면 새로 생긴 파일 · 폴더에 짝을 만든다. 꺼져 있으면 실물 그대로다(일반 볼륨).
 */
const volume = { pairs: false, stamp: false };
vi.mock("node:fs", async (importOriginal) => {
  const real = await importOriginal<typeof import("node:fs")>();
  const pairOf = (p: unknown): string | null => {
    if (!volume.pairs || typeof p !== "string" || basename(p).startsWith("._")) return null;
    return join(dirname(p), `._${basename(p)}`);
  };
  const stamp = (p: unknown): void => {
    const pair = volume.stamp ? pairOf(p) : null;
    if (pair !== null && real.existsSync(String(p)) && !real.existsSync(pair))
      real.writeFileSync(pair, `xattr of ${basename(String(p))}\n`);
  };
  return {
    ...real,
    writeFileSync: (p: string, ...rest: [never, never?]) => {
      const fresh = typeof p === "string" && !real.existsSync(p);
      real.writeFileSync(p, ...rest);
      if (fresh) stamp(p);
    },
    copyFileSync: (from: string, to: string, mode?: number) => {
      const fresh = !real.existsSync(to);
      real.copyFileSync(from, to, mode);
      if (fresh) stamp(to);
    },
    mkdirSync: (p: string, opts?: Parameters<typeof real.mkdirSync>[1]) => {
      const made: string[] = [];
      for (let d = resolve(p); !real.existsSync(d) && dirname(d) !== d; d = dirname(d))
        made.push(d);
      const out = real.mkdirSync(p, opts);
      for (const d of made) stamp(d);
      return out;
    },
    renameSync: (from: string, to: string) => {
      real.renameSync(from, to);
      const [a, b] = [pairOf(from), pairOf(to)];
      if (a === null || b === null) return;
      if (real.existsSync(a)) real.renameSync(a, b);
      else real.rmSync(b, { force: true });
    },
    rmSync: (p: string, opts?: Parameters<typeof real.rmSync>[1]) => {
      real.rmSync(p, opts);
      const a = pairOf(p);
      if (a !== null) real.rmSync(a, { force: true });
    },
    unlinkSync: (p: string) => {
      real.unlinkSync(p);
      const a = pairOf(p);
      if (a !== null) real.rmSync(a, { force: true });
    },
    rmdirSync: (p: string) => {
      // 그 볼륨의 rmdir 는 짝만 남은 폴더의 짝을 치우고 지운다
      if (volume.pairs && real.readdirSync(p).every((n) => n.startsWith("._")))
        for (const n of real.readdirSync(p)) real.rmSync(join(p, n), { force: true });
      real.rmdirSync(p);
      const a = pairOf(p);
      if (a !== null) real.rmSync(a, { force: true });
    },
  };
});

const HARNESS_ROOT = join(__dirname, "..");
const dirs: string[] = [];
afterEach(() => {
  volume.pairs = false;
  volume.stamp = false;
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

const isPairName = (path: string): boolean => basename(path).startsWith("._");

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
    if (volume.pairs) put(dir, `${root}/._jk`, "xattr of jk\n");
  }
}

const OK = { attempted: [], succeeded: 0, skipped: 0, excludedByCli: [] };

function installHold(dir: string) {
  return holdSkillSlots(dir, {
    recorded: [],
    assets: [],
    slots: [".agents/skills", ".claude/skills"],
    log: null,
    clis: ["claude", "codex"],
    scope: "project",
  });
}

describe("#890 — AppleDouble 짝을 두는 볼륨에서 외부 스킬 hold 가 끝까지 돌고 아무것도 잃지 않는다", () => {
  it("신고 모양(기록 없음 · 스킬 루트 전체 자리): 되돌리기가 실패하지 않고 파일 · 짝 · 앞선 백업이 원래 바이트로 제자리에 있다", () => {
    volume.pairs = true;
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
    volume.pairs = true;
    const dir = reportedLayout();
    const before = walk(dir);

    installHold(dir)(null);

    expect(walk(dir)).toEqual(before);
  });

  it("update — 손대지 않은 외부 스킬 파일의 짝은 '설치자 파일' 로 백업 · displaced 되지 않는다", () => {
    volume.pairs = true;
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

  it("짝 없는 `._<name>`(일반 볼륨의 평범한 파일)은 지금처럼 설치자 파일로 비켜 두었다가 돌려놓는다 — 회귀 없음", () => {
    const dir = mkdtempSync(join(tmpdir(), "uzys-890-plain-"));
    dirs.push(dir);
    put(dir, ".claude/skills/jk/._orphan", "a plain file named like a pair\n");
    put(dir, ".claude/skills/jk/notes.md", "my notes\n");
    const before = walk(dir);

    const settle = installHold(dir);
    // 비켜 두지 않으면 도구가 폴더를 새로 만들 때 사라진다
    expect(existsSync(join(dir, ".claude/skills/jk/._orphan"))).toBe(false);
    rmSync(join(dir, ".claude/skills/jk"), { recursive: true, force: true });
    put(dir, ".claude/skills/jk/SKILL.md", "# jk upstream\n");
    settle(OK);

    expect(walk(dir)).toEqual([...before, ".claude/skills/jk/SKILL.md=# jk upstream\n"].sort());
  });
});

/**
 * 회차 1 (리뷰 BLOCKER-1) — 신고자가 이어서 하는 순서 그대로: 첫 install → 같은 install 다시(신고 화면이 시키는 것 · 트랙 추가) →
 * update → uninstall. 외부 도구만 가짜이고 hold · 기록 · 정리 · 되돌리기는 실물이다. 짝을 기록에 적으면 다음 실행이 그 파일을 스킬
 * 자리로 훑다 ENOTDIR 로 멈췄다.
 */
describe("#890 · #897 — 짝을 두는 볼륨에서 install → install 다시 → update → uninstall", () => {
  const ASSETS = EXTERNAL_ASSETS.filter((a) =>
    ["frontend-design", "jakubkrehel-skills"].includes(a.id),
  );
  const NOTE = ".claude/skills/frontend-design/mine.md";

  function project(): { dir: string; spec: InstallSpec } {
    const dir = mkdtempSync(join(tmpdir(), "uzys-890-seq-"));
    dirs.push(dir);
    return {
      dir,
      spec: {
        tracks: ["csr-fastify"],
        options: { withCodexTrust: false },
        cli: ["claude", "codex"],
        projectDir: dir,
        userOverride: { forceInclude: ASSETS.map((a) => a.id), forceExclude: [] },
      },
    };
  }

  /** `npx skills add` — 소스마다 그 스킬 폴더를 두 루트에 지우고 새로 만든다. 그 밖의 호출(버전 확인 등)은 빈 성공. */
  function tool(dir: string): NonNullable<ExternalInstallerDeps["spawn"]> {
    let round = 0;
    return (cmd, args) => {
      if (cmd === "npx" && args.includes("add")) {
        round++;
        const skill = args.includes("anthropics/skills") ? "frontend-design" : "jk-a";
        for (const root of [".claude/skills", ".agents/skills"]) {
          rmSync(join(dir, root, skill), { recursive: true, force: true });
          put(dir, `${root}/${skill}/SKILL.md`, `# ${skill} r${round}\n`);
          put(dir, `${root}/${skill}/references/guide.md`, `guide r${round}\n`);
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

  function run(dir: string, spec: InstallSpec, mode: "fresh" | "add") {
    const spawn = tool(dir);
    return runInstall({
      harnessRoot: HARNESS_ROOT,
      projectDir: dir,
      spec,
      mode,
      runExternal: (c, d) =>
        runExternalInstall({ ...c, cli: spec.cli }, { ...d, spawn, assets: ASSETS }),
    });
  }

  const recordedPairs = (dir: string): string[] =>
    (readInstallLog(dir)?.assets ?? []).flatMap((a) =>
      (a.files ?? []).map((f) => f.path).filter(isPairName),
    );

  function sequence(dir: string, spec: InstallSpec, afterFirst?: () => void) {
    run(dir, spec, "fresh");
    afterFirst?.();
    put(dir, NOTE, "my note in an external skill folder\n");
    run(dir, spec, "add");
    // 설치자가 고친 하네스 파일 둘 — update 가 백업을 남긴다(그 볼륨이면 백업에도 짝이 생긴다: 루트 · 스킬 폴더 안)
    for (const rel of ["CLAUDE-uzys-harness.md", ".claude/skills/north-star/SKILL.md"])
      writeFileSync(join(dir, rel), `${readFileSync(join(dir, rel), "utf8")}\nmy edit\n`);
    const spawn = tool(dir);
    const updated = runUpdateMode(dir, join(HARNESS_ROOT, "templates"), HARNESS_ROOT, {
      refreshSkills: (p) =>
        refreshExternalSkills(p, { spawn, assets: ASSETS, log: () => {}, warn: () => {} }),
    });
    const noteAfterUpdate = readFileSync(join(dir, NOTE), "utf8");
    const lines: string[] = [];
    let code: number | null = null;
    uninstallAction(
      { projectDir: dir, yes: true },
      {
        exit: (c: number) => {
          code ??= c;
          return undefined as never;
        },
        log: (l: string) => lines.push(l),
        err: (l: string) => lines.push(l),
        resolveHarnessRoot: () => HARNESS_ROOT,
        spawn: (cmd, args) => spawn(cmd, args, { encoding: "utf8", stdio: "pipe" } as never),
      },
    );
    return { updated, noteAfterUpdate, lines, code };
  }

  it("멈추지 않고, 짝을 기록 · 백업 · 정리 · '당신 파일' 안내 어디에도 따로 들이지 않으며, 설치자 파일은 끝까지 남는다", () => {
    volume.pairs = true;
    volume.stamp = true;
    const { dir, spec } = project();

    const { updated, noteAfterUpdate, lines, code } = sequence(dir, spec, () => {
      // 대조군 — 이 모사가 실제로 짝을 만든다. 안 만들면 아래 단언이 전부 다른 이유로 green 이다
      expect(existsSync(join(dir, ".claude/skills/._frontend-design"))).toBe(true);
      expect(existsSync(join(dir, ".claude/skills/frontend-design/._SKILL.md"))).toBe(true);
      expect(recordedPairs(dir)).toEqual([]);
    });

    expect(updated.externalSkillsRefreshed).toBe(ASSETS.length);
    expect(updated.externalSkillsFailed).toEqual([]);
    // 대조군 — 고친 두 파일의 백업은 목록에 오른다. 짝 백업만 빠진다
    expect(updated.backups.map((b) => b.path)).toEqual(
      expect.arrayContaining(["CLAUDE-uzys-harness.md", ".claude/skills/north-star/SKILL.md"]),
    );
    expect(updated.backups.filter((b) => isPairName(b.path))).toEqual([]);
    expect(updated.skillsPruned.filter(isPairName)).toEqual([]);
    expect(noteAfterUpdate).toBe("my note in an external skill folder\n");
    expect(code).toBe(0);
    expect(lines.filter((l) => l.includes("/._") || l.includes(" ._"))).toEqual([]);
    expect(readFileSync(join(dir, NOTE), "utf8")).toBe("my note in an external skill folder\n");
  });

  it("옛 판이 짝을 자산 파일로 적어 둔 기록이어도 같은 순서가 멈추지 않는다 — 기록은 고치지 않고 읽는 쪽이 거른다", () => {
    volume.pairs = true;
    volume.stamp = true;
    const { dir, spec } = project();

    const { updated, lines, code } = sequence(dir, spec, () => {
      // 옛 판(≤ v26.174.0)이 그 볼륨에서 남긴 기록 모양 — 스킬 폴더의 짝 · 그 안 파일의 짝을 자산 파일로 적었다
      const log = readInstallLog(dir) as InstallLog;
      const pairs = [
        ".claude/skills/._frontend-design",
        ".claude/skills/frontend-design/._SKILL.md",
        ".agents/skills/._frontend-design",
      ];
      writeInstallLog(dir, {
        ...log,
        assets: log.assets.map((a) =>
          a.id === "frontend-design"
            ? {
                ...a,
                files: [
                  ...(a.files ?? []),
                  // 그 뒤 속성이 바뀌었다(다른 프로세스가 다시 만든 짝) — 기록 sha 와 다르다
                  ...pairs.map((path) => ({
                    path,
                    sha256: hashContent(`xattr at install of ${path}\n`),
                  })),
                ],
              }
            : a,
        ),
      });
      expect(recordedPairs(dir)).toEqual(expect.arrayContaining(pairs));
    });

    expect(updated.externalSkillsRefreshed).toBe(ASSETS.length);
    expect(code).toBe(0);
    expect(lines.filter((l) => l.includes("/._") || l.includes(" ._"))).toEqual([]);
  });
});
