import type { SpawnSyncReturns } from "node:child_process";
import {
  chmodSync,
  existsSync,
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
import { uninstallAction } from "../src/commands/uninstall.js";
import { excludedStillThere } from "../src/excluded-still-there.js";
import { type ExternalInstallerDeps, refreshExternalSkills } from "../src/external-installer.js";
import { listFilesRecursive } from "../src/fs-ops.js";
import {
  hashContent,
  type InstallLog,
  type InstallLogAsset,
  readInstallLog,
  writeInstallLog,
} from "../src/install-log.js";
import type { CliBase } from "../src/types.js";
import { buildRemovableRows } from "../src/uninstall-interactive.js";
import { createMockAsset } from "./helpers/mock-asset.js";

/**
 * #912 — 파일 목록 없는 옛 기록(v26.163.0 이하가 깐 외부 스킬)에서 도구가 한 번 새로 쓴 폴더는 그 뒤 update 마다 백업이 쌓이지 않고,
 * 덮지 못한 폴더는 "모름" 으로 남아 낡은 도구 파일이 설치자 원본으로 되살아나지 않는다. 설계 = `docs/plans/legacy-skill-list-coverage-912-design.md`
 * AC1 ~ AC8. 실 도구 대신 "고른 에이전트 자리를 폴더째 지우고 상류판을 쓰는" 목(`legacy-external-skill-files-902` 방식).
 */

const HARNESS_ROOT = resolve(__dirname, "..");
const SKILL = createMockAsset({
  id: "skill-a",
  condition: { kind: "any-track", tracks: ["tooling"] },
  method: { kind: "skill", source: "owner/a", skill: "a" },
});
const C = ".claude/skills/a";
const A = ".agents/skills/a";
const NOTE_BODY = "my own note — not from the skill\n";

const dirs: string[] = [];
afterEach(() => {
  vi.useRealTimers();
  while (dirs.length > 0) {
    const d = dirs.pop() as string;
    for (const rel of [C, A]) {
      try {
        chmodSync(join(d, rel, "locked.md"), 0o644);
      } catch {
        /* 없다 */
      }
    }
    rmSync(d, { recursive: true, force: true });
  }
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

type Upstream = Record<string, string>;

/** 상류 판 — 스킬 폴더 안 상대 경로 → 내용. */
function v(n: number, extra: Upstream = {}): Upstream {
  return { "SKILL.md": `# skill a v${n}\n`, "ref.md": "reference\n", ...extra };
}

/**
 * 옛 판이 깐 모양 — `clis` 자리마다 상류 판 `body` 의 도구 사본이 있고 자산 기록에 파일 목록이 없다. `listed` 면 v26.164.0 이후처럼
 * 목록이 모든 폴더를 말한다(대조군). `copies` = 디스크에 사본이 있는 자리(기본 `clis` 의 자리).
 */
function legacyProject(opts: {
  clis: CliBase[];
  body?: Upstream;
  listed?: boolean;
  copies?: string[];
  logScope?: "global";
  assetScope?: "global";
}): string {
  const dir = mkdtempSync(join(tmpdir(), "uzys-912-"));
  dirs.push(dir);
  const body = opts.body ?? v(1);
  const copies = opts.copies ?? [...new Set(opts.clis.map((c) => (c === "claude" ? C : A)))];
  const files = copies.flatMap((slot) =>
    Object.entries(body).map(([rel, b]) => {
      put(dir, `${slot}/${rel}`, b);
      return { path: `${slot}/${rel}`, sha256: hashContent(b) };
    }),
  );
  writeInstallLog(dir, {
    schemaVersion: 1,
    installedAt: "2026-10-01T00:00:00.000Z",
    scope: opts.logScope ?? "project",
    spec: { tracks: ["tooling"], cli: opts.clis, clis: opts.clis },
    templates: { claudeDir: ".claude/" },
    assets: [
      {
        id: SKILL.id,
        category: "dev-tools",
        method: "skill",
        scope: opts.assetScope ?? "project",
        detail: { source: "owner/a", skill: "a" },
        ...(opts.listed ? { files } : {}),
      },
    ],
  } as InstallLog);
  return dir;
}

/** `npx skills add --agent … --copy` 처럼 고른 에이전트 자리마다 스킬 폴더를 지우고(링크면 링크를) 상류 판으로 다시 쓴다. `-g` 면 프로젝트에 쓰지 않는다. */
function fakeTool(dir: string, body: Upstream): NonNullable<ExternalInstallerDeps["spawn"]> {
  return (cmd, args) => {
    if (cmd !== "npx" || args[1] !== "add" || args.includes("-g")) return ok();
    const agents = args.flatMap((a, i) => (args[i - 1] === "--agent" ? [a] : []));
    for (const slot of new Set(agents.map((a) => (a === "claude-code" ? C : A)))) {
      rmSync(join(dir, slot), { recursive: true, force: true });
      for (const [rel, b] of Object.entries(body)) put(dir, `${slot}/${rel}`, b);
    }
    return ok();
  };
}

function update(dir: string, body: Upstream) {
  tick();
  return refreshExternalSkills(dir, {
    spawn: fakeTool(dir, body),
    assets: [SKILL],
    log: () => {},
    warn: () => {},
  });
}

function uninstallOnly(dir: string, dryRun = false): { out: string; code: number } {
  tick();
  const lines: string[] = [];
  let code = 0;
  uninstallAction(
    { projectDir: dir, only: SKILL.id, ...(dryRun ? { dryRun: true } : {}) },
    {
      exit: ((c: number) => {
        code = c;
      }) as never,
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

function recordOf(dir: string): InstallLogAsset | undefined {
  return readInstallLog(dir)?.assets.find((a) => a.id === SKILL.id);
}

function paths(dir: string): string[] {
  return (recordOf(dir)?.files ?? []).map((f) => f.path).sort();
}

function shaOf(dir: string, path: string): string | undefined {
  return recordOf(dir)?.files?.find((f) => f.path === path)?.sha256;
}

function displacedIn(dir: string): string[] {
  return (readInstallLog(dir)?.rootFiles ?? [])
    .filter((f) => f.change === "displaced")
    .map((f) => f.path);
}

/** 두 스킬 자리 안의 하네스 백업(`<file>.backup-<시각>`) 전부. */
function backupsIn(dir: string): string[] {
  return [C, A]
    .flatMap((slot) => listFilesRecursive(join(dir, slot)).map((f) => `${slot}/${f}`))
    .filter((p) => /\.backup-/.test(p))
    .sort();
}

const both = (slot: string, body: Upstream) => Object.keys(body).map((rel) => `${slot}/${rel}`);

describe("#912 AC1 — 덮인 폴더는 그 뒤 update 마다 백업이 쌓이지 않는다 (상류가 매번 바뀌는 update 3회)", () => {
  for (const clis of [["claude"], ["claude", "codex"]] as CliBase[][]) {
    it(`${clis.join(" + ")} — 첫 update 만 '모름' 으로 백업하고 둘째 · 셋째는 조용하며 기록 sha 는 마지막 상류 판이다`, () => {
      const dir = legacyProject({ clis });
      const slots = clis.length === 1 ? [C] : [C, A];

      const first = update(dir, v(2));
      expect(first.refreshed).toBe(1);
      // 대조군: 목록이 없으니 상류가 바꾼 SKILL.md 는 고쳤는지 몰라 한 번 백업된다(지금과 같다)
      expect(first.judged?.filter((j) => j.recorded === "no-sha").length).toBe(slots.length);
      expect(paths(dir)).toEqual(slots.flatMap((s) => both(s, v(2))).sort());
      expect(recordOf(dir)?.filesPartial).toBe(true);
      const afterFirst = backupsIn(dir);

      const second = update(dir, v(3));
      const third = update(dir, v(4));

      for (const r of [second, third]) {
        expect(r.refreshed).toBe(1);
        expect(r.judged ?? []).toEqual([]);
        expect((r.judged ?? []).filter((j) => j.recorded === "sha")).toEqual([]);
      }
      expect(backupsIn(dir), "둘째 · 셋째 update 는 백업을 더하지 않는다").toEqual(afterFirst);
      for (const s of slots)
        expect(shaOf(dir, `${s}/SKILL.md`)).toBe(hashContent(v(4)["SKILL.md"] as string));
      expect(displacedIn(dir)).toEqual([]);
    });
  }
});

describe("#912 AC2 — 덮지 못한 폴더는 목록 밖 · displaced 0 · uninstall 이 낡은 도구 파일을 설치자 원본으로 되살리지 않는다", () => {
  it("CLI 일부(claude)만 덮은 실행 → .agents 는 '모름' 으로 남고 --only 는 목록만 지우며 .agents 를 남긴다고 말한다", () => {
    const dir = legacyProject({ clis: ["claude"], copies: [C, A] }); // codex 를 뺀 뒤에도 남은 .agents 사본

    update(dir, v(2));

    expect(paths(dir)).toEqual(both(C, v(2)).sort());
    expect(recordOf(dir)?.filesPartial).toBe(true);
    expect(displacedIn(dir)).toEqual([]);
    const run = uninstallOnly(dir);
    expect(run.out).not.toContain("put back");
    expect(existsSync(join(dir, C, "SKILL.md"))).toBe(false);
    expect(read(dir, `${A}/SKILL.md`), "덮지 못한 폴더의 옛 사본은 손대지 않는다").toBe(
      v(1)["SKILL.md"],
    );
    expect(run.out).toContain("not on record");
    expect(run.out).toContain(`left: ${A}/`);
  });

  it("codex 를 뺀 뒤(남은 .agents 사본) update → codex 를 다시 더한 뒤 update(이번엔 .agents 도 덮는다) → --only 가 옛 V1 을 되살리지 않는다", () => {
    const dir = legacyProject({ clis: ["claude"], copies: [C, A] });
    update(dir, v(2));
    // codex 를 다시 더했다 — 깔린 CLI 에 codex 가 든다
    const log = readInstallLog(dir) as InstallLog;
    writeInstallLog(dir, {
      ...log,
      spec: { ...log.spec, cli: ["claude", "codex"], clis: ["claude", "codex"] },
    });

    const r = update(dir, v(3));

    // .agents 는 '모름' 자리였다 — 그 V1 은 백업만, 설치자 파일로 적지 않는다
    expect(
      r.judged?.filter((j) => j.path.startsWith(`${A}/`)).every((j) => j.recorded === "no-sha"),
    ).toBe(true);
    expect(displacedIn(dir)).toEqual([]);
    expect(paths(dir)).toEqual([...both(C, v(3)), ...both(A, v(3))].sort());
    const run = uninstallOnly(dir);
    expect(run.out).not.toContain("put back");
    expect(existsSync(join(dir, A, "SKILL.md"))).toBe(false);
    expect(existsSync(join(dir, C, "SKILL.md"))).toBe(false);
  });

  it("기록 scope 가 global(project 로 깐 뒤 --scope global) · 자산은 project → 덮은 폴더만 목록, 덮지 못한 폴더는 '모름'", () => {
    const dir = legacyProject({ clis: ["claude"], copies: [C, A], logScope: "global" });

    update(dir, v(2));

    expect(paths(dir)).toEqual(both(C, v(2)).sort());
    expect(displacedIn(dir)).toEqual([]);
    const run = uninstallOnly(dir);
    expect(run.out).not.toContain("put back");
    expect(read(dir, `${A}/SKILL.md`)).toBe(v(1)["SKILL.md"]);
  });

  it("global 로 깐 자산은 프로젝트 자리가 없어 덮은 폴더가 없다 — 기록은 그대로 '모름'", () => {
    const dir = legacyProject({ clis: ["claude"], assetScope: "global", logScope: "global" });

    update(dir, v(2));

    expect(recordOf(dir)?.files).toBeUndefined();
    expect(recordOf(dir)?.filesPartial).toBeUndefined();
  });
});

describe("#912 AC3 — 옛 기록 폴더의 설치자 노트", () => {
  it("첫 update 는 백업 + 'no file list on record' · 덮인 뒤 다시 둔 노트는 다음 update 에서 설치자 파일로 남는다", () => {
    const dir = legacyProject({ clis: ["claude"] });
    put(dir, `${C}/mine.md`, NOTE_BODY);

    const first = update(dir, v(2));

    expect(first.judged?.find((j) => j.path === `${C}/mine.md`)?.line).toContain(
      "no file list on record",
    );
    expect(existsSync(join(dir, C, "mine.md"))).toBe(false);
    expect(paths(dir)).not.toContain(`${C}/mine.md`);

    put(dir, `${C}/mine.md`, NOTE_BODY);
    const second = update(dir, v(3));

    expect(read(dir, `${C}/mine.md`)).toBe(NOTE_BODY);
    expect(second.judged ?? []).toEqual([]);
    expect(paths(dir)).not.toContain(`${C}/mine.md`);
  });
});

describe("#912 AC4 — 호출 전부터 남은 파일이 있는 폴더는 덮은 폴더가 아니다", () => {
  it("못 읽는 파일이 남은 .claude 폴더는 목록에 들지 않고, 다 비켜 둔 .agents 폴더만 든다", () => {
    const dir = legacyProject({ clis: ["claude", "codex"] });
    put(dir, `${C}/locked.md`, "unreadable\n");
    chmodSync(join(dir, C, "locked.md"), 0o000);

    update(dir, v(2));

    expect(paths(dir)).toEqual(both(A, v(2)).sort());
    expect(recordOf(dir)?.filesPartial).toBe(true);
  });
});

describe("#912 AC5 — 링크 자리(.claude/skills/a → .agents/skills/a)", () => {
  function linked(): string {
    const dir = legacyProject({ clis: ["claude", "codex"], copies: [A] });
    mkdirSync(join(dir, ".claude/skills"), { recursive: true });
    symlinkSync("../../.agents/skills/a", join(dir, C));
    return dir;
  }

  it("AC1 과 같다 — 둘째 · 셋째 update 는 백업 0 · sha 행 0 · 기록 sha 는 마지막 상류 판", () => {
    const dir = linked();
    update(dir, v(2));
    expect(paths(dir)).toEqual([...both(C, v(2)), ...both(A, v(2))].sort());
    const afterFirst = backupsIn(dir);

    for (const n of [3, 4]) {
      const r = update(dir, v(n));
      expect(r.judged ?? []).toEqual([]);
    }
    expect(backupsIn(dir)).toEqual(afterFirst);
    for (const s of [C, A])
      expect(shaOf(dir, `${s}/SKILL.md`)).toBe(hashContent(v(4)["SKILL.md"] as string));
    expect(displacedIn(dir)).toEqual([]);
  });

  it("AC2 와 같다 — 덮은 뒤 --only 가 옛 V1 을 되살리지 않는다", () => {
    const dir = linked();
    update(dir, v(2));
    const run = uninstallOnly(dir);
    expect(run.out).not.toContain("put back");
    expect(existsSync(join(dir, A, "SKILL.md"))).toBe(false);
    expect(existsSync(join(dir, C, "SKILL.md"))).toBe(false);
  });
});

describe("#912 AC8 — 덮인 폴더에 상류가 파일을 더하고 바꾼다", () => {
  function run(listed: boolean) {
    const dir = legacyProject({ clis: ["claude"], listed });
    update(dir, v(2));
    const beforeAdd = backupsIn(dir);
    const added = update(dir, v(3, { "new.md": "new v1\n" }));
    const afterAdd = paths(dir);
    const changed = update(dir, v(4, { "new.md": "new v2\n" }));
    return { dir, added, afterAdd, changed, beforeAdd };
  }

  it("더한 파일이 목록에 들고 · 바꾼 update 는 백업 0 · displaced 0 · --only 가 그 파일을 되살리지 않는다 · 경로 집합은 표지 없는 기록과 같다", () => {
    const partial = run(false);
    const full = run(true); // 대조군: v26.164.0 이후(표지 없는 목록) 기록으로 같은 순서
    expect(recordOf(full.dir)?.filesPartial).toBeUndefined();
    expect(paths(partial.dir)).toEqual(paths(full.dir));
    expect(partial.afterAdd).toContain(`${C}/new.md`);
    expect(displacedIn(partial.dir)).toEqual([]);
    expect(partial.changed.judged ?? []).toEqual([]);
    expect(backupsIn(partial.dir)).toEqual(partial.beforeAdd);
    expect(displacedIn(partial.dir)).toEqual([]);
    const out = uninstallOnly(partial.dir);
    expect(out.out).not.toContain("put back");
    expect(existsSync(join(partial.dir, C, "new.md"))).toBe(false);
  });
});

describe("#912 — 일부 폴더만 말하는 목록을 읽는 화면", () => {
  it("uninstall 선택 화면은 목록 파일을 지우고 다른 폴더는 남긴다고 말한다", () => {
    const dir = legacyProject({ clis: ["claude"], copies: [C, A] });
    update(dir, v(2));
    const [row] = buildRemovableRows(readInstallLog(dir)?.assets ?? []);
    expect(row?.hint).toBe(
      "removes the 2 file(s) on record; files in other folders are not on record (older install) — left",
    );
  });

  it("뺀 자산의 목록 파일이 없어도 '모름' 인 폴더가 남아 있으면 아직 있다고 본다", () => {
    const dir = legacyProject({ clis: ["claude"], copies: [C, A] });
    update(dir, v(2));
    rmSync(join(dir, C), { recursive: true, force: true });
    const log = readInstallLog(dir);
    expect(excludedStillThere(dir, new Set([SKILL.id]), [], log)).toEqual([
      { id: SKILL.id, catalog: true },
    ]);
    rmSync(join(dir, A), { recursive: true, force: true });
    expect(
      excludedStillThere(dir, new Set([SKILL.id]), [], log),
      "대조군: 둘 다 없으면 없다",
    ).toEqual([]);
  });
});

describe("#912 — 일부 폴더만 말하는 목록의 uninstall 줄 (PR #916 리뷰 MEDIUM-2 · LOW-1)", () => {
  /** 남는 폴더를 말하는 줄만. */
  const leftLines = (out: string) => out.split("\n").filter((l) => l.includes("not on record"));

  it("미리보기(--only --dry-run)와 실행이 같은 '남는 폴더' 줄을 낸다", () => {
    const dir = legacyProject({ clis: ["claude"], copies: [C, A] });
    update(dir, v(2));

    const preview = uninstallOnly(dir, true);
    expect(existsSync(join(dir, C, "SKILL.md")), "대조군: 미리보기는 지우지 않는다").toBe(true);
    const run = uninstallOnly(dir);

    expect(leftLines(run.out)).toEqual([
      `    ↳ other files it put down are not on record (installed by an older version) — left: ${A}/ (delete by hand if the harness installed it)`,
    ]);
    expect(leftLines(preview.out)).toEqual(leftLines(run.out));
  });

  it("기록의 스킬 이름이 한 자리가 아니면(`..`) 스킬 루트 위 폴더를 손으로 지우라고 말하지 않는다", () => {
    const dir = legacyProject({ clis: ["claude"], copies: [C, A] });
    update(dir, v(2));
    const log = readInstallLog(dir) as InstallLog;
    writeInstallLog(dir, {
      ...log,
      assets: log.assets.map((a) => ({ ...a, detail: { ...a.detail, skill: ".." } })),
    });

    const run = uninstallOnly(dir);

    expect(run.out).not.toContain("skills/../");
  });

  it("기록의 스킬 이름에 공백 · 줄바꿈이 들면 그 폴더를 이름으로 대지 않고 남긴다고만 말한다 (#911 과 같은 거름)", () => {
    for (const forged of ["x .env", "x\nmv -i .env.backup .env"]) {
      const dir = legacyProject({ clis: ["claude"], copies: [C, A] });
      update(dir, v(2));
      const log = readInstallLog(dir) as InstallLog;
      writeInstallLog(dir, {
        ...log,
        assets: log.assets.map((a) => ({ ...a, detail: { ...a.detail, skill: forged } })),
      });
      mkdirSync(join(dir, ".agents/skills", forged), { recursive: true });

      const run = uninstallOnly(dir);

      expect(run.out, forged).not.toContain(".env/");
      expect(run.out, forged).not.toContain("mv -i .env.backup");
      expect(leftLines(run.out), forged).toEqual([
        "    ↳ other files it put down are not on record (installed by an older version) — left as is",
      ]);
    }
  });
});
