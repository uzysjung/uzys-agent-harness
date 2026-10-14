/**
 * #817 (#796 PR-C) · #777 — update · uninstall 화면이 그 파일에 **실제로 한 일**을 판정(`recorded()` → `judge()`) 하나와 같은 말로 한다.
 *
 * 전에는 화면이 영역마다 따로 셌다: 백업의 까닭은 기록 필드의 존재(`checksumOnRecord`)로 다시 갈랐고, 지우기 전 백업은 트랙 밖 회수만
 * "before removing" 으로 셌다. 그래서 같은 파일을 판정은 "체크섬 없음 · 백업 뒤 지움" 으로, 화면은 "바꾸기 전 백업 · 편집 아닐 수
 * 있음" 으로 말했다. 이제 파일마다 판정이 낸 줄을 그대로 찍고, 요약(BACKUPS · NEXT)은 그 줄과 디스크에 남은 결과에서 나온다.
 *
 * 장면은 #817 본문의 다섯 · #777 하나. 디스크 동작은 바뀌지 않는다 — 각 장면이 결과 디스크를 함께 단언한다.
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
import { createInstallRenderer, renderUpdateSummary } from "../src/commands/install-render.js";
import { type UninstallOptions, uninstallAction } from "../src/commands/uninstall.js";
import { hashContent, type InstallLog, installLogPath } from "../src/install-log.js";
import { runInstall } from "../src/installer.js";
import { RETIRED_PATHS } from "../src/manifest.js";
import type { CliBase, InstallSpec, Track } from "../src/types.js";
import { runUpdateMode } from "../src/update-mode.js";

const HARNESS_ROOT = resolve(__dirname, "..");
const TEMPLATES_DIR = join(HARNESS_ROOT, "templates");

let projectDir = "";
beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "ah-one-verdict-"));
});
afterEach(() => rmSync(projectDir, { recursive: true, force: true }));

const abs = (rel: string): string => join(projectDir, rel);
const read = (rel: string): string => readFileSync(abs(rel), "utf8");
function put(rel: string, text: string): void {
  mkdirSync(dirname(abs(rel)), { recursive: true });
  writeFileSync(abs(rel), text);
}

function spec(tracks: Track[] = ["tooling"], cli: CliBase[] = ["claude"]): InstallSpec {
  return { tracks, options: { withCodexTrust: false }, cli, projectDir };
}

function install(tracks?: Track[]): void {
  runInstall({
    runExternal: null,
    harnessRoot: HARNESS_ROOT,
    projectDir,
    spec: spec(tracks),
    mode: "add",
  });
}

// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI 색 코드를 벗긴다
const plain = (lines: string[]): string => lines.join("\n").replace(/\x1b\[[0-9;]*m/g, "");

/** update 1회 — 색을 벗긴 화면(진행 행 + 요약). */
function update(tracks?: Track[]): string {
  const lines: string[] = [];
  const renderer = createInstallRenderer((m) => lines.push(m), spec(tracks), false);
  const report = runInstall({
    runExternal: null,
    harnessRoot: HARNESS_ROOT,
    projectDir,
    spec: spec(tracks),
    mode: "update",
    onProgress: (event) => renderer.callbacks.onProgress?.(event),
  });
  renderUpdateSummary((m) => lines.push(m), spec(tracks), report);
  return plain(lines);
}

const readLog = (): InstallLog => JSON.parse(read(".uzys-agent-harness/.harness-install.json"));
const writeLog = (log: InstallLog): void =>
  writeFileSync(installLogPath(projectDir), `${JSON.stringify(log, null, 2)}\n`);

/** 체크섬 이전 옛 판(≤v26.125)의 기록 모양 — 파일 필드 · 쓰기 표시가 없다. */
function asLegacyLog(): void {
  const log = readLog();
  delete log.records;
  delete log.policyFiles;
  delete log.skillFiles;
  delete log.externalFiles;
  delete log.portions;
  writeLog(log);
}

type Indexed = { path: string; backup: string; noChecksum?: boolean; removed?: boolean };
const backupIndex = (): Indexed[] =>
  (JSON.parse(read(".uzys-agent-harness/update-backups.json")) as { backups: Indexed[] }).backups;

describe("#817 — update 화면은 파일마다 판정이 낸 줄을 말하고, 요약은 그 결과에서 나온다", () => {
  it("장면 1 — 옛 판(≤v26.125) 첫 update 가 백업 뒤 치운 은퇴 이름의 자기 파일: '바꾸기 전 · 편집 아닐 수 있음' 이 아니라 '지우기 전 백업'", () => {
    install();
    asLegacyLog();
    expect(RETIRED_PATHS).toContain("rules/database.md");
    put(".claude/rules/database.md", "my own database notes\n");

    const screen = update();

    // 디스크 — 백업 뒤 치웠다(바뀌지 않는다)
    expect(existsSync(abs(".claude/rules/database.md"))).toBe(false);
    expect(screen).toMatch(
      /\.claude\/rules\/database\.md — retired from the harness — no checksum on record — saved a copy, removed from live/,
    );
    expect(screen).toMatch(/BACKUPS\s+1 file\(s\) saved before removing/);
    expect(screen).not.toContain("may not be your edits");
    expect(screen).not.toContain("saved before replacing");
    expect(screen).not.toContain("nothing to carry over");
    expect(backupIndex()).toEqual([
      expect.objectContaining({
        path: ".claude/rules/database.md",
        noChecksum: true,
        removed: true,
      }),
    ]);
  });

  it("장면 2 — 고친 하네스 룰(바꿈)과 은퇴 회수(지움)가 한 실행에 있으면 BACKUPS 가 둘을 갈라 센다", () => {
    install();
    const RULE = ".claude/rules/git-policy.md";
    put(RULE, `${read(RULE)}\nmy team rule\n`);
    // 은퇴 claims 가 이어 적힌 자리 — 디스크 내용의 sha 로 적혀 있다(옛 update 의 `retiredClaims`)
    const retired = "my edited database rule\n";
    put(".claude/rules/database.md", retired);
    const log = readLog();
    log.policyFiles = [
      ...(log.policyFiles ?? []),
      { path: "rules/database.md", sha256: hashContent(retired) },
    ];
    writeLog(log);

    const screen = update();

    expect(existsSync(abs(".claude/rules/database.md"))).toBe(false);
    expect(read(RULE)).not.toContain("my team rule");
    expect(screen).toMatch(/BACKUPS\s+2 file\(s\) saved before replacing \(1 before removing\)/);
    expect(screen).toMatch(
      /backed up\s+\.claude\/rules\/git-policy\.md — you edited it — saved as /,
    );
    // 바꾼 것(편집)이 있으니 옮기라는 안내는 남는다
    expect(screen).toContain("to keep your edits across updates");
  });

  it("장면 3 — 부분 update 가 은퇴 claims 를 적은 뒤의 회수 백업: 판정(no-sha)과 같은 말 · 다시 얹으라 하지 않는다", () => {
    install();
    asLegacyLog();
    const RETIRED = ".claude/rules/nextjs.md";
    expect(RETIRED_PATHS).toContain("rules/nextjs.md");
    put(RETIRED, "# old harness nextjs rule\n");
    runUpdateMode(projectDir, TEMPLATES_DIR, HARNESS_ROOT, {}, ["hooks"]);
    // 전제 — 부분 실행이 은퇴 항목을 기록에 이어 적었다(필드 존재로 가르면 "체크섬 있음")
    expect((readLog().policyFiles ?? []).map((f) => f.path)).toContain("rules/nextjs.md");

    const screen = update();

    expect(existsSync(abs(RETIRED))).toBe(false);
    expect(screen).toMatch(
      /\.claude\/rules\/nextjs\.md — retired from the harness — no checksum on record — saved a copy, removed from live/,
    );
    expect(screen).toMatch(/BACKUPS\s+1 file\(s\) saved before removing/);
    expect(screen).not.toContain("to keep your edits across updates");
    expect(backupIndex()).toEqual([
      expect.objectContaining({ path: RETIRED, noChecksum: true, removed: true }),
    ]);
  });

  it("장면 4 — 번들 스킬 폴더 안 번들 밖 노트(#477): 'N files deleted' · '편집 아닐 수 있음' 이 아니라 파일 줄과 '지우기 전 백업'", () => {
    install();
    const id = readdirSync(abs(".claude/skills")).find((d) =>
      existsSync(join(TEMPLATES_DIR, "skills", d, "SKILL.md")),
    );
    if (id === undefined) throw new Error("픽스처 전제가 깨졌다 — 깔린 번들 스킬이 없다");
    const NOTE = `.claude/skills/${id}/my-notes.md`;
    put(NOTE, "my notes\n");

    const screen = update();

    expect(existsSync(abs(NOTE))).toBe(false);
    const [entry] = backupIndex();
    expect(entry).toEqual(expect.objectContaining({ path: NOTE, removed: true }));
    expect(entry).not.toHaveProperty("noChecksum");
    expect(screen).toContain(
      `${NOTE} — not in bundle — not on the install record — saved as ${entry?.backup}, removed from live`,
    );
    expect(screen).toMatch(/BACKUPS\s+1 file\(s\) saved before removing/);
    expect(screen).not.toContain("may not be your edits");
    expect(screen).not.toContain("files deleted");
  });
});

describe("#817 — 앵커 · 외부 CLI 산출물의 백업도 같은 줄(영역별 행 대신)", () => {
  it("고친 앵커와 고친 Codex 스킬 사본 — 파일마다 'you edited it — saved as <실제 백업>'", () => {
    runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: spec(["tooling"], ["claude", "codex"]),
      mode: "add",
    });
    const ANCHOR = "CLAUDE-uzys-harness.md";
    put(ANCHOR, `${read(ANCHOR)}\n<!-- my anchor edit -->\n`);
    const id = readdirSync(abs(".agents/skills"))[0];
    const SKILL = `.agents/skills/${id}/SKILL.md`;
    put(SKILL, `${read(SKILL)}\nmy note\n`);

    const lines: string[] = [];
    const s = spec(["tooling"], ["claude", "codex"]);
    const renderer = createInstallRenderer((m) => lines.push(m), s, false);
    const report = runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: s,
      mode: "update",
      onProgress: (event) => renderer.callbacks.onProgress?.(event),
    });
    renderUpdateSummary((m) => lines.push(m), s, report);
    const screen = plain(lines);

    for (const path of [ANCHOR, SKILL]) {
      const entry = backupIndex().find((b) => b.path === path);
      expect(entry, path).toBeDefined();
      expect(entry).not.toHaveProperty("noChecksum");
      expect(screen).toContain(`backed up  ${path} — you edited it — saved as ${entry?.backup}`);
    }
  });
});

describe("#817 장면 5 — uninstall 뒤 기록 폴더에 남은 설치자 파일을 화면이 말한다", () => {
  function uninstall(options: Omit<UninstallOptions, "projectDir"> = {}): string {
    const lines: string[] = [];
    uninstallAction(
      { projectDir, yes: true, ...options },
      {
        log: (l: string) => lines.push(l),
        err: (l: string) => lines.push(l),
        exit: () => undefined as never,
        resolveHarnessRoot: () => HARNESS_ROOT,
      },
    );
    return plain(lines);
  }

  it("자기 노트는 남고 · 미리보기와 실행이 같은 줄로 '남긴다' 고 말한다 · 기록 · 런타임 파일은 세지 않는다", () => {
    install();
    put(".uzys-agent-harness/my-notes.md", "mine\n");
    put(".uzys-agent-harness/hook-blocks.log", "2026-10-14\tprotect\t.env\n");

    const preview = uninstall({ dryRun: true });
    expect(preview).toMatch(
      /○ leave \.uzys-agent-harness\/ — 1 file\(s\) not on the install record.*: my-notes\.md/,
    );

    const screen = uninstall();

    expect(read(".uzys-agent-harness/my-notes.md")).toBe("mine\n");
    expect(existsSync(abs(".uzys-agent-harness/hook-blocks.log"))).toBe(false);
    expect(screen).toMatch(
      /left\s+\.uzys-agent-harness\/ — 1 file\(s\) not on the install record.*: my-notes\.md/,
    );
  });

  it("대조 — 기록 폴더에 설치자 파일이 없으면 그 줄이 없다", () => {
    install();
    expect(uninstall()).not.toContain(".uzys-agent-harness/ — ");
  });
});

describe("#777 — 옛 판이 설치자 .mcp.json 에 병합한, npm 에 없는 supabase 항목을 update 가 한 줄로 알린다", () => {
  const OLD = { type: "stdio", command: "npx", args: ["-y", "@supabase/mcp-server"] };

  /** v26.161 이하가 설치자의 `.mcp.json` 에 병합한 설치본 — 몫 기록이 없고 파일은 설치자 것(`modified`). */
  function legacySupabaseInstall(): void {
    put(
      ".mcp.json",
      `${JSON.stringify({ mcpServers: { mine: { command: "my-server" } } }, null, 2)}\n`,
    );
    install(["csr-supabase"]);
    const mcp = JSON.parse(read(".mcp.json")) as { mcpServers: Record<string, unknown> };
    mcp.mcpServers.supabase = OLD;
    put(".mcp.json", `${JSON.stringify(mcp, null, 2)}\n`);
    const log = readLog();
    delete log.records;
    delete log.portions;
    log.rootFiles = [
      ...(log.rootFiles ?? []).filter((f) => f.path !== ".mcp.json"),
      { path: ".mcp.json", change: "modified", notes: [] },
    ];
    writeLog(log);
  }

  it("값은 그대로 두고(갈아 끼우지 않는다) 화면에 그 항목과 바꿀 값을 한 줄로", () => {
    legacySupabaseInstall();

    const screen = update(["csr-supabase"]);

    const after = JSON.parse(read(".mcp.json")) as { mcpServers: Record<string, unknown> };
    expect(after.mcpServers.supabase).toEqual(OLD);
    expect(screen).toMatch(
      /\.mcp\.json\s+supabase — runs @supabase\/mcp-server, which is not on npm — this server never started/,
    );
    expect(screen).toContain('"url": "https://mcp.supabase.com/mcp"');
  });

  it("대조 — 그 항목이 현행 원격 값이면 그 줄이 없다", () => {
    install(["csr-supabase"]);
    expect(update(["csr-supabase"])).not.toContain("not on npm");
  });
});
