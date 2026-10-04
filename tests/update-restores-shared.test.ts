/**
 * ADR-099 R2 — 기록에 있는데 디스크(또는 파일 안)에서 사라진 하네스 몫을 **update 한 번**이 되돌리고 화면이 말한다
 * (설계 `docs/plans/explicit-exclusion-design-2026-10-04.md` §2 R2 · §4).
 *
 * 이 파일이 무는 것:
 *   - #675 — 훅 스크립트를 지운 뒤 update: 스크립트와 `settings.json` 배선이 같은 실행에서 돌아온다(전: 죽은 참조로 걷고
 *     "재설치 필요"). 옛 판이 굳힌 상태(배선 없음 · 키 자동 빼기)도 update 1회로 풀린다
 *   - update 가 install 과 같은 writer 로 `.mcp.json` · `.gitignore` 의 몫을 쓴다 — 설치자 키는 그대로, `--without` 은 지킨다
 *   - #598 — Codex 산출물(AGENTS.md · config.toml · 훅 스크립트)을 지운 뒤 update: 전부 돌아오고 기록에서도 안 사라진다
 *   - AGENTS.md 블록 모델 — 설치자 파일이었다면 블록만 담아 되살리고 `rootFiles.change = created` → uninstall 이 걷는다
 *   - #584 — Antigravity 앵커와 형제 룰을 지운 뒤 update: 기록이 그 CLI 를 말하면 앵커 존재와 무관하게 돌아온다
 *   - ADR-098 — 링크 너머가 프로젝트 밖인 함께 쓰는 파일은 update 도 쓰지 않는다
 */

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderHarnessMcp } from "../src/cli-transforms.js";
import { createInstallRenderer } from "../src/commands/install-render.js";
import { uninstallAction } from "../src/commands/uninstall.js";
import { cleanStaleHookRefs } from "../src/hook-ref.js";
import { type InstallLog, installLogPath, readInstallLog } from "../src/install-log.js";
import { type InstallReport, runInstall } from "../src/installer.js";
import type { CliBase, InstallSpec } from "../src/types.js";
import { runUpdateMode } from "../src/update-mode.js";

const HARNESS_ROOT = resolve(__dirname, "..");
/** 외부 스킬 갱신은 네트워크를 탄다 — 이 파일은 그 경로를 보지 않는다. */
const noRefresh = () => ({
  attempted: 0,
  refreshed: 0,
  failed: [],
  notInCatalog: [],
  unknown: false,
});

let projectDir: string;
let outsideDir: string;

beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "ah-update-restores-"));
  outsideDir = mkdtempSync(join(tmpdir(), "ah-update-restores-outside-"));
});

afterEach(() => {
  rmSync(projectDir, { recursive: true, force: true });
  rmSync(outsideDir, { recursive: true, force: true });
});

function spec(cli: CliBase[] = ["claude"], over: Partial<InstallSpec> = {}): InstallSpec {
  return {
    tracks: ["tooling"],
    options: { withCodexTrust: false },
    cli,
    projectDir,
    ...over,
  };
}

function install(cli: CliBase[] = ["claude"], over: Partial<InstallSpec> = {}): InstallReport {
  return runInstall({
    runExternal: null,
    harnessRoot: HARNESS_ROOT,
    projectDir,
    spec: spec(cli, over),
    mode: "add",
  });
}

/** update 1회 — 보고와 색을 벗긴 화면. */
function update(): { report: InstallReport; screen: string } {
  const lines: string[] = [];
  const renderer = createInstallRenderer((m) => lines.push(m), spec(), false);
  const report = runInstall({
    runExternal: null,
    harnessRoot: HARNESS_ROOT,
    projectDir,
    spec: spec(),
    mode: "update",
    onProgress: (event) => renderer.callbacks.onProgress?.(event),
  });
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI 색 코드를 벗긴다
  const screen = lines.join("\n").replace(/\x1b\[[0-9;]*m/g, "");
  return { report, screen };
}

const read = (rel: string): string => readFileSync(join(projectDir, rel), "utf8");
const put = (rel: string, text: string): void => writeFileSync(join(projectDir, rel), text);

type Settings = {
  model?: string;
  statusLine?: { command: string };
  hooks?: Record<string, Array<{ hooks: Array<{ command: string }> }>>;
};
const settings = (): Settings => JSON.parse(read(".claude/settings.json")) as Settings;
const wiredScripts = (): string[] =>
  Object.values(settings().hooks ?? {})
    .flatMap((groups) => groups.flatMap((g) => g.hooks.map((h) => h.command)))
    .flatMap((c) => /\.claude\/hooks\/([^"\s]+\.sh)/.exec(c)?.[1] ?? [])
    .sort();
const hookScripts = (): string[] => readdirSync(join(projectDir, ".claude/hooks")).sort();
const mcpServers = (): string[] =>
  Object.keys((JSON.parse(read(".mcp.json")) as { mcpServers?: object }).mcpServers ?? {}).sort();
const rawLog = (): InstallLog =>
  JSON.parse(readFileSync(installLogPath(projectDir), "utf8")) as InstallLog;

describe("#675 — 훅 스크립트를 지운 뒤 update 1회가 스크립트와 배선을 되돌린다", () => {
  it("스크립트가 돌아오고 settings.json 배선이 그대로 남는다 · 죽은 참조로 걷지 않는다 · 설치자 키는 그대로", () => {
    install();
    const scripts = hookScripts();
    const wired = wiredScripts();
    expect(scripts.length).toBeGreaterThan(0); // 전제 — 훅이 깔렸다
    expect(wired).toEqual(scripts);
    const s = settings();
    s.model = "claude-opus-4"; // 설치자 키
    put(".claude/settings.json", JSON.stringify(s, null, 2));
    for (const f of scripts) unlinkSync(join(projectDir, ".claude/hooks", f));

    const { report, screen } = update();

    expect(hookScripts()).toEqual(scripts);
    expect(wiredScripts()).toEqual(wired);
    expect(settings().model).toBe("claude-opus-4");
    expect(report.updateMode?.staleHookRefs).toEqual([]);
    for (const f of scripts) expect(screen).toContain(`.claude/hooks/${f}`);
    expect(screen).not.toContain("needs reinstall");
    expect(screen).not.toContain("stale hook refs");
  });

  it("배선을 손으로 지워도 update 가 되돌린다 — 화면이 키 id 와 빼는 명령을 말한다", () => {
    install();
    const wired = wiredScripts();
    const s = settings();
    delete s.hooks;
    put(".claude/settings.json", JSON.stringify(s, null, 2));

    const { screen } = update();

    expect(wiredScripts()).toEqual(wired);
    expect(screen).toMatch(
      /\.claude\/settings\.json\s+wrote the harness part — yours stays · was missing — restored: settings:hooks\./,
    );
    expect(screen).toContain("drop it: install … --without settings:hooks.");
  });

  it("v26.162–163 이 굳힌 상태(배선 없음 · 몫 걷힘 · 키 자동 빼기)도 이 판 update 1회로 풀린다", () => {
    install();
    const scripts = hookScripts();
    const wired = wiredScripts();
    // 163 모양: 죽은 참조 치유가 배선과 몫을 걷었고, 다음 install 이 그 키를 "설치자가 뺐다" 로 적었다. 스크립트는 없다
    const s = settings();
    delete s.hooks;
    put(".claude/settings.json", JSON.stringify(s, null, 2));
    for (const f of scripts) unlinkSync(join(projectDir, ".claude/hooks", f));
    const log = rawLog();
    const hookKeys = (log.portions ?? []).filter(
      (p) => p.path === ".claude/settings.json" && p.key.startsWith("hooks."),
    );
    expect(hookKeys.length).toBeGreaterThan(0); // 전제
    const frozen: InstallLog = {
      ...log,
      portions: (log.portions ?? []).filter((p) => !hookKeys.includes(p)),
      excluded: hookKeys.filter((p) => !p.key.endsWith("{}")).map((p) => `settings:${p.key}`),
    };
    delete frozen.excludedKeysMigrated;
    delete frozen.selections;
    writeFileSync(installLogPath(projectDir), JSON.stringify(frozen, null, 2));

    const { screen } = update();

    expect(hookScripts()).toEqual(scripts);
    expect(wiredScripts()).toEqual(wired);
    expect(readInstallLog(projectDir)?.excluded ?? []).toEqual([]);
    expect(screen).toMatch(
      /↺ restored \d+ harness part\(s\) an earlier version had marked as removed/,
    );
  });

  it("옛 판 update 가 스크립트 기준선을 지운 설치본도 되살림으로 말한다 — 배선 기록이 '전에 깔았다' 의 근거다", () => {
    install();
    const scripts = hookScripts();
    for (const f of scripts) unlinkSync(join(projectDir, ".claude/hooks", f));
    // 26.162.1 update 모양: 스크립트 없는 디스크로 기준선을 다시 찍어 `policyFiles` 에서 훅이 빠졌다(배선 몫은 남았다)
    const log = rawLog();
    writeFileSync(
      installLogPath(projectDir),
      JSON.stringify({
        ...log,
        policyFiles: (log.policyFiles ?? []).filter((f) => !f.path.startsWith("hooks/")),
      }),
    );

    const { report } = update();

    const paths = scripts.map((f) => `.claude/hooks/${f}`);
    expect(report.updateMode?.restored).toEqual(expect.arrayContaining(paths));
    for (const p of paths) expect(report.updateMode?.installedNew).not.toContain(p);
  });

  it("정리기는 `spare` 가 고른 참조(기록된 하네스 훅)를 판정하지 않는다 — 그 배선은 writer 가 소유한다", () => {
    const claudeDir = join(projectDir, ".claude");
    const settingsPath = join(claudeDir, "settings.json");
    mkdirSync(claudeDir, { recursive: true });
    const ref = (script: string) => ({
      hooks: [{ type: "command", command: `bash $CLAUDE_PROJECT_DIR/.claude/hooks/${script}` }],
    });
    writeFileSync(
      settingsPath,
      JSON.stringify({
        hooks: { SessionStart: [ref("harness.sh")], Stop: [ref("generated-x.sh")] },
      }),
    );

    const removed = cleanStaleHookRefs(
      settingsPath,
      claudeDir,
      (rel) => rel === "hooks/harness.sh",
    );

    expect(removed).toEqual(["hooks/generated-x.sh"]);
    const after = JSON.parse(readFileSync(settingsPath, "utf8")) as Settings;
    expect(after.hooks?.SessionStart?.[0]?.hooks[0]?.command).toContain("harness.sh");
    expect(after.hooks?.Stop ?? []).toEqual([]);
  });

  it("기록에 없는 스크립트를 부르는 죽은 참조는 전처럼 걷는다 (#536 · #603 — update 의 치유)", () => {
    install();
    const s = settings();
    s.hooks = {
      ...s.hooks,
      Stop: [{ hooks: [{ command: "bash $CLAUDE_PROJECT_DIR/.claude/hooks/generated-x.sh" }] }],
    };
    put(".claude/settings.json", JSON.stringify(s, null, 2));

    const { report } = update();

    expect(report.updateMode?.staleHookRefs).toEqual(["hooks/generated-x.sh"]);
    expect(settings().hooks?.Stop ?? []).toEqual([]);
  });
});

describe("update 가 `.mcp.json` · `.gitignore` 의 하네스 몫을 install 과 같은 writer 로 쓴다", () => {
  it("손으로 지운 하네스 서버 · 파일째 지운 `.mcp.json` 을 되돌린다 — 설치자 서버는 그대로", () => {
    install();
    const servers = mcpServers();
    expect(servers).toContain("github"); // 전제
    const mcp = JSON.parse(read(".mcp.json")) as { mcpServers: Record<string, unknown> };
    delete mcp.mcpServers.github;
    mcp.mcpServers.mine = { command: "node", args: ["mine.js"] };
    put(".mcp.json", JSON.stringify(mcp, null, 2));

    const first = update();
    expect(mcpServers()).toEqual([...servers, "mine"].sort());
    expect(first.screen).toContain("was missing — restored: mcp:github");

    rmSync(join(projectDir, ".mcp.json"));
    update();
    expect(mcpServers()).toEqual(servers);
  });

  it("`--without mcp:github` 한 설치본은 update 뒤에도 github 가 없다 (R3 — 빼기는 지킨다)", () => {
    install(["claude"], { keyExclude: ["mcp:github"] });
    expect(mcpServers()).not.toContain("github"); // 전제

    update();
    expect(mcpServers()).not.toContain("github");
    rmSync(join(projectDir, ".mcp.json"));
    update();
    expect(mcpServers()).not.toContain("github");
    expect(mcpServers().length).toBeGreaterThan(0); // 대조 — 다른 하네스 서버는 돌아왔다
  });

  it("하네스 몫을 전부 뺀 설치본 — 지운 `.mcp.json` · settings.json 을 `{}` 로 만들지 않고 썼다고도 말하지 않는다", () => {
    install();
    // 이 설치가 쓴 하네스 키 전부(값 키) — 키 id 로
    const ids = (rawLog().portions ?? [])
      .filter((p) => p.path === ".mcp.json" || p.path === ".claude/settings.json")
      .filter((p) => !p.key.endsWith("{}") && !p.key.endsWith("[]"))
      .map((p) =>
        p.path === ".mcp.json" ? `mcp:${p.key.slice("mcpServers.".length)}` : `settings:${p.key}`,
      );
    expect(ids.some((id) => id.startsWith("mcp:"))).toBe(true); // 전제
    expect(ids.some((id) => id.startsWith("settings:"))).toBe(true);
    install(["claude"], { keyExclude: ids });
    rmSync(join(projectDir, ".mcp.json"));
    rmSync(join(projectDir, ".claude/settings.json"));

    const { screen } = update();

    expect(existsSync(join(projectDir, ".mcp.json"))).toBe(false);
    expect(existsSync(join(projectDir, ".claude/settings.json"))).toBe(false);
    expect(screen).not.toMatch(/\.mcp\.json\s+wrote/);
    expect(screen).not.toMatch(/\.claude\/settings\.json\s+wrote/);
  });

  it("install 도 같은 writer 다 — 서버를 전부 뺀 첫 설치는 `.mcp.json` 을 `{}` 로 만들지 않는다", () => {
    const all = Object.keys(renderHarnessMcp(HARNESS_ROOT, ["tooling"]).mcpServers).map(
      (n) => `mcp:${n}`,
    );
    expect(all.length).toBeGreaterThan(0); // 전제

    install(["claude"], { keyExclude: all });

    expect(existsSync(join(projectDir, ".mcp.json"))).toBe(false);
    expect((rawLog().rootFiles ?? []).map((f) => f.path)).not.toContain(".mcp.json");
    // 대조 — 하나라도 남기면 만든다
    rmSync(installLogPath(projectDir));
    install(["claude"], { keyExclude: all.slice(1) });
    expect(mcpServers()).toEqual([all[0]?.slice("mcp:".length)]);
  });

  it("기록에 `.mcp.json` 이 없는 설치본은 update 가 그 파일을 새로 만들지 않는다 (onlyIfRecorded)", () => {
    install();
    rmSync(join(projectDir, ".mcp.json"));
    const log = rawLog();
    writeFileSync(
      installLogPath(projectDir),
      JSON.stringify({
        ...log,
        portions: (log.portions ?? []).filter((p) => p.path !== ".mcp.json"),
        rootFiles: (log.rootFiles ?? []).filter((f) => f.path !== ".mcp.json"),
      }),
    );

    update();

    expect(existsSync(join(projectDir, ".mcp.json"))).toBe(false);
    // 대조 — 같은 writer 가 settings.json 은 기록대로 다룬다(update 가 이 단계를 돌았다)
    expect(existsSync(join(projectDir, ".claude/settings.json"))).toBe(true);
  });

  it("`.gitignore` 에서 지운 하네스 줄을 되돌린다 · 파일이 없으면 만들지 않는다", () => {
    put(".gitignore", "node_modules/\n");
    install();
    const full = read(".gitignore");
    expect(full).toContain(".uzys-agent-harness/"); // 전제
    put(".gitignore", "node_modules/\n");

    update();
    expect(read(".gitignore")).toBe(full);

    rmSync(join(projectDir, ".gitignore"));
    update();
    expect(existsSync(join(projectDir, ".gitignore"))).toBe(false);
  });

  it("`--only` 묶음 — settings.json 은 hooks · .mcp.json 은 external · .gitignore 는 rules 가 고를 때만 쓴다", () => {
    put(".gitignore", "node_modules/\n");
    install();
    const full = { wired: wiredScripts(), servers: mcpServers(), gitignore: read(".gitignore") };
    const s = settings();
    delete s.hooks;
    put(".claude/settings.json", JSON.stringify(s, null, 2));
    const mcp = JSON.parse(read(".mcp.json")) as { mcpServers: Record<string, unknown> };
    delete mcp.mcpServers.github;
    put(".mcp.json", JSON.stringify(mcp, null, 2));
    put(".gitignore", "node_modules/\n");
    const templates = join(HARNESS_ROOT, "templates");

    runUpdateMode(projectDir, templates, HARNESS_ROOT, {}, ["rules"]);
    expect(read(".gitignore")).toBe(full.gitignore);
    expect(wiredScripts()).toEqual([]);
    expect(mcpServers()).not.toContain("github");

    runUpdateMode(projectDir, templates, HARNESS_ROOT, {}, ["hooks"]);
    expect(wiredScripts()).toEqual(full.wired);
    expect(mcpServers()).not.toContain("github");

    runUpdateMode(projectDir, templates, HARNESS_ROOT, { refreshSkills: noRefresh }, ["external"]);
    expect(mcpServers()).toEqual(full.servers);
  });

  it("링크 너머가 프로젝트 밖인 `.mcp.json` 은 쓰지 않는다 (ADR-098)", () => {
    install();
    const outside = join(outsideDir, "mcp.json");
    writeFileSync(outside, JSON.stringify({ mcpServers: { theirs: { command: "x" } } }, null, 2));
    const before = readFileSync(outside, "utf8");
    rmSync(join(projectDir, ".mcp.json"));
    symlinkSync(outside, join(projectDir, ".mcp.json"));

    const { report } = update();

    expect(readFileSync(outside, "utf8")).toBe(before);
    expect(report.updateMode?.outsideLinks?.map((o) => o.path)).toContain(".mcp.json");
  });
});

describe("#598 — Codex 산출물을 지운 뒤 update 1회가 되돌린다", () => {
  it("AGENTS.md · .codex/config.toml · .codex/hooks/session-start.sh 가 돌아오고 기록에서 안 사라진다 · 화면이 CLI 를 빼는 길을 말한다", () => {
    install(["codex"]);
    const files = ["AGENTS.md", ".codex/config.toml", ".codex/hooks/session-start.sh"];
    const before = Object.fromEntries(files.map((f) => [f, read(f)]));
    for (const f of files) rmSync(join(projectDir, f));

    const { screen } = update();

    for (const f of files) expect(read(f)).toBe(before[f]);
    const recorded = (readInstallLog(projectDir)?.externalFiles ?? []).map((f) => f.path);
    for (const f of files) expect(recorded).toContain(f);
    expect(screen).toMatch(
      /AGENTS\.md\s+was missing — restored \(drop this CLI for good: agent-harness uninstall --cli codex\)/,
    );
    expect(screen).toMatch(
      /\.codex\/hooks\/session-start\.sh\s+was missing — restored \(drop this CLI for good: agent-harness uninstall --cli codex\)/,
    );
    expect(screen).toMatch(
      /\.codex\/config\.toml\s+was missing — restored — wrote \(harness part only\)/,
    );
  });

  it("설치자 AGENTS.md(첫 접촉 블록 모델)를 지우면 블록만 담아 되살리고 uninstall 이 파일째 걷는다", () => {
    put("AGENTS.md", "# Mine\n\nmy notes\n");
    install(["codex"]);
    expect(read("AGENTS.md")).toContain("<!-- uzys-harness:agents:start -->"); // 전제 — 블록 모델
    const block = read("AGENTS.md").slice(
      read("AGENTS.md").indexOf("<!-- uzys-harness:agents:start"),
    );
    rmSync(join(projectDir, "AGENTS.md"));

    const { screen } = update();

    expect(read("AGENTS.md")).not.toContain("my notes");
    expect(read("AGENTS.md")).toContain(block.trim());
    // 파일째 하네스 것이 아니다 — 기준선 대신 "하네스가 만든 함께 쓰는 파일" 로 적는다
    const log = readInstallLog(projectDir);
    expect((log?.externalFiles ?? []).map((f) => f.path)).not.toContain("AGENTS.md");
    expect(log?.rootFiles).toContainEqual(
      expect.objectContaining({ path: "AGENTS.md", change: "created" }),
    );
    expect(screen).toMatch(/AGENTS\.md\s+was missing — restored — wrote the harness block only/);
    // 블록 하나를 빼는 길은 그 키 id 다 — CLI 를 통째로 빼라고 하지 않는다(USAGE AGENTS.md 행 · 설계 §4)
    const row = screen.split("\n").find((l) => l.includes("wrote the harness block only")) ?? "";
    expect(row).toContain("(drop it: install … --without agents-md:agents — kept out by update;");
    expect(row).not.toContain("uninstall --cli");

    const lines: string[] = [];
    uninstallAction(
      { projectDir, yes: true },
      {
        exit: () => undefined as never,
        log: (l: string) => lines.push(l),
        err: (l: string) => lines.push(l),
        resolveHarnessRoot: () => HARNESS_ROOT,
      },
    );
    expect(existsSync(join(projectDir, "AGENTS.md"))).toBe(false);
  });
});

describe("#584 — Antigravity 앵커와 형제 룰을 지운 뒤 update 1회가 되돌린다", () => {
  const ANCHOR = ".agents/rules/uzys-harness.md";
  const RULE = ".agents/rules/git-policy.md";

  it("앵커 · git-policy 가 돌아온다 — 화면이 둘 다 말한다", () => {
    install(["antigravity"]);
    const before = { anchor: read(ANCHOR), rule: read(RULE) };
    rmSync(join(projectDir, ANCHOR));
    rmSync(join(projectDir, RULE));

    const { screen } = update();

    expect(read(ANCHOR)).toBe(before.anchor);
    expect(read(RULE)).toBe(before.rule);
    expect(screen).toMatch(
      /\.agents\/rules\/uzys-harness\.md\s+was missing — restored \(drop this CLI for good: agent-harness uninstall --cli antigravity\)/,
    );
    expect(screen).toMatch(/\.agents\/rules\/git-policy\.md\s+was missing — reinstalled/);
    // 기록에 있던 자리다 — 릴리즈가 더한 것이라 말하지 않는다
    expect(screen).not.toMatch(
      /\.agents\/rules\/(uzys-harness|git-policy)\.md\s+added by this release/,
    );
  });

  it("기록에서 두 파일이 빠진 설치본(옛 판 update 가 걷었다)도 기록된 CLI 를 근거로 돌아온다", () => {
    install(["antigravity"]);
    const before = { anchor: read(ANCHOR), rule: read(RULE) };
    rmSync(join(projectDir, ANCHOR));
    rmSync(join(projectDir, RULE));
    const log = rawLog();
    writeFileSync(
      installLogPath(projectDir),
      JSON.stringify({
        ...log,
        externalFiles: (log.externalFiles ?? []).filter(
          (f) => f.path !== ANCHOR && f.path !== RULE,
        ),
      }),
    );

    const { screen } = update();

    expect(read(ANCHOR)).toBe(before.anchor);
    expect(read(RULE)).toBe(before.rule);
    // 기록이 아니라 기록된 CLI 를 근거로 만들었어도 화면이 말한다(리뷰 PR B NOTE-4). 기록에 없던 자리는 릴리즈가 새로 더한 룰과
    // 구분되지 않는다 — claude 쪽과 같이 "added by this release" 로 말하고 "was missing" 이라 하지 않는다
    expect(screen).toMatch(/\.agents\/rules\/uzys-harness\.md\s+added by this release/);
    expect(screen).toMatch(/\.agents\/rules\/git-policy\.md\s+added by this release/);
    expect(screen).not.toMatch(/\.agents\/rules\/(uzys-harness|git-policy)\.md\s+was missing/);
  });

  it("릴리즈가 더한 룰(디스크에도 기록에도 없던 자리)은 'added by this release' 로 말한다 — 지운 적 없는 것을 되살렸다고 하지 않는다", () => {
    install(["antigravity"]);
    // 이 판의 룰 하나를 '아직 없던 릴리즈' 상태로 만든다 — 파일도 기록도 없다(옛 판에서 올라온 설치본과 같은 입력)
    rmSync(join(projectDir, RULE));
    const log = rawLog();
    writeFileSync(
      installLogPath(projectDir),
      JSON.stringify({
        ...log,
        externalFiles: (log.externalFiles ?? []).filter((f) => f.path !== RULE),
      }),
    );

    const { screen } = update();

    expect(existsSync(join(projectDir, RULE))).toBe(true);
    expect(screen).toMatch(/\.agents\/rules\/git-policy\.md\s+added by this release/);
    expect(screen).not.toMatch(/\.agents\/rules\/git-policy\.md\s+was missing/);
    expect(screen).not.toContain("to keep it out");
    // 다음 update 는 기록에 생긴 자리라 아무 줄도 내지 않는다
    expect(update().screen).not.toMatch(/\.agents\/rules\/git-policy\.md/);
  });
});
