/**
 * uninstall 이 첫 접촉 파일의 하네스 몫만 걷는다 (#551 R1 · #558 · #563).
 *
 * 설치자가 이미 쓰던 `AGENTS.md` · `opencode.json` 에 install 은 블록 하나 · MCP 키만 더한다. uninstall 이 그것을 안
 * 걷으면 Codex · OpenCode 가 하네스를 지운 뒤에도 하네스 룰을 읽고 하네스 서버를 띄운다 — 화면은 "complete" 라 한다.
 * 무는 것: 기록된 몫만 걷는다 · 설치자 것(같은 이름의 자기 서버 포함)은 남는다 · 설치자가 고친 몫은 남기고 말한다 ·
 * 기록이 없으면 지우지 않고 말한다 · 미리보기와 실행이 같다 · `--cli` 는 마지막 사용자일 때만 · 하네스가 만든 파일은
 * 지금의 회수 경로 그대로.
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { uninstallAction } from "../src/commands/uninstall.js";
import { readInstallLog } from "../src/install-log.js";
import { runInstall } from "../src/installer.js";
import type { CliBase, InstallSpec } from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");

let projectDir: string;

beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "un-shared-"));
});

afterEach(() => {
  rmSync(projectDir, { recursive: true, force: true });
});

const INSTALLER_AGENTS = [
  "## Project Context",
  "MARKER-CONTEXT-FILLED-BY-USER",
  "",
  "## Project Rules",
  "MARKER-RULES-FILLED-BY-USER",
  "",
].join("\n");

/** 설치자 opencode.json — 하네스와 같은 이름의 자기 서버(`context7`)도 들고 있다. */
const INSTALLER_OPENCODE = {
  model: "anthropic/claude-sonnet-4-5",
  mcp: {
    mine: { type: "local", command: ["node", "mine.js"] },
    context7: { type: "remote", url: "https://example.test/mcp" },
  },
};

function put(rel: string, content: string): void {
  const abs = join(projectDir, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
}

function read(rel: string): string {
  return readFileSync(join(projectDir, rel), "utf8");
}

function install(cli: CliBase[]): void {
  runInstall({
    harnessRoot: HARNESS_ROOT,
    projectDir,
    spec: {
      tracks: ["tooling"],
      options: { withCodexTrust: false },
      cli,
      projectDir,
    } satisfies InstallSpec,
    mode: "add",
    runExternal: null,
  });
}

interface Run {
  lines: string[];
  code: number | null;
}

function uninstall(extra: { dryRun?: boolean; cli?: string } = {}): Run {
  const out: Run = { lines: [], code: null };
  uninstallAction(
    { projectDir, ...extra },
    {
      exit: (code: number) => {
        out.code ??= code;
        return undefined as never;
      },
      // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI 색 코드를 벗긴다
      log: (l: string) => out.lines.push(l.replace(/\x1b\[[0-9;]*m/g, "")),
      err: (l: string) => out.lines.push(l),
      resolveHarnessRoot: () => HARNESS_ROOT,
    },
  );
  return out;
}

function firstContact(): void {
  put("AGENTS.md", INSTALLER_AGENTS);
  put("opencode.json", `${JSON.stringify(INSTALLER_OPENCODE, null, 2)}\n`);
  install(["codex", "opencode"]);
  // 전제 — 하네스 몫이 실제로 들어갔다
  expect(read("AGENTS.md")).toContain("<!-- uzys-harness:agents:start -->");
  expect(JSON.parse(read("opencode.json")).mcp).toHaveProperty("github");
}

describe("uninstall — 첫 접촉 파일의 하네스 몫만 걷는다 (#551 R1)", () => {
  it("AGENTS.md 는 설치자 원본 바이트로 · opencode.json 은 설치자 설정으로 돌아온다 — 같은 이름의 설치자 서버는 남는다", () => {
    firstContact();

    const run = uninstall();

    expect(read("AGENTS.md")).toBe(INSTALLER_AGENTS);
    expect(JSON.parse(read("opencode.json"))).toEqual(INSTALLER_OPENCODE);
    expect(run.lines).toContain("  ✓ AGENTS.md — removed the harness block (yours stays)");
    expect(run.lines.find((l) => l.includes("opencode.json — removed the harness part"))).toContain(
      "mcp.github",
    );
    expect(run.lines.join("\n")).not.toContain("mcp.context7 ·");
    expect(run.code).toBe(0);
  });

  it("미리보기는 같은 판정을 말하고 아무것도 바꾸지 않는다", () => {
    firstContact();
    const before = { agents: read("AGENTS.md"), json: read("opencode.json") };

    const run = uninstall({ dryRun: true });

    expect(run.lines).toContain("  ○ remove the harness block from AGENTS.md (yours stays)");
    expect(
      run.lines.some((l) => l.startsWith("  ○ remove the harness part from opencode.json: mcp.")),
    ).toBe(true);
    expect(read("AGENTS.md")).toBe(before.agents);
    expect(read("opencode.json")).toBe(before.json);
  });

  it("설치자가 고친 하네스 몫은 남기고 그렇게 말한다 — 고치지 않은 몫은 걷는다", () => {
    firstContact();
    const json = JSON.parse(read("opencode.json")) as {
      mcp: Record<string, { environment?: object }>;
    };
    const github = json.mcp.github;
    if (github === undefined) throw new Error("전제가 깨졌다");
    github.environment = { GITHUB_TOKEN: "mine" };
    put("opencode.json", JSON.stringify(json));

    const run = uninstall();

    const after = JSON.parse(read("opencode.json")) as { mcp: Record<string, unknown> };
    expect(after.mcp.github).toMatchObject({ environment: { GITHUB_TOKEN: "mine" } });
    expect(after.mcp).not.toHaveProperty("chrome-devtools");
    expect(
      run.lines.some((l) => l.includes("opencode.json — kept mcp.github: changed since install")),
    ).toBe(true);
  });

  it("몫 기록이 없으면 지우지 않고 남은 것을 한 줄로 말한다", () => {
    firstContact();
    const log = readInstallLog(projectDir);
    if (!log) throw new Error("install log 가 없다");
    delete log.portions;
    writeFileSync(
      join(projectDir, ".uzys-agent-harness/.harness-install.json"),
      JSON.stringify(log),
    );
    const before = { agents: read("AGENTS.md"), json: read("opencode.json") };

    const run = uninstall();

    expect(read("AGENTS.md")).toBe(before.agents);
    expect(read("opencode.json")).toBe(before.json);
    const text = run.lines.join("\n");
    expect(text).toContain("left  AGENTS.md — the harness block is not on record");
    // 이름이 같아도 값이 하네스 렌더와 다른 설치자 서버(context7)는 하네스 것이라 말하지 않는다
    const oc = run.lines.find((l) => l.includes("left  opencode.json")) ?? "";
    expect(oc).toContain("mcp.github");
    expect(oc).not.toContain("mcp.context7");
  });

  it("--cli opencode 는 opencode.json 만 걷는다 — codex 가 아직 쓰는 AGENTS.md 는 남기고 그 몫 기록도 이어간다", () => {
    firstContact();
    const agents = read("AGENTS.md");

    const run = uninstall({ cli: "opencode" });

    expect(run.code).toBe(0);
    expect(JSON.parse(read("opencode.json"))).toEqual(INSTALLER_OPENCODE);
    expect(read("AGENTS.md")).toBe(agents);
    const portions = readInstallLog(projectDir)?.portions ?? [];
    expect(portions.some((p) => p.path === "opencode.json")).toBe(false);
    expect(portions.some((p) => p.path === "AGENTS.md" && p.key === "agents")).toBe(true);

    // 남은 codex 까지 빼면(전량) 블록도 걷힌다 — 이어 적은 기록이 쓰인다
    uninstall();
    expect(read("AGENTS.md")).toBe(INSTALLER_AGENTS);
  });

  it("하네스가 만든 opencode.json 은 지금의 회수 그대로 — 설치자가 고쳤으면 통째로 남긴다(몫을 걷지 않는다)", () => {
    install(["opencode"]);
    const json = JSON.parse(read("opencode.json")) as Record<string, unknown>;
    put("opencode.json", JSON.stringify({ ...json, myKey: true }, null, 2));
    const edited = read("opencode.json");

    const run = uninstall();

    expect(read("opencode.json")).toBe(edited);
    expect(run.lines.join("\n")).toContain("opencode.json kept — modified since install");
    expect(run.lines.join("\n")).not.toContain("opencode.json — removed the harness part");
  });

  it("하네스가 만든 AGENTS.md(안 채움)는 지금처럼 지운다", () => {
    install(["codex"]);
    uninstall();
    expect(existsSync(join(projectDir, "AGENTS.md"))).toBe(false);
  });
});
