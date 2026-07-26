import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { detectInstallState } from "../src/state.js";

describe("detectInstallState", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "ch-state-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns state=new when .claude/ does not exist", () => {
    const result = detectInstallState(dir);
    expect(result.state).toBe("new");
    expect(result.tracks).toEqual([]);
    expect(result.source).toBe("none");
    expect(result.hasClaudeDir).toBe(false);
  });

  it("reads .claude/.installed-tracks when present (metafile source)", () => {
    mkdirSync(join(dir, ".claude"), { recursive: true });
    writeFileSync(join(dir, ".claude/.installed-tracks"), "tooling\ncsr-fastapi\n");
    const result = detectInstallState(dir);
    expect(result.state).toBe("existing");
    expect(result.source).toBe("metafile");
    expect(result.tracks).toEqual(["csr-fastapi", "tooling"]);
  });

  it("dedupes + sorts tracks from metafile", () => {
    mkdirSync(join(dir, ".claude"), { recursive: true });
    writeFileSync(join(dir, ".claude/.installed-tracks"), "tooling tooling\ndata\ntooling\n");
    const result = detectInstallState(dir);
    expect(result.tracks).toEqual(["data", "tooling"]);
  });

  it("ignores unknown tokens in metafile", () => {
    mkdirSync(join(dir, ".claude"), { recursive: true });
    writeFileSync(join(dir, ".claude/.installed-tracks"), "tooling unknown\nbogus\n");
    const result = detectInstallState(dir);
    expect(result.tracks).toEqual(["tooling"]);
  });

  it("falls back to legacy rules/*.md heuristic when metafile missing", () => {
    mkdirSync(join(dir, ".claude/rules"), { recursive: true });
    writeFileSync(join(dir, ".claude/rules/htmx.md"), "");
    writeFileSync(join(dir, ".claude/rules/cli-development.md"), "");
    const result = detectInstallState(dir);
    expect(result.source).toBe("legacy");
    expect(result.tracks).toEqual(["ssr-htmx", "tooling"]);
  });

  it("legacy: pyside6.md OR data-analysis.md both map to data (deduped)", () => {
    mkdirSync(join(dir, ".claude/rules"), { recursive: true });
    writeFileSync(join(dir, ".claude/rules/pyside6.md"), "");
    writeFileSync(join(dir, ".claude/rules/data-analysis.md"), "");
    const result = detectInstallState(dir);
    expect(result.tracks).toEqual(["data"]);
  });

  it("legacy: returns empty tracks when rules/ missing entirely", () => {
    mkdirSync(join(dir, ".claude"), { recursive: true });
    const result = detectInstallState(dir);
    expect(result.state).toBe("existing");
    expect(result.source).toBe("legacy");
    expect(result.tracks).toEqual([]);
  });

  it("legacy: returns existing-but-empty when rules dir present but no signatures match", () => {
    mkdirSync(join(dir, ".claude/rules"), { recursive: true });
    writeFileSync(join(dir, ".claude/rules/random.md"), "");
    const result = detectInstallState(dir);
    expect(result.state).toBe("existing");
    expect(result.source).toBe("legacy");
    expect(result.tracks).toEqual([]);
  });
});

/**
 * v26.135.0 (#253) — `.claude/` 부재 ≠ 미설치.
 *
 * opencode/codex 단독 설치는 `.claude/` 를 만들지 않는다. 여기서 "new" 를 돌려주면 위저드가
 * 기설치 프로젝트를 새 설치 흐름으로 태우고, `update` 는 갱신할 게 있는데도 거절한다.
 */
describe("detectInstallState — .claude/ 없는 설치 (#253)", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "ch-state-nolog-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function writeLog(tracks: string[]): void {
    mkdirSync(join(dir, ".uzys-agent-harness"), { recursive: true });
    writeFileSync(
      join(dir, ".uzys-agent-harness", ".harness-install.json"),
      JSON.stringify({
        schemaVersion: 1,
        installedAt: "2026-07-26T00:00:00.000Z",
        scope: "project",
        spec: { tracks, cli: ["opencode"] },
        templates: { claudeDir: ".claude/" },
        assets: [],
      }),
      "utf8",
    );
  }

  it("설치 로그만 있어도 existing — opencode 단독 설치가 '미설치'로 보이면 안 된다", () => {
    writeLog(["tooling"]);
    const result = detectInstallState(dir);
    expect(result.state).toBe("existing");
    expect(result.source).toBe("install-log");
    expect(result.hasClaudeDir).toBe(false);
    expect(result.tracks).toEqual(["tooling"]);
  });

  it("로그의 폐기된 track 이름은 버린다 — 없는 track 으로 재설치가 굴러가면 안 된다", () => {
    writeLog(["tooling", "no-such-track"]);
    expect(detectInstallState(dir).tracks).toEqual(["tooling"]);
  });

  it("로그도 `.claude/` 도 없으면 여전히 new", () => {
    expect(detectInstallState(dir).state).toBe("new");
  });
});
