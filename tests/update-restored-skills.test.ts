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
import { createInstallRenderer } from "../src/commands/install-render.js";
import { type InstallLog, readInstallLog, writeInstallLog } from "../src/install-log.js";
import { type InstallReport, runInstall } from "../src/installer.js";
import type { CliBase, CliTargets, InstallSpec } from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");

let projectDir: string;

beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "update-restored-skills-"));
});

afterEach(() => {
  rmSync(projectDir, { recursive: true, force: true });
});

function spec(cli: CliTargets): InstallSpec {
  return { tracks: ["tooling"], options: { withCodexTrust: false }, cli, projectDir };
}

function install(cli: CliTargets): void {
  runInstall({
    harnessRoot: HARNESS_ROOT,
    projectDir,
    spec: spec(cli),
    mode: "add",
    runExternal: null,
  });
}

function update(cli: CliTargets): InstallReport {
  return runInstall({
    harnessRoot: HARNESS_ROOT,
    projectDir,
    spec: spec(cli),
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
