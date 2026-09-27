import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listAction } from "../src/commands/list.js";
import { hashContent, type InstallLog, installLogPath } from "../src/install-log.js";
import { runInstall } from "../src/installer.js";

/**
 * v26.123.0 (F-1b) — 설치 기록은 v26.64.0 부터 있었지만 사용자가 볼 수단이 없었다.
 * `list` 가 그 창구다: 여기서 보이는 자산 id 가 곧 `uninstall --only <id>` 의 입력값이므로,
 * 하나라도 안 보이면 그 자산은 사용자 입장에서 제거할 방법이 없다.
 */
function writeLog(projectDir: string, log: InstallLog): void {
  mkdirSync(dirname(installLogPath(projectDir)), { recursive: true });
  writeFileSync(installLogPath(projectDir), JSON.stringify(log), "utf8");
}

function baseLog(): InstallLog {
  return {
    schemaVersion: 1,
    installedAt: "2026-07-19T00:00:00.000Z",
    scope: "project",
    spec: { tracks: ["tooling"], cli: ["claude"] },
    templates: { claudeDir: ".claude/" },
    assets: [],
  };
}

describe("listAction", () => {
  let tmpDir = "";
  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "harness-list-"));
  });

  function run(): { output: string; exit: ReturnType<typeof vi.fn> } {
    const log = vi.fn();
    const err = vi.fn();
    const exit = vi.fn();
    listAction(
      { projectDir: tmpDir },
      { log, err, exit: exit as unknown as (code: number) => never },
    );
    return { output: [...log.mock.calls, ...err.mock.calls].flat().join("\n"), exit };
  }

  it("log 없으면 exit 1 + 어디를 봤는지 명시 (조용한 빈 출력 금지)", () => {
    const { output, exit } = run();
    expect(exit).toHaveBeenCalledWith(1);
    expect(output).toContain("install log not found");
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("설치된 자산의 id 를 전부 보여준다 — 안 보이면 --only 로 지울 수 없다", () => {
    writeLog(tmpDir, {
      ...baseLog(),
      assets: [
        {
          id: "code-review",
          category: "dev-tools",
          method: "plugin",
          scope: "project",
          detail: { marketplace: "mp", pluginId: "cr@mp" },
          version: "1.2.0",
        },
        {
          id: "agentmemory",
          category: "understanding",
          method: "skill",
          scope: "global",
          detail: { source: "owner/repo" },
        },
      ],
    });
    const { output, exit } = run();
    expect(output).toContain("code-review");
    expect(output).toContain("agentmemory");
    expect(output).toContain("1.2.0");
    expect(exit).toHaveBeenCalledWith(0);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // #492 — 은퇴한 자산은 카탈로그에 없다. `list` 가 카탈로그를 조회하면 그 자산은 화면에서
  // 사라지고, 그러면 사용자는 `uninstall --only <id>` 의 입력값을 알 수 없다.
  it("카탈로그에서 은퇴한 자산도 그대로 보여준다 (로그가 진실이다)", () => {
    writeLog(tmpDir, {
      ...baseLog(),
      assets: [
        {
          id: "ecc-plugin",
          category: "ecc-suite",
          method: "plugin",
          scope: "project",
          detail: { marketplace: "affaan-m/everything-claude-code", pluginId: "ecc@ecc" },
        },
        {
          id: "find-skills",
          category: "dev-tools",
          method: "skill",
          scope: "project",
          detail: { source: "vercel-labs/skills" },
        },
      ],
    });
    const { output, exit } = run();
    expect(output).toContain("ecc-plugin");
    expect(output).toContain("find-skills");
    expect(exit).toHaveBeenCalledWith(0);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("global 자산은 자동 삭제 대상이 아님을 표시한다 (D16 — 오해하면 지웠다고 믿는다)", () => {
    writeLog(tmpDir, {
      ...baseLog(),
      assets: [
        {
          id: "vercel",
          category: "dev-tools",
          method: "npm",
          scope: "global",
          detail: { pkg: "vercel" },
        },
      ],
    });
    expect(run().output).toContain("manual removal");
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("항목별/전체 제거 방법을 함께 안내한다 (조회 다음 행동이 곧 제거다)", () => {
    writeLog(tmpDir, baseLog());
    const { output } = run();
    expect(output).toContain("uninstall --only");
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("CLAUDE.md 가 수정됐으면 uninstall 이 보존한다는 사실을 미리 알린다", () => {
    // 같은 sha256 판정을 uninstall 이 쓰므로, 여기 표시와 실제 동작이 어긋나면 안 된다.
    writeFileSync(join(tmpDir, "CLAUDE.md"), "user edited\n", "utf8");
    writeLog(tmpDir, {
      ...baseLog(),
      templates: {
        claudeDir: ".claude/",
        rootClaudeMd: { path: "CLAUDE.md", sha256: hashContent("original\n") },
      },
    });
    expect(run().output).toContain("수정됨");
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("CLAUDE.md 가 원본 그대로면 수정 표시를 하지 않는다", () => {
    writeFileSync(join(tmpDir, "CLAUDE.md"), "original\n", "utf8");
    writeLog(tmpDir, {
      ...baseLog(),
      templates: {
        claudeDir: ".claude/",
        rootClaudeMd: { path: "CLAUDE.md", sha256: hashContent("original\n") },
      },
    });
    expect(run().output).not.toContain("수정됨");
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("자산이 0개여도 크래시 없이 (none) 으로 보고한다", () => {
    writeLog(tmpDir, baseLog());
    const { output, exit } = run();
    expect(output).toContain("Assets (0)");
    expect(exit).toHaveBeenCalledWith(0);
    rmSync(tmpDir, { recursive: true, force: true });
  });
});

/**
 * v26.124.0 (F-1f) — `.claude/` 밖 루트 파일. 인벤토리가 `.claude/` 안만 보여주면
 * "무엇이 설치됐는가"의 답이 반쪽이다 — uninstall 이 남기는 것들이 여기서도 안 보인다.
 */
describe("listAction — 루트 파일 (F-1f)", () => {
  let tmpDir = "";
  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "harness-list-root-"));
  });

  function run(): string {
    const log = vi.fn();
    listAction(
      { projectDir: tmpDir },
      { log, err: vi.fn(), exit: vi.fn() as unknown as (code: number) => never },
    );
    return log.mock.calls.flat().join("\n");
  }

  it("루트 파일을 실재하는 것만 보여준다", () => {
    writeLog(tmpDir, {
      ...baseLog(),
      rootFiles: [
        { path: ".mcp.json", change: "modified", notes: ["MCP 서버 정의 병합"] },
        { path: ".env.example", change: "created", notes: ["Supabase 가이드"] },
      ],
    });
    writeFileSync(join(tmpDir, ".mcp.json"), "{}", "utf8"); // .env.example 은 없다

    const out = run();
    expect(out).toContain(".mcp.json");
    expect(out).not.toContain(".env.example");
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("rootFiles 없는 구 로그는 섹션이 없다", () => {
    writeLog(tmpDir, baseLog());
    expect(run()).not.toContain("Root files");
    rmSync(tmpDir, { recursive: true, force: true });
  });
});

/**
 * #559 (설계 §2 행 25) — `list` 는 **기록이 말하는 자리만** 보인다. 예전에는 `templates.*Dir` 를 읽어
 * OpenCode 를 고른 설치에 `.opencode/` 를 보였다 — OpenCode 는 그 폴더를 만들지 않는다(스킬은
 * `.agents/skills/`, 설정은 `opencode.json`). 설치자는 없는 폴더를 찾거나 지우려 들게 된다.
 */
describe("listAction — 하네스 파일은 기록 경로에서 (#559)", () => {
  let projectDir = "";
  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "harness-list-559-"));
  });

  function harnessRow(): string {
    const lines: string[] = [];
    listAction(
      { projectDir },
      { log: (l: string) => lines.push(l), err: vi.fn(), exit: vi.fn() as never },
    );
    const at = lines.findIndex((l) => l.includes("Harness files"));
    return lines[at + 1] ?? "";
  }

  it("claude · codex · opencode 설치 — 만들지 않은 .opencode/ 를 말하지 않는다", () => {
    runInstall({
      runExternal: null,
      harnessRoot: resolve(__dirname, ".."),
      projectDir,
      spec: {
        tracks: ["tooling"],
        options: { withCodexTrust: false },
        cli: ["claude", "codex", "opencode"],
        projectDir,
      },
    });
    expect(existsSync(join(projectDir, ".opencode"))).toBe(false); // 픽스처 자기검증

    const row = harnessRow();
    expect(row).toContain(".claude/");
    expect(row).toContain(".codex/");
    expect(row).not.toContain(".opencode/");
    rmSync(projectDir, { recursive: true, force: true });
  });

  it("옛 codex 단독 로그(claudeDir 가 적혀 있다)에 .claude/ 를 말하지 않는다 — 깔린 CLI 는 기록에서", () => {
    // v26.160.1 이하는 claude 를 안 골라도 `templates.claudeDir` 를 적었고, `policyFiles` 는 설치자
    // `.claude/` 를 훑어 적었다 — 둘 다 하네스가 거기 썼다는 기록이 아니다.
    writeLog(projectDir, {
      ...baseLog(),
      spec: { tracks: ["tooling"], cli: ["codex"] },
      templates: { claudeDir: ".claude/", codexDir: ".codex/" },
      policyFiles: [{ path: "rules/git-policy.md", sha256: hashContent("# 내 룰\n") }],
      externalFiles: [{ path: ".codex/hooks/session-start.sh", sha256: "x" }],
    });

    const row = harnessRow();
    expect(row).toContain(".codex/");
    expect(row).not.toContain(".claude/");
    rmSync(projectDir, { recursive: true, force: true });
  });
});
