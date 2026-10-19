/**
 * #859 — OpenCode 옛 커맨드 은퇴가 install · update 에서 설치자 커맨드를 이름 충돌만으로 지우지 않는다.
 *
 * 은퇴(ADR-081 전환 뒷정리)의 대상은 하네스가 쓴 기록이 있는 `.opencode/commands/<id>.md` 이고, 이번 실행이 같은 이름의
 * 스킬을 `.agents/skills/` 에 둘 때만이다. 이 파일은 설치기 경로 전체(install · update · `--without baseline:skills/<id>`)로
 * 그것을 본다 — 변환 단위 판정은 `tests/opencode/transform.test.ts`.
 */

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
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderCliArtifacts } from "../src/commands/install-render.js";
import { readInstallLog, writeInstallLog } from "../src/install-log.js";
import { runInstall } from "../src/installer.js";
import type { InstallSpec } from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");
const MINE = '---\ndescription: "mine"\n---\n\nmy own command\n';

let projectDir: string;
beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "ah-859-"));
});
afterEach(() => rmSync(projectDir, { recursive: true, force: true }));

function spec(over: Partial<InstallSpec> = {}): InstallSpec {
  return {
    tracks: ["tooling"],
    options: { withCodexTrust: false },
    cli: ["claude", "opencode"],
    projectDir,
    ...over,
  };
}

function run(mode: "install" | "update", over: Partial<InstallSpec> = {}) {
  return runInstall({
    harnessRoot: HARNESS_ROOT,
    projectDir,
    spec: spec(over),
    ...(mode === "update" ? { mode } : {}),
    runExternal: null,
  });
}

/** 이 설치가 `.agents/skills/` 에 둔 번들 스킬 하나 — 그 이름으로 충돌을 만든다. */
function installedSkillId(): string {
  const ids = readdirSync(join(projectDir, ".agents/skills"));
  const id = ids.includes("natural-korean") ? "natural-korean" : ids[0];
  if (id === undefined) throw new Error("전제: 설치가 .agents/skills/ 에 스킬을 두었다");
  return id;
}

function writeCommand(id: string): string {
  const path = join(projectDir, ".opencode/commands", `${id}.md`);
  mkdirSync(join(projectDir, ".opencode/commands"), { recursive: true });
  writeFileSync(path, MINE);
  return path;
}

const commandBackups = (): string[] =>
  readdirSync(join(projectDir, ".opencode/commands")).filter((f) => f.includes(".backup"));

describe("#859 — 설치자 커맨드는 이름이 번들 스킬과 같아도 남는다", () => {
  it("install 재실행 · update 둘 다 지우지 않고 백업도 만들지 않는다", () => {
    run("install");
    const path = writeCommand(installedSkillId());

    const again = run("install");
    expect(readFileSync(path, "utf8")).toBe(MINE);
    expect(again.opencode?.retiredCommands ?? []).toEqual([]);

    run("update");
    expect(readFileSync(path, "utf8")).toBe(MINE);
    expect(commandBackups()).toEqual([]);
  });

  it("대조군 — 하네스가 쓴 기록이 있는 같은 이름의 커맨드는 백업 뒤 은퇴한다(현행 유지)", () => {
    run("install");
    const id = installedSkillId();
    const path = writeCommand(id);
    const log = readInstallLog(projectDir);
    if (log === null) throw new Error("설치 기록이 없다");
    writeInstallLog(projectDir, {
      ...log,
      externalFiles: [
        ...(log.externalFiles ?? []),
        { path: `.opencode/commands/${id}.md`, sha256: "old" },
      ],
    });

    const report = run("install");
    expect(existsSync(path)).toBe(false);
    expect(report.opencode?.retiredCommands).toEqual([path]);
    expect(commandBackups().length).toBeGreaterThan(0);
    // install 화면이 은퇴를 말한다 — 같은 이름의 스킬이 이번 실행에서 `.agents/skills/` 에 있으므로 문구가 사실이다
    const lines: string[] = [];
    renderCliArtifacts((m) => lines.push(m), spec(), report);
    expect(lines.join("\n")).toMatch(/\.opencode\/commands\/.*1 retired/);
    expect(existsSync(join(projectDir, ".agents/skills", id, "SKILL.md"))).toBe(true);
  });

  it("--without baseline:skills/<id> 로 뺀 스킬의 커맨드는 기록이 있어도 지우지 않는다", () => {
    run("install");
    const id = installedSkillId();
    const path = writeCommand(id);
    const log = readInstallLog(projectDir);
    if (log === null) throw new Error("설치 기록이 없다");
    writeInstallLog(projectDir, {
      ...log,
      externalFiles: [
        ...(log.externalFiles ?? []),
        { path: `.opencode/commands/${id}.md`, sha256: "old" },
      ],
    });

    const report = run("install", { baselineExclude: [`baseline:skills/${id}`] });
    expect(readFileSync(path, "utf8")).toBe(MINE);
    expect(report.opencode?.retiredCommands ?? []).toEqual([]);
  });
});
