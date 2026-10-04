import { createHash } from "node:crypto";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type ExecuteSpecDeps, executeSpec } from "../src/commands/install.js";
import { listAction } from "../src/commands/list.js";
import { uninstallAction } from "../src/commands/uninstall.js";
import { updateAction } from "../src/commands/update.js";
import { readInstallLog } from "../src/install-log.js";
import { runInstall } from "../src/installer.js";

const HARNESS_ROOT = resolve(__dirname, "..");

/**
 * #595 (설계 no-record §1 · §6 A2–A4) — 기록이 없거나 깨진 프로젝트에서 `list` · `update` · `uninstall` 은
 * ⓐ stderr 첫 줄이 같고 ⓑ exit 1 이고 ⓒ 디스크에 한 바이트도 쓰지 않는다. 판정은 `detectInstallState` 하나다.
 *
 * 실제 명령을 기본 의존성으로 돌린다(`update` 의 파이프라인 포함) — 명령 쪽 판정이 빠지면 엔진이 무엇을 쓰는지가
 * 그대로 드러나야 이 테스트가 문다.
 */

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "no-record-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function put(rel: string, content: string): void {
  mkdirSync(join(dir, rel, ".."), { recursive: true });
  writeFileSync(join(dir, rel), content, "utf8");
}

/** 트리의 경로 · sha 집합 — 디렉터리도 넣는다(빈 백업 폴더 생성도 쓰기다). */
function snapshot(root: string): string[] {
  const out: string[] = [];
  const walk = (rel: string): void => {
    for (const e of readdirSync(join(root, rel), { withFileTypes: true })) {
      const p = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        out.push(`${p}/`);
        walk(p);
      } else {
        out.push(
          `${p} ${createHash("sha256")
            .update(readFileSync(join(root, p)))
            .digest("hex")}`,
        );
      }
    }
  };
  walk("");
  return out.sort();
}

// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape stripping requires \x1b
const plain = (s: string): string => s.replace(/\x1b\[[0-9;]*m/g, "");

/** 실제 파이프라인 — 하네스 루트를 이 저장소로, 외부 단계는 끈다. 명령 판정이 빠지면 이 경로가 실제로 쓴다. */
function realPipeline(): Pick<ExecuteSpecDeps, "resolveHarnessRoot" | "runPipeline"> {
  return {
    resolveHarnessRoot: () => HARNESS_ROOT,
    runPipeline: (sp, root, m, cb) =>
      runInstall({
        runExternal: null,
        harnessRoot: root,
        projectDir: dir,
        spec: sp,
        ...(m ? { mode: m } : {}),
        ...(cb?.onProgress ? { onProgress: cb.onProgress } : {}),
      }),
  };
}

interface Run {
  code: number | undefined;
  err: string[];
}

function run(command: "list" | "update" | "uninstall"): Run {
  const result: Run = { code: undefined, err: [] };
  const deps = {
    log: () => {},
    err: (m: string) => result.err.push(plain(m)),
    exit: ((code: number) => {
      result.code ??= code;
    }) as (code: number) => never,
  };
  if (command === "list") listAction({ projectDir: dir }, deps);
  else if (command === "update")
    updateAction(
      { projectDir: dir },
      { ...deps, execute: (spec, d) => executeSpec(spec, { ...d, ...realPipeline() }) },
    );
  else uninstallAction({ projectDir: dir, yes: true }, deps);
  return result;
}

const FIXTURES: Record<string, () => void> = {
  // #595 재현 — 자기 CLAUDE.md 와 Claude Code 로컬 설정만 있는 프로젝트(사람 D)
  none: () => {
    put("CLAUDE.md", "# my project\n\nmy notes\n");
    put(".claude/settings.local.json", '{ "permissions": {} }\n');
  },
  // 기록 전 판 설치본 · 기록을 잃은 클론(사람 E)
  "none+traces": () => {
    put(".claude/.installed-tracks", "tooling\n");
    put(".claude/rules/cli-development.md", "# old rule\n");
    put(".claude/CLAUDE.md", "# old anchor\n");
  },
  // 병합 충돌 마커가 남은 기록 + `.claude/`
  corrupted: () => {
    put(".claude/rules/git-policy.md", "# rule\n");
    put(".uzys-agent-harness/.harness-install.json", '<<<<<<< HEAD\n{"schemaVersion":1}\n');
  },
};

describe("기록 없음 · 깨짐 — 세 명령이 같은 답 · 쓰기 0 (#595)", () => {
  it("A2 · #595 재현에서 update 는 exit 1 · 트리 불변 · 첫 줄이 list · uninstall 과 같다", () => {
    FIXTURES.none?.();
    const before = snapshot(dir);
    const update = run("update");
    expect(update.code).toBe(1);
    expect(snapshot(dir)).toEqual(before);
    expect(update.err[0]).toBe(`✗ No harness install found at ${dir}`);
    expect(run("list").err[0]).toBe(update.err[0]);
    expect(run("uninstall").err[0]).toBe(update.err[0]);
  });

  for (const [name, setup] of Object.entries(FIXTURES)) {
    it(`A3 · ${name}: 세 명령의 stderr 첫 줄 동일 · exit 1 · 트리 불변`, () => {
      setup();
      const before = snapshot(dir);
      const runs = (["list", "update", "uninstall"] as const).map(run);
      expect(runs.map((r) => r.code)).toEqual([1, 1, 1]);
      expect(new Set(runs.map((r) => r.err[0])).size).toBe(1);
      expect(runs[0]?.err).toEqual(runs[1]?.err);
      expect(snapshot(dir)).toEqual(before);
    });
  }

  it("A3 · 흔적이 있으면 네 줄 — 흔적 나열 · 클론 안내 · 메타파일 트랙 제안", () => {
    FIXTURES["none+traces"]?.();
    const { err } = run("update");
    expect(err[0]).toBe(
      `✗ No install record at ${join(dir, ".uzys-agent-harness/.harness-install.json")}`,
    );
    expect(err[1]).toContain(
      "Harness files are here (.claude/.installed-tracks, .claude/CLAUDE.md, .claude/rules/cli-development.md)",
    );
    expect(err[2]).toContain("Cloned from a teammate?");
    expect(err[3]).toContain("agent-harness install --track tooling");
  });

  it("A4 · 깨진 기록 + `.claude/` 에서 update 는 corrupted 문구로 exit 1 — 진행하지 않는다", () => {
    FIXTURES.corrupted?.();
    const before = snapshot(dir);
    const { code, err } = run("update");
    expect(code).toBe(1);
    expect(err).toEqual([
      `✗ install log is corrupted at ${join(dir, ".uzys-agent-harness/.harness-install.json")} — if it holds git conflict markers, take one side whole; otherwise run install --reinstall (it forgets recorded exclusions and external assets)`,
    ]);
    expect(snapshot(dir)).toEqual(before);
  });
});

/**
 * A6 (설계 no-record §3) — 기록 없는 옛 판 설치본(E)은 `install` 한 번으로 보통 설치본이 된다. 옛 앵커
 * `.claude/CLAUDE.md` 는 하네스가 관리하지 않으니 install 화면이 update 와 같은 문장으로 한 줄 알린다.
 */
describe("install on E — 옛 앵커 안내 · 기록 생성 · 같은 파일은 둔다 (#595)", () => {
  function install(): string[] {
    const out: string[] = [];
    executeSpec(
      { tracks: ["tooling"], options: { withCodexTrust: false }, cli: ["claude"], projectDir: dir },
      {
        log: (m) => out.push(plain(m)),
        err: (m) => out.push(plain(m)),
        exit: (() => undefined) as unknown as (code: number) => never,
        ...realPipeline(),
      },
    );
    return out;
  }
  const anchorLines = (out: string[]): string[] =>
    out.filter((l) => l.includes(".claude/CLAUDE.md") && l.includes("legacy anchor"));

  it("A6 · 옛 앵커 안내 1줄 · 기록 생성 · 같은 내용이던 룰은 mtime 불변 · 옛 앵커는 그대로", () => {
    put(".claude/.installed-tracks", "tooling\n");
    put(".claude/CLAUDE.md", "# old anchor\n");
    mkdirSync(join(dir, ".claude/rules"), { recursive: true });
    const rule = join(dir, ".claude/rules/git-policy.md");
    copyFileSync(join(HARNESS_ROOT, "templates/rules/git-policy.md"), rule);
    const past = new Date("2026-01-01T00:00:00Z");
    utimesSync(rule, past, past);

    const out = install();

    expect(anchorLines(out)).toHaveLength(1);
    expect(readInstallLog(dir)?.spec.tracks).toEqual(["tooling"]);
    expect(statSync(rule).mtimeMs).toBe(past.getTime());
    expect(readdirSync(join(dir, ".claude/rules")).filter((n) => n.includes(".backup-"))).toEqual(
      [],
    );
    expect(readFileSync(join(dir, ".claude/CLAUDE.md"), "utf8")).toBe("# old anchor\n");
  });

  it("대조 — 하네스 흔적 없이 설치자 자기 `.claude/CLAUDE.md` 만 있으면 그 줄을 내지 않는다", () => {
    put(".claude/CLAUDE.md", "# my own Claude Code memory\n");
    const out = install();
    expect(anchorLines(out)).toEqual([]);
    expect(readInstallLog(dir)).not.toBeNull(); // 설치 자체는 됐다 — 문장만 없다
  });
});
