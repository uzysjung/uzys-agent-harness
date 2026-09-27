/**
 * #550 ② — 설치자가 손으로 지운 번들 스킬이 `update` 로 돌아오면, 화면이 **그 스킬 이름**과
 * **영구히 빼는 방법**(`install --without <id>`, #505 `skillExclude`)을 말한다.
 *
 * 결함의 형태: 공유 자리 `.agents/skills/<id>`(Codex · OpenCode · Antigravity)에 되살린 스킬은
 * `external CLI artifacts · N files updated` 의 **파일 수**에만 섞였다. Claude 자리
 * (`.claude/skills/<id>`)는 이름은 댔지만 *"added by this release"* — 설치자가 지운 것을 새
 * 릴리즈 자산이라고 적었다. 둘 다 "update 는 지운 스킬을 다시 깐다 · 빼려면 기록을 남겨라"를
 * 말하지 않아서, 설치자는 지우고 되살아나기를 반복한다.
 *
 * 반대 축: **정말로 이 릴리즈가 더한 스킬**은 되살림이 아니다 — 기준선에 기록이 없는 스킬은
 * *"added by this release"* 로 남아야 한다(#283). 둘을 한 문구로 말하면 한쪽에는 거짓이다.
 *
 * 스킬 이름은 박지 않는다 — 설치 결과에서 고른다(`agents-skills-slot.test.ts` 와 같은 이유).
 */

import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { installAction } from "../src/commands/install.js";
import { createInstallRenderer } from "../src/commands/install-render.js";
import { type InstallLog, readInstallLog, writeInstallLog } from "../src/install-log.js";
import { type InstallReport, runInstall } from "../src/installer.js";
import type { CliBase, CliTargets, InstallSpec, Track } from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");

let projectDir: string;

beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "update-restored-skills-"));
});

afterEach(() => {
  rmSync(projectDir, { recursive: true, force: true });
});

function spec(cli: CliTargets, tracks: ReadonlyArray<Track> = ["tooling"]): InstallSpec {
  return { tracks: [...tracks], options: { withCodexTrust: false }, cli, projectDir };
}

function install(cli: CliTargets, tracks?: ReadonlyArray<Track>): void {
  runInstall({
    harnessRoot: HARNESS_ROOT,
    projectDir,
    spec: spec(cli, tracks),
    mode: "add",
    runExternal: null,
  });
}

function update(cli: CliTargets, tracks?: ReadonlyArray<Track>): InstallReport {
  return runInstall({
    harnessRoot: HARNESS_ROOT,
    projectDir,
    spec: spec(cli, tracks),
    mode: "update",
    runExternal: null,
  });
}

/** 설치자가 보는 화면 — update 가 내는 Phase 1 행을 렌더러 그대로 통과시킨다. */
function screen(cli: CliTargets, report: InstallReport): string {
  const out: string[] = [];
  const r = createInstallRenderer((m) => out.push(m), spec(cli), false);
  // `InstallReport` 타입은 `rootClaudeMd` 를 선언하지 않는다(런타임엔 실려 온다) — 실린 값이 이긴다.
  r.callbacks.onProgress?.({
    type: "baseline-complete",
    baseline: { rootClaudeMd: null, ...report },
  });
  // 색 코드는 문구 판정에 방해만 된다.
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI 이스케이프 제거
  return out.join("\n").replace(/\u001b\[[0-9;]*m/g, "");
}

function skillIdsAt(slot: string): string[] {
  const root = join(projectDir, slot);
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

function logOrThrow(): InstallLog {
  const log = readInstallLog(projectDir);
  if (!log) throw new Error("install log 가 없다 — 픽스처 전제가 깨졌다");
  return log;
}

/** 이 스킬의 행 — 경로와 문구가 **같은 줄**에 있어야 설치자가 짝을 짓는다. */
function rowOf(out: string, path: string): string | undefined {
  return out.split("\n").find((l) => l.includes(path));
}

const SLOT_CLIS: ReadonlyArray<CliBase> = ["codex", "opencode", "antigravity"];

describe.each(SLOT_CLIS)("#550 ② 공유 자리 `.agents/skills` (%s)", (cli) => {
  it("손으로 지운 스킬이 돌아오면 이름과 `--without <id>` 를 댄다", () => {
    install([cli]);
    const [id, control] = skillIdsAt(".agents/skills");
    if (id === undefined || control === undefined) throw new Error("번들 스킬이 2개 미만");
    rmSync(join(projectDir, ".agents/skills", id), { recursive: true, force: true });

    const report = update([cli]);
    const out = screen([cli], report);

    expect(existsSync(join(projectDir, ".agents/skills", id, "SKILL.md"))).toBe(true);
    expect(report.updateMode?.restored ?? []).toContain(`.agents/skills/${id}`);
    const row = rowOf(out, `.agents/skills/${id}`);
    expect(row, "되살린 스킬 이름이 화면에 없다").toBeDefined();
    expect(row).toContain("was missing");
    expect(row).not.toContain("added by this release");
    expect(out).toContain(`--without ${id}`);
    // 대조군 — 안 지운 스킬은 되살림으로 말하지 않는다(판정기가 "전부"를 내는 게 아니다).
    expect(rowOf(out, `.agents/skills/${control}`)).toBeUndefined();
    expect(out).not.toContain(`--without ${control}`);
  });

  it("기준선에 기록이 없는 스킬은 되살림이 아니라 이 릴리즈의 추가다 (#283)", () => {
    install([cli]);
    const [id] = skillIdsAt(".agents/skills");
    if (id === undefined) throw new Error("번들 스킬이 없다");
    rmSync(join(projectDir, ".agents/skills", id), { recursive: true, force: true });
    const log = logOrThrow();
    writeInstallLog(projectDir, {
      ...log,
      externalFiles: (log.externalFiles ?? []).filter(
        (f) => !f.path.startsWith(`.agents/skills/${id}/`),
      ),
    });

    const report = update([cli]);
    const out = screen([cli], report);

    expect(report.updateMode?.restored ?? []).not.toContain(`.agents/skills/${id}`);
    expect(rowOf(out, `.agents/skills/${id}`)).toContain("added by this release");
    expect(out).not.toContain(`--without ${id}`);
  });

  it("지운 것이 없으면 되살림 행도 안내도 없다", () => {
    install([cli]);
    const out = screen([cli], update([cli]));
    expect(out).not.toContain("was missing");
    expect(out).not.toContain("--without");
  });
});

describe("#550 ② Claude 자리 `.claude/skills` — 같은 규칙", () => {
  it("손으로 지운 스킬이 돌아오면 '이 릴리즈의 추가'가 아니라 되살림 · `--without <id>`", () => {
    install(["claude"]);
    const [id, control] = skillIdsAt(".claude/skills");
    if (id === undefined || control === undefined) throw new Error("번들 스킬이 2개 미만");
    rmSync(join(projectDir, ".claude/skills", id), { recursive: true, force: true });

    const report = update(["claude"]);
    const out = screen(["claude"], report);

    expect(existsSync(join(projectDir, ".claude/skills", id, "SKILL.md"))).toBe(true);
    expect(report.updateMode?.restored ?? []).toContain(`.claude/skills/${id}`);
    const row = rowOf(out, `.claude/skills/${id}`);
    expect(row).toContain("was missing");
    expect(row).not.toContain("added by this release");
    expect(out).toContain(`--without ${id}`);
    expect(rowOf(out, `.claude/skills/${control}`)).toBeUndefined();
  });

  it("기준선에 기록이 없는 스킬은 '이 릴리즈의 추가' 그대로 (#283 · #480)", () => {
    install(["claude"]);
    const [id] = skillIdsAt(".claude/skills");
    if (id === undefined) throw new Error("번들 스킬이 없다");
    rmSync(join(projectDir, ".claude/skills", id), { recursive: true, force: true });
    const log = logOrThrow();
    writeInstallLog(projectDir, {
      ...log,
      skillFiles: (log.skillFiles ?? []).filter((f) => !f.path.startsWith(`${id}/`)),
    });

    const report = update(["claude"]);
    const out = screen(["claude"], report);

    expect(report.updateMode?.installedNew ?? []).toContain(`.claude/skills/${id}`);
    expect(rowOf(out, `.claude/skills/${id}`)).toContain("added by this release");
    expect(out).not.toContain(`--without ${id}`);
  });

  it("claude + codex — 두 자리에서 지운 같은 스킬은 두 행 · 안내의 id 는 한 번", () => {
    install(["claude", "codex"]);
    const [id] = skillIdsAt(".agents/skills").filter((x) =>
      skillIdsAt(".claude/skills").includes(x),
    );
    if (id === undefined) throw new Error("두 자리에 함께 깔린 스킬이 없다");
    rmSync(join(projectDir, ".claude/skills", id), { recursive: true, force: true });
    rmSync(join(projectDir, ".agents/skills", id), { recursive: true, force: true });

    const out = screen(["claude", "codex"], update(["claude", "codex"]));

    expect(rowOf(out, `.claude/skills/${id}`)).toContain("was missing");
    expect(rowOf(out, `.agents/skills/${id}`)).toContain("was missing");
    expect(out.split(`--without ${id}`).length - 1).toBe(1);
  });
});

/**
 * #550 리뷰 B1 · N1 · N2 — 안내를 **글자 그대로** 따르면 정말로 안 돌아오는가.
 *
 * 화면의 안내 줄에서 `--without <인자>` 를 파싱해 **install 명령 진입점**(`installAction` — CLI 가
 * 플래그를 검증하는 그 자리)에 그대로 넘긴다. 안내가 install 이 모르는 id 를 내면 여기서 `[WARN]
 * Unknown asset id` 가 나고, 기록이 안 남아 다음 update 가 되살린다 — 안내와 실제 인자가 갈라지면 red.
 * 외부 자산 설치(네트워크)만 `runExternal: null` 로 끊는다.
 */
function reinstallAsHinted(
  cli: CliTargets,
  tracks: ReadonlyArray<Track>,
  hint: string,
): { args: string[]; errs: string[] } {
  const args = [...hint.matchAll(/--without ([^\s,]+)/g)].map((m) => m[1] as string);
  const errs: string[] = [];
  installAction(
    { track: [...tracks], cli: [...cli], projectDir, scope: "project", without: args },
    {
      log: () => {},
      err: (m) => errs.push(m),
      exit: (code) => {
        throw new Error(`install exit ${code}: ${errs.join(" | ")}`);
      },
      runPipeline: (s, harnessRoot, mode, callbacks) =>
        runInstall({
          harnessRoot,
          projectDir: s.projectDir,
          spec: s,
          ...(mode ? { mode } : {}),
          runExternal: null,
          ...(callbacks?.onProgress ? { onProgress: callbacks.onProgress } : {}),
        }),
      resolveHarnessRoot: () => HARNESS_ROOT,
    },
  );
  return { args, errs };
}

function firstFileIn(rel: string): string {
  const dir = join(projectDir, rel);
  const name = existsSync(dir) ? readdirSync(dir).sort()[0] : undefined;
  if (name === undefined) throw new Error(`${rel} 이 비었다 — 픽스처 전제가 깨졌다`);
  return `${rel}/${name}`;
}

describe("#550 리뷰 — 안내대로 재설치하고 다시 지우면 update 가 되살리지 않는다", () => {
  const cases: ReadonlyArray<{
    name: string;
    tracks: ReadonlyArray<Track>;
    cli: CliTargets;
    /** 설치 뒤 지울 경로(projectDir 상대). */
    pick: () => string;
    /** 안내가 내야 하는 인자 — install 이 받는 id. */
    arg: (path: string) => string;
  }> = [
    {
      // B1 — 스킬 자리에 있지만 번들 스킬이 아니라 UI 트랙 baseline 이다.
      name: "UI 트랙 · Claude 자리 `ui-visual-review`",
      tracks: ["csr-supabase"],
      cli: ["claude"],
      pick: () => ".claude/skills/ui-visual-review",
      arg: () => "baseline:skills/ui-visual-review",
    },
    {
      // N1 — 룰의 "delete it again if intentional" 은 거짓이었다.
      name: "룰 `.claude/rules/git-policy.md`",
      tracks: ["tooling"],
      cli: ["claude"],
      pick: () => ".claude/rules/git-policy.md",
      arg: () => "baseline:rules/git-policy",
    },
    {
      name: "공유 자리 번들 스킬",
      tracks: ["tooling"],
      cli: ["codex"],
      pick: () => firstFileIn(".agents/skills"),
      arg: (path) => path.split("/").at(-1) as string,
    },
  ];

  it.each(cases)("$name", ({ tracks, cli, pick, arg }) => {
    install(cli, tracks);
    const rel = pick();
    const abs = join(projectDir, rel);
    expect(existsSync(abs), `${rel} 가 설치되지 않았다 — 픽스처 전제가 깨졌다`).toBe(true);
    rmSync(abs, { recursive: true, force: true });

    const out = screen(cli, update(cli, tracks));
    expect(rowOf(out, rel)).toContain("was missing");
    const hint = out.split("\n").find((l) => l.includes("to keep it out"));
    if (hint === undefined) throw new Error(`영구히 빼는 안내가 없다:\n${out}`);
    // N2 — 재설치가 지워 주지 않으니 안내가 그다음 할 일을 말한다.
    expect(hint).toContain("then delete it again");

    const { args, errs } = reinstallAsHinted(cli, tracks, hint);
    expect(
      errs.filter((e) => /WARN|Unknown/.test(e)),
      "install 이 안내된 인자를 거절했다",
    ).toEqual([]);
    expect(args).toContain(arg(rel));
    // N2 근거 — 재설치는 이미 되살아난 파일을 지우지 않는다. 지웠다면 안내의 마지막 말이 거짓이다.
    expect(
      existsSync(abs),
      "재설치가 파일을 지웠다 — 'then delete it again' 이 틀린 안내가 된다",
    ).toBe(true);

    rmSync(abs, { recursive: true, force: true });
    const after = screen(cli, update(cli, tracks));
    expect(existsSync(abs), "안내대로 했는데 update 가 또 되살렸다").toBe(false);
    expect(rowOf(after, rel)).toBeUndefined();
  });

  it("뺄 인자가 없는 되살림은 인자 안내 없이 '하네스 관리'라고 말한다", () => {
    // 지금 트랙 12개의 되살림 대상은 전부 뺄 인자가 있다(81 파일 · 108 스킬 디렉터리 실측) —
    // 이 행은 그 판정이 인자를 못 찾을 때 **틀린 `--without` 을 내지 않는** 퇴로라, 실설치로는 못
    // 만들고 리포트를 손으로 만든다.
    install(["claude"]);
    const report = update(["claude"]);
    if (report.updateMode === null) throw new Error("update 리포트가 없다");
    const path = ".claude/commands/uzys/example.md";
    const out = screen(["claude"], {
      ...report,
      updateMode: { ...report.updateMode, restored: [path], restoredWithout: {} },
    });

    expect(rowOf(out, path)).toContain("harness-managed");
    expect(out).not.toContain("to keep it out");
    expect(out).not.toContain("--without");
  });
});
