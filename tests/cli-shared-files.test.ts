/**
 * Codex · OpenCode 를 이미 쓰던 프로젝트에 처음 깔아도 설치자 설정이 남는다 (#551 PR-4 · #563 · #558 · ADR-097 §6.2).
 *
 * 무는 것은 **설치자 디스크의 라이브 파일**이다 — 백업에 남는 것은 보존이 아니다(지금 도는 CLI 는 백업을 안 읽는다).
 *   - `.codex/config.toml` (`toml-region`): 설치자 키·표는 그대로, 하네스 몫은 구간 둘. 겹치면 설치자 값이 이긴다.
 *   - `opencode.json` (`json-keys`): 설치자 설정은 그대로, 하네스 MCP 키(`mcp.<name>`)만.
 *   - `AGENTS.md` (`marker-md` 첫 접촉): 설치자 본문은 바이트 그대로, 하네스 몫은 파일 끝 블록 하나.
 * install(첫 설치) · 재설치 · update 가 같은 변환을 타므로 셋 다 같은 결과여야 한다.
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
import { dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ADAPTERS } from "../src/adapters/index.js";
import { readToml } from "../src/adapters/toml-region.js";
import { runCliTransforms } from "../src/cli-transforms.js";
import { renderCliArtifacts, renderFinalSummary } from "../src/commands/install-render.js";
import { hashContent, type InstallLogPortion, readInstallLog } from "../src/install-log.js";
import { type InstallReport, runInstall } from "../src/installer.js";
import { createOwnedWriter } from "../src/owned-write.js";
import { writeShared } from "../src/shared-write.js";
import type { CliBase, InstallSpec } from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");

let projectDir: string;

beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "cli-shared-"));
});

afterEach(() => {
  rmSync(projectDir, { recursive: true, force: true });
});

function put(rel: string, content: string): void {
  const abs = join(projectDir, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
}

function read(rel: string): string {
  return readFileSync(join(projectDir, rel), "utf8");
}

function spec(cli: CliBase[]): InstallSpec {
  return { tracks: ["tooling"], options: { withCodexTrust: false }, cli, projectDir };
}

function install(cli: CliBase[], tracks: InstallSpec["tracks"] = ["tooling"]): InstallReport {
  return runInstall({
    harnessRoot: HARNESS_ROOT,
    projectDir,
    spec: { ...spec(cli), tracks },
    mode: "add",
    runExternal: null,
  });
}

function update(): InstallReport {
  return runInstall({
    harnessRoot: HARNESS_ROOT,
    projectDir,
    spec: spec(["claude"]),
    mode: "update",
    runExternal: null,
  });
}

/** 설치 화면의 CLI 산출물 절 — 색을 벗긴 줄. */
function screen(cli: CliBase[], report: InstallReport): string[] {
  const lines: string[] = [];
  renderCliArtifacts((m) => lines.push(m), spec(cli), report);
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI 색 코드를 벗긴다
  return lines.map((l) => l.replace(/\x1b\[[0-9;]*m/g, ""));
}

/** 프로젝트 전체에서 백업 파일(`*.backup-*`) — 함께 쓰는 파일은 백업이 아니라 몫만 다룬다. */
function backups(dir = projectDir): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules") continue;
    const abs = join(dir, e.name);
    if (e.name.includes(".backup-")) out.push(abs);
    else if (e.isDirectory()) out.push(...backups(abs));
  }
  return out;
}

/** 로그에서 몫 기록을 뺀다 — 몫을 기록하기 전 판(v26.161 이하 · PR-4 단독)이 남긴 로그. */
function dropPortions(): void {
  const log = readInstallLog(projectDir);
  if (!log) throw new Error("install log 가 없다");
  delete log.portions;
  writeFileSync(
    join(projectDir, ".uzys-agent-harness/.harness-install.json"),
    JSON.stringify(log, null, 2),
  );
}

/** 지금 파일의 하네스 블록을 기록된 몫으로 — 기록 writer(PR-3)가 남겼을 값을 테스트가 대신 만든다. */
function portionsOf(path: "AGENTS.md", text: string): InstallLogPortion[] {
  const shas = ADAPTERS["marker-md"].read(text, ["agents"]) ?? new Map<string, string>();
  return [...shas].map(([key, sha256]) => ({ path, adapter: "marker-md", key, sha256 }));
}

type Toml = Record<string, unknown> & {
  mcp_servers?: Record<string, Record<string, unknown>>;
  hooks?: { session_start?: Array<{ command: unknown }> };
};

function toml(rel = ".codex/config.toml"): Toml {
  const parsed = readToml(read(rel));
  expect(parsed, "config.toml 이 TOML 로 읽히지 않는다 — Codex 가 거절한다").not.toBeNull();
  return parsed as Toml;
}

/* ─── .codex/config.toml — #563 ─────────────────────────────────────────── */

const INSTALLER_TOML = [
  "# 내 Codex 설정",
  'model = "o3"',
  'model_reasoning_effort = "high"',
  "",
  "[mcp_servers.myown]",
  'command = "node"',
  'args = ["my-server.js"]',
  "",
].join("\n");

describe(".codex/config.toml — 설치자 파일에 하네스 몫(구간 둘)만 더한다 (#563)", () => {
  it("첫 설치: 설치자 MCP 서버 · 모델이 라이브 파일에 남고 하네스 서버 · 설정이 옆에 선다 · 백업 0", () => {
    put(".codex/config.toml", INSTALLER_TOML);
    const report = install(["codex"]);

    const live = read(".codex/config.toml");
    expect(live).toContain(INSTALLER_TOML.trimEnd()); // 설치자 바이트가 그대로 한 덩어리로
    const t = toml();
    expect(t.model).toBe("o3");
    expect(t.model_reasoning_effort).toBe("high");
    expect(t.mcp_servers?.myown).toEqual({ command: "node", args: ["my-server.js"] });
    expect(t.mcp_servers?.context7).toBeDefined(); // 하네스 서버
    expect(t.approval_policy).toBe("on-request");
    expect(t.sandbox_mode).toBe("workspace-write");
    expect(t.hooks?.session_start).toHaveLength(1);
    expect(live.startsWith("# uzys-harness:top:start\n")).toBe(true);
    expect(live).toContain("# uzys-harness:tables:start");
    expect(backups()).toEqual([]);
    expect(report.codex?.configToml).toMatchObject({ action: "updated", kept: [] });
  });

  it("겹치는 키 · 표는 설치자 값이 이긴다 — 화면이 'kept yours' 로 말한다", () => {
    put(
      ".codex/config.toml",
      'approval_policy = "never"\n\n[mcp_servers.context7]\ncommand = "bunx"\nargs = ["my-context7"]\n',
    );
    const report = install(["codex"]);

    const t = toml();
    expect(t.approval_policy).toBe("never");
    expect(t.mcp_servers?.context7).toEqual({ command: "bunx", args: ["my-context7"] });
    expect(t.sandbox_mode).toBe("workspace-write"); // 겹치지 않는 하네스 키는 들어온다
    expect(report.codex?.configToml?.kept).toEqual(
      expect.arrayContaining(["approval_policy", "[mcp_servers.context7]"]),
    );
    const row = screen(["codex"], report).find((l) => l.includes(".codex/config.toml")) ?? "";
    expect(row).toContain("kept yours: approval_policy · [mcp_servers.context7]");
  });

  it("재설치 · update 도 같은 규칙 — 설치자 내용은 그대로, 하네스 구간은 한 벌 · 두 번째부터 바이트가 안 바뀐다", () => {
    put(".codex/config.toml", INSTALLER_TOML);
    install(["codex"]);
    const first = read(".codex/config.toml");

    install(["codex"]);
    expect(read(".codex/config.toml")).toBe(first);
    update();
    expect(read(".codex/config.toml")).toBe(first);
    expect(first.match(/# uzys-harness:tables:start/g)).toHaveLength(1);
    expect(toml().mcp_servers?.myown).toBeDefined();
    expect(backups()).toEqual([]);
  });

  // 몫 기록(`portions`)이 로그에 없으면 구간 안의 값이 하네스가 쓴 그대로인지 알 수 없다. 모른다고 하네스 판으로
  // 갈아 끼우면 설치자가 구간 안에서 고친 값(예: 하네스 서버에 토큰 env 추가)이 백업도 없이 사라진다 — 남긴다.
  it.each([
    ["첫 접촉 파일", INSTALLER_TOML],
    ["하네스가 만든 파일", null],
  ])("설치자가 하네스 구간 안을 고쳤으면 재설치 · update 가 되돌리지 않는다 — %s", (_, original) => {
    if (original !== null) put(".codex/config.toml", original);
    install(["codex"]);
    const edited = read(".codex/config.toml").replace(
      'args = ["-y","@upstash/context7-mcp@latest"]',
      'args = ["-y","@upstash/context7-mcp@latest"]\nenv = { CONTEXT7_API_KEY = "mine" }',
    );
    expect(edited).toContain("CONTEXT7_API_KEY"); // 대조군 — 편집이 실제로 들어갔다
    writeFileSync(join(projectDir, ".codex/config.toml"), edited);

    install(["codex"]);
    update();

    expect(read(".codex/config.toml")).toBe(edited);
    expect(toml().mcp_servers?.context7?.env).toEqual({ CONTEXT7_API_KEY: "mine" });
  });

  it("몫 기록이 없는 로그로 다시 깔면 하네스 구간을 남기고 화면이 그렇게 말한다 — 하네스 구간을 'kept yours' 로 부르지 않는다", () => {
    put(".codex/config.toml", INSTALLER_TOML);
    install(["codex"]);
    dropPortions(); // 몫을 기록하기 전 판이 남긴 로그
    const report = install(["codex"]);
    const row = screen(["codex"], report).find((l) => l.includes(".codex/config.toml")) ?? "";
    expect(row).toContain("harness part left as is: top · tables");
    expect(row).toContain("nothing written");
    expect(row).not.toContain("kept yours");
    expect(row).not.toContain("already current");
  });

  it("TOML 로 읽히지 않으면 한 바이트도 쓰지 않고 이유를 말한다(#574 규칙)", () => {
    const broken = 'model = "o3\n[mcp_servers.myown\n';
    put(".codex/config.toml", broken);
    const report = install(["codex"]);

    expect(read(".codex/config.toml")).toBe(broken);
    expect(report.codex?.configToml).toMatchObject({ action: "left" });
    const row = screen(["codex"], report).find((l) => l.includes(".codex/config.toml")) ?? "";
    expect(row).toContain("left — could not read it (invalid TOML) — harness part not added");
  });

  it("옛 판이 통째로 쓴 파일이 그 뒤 바뀌었으면 쓰지 않는다 — 구간을 더하면 같은 훅이 두 번 돈다", () => {
    install(["codex"]);
    // 옛 판(구간 도입 전) 형태: 하네스 훅을 부르는 통짜 파일 + 설치자가 한 줄 더함. 기준선과 다르다
    const legacy = [
      'approval_policy = "on-request"',
      'model = "o3"',
      "[[hooks.session_start]]",
      `command = ["${projectDir}/.codex/hooks/session-start.sh"]`,
      "",
    ].join("\n");
    put(".codex/config.toml", legacy);

    const report = install(["codex"]);

    expect(read(".codex/config.toml")).toBe(legacy);
    expect(report.codex?.configToml).toMatchObject({ action: "left" });
    expect(report.codex?.configToml?.line).toContain("earlier harness version");
  });

  it("옛 판이 통째로 쓴 파일이 기준선 그대로면 구간 둘로 옮겨 쓴다 — 백업 없이", () => {
    install(["codex"]);
    const fresh = read(".codex/config.toml");
    const legacy = `approval_policy = "on-request"\n[[hooks.session_start]]\ncommand = ["${projectDir}/.codex/hooks/session-start.sh"]\n`;
    put(".codex/config.toml", legacy);
    const log = readInstallLog(projectDir);
    if (!log) throw new Error("install log 가 없다");
    const externalFiles = (log.externalFiles ?? []).map((f) =>
      f.path === ".codex/config.toml" ? { ...f, sha256: hashContent(legacy) } : f,
    );
    writeFileSync(
      join(projectDir, ".uzys-agent-harness/.harness-install.json"),
      JSON.stringify({ ...log, externalFiles }, null, 2),
    );

    install(["codex"]);

    expect(read(".codex/config.toml")).toBe(fresh);
    expect(toml().hooks?.session_start).toHaveLength(1);
    expect(backups()).toEqual([]);
  });

  it("BOM 이 붙은 설치자 파일 — 하네스 최상위 키가 들어가고 BOM 은 맨 앞에 남는다(PR-1 인계 ①)", () => {
    put(".codex/config.toml", `﻿${INSTALLER_TOML}`);
    install(["codex"]);
    const live = read(".codex/config.toml");
    expect(live.startsWith("﻿# uzys-harness:top:start\n")).toBe(true);
    expect(toml()).toMatchObject({ model: "o3", sandbox_mode: "workspace-write" });
  });
});

/* ─── opencode.json — #563 ──────────────────────────────────────────────── */

const INSTALLER_OPENCODE = {
  model: "anthropic/claude-sonnet-4",
  theme: "mine",
  mcp: { mine: { type: "local", command: ["node", "mine.js"] } },
};

describe("opencode.json — 설치자 설정은 그대로, 하네스 MCP 키만 (#563)", () => {
  it("첫 설치: 설치자 키 · 서버가 남고 하네스 서버만 더해진다 — 템플릿의 다른 키는 끼워 넣지 않는다 · 백업 0", () => {
    put("opencode.json", `${JSON.stringify(INSTALLER_OPENCODE, null, 2)}\n`);
    const report = install(["opencode"]);

    const live = JSON.parse(read("opencode.json")) as Record<string, unknown> & {
      mcp: Record<string, unknown>;
    };
    expect(live.model).toBe(INSTALLER_OPENCODE.model);
    expect(live.theme).toBe("mine");
    expect(live.mcp.mine).toEqual(INSTALLER_OPENCODE.mcp.mine);
    expect(live.mcp.context7).toMatchObject({ type: "local" });
    for (const key of ["$schema", "agent", "permission", "instructions", "plugin", "command"]) {
      expect(live, `${key} 는 하네스 몫이 아니다`).not.toHaveProperty(key);
    }
    expect(backups()).toEqual([]);
    expect(report.opencode?.opencodeJson).toMatchObject({ action: "updated", kept: [] });
  });

  it("같은 이름의 설치자 서버는 설치자 값이 이긴다 · 파일이 없으면 템플릿 바탕 + 하네스 서버로 만든다", () => {
    put(
      "opencode.json",
      JSON.stringify({ mcp: { context7: { type: "remote", url: "https://example.test/mcp" } } }),
    );
    const report = install(["opencode"]);
    const live = JSON.parse(read("opencode.json")) as { mcp: Record<string, unknown> };
    expect(live.mcp.context7).toEqual({ type: "remote", url: "https://example.test/mcp" });
    expect(report.opencode?.opencodeJson?.kept).toEqual(["mcp.context7"]);

    // 대조군 — 파일이 없던 프로젝트
    const other = mkdtempSync(join(tmpdir(), "cli-shared-fresh-"));
    try {
      runInstall({
        harnessRoot: HARNESS_ROOT,
        projectDir: other,
        spec: { ...spec(["opencode"]), projectDir: other },
        mode: "add",
        runExternal: null,
      });
      const created = JSON.parse(readFileSync(join(other, "opencode.json"), "utf8")) as Record<
        string,
        unknown
      >;
      expect(created.$schema).toBe("https://opencode.ai/config.json");
      expect(created).toHaveProperty("agent");
    } finally {
      rmSync(other, { recursive: true, force: true });
    }
  });

  it("재설치 · update 에도 설치자 키가 남고 두 번째부터 바이트가 안 바뀐다", () => {
    put("opencode.json", `${JSON.stringify(INSTALLER_OPENCODE, null, 2)}\n`);
    install(["opencode"]);
    const first = read("opencode.json");
    install(["opencode"]);
    update();
    expect(read("opencode.json")).toBe(first);
    expect((JSON.parse(first) as { model: string }).model).toBe(INSTALLER_OPENCODE.model);
  });

  it("하네스가 만든 파일의 하네스 서버 값을 설치자가 고쳤으면 재설치 · update 가 되돌리지 않는다", () => {
    install(["opencode"]);
    const json = JSON.parse(read("opencode.json")) as {
      mcp: Record<string, { environment?: object }>;
    };
    const context7 = json.mcp.context7;
    if (context7 === undefined) throw new Error("하네스 서버 context7 이 없다 — 전제가 깨졌다");
    context7.environment = { CONTEXT7_API_KEY: "mine" };
    put("opencode.json", `${JSON.stringify(json, null, 2)}\n`);

    install(["opencode"]);
    update();

    const after = JSON.parse(read("opencode.json")) as {
      mcp: Record<string, { environment?: object }>;
    };
    expect(after.mcp.context7?.environment).toEqual({ CONTEXT7_API_KEY: "mine" });
  });

  it("JSON 으로 읽히지 않으면 한 바이트도 쓰지 않는다", () => {
    put("opencode.json", "{ model: nope");
    const report = install(["opencode"]);
    expect(read("opencode.json")).toBe("{ model: nope");
    expect(report.opencode?.opencodeJson).toMatchObject({
      action: "left",
      line: "could not read it (invalid JSON) — harness part not added",
    });
  });
});

/* ─── AGENTS.md — #558 ──────────────────────────────────────────────────── */

const INSTALLER_AGENTS = [
  "## Project Context",
  "MARKER-CONTEXT-FILLED-BY-USER — this is my own project description.",
  "",
  "## Project Rules",
  "MARKER-RULES-FILLED-BY-USER — my own rule: always run tests before commit.",
  "",
].join("\n");

describe("AGENTS.md — 기록에 없는 설치자 파일은 본문 그대로 + 블록 하나 (#558)", () => {
  it("첫 설치: 두 절이 바이트 그대로 남고 하네스 몫은 파일 끝 블록 하나 · 백업 0", () => {
    put("AGENTS.md", INSTALLER_AGENTS);
    const report = install(["codex"]);

    const live = read("AGENTS.md");
    expect(live.startsWith(INSTALLER_AGENTS)).toBe(true);
    expect(live.match(/<!-- uzys-harness:agents:start -->/g)).toHaveLength(1);
    expect(live.trimEnd().endsWith("<!-- uzys-harness:agents:end -->")).toBe(true);
    // 블록 안에 블록을 열지 않는다(읽지 못한 파일이 된다) · 설치자 절 이름을 다시 쓰지 않는다
    expect(live).not.toContain("uzys-harness:anchor");
    expect(live).not.toContain("uzys-harness:skills");
    expect(live.match(/^## Project Rules$/gm)).toHaveLength(1);
    // 하네스 몫은 실제로 들어왔다 — 룰 · 앵커 · 하네스 절
    for (const needle of [
      "## Working Principles",
      "## Harness Rules",
      "## Session Start",
      "## Protected Files",
    ]) {
      expect(live, needle).toContain(needle);
    }
    expect(backups()).toEqual([]);
    expect(report.codex?.agentsMd?.model).toBe("block");
    const row = screen(["codex"], report).find((l) => l.includes("AGENTS.md")) ?? "";
    expect(row).toContain("one harness block at the end (your text kept as-is)");
  });

  it("제목 없이 자유롭게 쓴 AGENTS.md 도 같다 — 파일 전체가 남는다", () => {
    const free = "# Team notes\n\nWe deploy on Tuesdays.\nNever touch prod db by hand.";
    put("AGENTS.md", free);
    install(["codex", "opencode"]);
    const live = read("AGENTS.md");
    expect(live.startsWith(`${free}\n`)).toBe(true);
    expect(live.match(/<!-- uzys-harness:agents:start -->/g)).toHaveLength(1);
  });

  it("재설치 · update 는 블록만 — 설치자 본문은 그대로이고, 설치자가 나중에 고친 본문도 남는다", () => {
    put("AGENTS.md", INSTALLER_AGENTS);
    install(["codex"]);
    const first = read("AGENTS.md");
    install(["codex"]);
    expect(read("AGENTS.md")).toBe(first);

    const edited = first.replace("MARKER-RULES-FILLED-BY-USER", "MARKER-RULES-EDITED-LATER");
    writeFileSync(join(projectDir, "AGENTS.md"), edited);
    update();
    expect(read("AGENTS.md")).toBe(edited);
    expect(backups()).toEqual([]);
  });

  it("블록 파일은 하네스 기준선에 남지 않는다 — 남으면 지금의 uninstall 이 '안 고친 하네스 파일' 로 읽고 본문째 지운다", () => {
    put("AGENTS.md", INSTALLER_AGENTS);
    install(["codex"]);
    const log = readInstallLog(projectDir);
    expect((log?.externalFiles ?? []).map((f) => f.path)).not.toContain("AGENTS.md");
  });

  it("블록 파일이 어쩌다 기준선과 같은 sha 로 기록돼 있어도 설치자 본문을 새로 쓰지 않는다", () => {
    put("AGENTS.md", INSTALLER_AGENTS);
    install(["codex"]);
    const withBlock = read("AGENTS.md");
    // 기준선이 이 파일을 "하네스가 쓴 그대로" 라고 말하는 상태 — 블록 파일은 하네스 파일이 아니므로 새로 쓰면 안 된다
    const r = runCliTransforms({
      harnessRoot: HARNESS_ROOT,
      projectDir,
      cli: ["codex"],
      selectedInternalSkills: [],
      rules: ["doc-governance"],
      tracks: ["tooling"],
      previousExternal: [{ path: "AGENTS.md", sha256: hashContent(withBlock) }],
      shared: { portions: portionsOf("AGENTS.md", withBlock) },
    });
    expect(r.sharedFiles.find((f) => f.path === "AGENTS.md")?.action).toBe("updated"); // 블록은 갈렸다
    expect(read("AGENTS.md").startsWith(INSTALLER_AGENTS)).toBe(true);
  });

  it("하네스가 만든 파일은 전과 같은 절 모델이다 — 마커 조각 · 절이 그대로", () => {
    const report = install(["codex"]);
    const live = read("AGENTS.md");
    expect(report.codex?.agentsMd?.model).toBe("sections");
    expect(live).toContain("<!-- uzys-harness:anchor:start -->");
    expect(live).not.toContain("uzys-harness:agents");
  });

  it("기록을 잃은 하네스 파일(절 모델 조각 마커가 있다)은 첫 접촉으로 읽지 않는다 — 룰이 두 벌 들어가지 않는다(N-c)", () => {
    install(["codex"]);
    const before = read("AGENTS.md");
    rmSync(join(projectDir, ".uzys-agent-harness"), { recursive: true, force: true }); // 로그가 사라졌다
    const report = install(["codex"]);
    expect(report.codex?.agentsMd?.model).toBe("sections");
    expect(read("AGENTS.md")).toBe(before);
  });
});

/* ─── runCliTransforms — 기록에 넘길 몫 ──────────────────────────────────── */

describe("runCliTransforms 가 세 어댑터의 몫과 설치자가 지운 키를 돌려준다", () => {
  function run(shared?: { portions?: InstallLogPortion[]; excluded?: string[] }) {
    return runCliTransforms({
      harnessRoot: HARNESS_ROOT,
      projectDir,
      cli: ["codex", "opencode"],
      selectedInternalSkills: [],
      rules: ["git-policy"],
      tracks: ["tooling"],
      previousExternal: [],
      ...(shared ? { shared } : {}),
    });
  }

  it("몫 = config.toml 구간 둘 · opencode.json mcp 키 · 첫 접촉 AGENTS.md 블록", () => {
    put("AGENTS.md", INSTALLER_AGENTS);
    put(".codex/config.toml", INSTALLER_TOML);
    put("opencode.json", JSON.stringify(INSTALLER_OPENCODE));
    const r = run();

    const keys = (path: string) => r.portions.filter((p) => p.path === path).map((p) => p.key);
    expect(keys(".codex/config.toml").sort()).toEqual(["tables", "top"]);
    expect(keys("AGENTS.md")).toEqual(["agents"]);
    expect(keys("opencode.json")).toContain("mcp.context7");
    expect(r.portionPaths.sort()).toEqual([".codex/config.toml", "AGENTS.md", "opencode.json"]);
    for (const p of r.portions) {
      expect(p.adapter).toBe(
        {
          ".codex/config.toml": "toml-region",
          "AGENTS.md": "marker-md",
          "opencode.json": "json-keys",
        }[p.path],
      );
    }
    expect(r.deletedKeyIds).toEqual([]);
  });

  it("기록에 있는데 파일에 없는 몫 = 설치자가 지웠다 — 되살리지 않고 키 id 로 돌려준다(R2)", () => {
    put(".codex/config.toml", INSTALLER_TOML);
    put("opencode.json", JSON.stringify(INSTALLER_OPENCODE));
    const first = run();

    // 설치자가 표 구간을 통째로 지우고 opencode 서버 하나를 지운다
    const tomlNow = read(".codex/config.toml");
    put(".codex/config.toml", tomlNow.slice(0, tomlNow.indexOf("# uzys-harness:tables:start")));
    const json = JSON.parse(read("opencode.json")) as { mcp: Record<string, unknown> };
    delete json.mcp.github;
    put("opencode.json", JSON.stringify(json));

    const second = run({ portions: first.portions });

    expect(second.deletedKeyIds.sort()).toEqual(["codex:tables", "opencode:mcp.github"]);
    expect(read(".codex/config.toml")).not.toContain("uzys-harness:tables");
    expect(JSON.parse(read("opencode.json")).mcp).not.toHaveProperty("github");
    expect(second.portions.map((p) => p.key)).not.toContain("mcp.github");
    // 설치자 것은 그대로
    expect(toml().mcp_servers?.myown).toBeDefined();
  });

  it("설치자 파일에 직접 쓴 갱신도 update 갱신 수에 센다 — 기준선(`externalFiles`)에는 남기지 않는다", () => {
    put("AGENTS.md", INSTALLER_AGENTS);
    const first = run();
    const second = runCliTransforms({
      harnessRoot: HARNESS_ROOT,
      projectDir,
      cli: ["codex"],
      selectedInternalSkills: [],
      rules: ["doc-governance"], // 룰이 바뀐 릴리즈 — 블록이 바뀐다
      tracks: ["tooling"],
      previousExternal: first.externalFiles,
      shared: { portions: first.portions },
    });
    const agents = second.sharedFiles.find((r) => r.path === "AGENTS.md");
    expect(agents?.action).toBe("updated");
    expect(second.externalFiles.map((f) => f.path)).not.toContain("AGENTS.md");
    expect(second.externalUpdated).toBeGreaterThanOrEqual(1);
    const writerCounted = second.codex?.ownership.updated ?? 0;
    expect(second.externalUpdated).toBe(writerCounted + 1);
  });

  it("update 에서 설치자가 파일째 지웠으면 되살리지 않고 기록된 키 전부를 지운 키로 돌려준다(Q4)", () => {
    put("opencode.json", JSON.stringify(INSTALLER_OPENCODE));
    const first = run();
    rmSync(join(projectDir, "opencode.json"));

    const second = runCliTransforms({
      harnessRoot: HARNESS_ROOT,
      projectDir,
      cli: ["opencode"],
      selectedInternalSkills: [],
      rules: ["git-policy"],
      tracks: ["tooling"],
      previousExternal: first.externalFiles,
      refreshOnly: true,
      shared: { portions: first.portions },
    });

    const r = second.sharedFiles.find((f) => f.path === "opencode.json");
    expect(r).toMatchObject({ action: "left", deletedFile: true, portions: [] });
    expect([...(r?.deleted ?? [])].sort()).toEqual(
      first.portions
        .filter((p) => p.path === "opencode.json")
        .map((p) => `opencode:${p.key}`)
        .sort(),
    );
    expect(second.portionPaths).toContain("opencode.json");
    expect(existsSync(join(projectDir, "opencode.json"))).toBe(false);
  });

  it("기록된 몫이 있으면 하네스 구간을 갱신한다 — 설치자가 구간 안을 고쳤으면 그 구간만 남기고 알린다", () => {
    put(".codex/config.toml", INSTALLER_TOML);
    const first = run();
    const again = (tracks: ("tooling" | "csr-fastapi")[], portions: InstallLogPortion[]) =>
      runCliTransforms({
        harnessRoot: HARNESS_ROOT,
        projectDir,
        cli: ["codex"],
        selectedInternalSkills: [],
        rules: ["git-policy"],
        tracks,
        previousExternal: first.externalFiles,
        shared: { portions },
      });

    // 트랙 서버가 늘어난 릴리즈 — 기록 sha 그대로인 표 구간은 갈린다
    const second = again(["csr-fastapi"], first.portions);
    expect(toml().mcp_servers).toHaveProperty("railway-mcp-server");
    expect(toml().mcp_servers?.myown).toBeDefined();
    expect(second.sharedFiles.find((f) => f.path === ".codex/config.toml")?.action).toBe("updated");

    // 설치자가 표 구간 안을 고쳤다 — 다음 갱신은 그 구간을 남기고 "kept" 로 알린다
    const edited = read(".codex/config.toml").replace(
      'args = ["-y","@upstash/context7-mcp@latest"]',
      'args = ["-y","@upstash/context7-mcp@latest"]\nenv = { CONTEXT7_API_KEY = "mine" }',
    );
    put(".codex/config.toml", edited);
    const third = again(["tooling"], second.portions);
    expect(read(".codex/config.toml")).toBe(edited);
    const r = third.sharedFiles.find((f) => f.path === ".codex/config.toml");
    expect(r?.leftAsIs).toEqual(["tables"]);
    expect(r?.kept).not.toContain("tables"); // 하네스 구간 이름을 "kept yours" 로 부르지 않는다
  });

  it("excluded 의 키는 더하지 않는다", () => {
    put("opencode.json", JSON.stringify(INSTALLER_OPENCODE));
    const r = run({ excluded: ["opencode:mcp.github", "codex:top"] });
    expect(JSON.parse(read("opencode.json")).mcp).not.toHaveProperty("github");
    expect(read(".codex/config.toml")).not.toContain("uzys-harness:top");
    expect(r.portions.map((p) => p.key)).not.toContain("mcp.github");
  });
});

/* ─── writeShared — 합친 결과가 안 읽히면 쓰지 않는다 ───────────────────── */

describe("writeShared — 읽히는 파일이어도 합친 결과가 안 읽히면 한 바이트도 쓰지 않는다", () => {
  it("설치자가 고쳐 남긴 구간과 새 구간이 같은 표를 정의하면 쓰지 않고 이유를 낸다", () => {
    const first = writeShared({
      projectDir,
      path: ".codex/config.toml",
      render: new Map([["tables", "[features]\na = true"]]),
      record: {},
      baseline: new Map(),
      writer: createOwnedWriter(projectDir, new Map()),
      refreshOnly: false,
    });
    // 설치자가 하네스 구간을 고쳤다 → 다음 갱신은 그 구간을 남긴다. 릴리즈는 같은 표를 새 구간에 정의한다
    const edited = read(".codex/config.toml").replace("a = true", "a = false");
    put(".codex/config.toml", edited);
    const r = writeShared({
      projectDir,
      path: ".codex/config.toml",
      render: new Map([["extra", "[features]\nb = 1"]]),
      record: { portions: first.portions ?? [] },
      baseline: new Map(),
      writer: createOwnedWriter(projectDir, new Map()),
      refreshOnly: false,
    });
    expect(r).toMatchObject({ action: "left", portions: null });
    expect(r.line).toBe(
      "could not merge it (the merged result would not be readable TOML) — harness part not added",
    );
    expect(read(".codex/config.toml")).toBe(edited);
  });
});

/* ─── R2 — 몫 왕복: install · update 가 기록된 몫으로 판정한다 ────────────── */

/** 기록된 이 파일의 몫 key → sha. */
function loggedPortions(path: string): Map<string, string> {
  const log = readInstallLog(projectDir);
  return new Map(
    (log?.portions ?? []).filter((p) => p.path === path).map((p) => [p.key, p.sha256]),
  );
}

function loggedExcluded(): string[] {
  return [...(readInstallLog(projectDir)?.excluded ?? [])];
}

describe("R2 — install 이 몫을 기록하고 다음 실행이 그 기록으로 판정한다", () => {
  it("첫 접촉 config.toml — 트랙을 더하면 하네스 구간에 새 서버가 들어가고 설치자 것은 그대로", () => {
    put(".codex/config.toml", INSTALLER_TOML);
    install(["codex"]);
    expect([...loggedPortions(".codex/config.toml").keys()].sort()).toEqual(["tables", "top"]);
    expect(toml().mcp_servers).not.toHaveProperty("railway-mcp-server");

    const report = install(["codex"], ["tooling", "csr-fastapi"]);

    expect(toml().mcp_servers).toHaveProperty("railway-mcp-server");
    expect(toml().mcp_servers?.myown).toEqual({ command: "node", args: ["my-server.js"] });
    expect(read(".codex/config.toml")).toContain(INSTALLER_TOML.trimEnd());
    expect(report.codex?.configToml).toMatchObject({ action: "updated", leftAsIs: [] });
  });

  it("설치자가 하네스 구간 안을 고치면 재설치 뒤에도 남고 화면이 'left as is' 로 말한다", () => {
    put(".codex/config.toml", INSTALLER_TOML);
    install(["codex"]);
    const edited = read(".codex/config.toml").replace(
      'sandbox_mode = "workspace-write"',
      'sandbox_mode = "read-only"',
    );
    expect(edited).toContain('sandbox_mode = "read-only"'); // 대조군
    writeFileSync(join(projectDir, ".codex/config.toml"), edited);

    const report = install(["codex"], ["tooling", "csr-fastapi"]);

    expect(toml().sandbox_mode).toBe("read-only");
    expect(report.codex?.configToml?.leftAsIs).toEqual(["top"]);
    // 고치지 않은 표 구간은 새 트랙대로 갱신된다
    expect(toml().mcp_servers).toHaveProperty("railway-mcp-server");
    const row = screen(["codex"], report).find((l) => l.includes(".codex/config.toml")) ?? "";
    expect(row).toContain("harness part left as is: top");
  });

  it("설치자가 하네스 키 · 블록을 지우면 excluded 에 들고 다음 install 이 되살리지 않는다", () => {
    put("opencode.json", JSON.stringify(INSTALLER_OPENCODE));
    put("AGENTS.md", INSTALLER_AGENTS);
    install(["opencode"]);
    const json = JSON.parse(read("opencode.json")) as { mcp: Record<string, unknown> };
    delete json.mcp.github;
    put("opencode.json", JSON.stringify(json));
    put("AGENTS.md", INSTALLER_AGENTS); // 블록째 지웠다

    install(["opencode"]);
    install(["opencode"]);

    expect(JSON.parse(read("opencode.json")).mcp).not.toHaveProperty("github");
    expect(JSON.parse(read("opencode.json")).mcp).toHaveProperty("context7");
    expect(read("AGENTS.md")).toBe(INSTALLER_AGENTS);
    expect(loggedExcluded()).toEqual(
      expect.arrayContaining(["opencode:mcp.github", "agents-md:agents"]),
    );
  });

  it("하네스가 만든 파일(기준선 그대로)을 기록된 몫과 함께 새로 써도 키가 지워지지 않고 excluded 에 들지 않는다 (리뷰 N3)", () => {
    install(["codex", "opencode"]); // 두 파일을 하네스가 만든다 — 기준선 sha 그대로 새로 쓰는 경로
    const before = { toml: read(".codex/config.toml"), json: read("opencode.json") };
    expect(loggedPortions("opencode.json").size).toBeGreaterThan(0); // 전제: 몫이 기록됐다

    install(["codex", "opencode"]);

    expect(read(".codex/config.toml")).toBe(before.toml);
    expect(read("opencode.json")).toBe(before.json);
    expect(loggedExcluded()).toEqual([]);
    expect([...loggedPortions("opencode.json").keys()].sort()).toEqual([
      "mcp.chrome-devtools",
      "mcp.context7",
      "mcp.github",
    ]);
    expect([...loggedPortions(".codex/config.toml").keys()].sort()).toEqual(["tables", "top"]);
  });
});

describe("R2 — update 도 같은 왕복을 한다", () => {
  it("update 가 설치자가 지운 하네스 구간 · 블록을 되살리지 않고 excluded 에 적는다", () => {
    put(".codex/config.toml", INSTALLER_TOML);
    put("AGENTS.md", INSTALLER_AGENTS);
    install(["codex"]);
    const toml0 = read(".codex/config.toml");
    put(".codex/config.toml", toml0.slice(0, toml0.indexOf("# uzys-harness:tables:start")));
    put("AGENTS.md", INSTALLER_AGENTS);

    update();

    expect(read(".codex/config.toml")).not.toContain("uzys-harness:tables");
    expect(read("AGENTS.md")).toBe(INSTALLER_AGENTS);
    expect(loggedExcluded()).toEqual(expect.arrayContaining(["codex:tables", "agents-md:agents"]));
    // 다음 install 도 되살리지 않는다 — 누적이 이어진다
    install(["codex"]);
    expect(read(".codex/config.toml")).not.toContain("uzys-harness:tables");
    expect(read("AGENTS.md")).toBe(INSTALLER_AGENTS);
  });

  it("update 가 갈아 끼운 구간의 sha 를 다시 적는다 — 다음 install 이 그 구간을 'left as is' 로 굳히지 않는다", () => {
    put(".codex/config.toml", INSTALLER_TOML);
    install(["codex"]);
    // 옛 판이 쓴 표 구간인 척 — 디스크와 기록을 같은 옛 값으로 맞춘다(설치자는 안 고쳤다)
    const now = read(".codex/config.toml");
    const start = now.indexOf("# uzys-harness:tables:start");
    const old = `${now.slice(0, start)}# uzys-harness:tables:start\n[features]\nold = true\n# uzys-harness:tables:end\n`;
    put(".codex/config.toml", old);
    const oldSha = ADAPTERS["toml-region"].read(old, ["tables"])?.get("tables");
    const log = readInstallLog(projectDir);
    if (!log || oldSha === undefined) throw new Error("전제가 깨졌다");
    writeFileSync(
      join(projectDir, ".uzys-agent-harness/.harness-install.json"),
      JSON.stringify({
        ...log,
        portions: (log.portions ?? []).map((p) =>
          p.path === ".codex/config.toml" && p.key === "tables" ? { ...p, sha256: oldSha } : p,
        ),
      }),
    );

    update();
    expect(read(".codex/config.toml")).toBe(now); // 기록 sha 그대로였으니 최신판으로 갈렸다
    expect(loggedPortions(".codex/config.toml").get("tables")).toBe(
      ADAPTERS["toml-region"].read(now, ["tables"])?.get("tables"),
    );

    const report = install(["codex"]);
    expect(report.codex?.configToml).toMatchObject({ action: "unchanged", leftAsIs: [] });
  });
});

/* ─── 화면 — 리뷰 N1 · N2 ──────────────────────────────────────────────── */

describe("화면 — 한 일만 말한다 (리뷰 N1 · N2)", () => {
  function summary(cli: CliBase[], report: InstallReport): string[] {
    const lines: string[] = [];
    renderFinalSummary((m) => lines.push(m), spec(cli), report, false);
    // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI 색 코드를 벗긴다
    return lines.map((l) => l.replace(/\x1b\[[0-9;]*m/g, ""));
  }

  it("N2 — 첫 접촉 AGENTS.md 에는 FILL 이 없으니 FILL 안내가 AGENTS.md 를 부르지 않는다", () => {
    put("AGENTS.md", INSTALLER_AGENTS);
    const report = install(["codex"]);
    expect(read("AGENTS.md")).not.toContain("<!-- FILL:"); // 전제
    expect(
      summary(["codex"], report).some((l) => l.includes("FILL") && l.includes("AGENTS.md")),
    ).toBe(false);
  });

  it("N2 대조군 — 하네스가 만든 AGENTS.md(스캐폴드 있음)는 FILL 안내에 나온다", () => {
    const report = install(["codex"]);
    expect(read("AGENTS.md")).toContain("<!-- FILL:");
    expect(
      summary(["codex"], report).some((l) => l.includes("FILL") && l.includes("AGENTS.md")),
    ).toBe(true);
  });

  it("N1 — 값이 하네스 렌더와 같은 키를 'kept yours' 로 부르지 않는다(기록 없는 옛 로그 · 고친 하네스 파일)", () => {
    install(["opencode"]);
    const json = JSON.parse(read("opencode.json")) as Record<string, unknown>;
    put("opencode.json", `${JSON.stringify({ ...json, myKey: true }, null, 2)}\n`); // 기준선과 다르다
    dropPortions();

    const report = install(["opencode"]);

    expect(report.opencode?.opencodeJson?.kept).toEqual([]);
    const row = screen(["opencode"], report).find((l) => l.includes("opencode.json")) ?? "";
    expect(row).not.toContain("kept yours");
  });
});
