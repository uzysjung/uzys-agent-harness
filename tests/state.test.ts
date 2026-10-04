import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { detectInstallState, notInstalledLines, suggestedTracks } from "../src/state.js";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ch-state-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function put(rel: string, content = ""): void {
  mkdirSync(join(dir, rel, ".."), { recursive: true });
  writeFileSync(join(dir, rel), content, "utf8");
}

function writeLog(tracks: string[], cli: string[] = ["opencode"]): void {
  put(
    ".uzys-agent-harness/.harness-install.json",
    JSON.stringify({
      schemaVersion: 1,
      installedAt: "2026-07-26T00:00:00.000Z",
      scope: "project",
      spec: { tracks, cli },
      templates: { claudeDir: ".claude/" },
      assets: [],
    }),
  );
}

/**
 * #595 (설계 no-record §1) — 판정 입력은 설치 기록 하나다. 디스크 흔적은 `traces` 로만 나오고 `state` 를 바꾸지 않는다.
 */
describe("detectInstallState — 기록이 정한다 (#595)", () => {
  it("A1 · `.claude/` + 메타파일 + 옛 트랙 룰이 있어도 기록이 없으면 none — 흔적에는 나온다", () => {
    put(".claude/.installed-tracks", "tooling\n");
    put(".claude/rules/cli-development.md", "# rule\n");
    const result = detectInstallState(dir);
    expect(result.state).toBe("none");
    expect(result.log).toBeNull();
    expect(result.tracks).toEqual([]);
    expect(result.hasClaudeDir).toBe(true);
    expect(result.traces.map((t) => t.path)).toEqual([
      ".claude/.installed-tracks",
      ".claude/rules/cli-development.md",
    ]);
    expect(suggestedTracks(result.traces)).toEqual(["tooling"]);
  });

  it("#595 재현 — 자기 CLAUDE.md + settings.local.json 만 있으면 none · 흔적 없음", () => {
    put("CLAUDE.md", "# my project\n");
    put(".claude/settings.local.json", "{}\n");
    const result = detectInstallState(dir);
    expect(result.state).toBe("none");
    expect(result.traces).toEqual([]);
  });

  it("하네스 표시가 있는 루트 파일 · 옛 앵커는 흔적이다", () => {
    put("CLAUDE.md", "# mine\n<!-- uzys-harness:import:start -->\n@CLAUDE-uzys-harness.md\n");
    put("CLAUDE-uzys-harness.md", "# anchor\n");
    put("AGENTS.md", "<!-- uzys-harness:agents:start -->\nx\n<!-- uzys-harness:agents:end -->\n");
    put(".agents/rules/uzys-harness.md", "x\n");
    put(".claude/CLAUDE.md", "# old anchor\n");
    expect(detectInstallState(dir).traces.map((t) => t.path)).toEqual([
      "CLAUDE-uzys-harness.md",
      "CLAUDE.md",
      "AGENTS.md",
      ".agents/rules/uzys-harness.md",
      ".claude/CLAUDE.md",
    ]);
  });

  it("메타파일 제안은 중복 제거 · 정렬 · 모르는 낱말 버림", () => {
    put(".claude/.installed-tracks", "tooling tooling\ndata bogus\n");
    expect(suggestedTracks(detectInstallState(dir).traces)).toEqual(["data", "tooling"]);
  });

  it("기록이 있으면 installed — 트랙은 기록에서(메타파일이 달라도)", () => {
    writeLog(["tooling"], ["claude"]);
    put(".claude/.installed-tracks", "data\n");
    const result = detectInstallState(dir);
    expect(result.state).toBe("installed");
    expect(result.log?.spec.tracks).toEqual(["tooling"]);
    expect(result.tracks).toEqual(["tooling"]);
    expect(result.traces).toEqual([]);
  });

  it("깨진 기록은 corrupted — `.claude/` 가 있어도", () => {
    put(".uzys-agent-harness/.harness-install.json", "<<<<<<< HEAD\n{");
    mkdirSync(join(dir, ".claude/rules"), { recursive: true });
    const result = detectInstallState(dir);
    expect(result.state).toBe("corrupted");
    expect(result.log).toBeNull();
    expect(result.traces).toEqual([]);
  });

  it("아무것도 없으면 none · 흔적 없음", () => {
    const result = detectInstallState(dir);
    expect(result).toMatchObject({ state: "none", tracks: [], hasClaudeDir: false, traces: [] });
  });
});

/**
 * v26.135.0 (#253) — `.claude/` 부재 ≠ 미설치. opencode/codex 단독 설치는 `.claude/` 를 만들지 않는다.
 */
describe("detectInstallState — .claude/ 없는 설치 (#253)", () => {
  it("설치 로그만 있어도 installed — opencode 단독 설치가 '미설치'로 보이면 안 된다", () => {
    writeLog(["tooling"]);
    const result = detectInstallState(dir);
    expect(result.state).toBe("installed");
    expect(result.hasClaudeDir).toBe(false);
    expect(result.tracks).toEqual(["tooling"]);
  });

  it("로그의 폐기된 track 이름은 버린다 — 없는 track 으로 재설치가 굴러가면 안 된다", () => {
    writeLog(["tooling", "no-such-track"]);
    expect(detectInstallState(dir).tracks).toEqual(["tooling"]);
  });
});

describe("notInstalledLines — 세 명령이 함께 쓰는 문장 (설계 no-record §1)", () => {
  const logAt = (): string => join(dir, ".uzys-agent-harness/.harness-install.json");

  it("흔적 없음 = 두 줄", () => {
    expect(notInstalledLines(detectInstallState(dir), dir)).toEqual([
      `No harness install found at ${dir}`,
      "Run `agent-harness install --track <name>` first.",
    ]);
  });

  it("흔적 있음 = 네 줄 · 마지막 줄이 메타파일의 트랙을 제안한다", () => {
    put(".claude/.installed-tracks", "tooling\n");
    put(".claude/CLAUDE.md", "# old\n");
    const lines = notInstalledLines(detectInstallState(dir), dir);
    expect(lines).toHaveLength(4);
    expect(lines[0]).toBe(`No install record at ${logAt()}`);
    expect(lines[1]).toBe(
      "Harness files are here (.claude/.installed-tracks, .claude/CLAUDE.md) but no record of installing them.",
    );
    expect(lines[2]).toContain(
      "Cloned from a teammate? Ask whoever installed it to run `install --track <t>` once",
    );
    expect(lines[3]).toBe(
      "To make this copy managed on its own: agent-harness install --track tooling",
    );
  });

  it("흔적이 셋을 넘으면 셋만 나열하고 줄임표 · 메타파일이 없으면 --track <t>", () => {
    for (const r of ["htmx", "nextjs", "pyside6", "cli-development"]) put(`.claude/rules/${r}.md`);
    const lines = notInstalledLines(detectInstallState(dir), dir);
    expect(lines[1]).toContain(
      "(.claude/rules/htmx.md, .claude/rules/nextjs.md, .claude/rules/pyside6.md, …)",
    );
    expect(lines[3]).toBe(
      "To make this copy managed on its own: agent-harness install --track <t>",
    );
  });

  it("corrupted = 한 줄 · installed = 없음", () => {
    put(".uzys-agent-harness/.harness-install.json", "{");
    expect(notInstalledLines(detectInstallState(dir), dir)).toEqual([
      `install log is corrupted at ${logAt()} — if it holds git conflict markers, take one side whole; otherwise run install --reinstall (it forgets recorded exclusions and external assets)`,
    ]);
    writeLog(["tooling"]);
    expect(notInstalledLines(detectInstallState(dir), dir)).toEqual([]);
  });
});
