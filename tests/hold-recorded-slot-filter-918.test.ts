import type { SpawnSyncReturns } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { leftAsIsRows } from "../src/commands/install-render.js";
import { EXTERNAL_ASSETS, type ExternalAsset } from "../src/external-assets.js";
import {
  type ExternalInstallerDeps,
  refreshExternalSkills,
  runExternalInstall,
} from "../src/external-installer.js";
import { listFilesRecursive } from "../src/fs-ops.js";
import {
  hashContent,
  type InstallLog,
  readInstallLog,
  writeInstallLog,
} from "../src/install-log.js";
import { runInstall } from "../src/installer.js";
import type { CliTargets, InstallSpec } from "../src/types.js";
import { createMockAsset } from "./helpers/mock-asset.js";

/**
 * #918 — 설치 기록은 커밋된다(ADR-100). 남이 고친 기록의 외부 스킬 `files` 가 그 자산의 스킬 폴더 밖(4단 이상 경로 · 다른 스킬
 * 폴더 · `../` · 링크로 둔 자리)을 가리켜도 update · install 재실행의 hold 가 그 파일을 제자리에서 빼 백업으로 옮기지 않는다.
 * 실 도구 대신 "고른 에이전트 자리를 폴더째 지우고 상류판을 쓰는" 목(`legacy-external-skill-files-902` 방식).
 */

const HARNESS_ROOT = resolve(__dirname, "..");
const found = EXTERNAL_ASSETS.find((a) => a.id === "frontend-design");
if (found === undefined) throw new Error("catalog has no frontend-design");
const FD = found;
const BODY = "# frontend-design\n";
const SRC = "src/a/b/c.ts";
const SRC_BODY = "export const x = 1;\n";
const MINE = ".claude/skills/my-own/SKILL.md";
const MINE_BODY = "# my own skill\n";

const dirs: string[] = [];
afterEach(() => {
  vi.useRealTimers();
  while (dirs.length > 0) rmSync(dirs.pop() as string, { recursive: true, force: true });
});

// 실행마다 시계를 하루씩 민다 — 한 테스트 안의 여러 실행이 같은 초의 백업 이름으로 겹치지 않게
let day = 0;
function tick(): void {
  vi.useFakeTimers({ toFake: ["Date"], now: new Date(Date.UTC(2026, 10, 1 + ++day)) });
}

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

/** `npx skills add --agent … --copy` 처럼 고른 에이전트 자리마다 `<root>/<name>` 을 지우고 상류판으로 다시 쓴다. */
function fakeTool(dir: string, name: string): NonNullable<ExternalInstallerDeps["spawn"]> {
  return (cmd, args) => {
    if (cmd !== "npx" || args[1] !== "add") return ok();
    const agents = args.flatMap((a, i) => (args[i - 1] === "--agent" ? [a] : []));
    for (const agent of new Set(agents)) {
      const root = agent === "claude-code" ? ".claude/skills" : ".agents/skills";
      rmSync(join(dir, root, name), { recursive: true, force: true });
      put(dir, `${root}/${name}/SKILL.md`, BODY);
    }
    return ok();
  };
}

function install(
  dir: string,
  cli: CliTargets,
  asset: ExternalAsset = FD,
  name = "frontend-design",
): void {
  tick();
  runInstall({
    harnessRoot: HARNESS_ROOT,
    projectDir: dir,
    spec: {
      tracks: ["tooling"],
      options: { withCodexTrust: false },
      cli,
      projectDir: dir,
      userOverride: { forceInclude: [asset.id], forceExclude: [] },
    } satisfies InstallSpec,
    mode: "add",
    runExternal: (ctx, deps) =>
      runExternalInstall({ ...ctx, cli }, { ...deps, assets: [asset], spawn: fakeTool(dir, name) }),
  });
}

function update(dir: string, asset: ExternalAsset = FD, name = "frontend-design") {
  tick();
  return refreshExternalSkills(dir, {
    spawn: fakeTool(dir, name),
    assets: [asset],
    log: () => {},
    warn: () => {},
  });
}

/** 기록의 `id` 자산 `files` 에 위조 항목을 더한다 — 기록 sha 는 디스크와 다르다(설치자가 "고친" 하네스 파일로 읽히는 모양). */
function forge(dir: string, id: string, paths: ReadonlyArray<string>, skill?: string): void {
  const log = readInstallLog(dir) as InstallLog;
  writeInstallLog(dir, {
    ...log,
    assets: log.assets.map((a) =>
      a.id === id
        ? {
            ...a,
            ...(skill !== undefined ? { detail: { ...a.detail, skill } } : {}),
            files: [
              ...(a.files ?? []),
              ...paths.map((path) => ({ path, sha256: hashContent("forged\n") })),
            ],
          }
        : a,
    ),
  });
}

function backupsIn(dir: string): string[] {
  return listFilesRecursive(dir).filter((p) => p.includes(".backup-"));
}

/** 설치 · 설치자 파일 두 개 · 기록 위조 뒤의 프로젝트. */
function forgedProject(
  paths: ReadonlyArray<string>,
  prep?: (dir: string) => void,
  skill?: string,
): string {
  const dir = mkdtempSync(join(tmpdir(), "uzys-918-"));
  dirs.push(dir);
  install(dir, ["claude"]);
  put(dir, SRC, SRC_BODY);
  put(dir, MINE, MINE_BODY);
  prep?.(dir);
  forge(dir, "frontend-design", paths, skill);
  return dir;
}

function expectUntouched(dir: string): void {
  expect(read(dir, SRC)).toBe(SRC_BODY);
  expect(read(dir, MINE)).toBe(MINE_BODY);
  expect(backupsIn(dir)).toEqual([]);
}

const FORGED: ReadonlyArray<[string, ReadonlyArray<string>, ((dir: string) => void)?]> = [
  ["4단 이상 경로", [SRC]],
  ["다른 스킬 폴더", [MINE]],
  ["`../` 로 접두를 바꾼 소스 경로", [`src/../${SRC}`]],
  ["`../` 로 다른 스킬 폴더로 돌아오는 경로", [".claude/skills/my-own/../my-own/SKILL.md"]],
  [
    "스킬 자리를 프로젝트 안 다른 폴더로의 링크로 둔 자리",
    [".agents/skills/frontend-design/c.ts"],
    (dir) => {
      mkdirSync(join(dir, ".agents/skills"), { recursive: true });
      symlinkSync("../../src/a/b", join(dir, ".agents/skills/frontend-design"));
    },
  ],
];

describe("#918 — 기록이 스킬 폴더 밖을 가리켜도 hold 는 그 파일을 옮기지 않는다", () => {
  it("대조군 — 위조 없는 기록은 update · install 재실행에서 백업을 남기지 않는다", () => {
    const dir = forgedProject([]);
    update(dir);
    install(dir, ["claude"]);
    expectUntouched(dir);
    expect(read(dir, ".claude/skills/frontend-design/SKILL.md")).toBe(BODY);
  });

  for (const [what, paths, prep] of FORGED) {
    it(`update — ${what}`, () => {
      const dir = forgedProject(paths, prep);
      update(dir);
      expectUntouched(dir);
    });

    it(`install 재실행 — ${what}`, () => {
      const dir = forgedProject(paths, prep);
      install(dir, ["claude"]);
      expectUntouched(dir);
    });
  }

  // 기록의 이름까지 위조해도 자리 이름은 카탈로그가 정한다 — 기록이 자리를 정하지 않는다
  it("update — 기록의 `detail.skill` 까지 다른 스킬 폴더 이름으로 위조", () => {
    const dir = forgedProject([MINE], undefined, "my-own");
    update(dir);
    expectUntouched(dir);
  });

  it("install 재실행 — 기록의 `detail.skill` 까지 다른 스킬 폴더 이름으로 위조", () => {
    const dir = forgedProject([MINE], undefined, "my-own");
    install(dir, ["claude"]);
    expectUntouched(dir);
  });

  // 대조 — 상류가 스킬 이름을 바꾼 옛 기록(기록 이름 ≠ 카탈로그 이름): 설치자가 고친 옛 폴더 파일이 사라지지 않는다
  for (const [what, run] of [
    ["update", (dir: string) => update(dir)],
    ["install 재실행", (dir: string) => install(dir, ["claude"])],
  ] as const) {
    it(`${what} — 이름이 바뀐 옛 기록의 옛 폴더 파일은 제자리`, () => {
      const OLD = ".claude/skills/old-design/SKILL.md";
      const EDITED = "# old design — my edits\n";
      const dir = mkdtempSync(join(tmpdir(), "uzys-918-rename-"));
      dirs.push(dir);
      install(dir, ["claude"]);
      put(dir, OLD, EDITED);
      const log = readInstallLog(dir) as InstallLog;
      writeInstallLog(dir, {
        ...log,
        assets: log.assets.map((a) =>
          a.id === "frontend-design"
            ? {
                ...a,
                detail: { ...a.detail, skill: "old-design" },
                files: [{ path: OLD, sha256: hashContent(BODY) }],
              }
            : a,
        ),
      });
      run(dir);
      expect(read(dir, OLD)).toBe(EDITED);
      expect(backupsIn(dir)).toEqual([]);
    });
  }

  it("소스 전체 자산(`detail.skill` 없음)의 기록이 스킬 루트 밖을 가리켜도 update 는 그 파일을 옮기지 않는다", () => {
    const whole = createMockAsset({
      id: "whole",
      condition: { kind: "any-track", tracks: ["tooling"] },
      method: { kind: "skill", source: "owner/whole" },
    });
    const dir = mkdtempSync(join(tmpdir(), "uzys-918-whole-"));
    dirs.push(dir);
    put(dir, ".claude/skills/w/SKILL.md", BODY);
    put(dir, SRC, SRC_BODY);
    writeInstallLog(dir, {
      schemaVersion: 1,
      installedAt: "2026-10-01T00:00:00.000Z",
      scope: "project",
      spec: { tracks: ["tooling"], cli: ["claude"] },
      templates: { claudeDir: ".claude/" },
      assets: [
        {
          id: whole.id,
          category: "dev-tools",
          method: "skill",
          scope: "project",
          detail: { source: "owner/whole" },
          files: [
            { path: ".claude/skills/w/SKILL.md", sha256: hashContent(BODY) },
            { path: SRC, sha256: hashContent("forged\n") },
          ],
        },
      ],
    } as InstallLog);
    update(dir, whole, "w");
    expect(read(dir, SRC)).toBe(SRC_BODY);
    expect(backupsIn(dir)).toEqual([]);
  });
});

const jk = EXTERNAL_ASSETS.find((a) => a.id === "jakubkrehel-skills");
if (jk === undefined) throw new Error("catalog has no jakubkrehel-skills");
const JK = jk;

/** 소스 전체 자산(jakubkrehel-skills · 도구가 `jk` 폴더를 쓴다)을 claude 로 깐 프로젝트. */
function wholeProject(): string {
  const dir = mkdtempSync(join(tmpdir(), "uzys-918-ws-"));
  dirs.push(dir);
  install(dir, ["claude"], JK, "jk");
  return dir;
}

function editRecord(
  dir: string,
  id: string,
  edit: (a: InstallLog["assets"][number]) => object,
): void {
  const log = readInstallLog(dir) as InstallLog;
  writeInstallLog(dir, {
    ...log,
    assets: log.assets.map((a) => (a.id === id ? { ...a, ...edit(a) } : a)),
  });
}

describe("#918 회차 2 — 기록 파일의 백업+제거는 도구가 이번에 새로 쓴 폴더 안에서만", () => {
  const runs = [
    ["update", (dir: string) => update(dir, JK, "jk")],
    ["install 재실행", (dir: string) => install(dir, ["claude"], JK, "jk")],
  ] as const;

  for (const [what, run] of runs) {
    it(`${what} — 소스 전체 자산 기록에 다른 스킬 폴더(${MINE})를 넣어도 제자리 · 백업 0`, () => {
      const dir = wholeProject();
      put(dir, MINE, MINE_BODY);
      forge(dir, JK.id, [MINE]);
      run(dir);
      expect(read(dir, MINE)).toBe(MINE_BODY);
      expect(backupsIn(dir)).toEqual([]);
    });

    it(`${what} — 소스 전체 자산 기록의 \`detail.skill\` 까지 위조해도 제자리 · 백업 0`, () => {
      const dir = wholeProject();
      put(dir, MINE, MINE_BODY);
      forge(dir, JK.id, [MINE], "my-own");
      run(dir);
      expect(read(dir, MINE)).toBe(MINE_BODY);
      expect(backupsIn(dir)).toEqual([]);
    });
  }

  // 정상에서 바뀌는 것 — 상류가 뺀 소스 전체 자산의 옛 스킬 폴더에서 설치자가 고친 기록 파일은 백업+제거 대신 제자리(손실 없는 쪽)
  it("update — 상류가 뺀 소스 전체 자산의 옛 폴더에서 고친 기록 파일은 제자리 · 백업 0", () => {
    const OLD = ".claude/skills/old-jk/SKILL.md";
    const EDITED = "# old jk — my edits\n";
    const dir = wholeProject();
    put(dir, OLD, EDITED);
    editRecord(dir, JK.id, (a) => ({
      files: [...(a.files ?? []), { path: OLD, sha256: hashContent(BODY) }],
    }));
    update(dir, JK, "jk");
    expect(read(dir, OLD)).toBe(EDITED);
    expect(backupsIn(dir)).toEqual([]);
  });

  // 대조 — 이름 있는 자산의 폴더는 도구가 통째로 새로 쓴다: 상류가 뺀 파일을 고쳤으면 그 파일 하나를 백업하고 live 에서 뺀다(그대로)
  it("update — 이름 있는 자산 폴더에서 상류가 뺀 고친 기록 파일은 백업+제거(그대로)", () => {
    const GONE = ".claude/skills/frontend-design/old.md";
    const dir = forgedProject([]);
    put(dir, GONE, "# my edits\n");
    editRecord(dir, FD.id, (a) => ({
      files: [...(a.files ?? []), { path: GONE, sha256: hashContent("upstream\n") }],
    }));
    update(dir);
    expect(existsSync(join(dir, GONE))).toBe(false);
    expect(backupsIn(dir).filter((p) => p.startsWith(`${GONE}.backup-`))).toHaveLength(1);
  });
});

describe("#918 회차 2 — 스킬 자리가 스킬 폴더 밖으로 풀리는 링크면 그 자리로 도구를 부르지 않고 hold 도 따라가지 않는다", () => {
  /** 카탈로그 자리 `slot` 을 `src/a/b` 로의 상대 링크로 바꾼 프로젝트. */
  function linkedProject(cli: CliTargets, slot: string): string {
    const dir = mkdtempSync(join(tmpdir(), "uzys-918-lc-"));
    dirs.push(dir);
    install(dir, cli);
    put(dir, SRC, SRC_BODY);
    put(dir, "src/a/b/d.ts", "export const d = 1;\n");
    rmSync(join(dir, slot), { recursive: true, force: true });
    mkdirSync(dirname(join(dir, slot)), { recursive: true });
    symlinkSync("../../src/a/b", join(dir, slot));
    return dir;
  }

  function expectSrcInPlace(dir: string, slot: string): void {
    expect(read(dir, SRC)).toBe(SRC_BODY);
    expect(read(dir, "src/a/b/d.ts")).toBe("export const d = 1;\n");
    expect(lstatSync(join(dir, slot)).isSymbolicLink()).toBe(true);
    expect(backupsIn(dir)).toEqual([]);
  }

  const C = ".claude/skills/frontend-design";
  const A = ".agents/skills/frontend-design";

  it("update · claude 만 — 도구를 부르지 않고 화면 줄이 그 자리를 말한다", () => {
    const dir = linkedProject(["claude"], C);
    const r = update(dir);
    expectSrcInPlace(dir, C);
    expect(r.failed.map((f) => f.message).join("\n")).toContain(
      `${C} links outside the skill folders`,
    );
  });

  it("install 재실행 · claude 만", () => {
    const dir = linkedProject(["claude"], C);
    install(dir, ["claude"]);
    expectSrcInPlace(dir, C);
  });

  it("update · claude+codex 에서 `.agents` 자리 링크 — claude 자리만 새로 쓴다", () => {
    const dir = linkedProject(["claude", "codex"], A);
    update(dir);
    expectSrcInPlace(dir, A);
    expect(read(dir, `${C}/SKILL.md`)).toBe(BODY);
  });

  it("install 재실행 · claude+codex 에서 `.agents` 자리 링크", () => {
    const dir = linkedProject(["claude", "codex"], A);
    install(dir, ["claude", "codex"]);
    expectSrcInPlace(dir, A);
  });

  // 대조 — 정규 레이아웃(#524 `.claude/skills/<id>` → `.agents/skills/<id>`, 둘 다 스킬 폴더)은 지금처럼 도구가 두 자리를 쓴다
  it("대조 — 자리끼리 잇는 링크는 그대로 처리된다", () => {
    const dir = mkdtempSync(join(tmpdir(), "uzys-918-lc-ok-"));
    dirs.push(dir);
    install(dir, ["claude", "codex"]);
    put(dir, `${A}/note.md`, "my note\n");
    rmSync(join(dir, C), { recursive: true, force: true });
    symlinkSync("../../.agents/skills/frontend-design", join(dir, C));
    const r = update(dir);
    expect(r.failed).toEqual([]);
    expect(read(dir, `${A}/SKILL.md`)).toBe(BODY);
    expect(read(dir, `${C}/SKILL.md`)).toBe(BODY);
    expect(read(dir, `${A}/note.md`)).toBe("my note\n");
  });
});

describe("#918 회차 3 — hold 가 옮긴 파일은 언제나 옮기기 전 실제로 있던 자리로 돌아간다", () => {
  const C = ".claude/skills/frontend-design";
  const A = ".agents/skills/frontend-design";
  const OWN = "src/frontend-design/mine.ts";
  const OWN_BODY = "export const mine = 1;\n";

  /** `.agents/skills → src` · `.claude/skills/frontend-design → src/frontend-design` 링크 둘 — 설치자 `src/frontend-design/mine.ts`. */
  function twoLinks(forged: boolean): string {
    const dir = mkdtempSync(join(tmpdir(), "uzys-918-r3-"));
    dirs.push(dir);
    install(dir, ["claude"]);
    put(dir, OWN, OWN_BODY);
    rmSync(join(dir, ".agents/skills"), { recursive: true, force: true });
    mkdirSync(join(dir, ".agents"), { recursive: true });
    symlinkSync("../src", join(dir, ".agents/skills"));
    rmSync(join(dir, C), { recursive: true, force: true });
    symlinkSync("../../src/frontend-design", join(dir, C));
    if (forged) forge(dir, FD.id, [`${C}/mine.ts`]);
    return dir;
  }

  for (const forged of [false, true]) {
    const what = forged ? "기록에 그 경로를 위조해도" : "위조 없이";
    it(`update — 링크 둘(${what}): 설치자 파일은 원래 폴더 · 백업 0`, () => {
      const dir = twoLinks(forged);
      update(dir);
      expect(read(dir, OWN)).toBe(OWN_BODY);
      expect(existsSync(join(dir, C, "mine.ts"))).toBe(false);
      expect(backupsIn(dir)).toEqual([]);
    });

    it(`install 재실행 — 링크 둘(${what}): 설치자 파일은 원래 폴더 · 백업 0`, () => {
      const dir = twoLinks(forged);
      install(dir, ["claude"]);
      expect(read(dir, OWN)).toBe(OWN_BODY);
      expect(existsSync(join(dir, C, "mine.ts"))).toBe(false);
      expect(backupsIn(dir)).toEqual([]);
    });
  }

  // 대조 — 정규 레이아웃(#524 · #838): claude 자리가 `.agents` 자리로의 링크면 그 안 설치자 노트는 원래 있던 `.agents` 폴더로 돌아간다
  it("대조 — `.claude/skills/<id>` → `.agents/skills/<id>` 링크 자리의 노트는 `.agents` 폴더에 남고 도구는 claude 자리를 새로 쓴다", () => {
    const dir = mkdtempSync(join(tmpdir(), "uzys-918-r3-ok-"));
    dirs.push(dir);
    install(dir, ["claude"]);
    mkdirSync(join(dir, A), { recursive: true });
    put(dir, `${A}/SKILL.md`, BODY);
    put(dir, `${A}/note.md`, "my note\n");
    rmSync(join(dir, C), { recursive: true, force: true });
    symlinkSync("../../.agents/skills/frontend-design", join(dir, C));
    const r = update(dir);
    expect(r.failed).toEqual([]);
    expect(read(dir, `${A}/note.md`)).toBe("my note\n");
    expect(lstatSync(join(dir, C)).isDirectory()).toBe(true);
    expect(read(dir, `${C}/SKILL.md`)).toBe(BODY);
    expect(backupsIn(dir)).toEqual([]);
  });
});

describe("#918 회차 3 — update 도 일부 CLI 자리만 링크로 밖이면 그 자리를 한 줄로 말한다", () => {
  it("claude+codex 에서 `.agents` 자리 링크 — 갱신 결과와 화면 줄", () => {
    const A = ".agents/skills/frontend-design";
    const dir = mkdtempSync(join(tmpdir(), "uzys-918-r3-line-"));
    dirs.push(dir);
    install(dir, ["claude", "codex"]);
    put(dir, SRC, SRC_BODY);
    rmSync(join(dir, A), { recursive: true, force: true });
    symlinkSync("../../src/a/b", join(dir, A));
    const r = update(dir);
    expect(r.failed).toEqual([]);
    const rows = leftAsIsRows(r.leftAsIs ?? []).join("\n");
    expect(rows).toContain(`frontend-design: ${A}/ left as is (links outside the skill folders:`);
  });
});
