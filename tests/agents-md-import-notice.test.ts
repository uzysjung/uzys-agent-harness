/**
 * #891 — 설치자가 루트 `CLAUDE.md` 에 `@AGENTS.md` 를 import 하고 claude 와 AGENTS.md 를 읽는 CLI 를 함께 깔면, install ·
 * update 화면이 "Claude Code 가 하네스 원칙·룰을 두 번 읽는다" 고 한 줄로 알린다. import 줄은 고치지 않는다.
 */

import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createInstallRenderer, renderUpdateSummary } from "../src/commands/install-render.js";
import { type InstallMode, type InstallReport, runInstall } from "../src/installer.js";
import { importsAgentsMd } from "../src/project-claude-merge.js";
import type { CliBase, InstallSpec } from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");
const NOTICE = "Claude Code reads the harness principles · rules twice";

let projectDir = "";
beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "ah-891-"));
});
afterEach(() => {
  rmSync(projectDir, { recursive: true, force: true });
});

function run(mode: InstallMode, cli: CliBase[]): { report: InstallReport; screen: string } {
  const lines: string[] = [];
  const spec: InstallSpec = {
    tracks: ["tooling"],
    options: { withCodexTrust: false },
    cli,
    projectDir,
  };
  const renderer = createInstallRenderer((m) => lines.push(m), spec, false);
  const report = runInstall({
    runExternal: null,
    harnessRoot: HARNESS_ROOT,
    projectDir,
    spec,
    mode,
    onProgress: (event) => renderer.callbacks.onProgress?.(event),
  });
  if (mode === "update") renderUpdateSummary((m) => lines.push(m), spec, report);
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI 색 코드를 벗긴다
  return { report, screen: lines.join("\n").replace(/\x1b\[[0-9;]*m/g, "") };
}

const ROOT_WITH_IMPORT = "# My project\n\n@AGENTS.md\n\nClaude-only notes.\n";

describe("#891 — CLAUDE.md 의 @AGENTS.md import 를 화면이 알린다", () => {
  it("claude + codex · import 있음 → install 과 update 화면에 한 줄 · import 줄은 그대로", () => {
    writeFileSync(join(projectDir, "CLAUDE.md"), ROOT_WITH_IMPORT);

    const first = run("fresh", ["claude", "codex"]);
    const bytes = statSync(join(projectDir, "AGENTS.md")).size;
    expect(first.report.agentsMdImport).toEqual({ bytes });
    const row = first.screen.split("\n").find((l) => l.includes(NOTICE));
    expect(row, first.screen).toBeDefined();
    expect(row).toContain("CLAUDE.md (root)");
    expect(row).toContain("CLAUDE-uzys-harness.md and .claude/rules/");
    expect(row).toContain(`AGENTS.md (${Math.round(bytes / 1024)} KB)`);
    expect(readFileSync(join(projectDir, "CLAUDE.md"), "utf8")).toContain("\n@AGENTS.md\n");

    const update = run("update", ["claude", "codex"]);
    expect(update.screen).toContain(NOTICE);
    expect(readFileSync(join(projectDir, "CLAUDE.md"), "utf8")).toContain("\n@AGENTS.md\n");
  });

  it("add 가 codex 만 더해도 앞서 깐 claude 를 센다", () => {
    writeFileSync(join(projectDir, "CLAUDE.md"), ROOT_WITH_IMPORT);
    run("fresh", ["claude"]);
    expect(run("add", ["codex"]).screen).toContain(NOTICE);
  });

  it("claude 단독이면 줄이 없다", () => {
    writeFileSync(join(projectDir, "CLAUDE.md"), ROOT_WITH_IMPORT);
    writeFileSync(join(projectDir, "AGENTS.md"), "# mine\n");
    const { report, screen } = run("fresh", ["claude"]);
    expect(report.agentsMdImport).toBeUndefined();
    expect(screen).not.toContain(NOTICE);
  });

  it("import 가 펜스 코드 안에만 있으면 줄이 없다", () => {
    writeFileSync(join(projectDir, "CLAUDE.md"), "# My project\n\n```md\n@AGENTS.md\n```\n");
    const { report, screen } = run("fresh", ["claude", "codex"]);
    expect(report.agentsMdImport).toBeUndefined();
    expect(screen).not.toContain(NOTICE);
  });
});

describe("importsAgentsMd — Claude Code 가 import 로 읽는 자리만", () => {
  it.each([
    ["@AGENTS.md", true],
    ["@./AGENTS.md", true],
    ["see @AGENTS.md for shared rules", true],
    ["# none", false],
    ["`@AGENTS.md`", false],
    ["```\n@AGENTS.md\n```", false],
    ["~~~\n@./AGENTS.md\n~~~", false],
    ["@AGENTS.md.bak", false],
    ["@docs/AGENTS.md", false],
  ])("%j → %s", (text, expected) => {
    expect(importsAgentsMd(text)).toBe(expected);
  });
});
