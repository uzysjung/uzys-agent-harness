import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listAction } from "../src/commands/list.js";
import { hashContent, type InstallLog, installLogPath } from "../src/install-log.js";

/**
 * v26.123.0 (F-1b) — 설치 기록은 v26.64.0 부터 있었지만 사용자가 볼 수단이 없었다.
 * `list` 가 그 창구다: 여기서 보이는 자산 id 가 곧 `uninstall --only <id>` 의 입력값이므로,
 * 하나라도 안 보이면 그 자산은 사용자 입장에서 제거할 방법이 없다.
 */
function writeLog(projectDir: string, log: InstallLog): void {
  mkdirSync(join(projectDir, ".claude"), { recursive: true });
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
