import {
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runInstall } from "../src/installer.js";

const HARNESS_ROOT = resolve(__dirname, "..");

describe("installer (integration with templates/)", () => {
  let projectDir: string;

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "ch-installer-"));
  });

  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  it("tooling track: installs core assets + writes .installed-tracks", () => {
    const report = runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: {
        tracks: ["tooling"],
        options: {
          withCodexTrust: false,
        },
        cli: ["claude"],
        projectDir,
      },
    });

    expect(report.installedTracks).toEqual(["tooling"]);
    expect(report.filesCopied).toBeGreaterThan(10);

    // Project skeleton exists. 하네스 앵커는 v26.141.0(P5 · ADR-060)부터 **프로젝트 루트**다 —
    // `.claude/CLAUDE.md` 는 더 이상 설치되지 않는다.
    expect(existsSync(join(projectDir, "CLAUDE-uzys-harness.md"))).toBe(true);
    expect(existsSync(join(projectDir, ".claude/CLAUDE.md"))).toBe(false);
    expect(existsSync(join(projectDir, ".claude/settings.json"))).toBe(true);

    // Common rules
    expect(existsSync(join(projectDir, ".claude/rules/git-policy.md"))).toBe(true);
    expect(existsSync(join(projectDir, ".claude/rules/change-management.md"))).toBe(true);
    // tooling-specific
    expect(existsSync(join(projectDir, ".claude/rules/cli-development.md"))).toBe(true);

    // Hooks
    expect(existsSync(join(projectDir, ".claude/hooks/session-start.sh"))).toBe(true);
    // v26.115.0 (ADR-043) — hito-counter 제거. 상시 훅이 아무도 읽지 않는 로그를 쌓고 있었다.
    expect(existsSync(join(projectDir, ".claude/hooks/hito-counter.sh"))).toBe(false);

    // uzys/* 6-Gate commands removed — must never be emitted
    expect(existsSync(join(projectDir, ".claude/commands/uzys/spec.md"))).toBe(false);
    expect(existsSync(join(projectDir, ".claude/commands/uzys/auto.md"))).toBe(false);

    // Project root CLAUDE.md
    expect(existsSync(join(projectDir, "CLAUDE.md"))).toBe(true);

    // .mcp.json with context7 server
    const mcpPath = join(projectDir, ".mcp.json");
    expect(existsSync(mcpPath)).toBe(true);
    const mcp = JSON.parse(readFileSync(mcpPath, "utf8"));
    expect(mcp.mcpServers.context7).toBeDefined();

    // .installed-tracks meta
    const meta = readFileSync(join(projectDir, ".claude/.installed-tracks"), "utf8");
    expect(meta).toContain("tooling");
  });

  it("executive track: skips uzys/* commands and dev rules", () => {
    runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: {
        tracks: ["executive"],
        options: {
          withCodexTrust: false,
        },
        cli: ["claude"],
        projectDir,
      },
    });
    expect(existsSync(join(projectDir, ".claude/commands/uzys/spec.md"))).toBe(false);
    expect(existsSync(join(projectDir, ".claude/rules/test-policy.md"))).toBe(false);
    // common rule still installed
    expect(existsSync(join(projectDir, ".claude/rules/git-policy.md"))).toBe(true);
  });

  it("multi-track: union of rules + merged project-root CLAUDE.md with track subheaders", () => {
    runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: {
        tracks: ["tooling", "data"],
        options: {
          withCodexTrust: false,
        },
        cli: ["claude"],
        projectDir,
      },
    });
    // 2026-08-02 정비 — data 트랙 전용 룰(data-analysis·pyside6)이 배포에서 빠졌다. union 축은
    //   tooling 만 내는 cli-development + 두 트랙이 함께 무는 dev 룰로 계속 확인한다.
    expect(existsSync(join(projectDir, ".claude/rules/cli-development.md"))).toBe(true);
    expect(existsSync(join(projectDir, ".claude/rules/test-policy.md"))).toBe(true);
    expect(existsSync(join(projectDir, ".claude/rules/ship-checklist.md"))).toBe(true);
    // Root CLAUDE.md is a fill-in scaffold: real project name + active-track note + FILL sections.
    const rootMd = join(projectDir, "CLAUDE.md");
    expect(existsSync(rootMd)).toBe(true);
    const content = readFileSync(rootMd, "utf8");
    expect(content).toContain("Active track(s): Tooling, Data");
    expect(content).toContain("SCAFFOLD");
    expect(content).toContain("<!-- FILL:stack —");
    expect(content).not.toContain("[Project Name]");
    // 앵커 본문은 여기 없다 — 루트 CLAUDE.md 는 그것을 @import 로 끌어올 뿐이다 (P5 · ADR-060).
    expect(content).toContain("@CLAUDE-uzys-harness.md");
  });

  /**
   * P5 (ADR-060) 의 계약이 **설치 경로에서** 지켜지는가. 순수 함수 게이트
   * (`tests/claude-md-import.test.ts`)와 별개로 무는 이유: 그 증거는 `upsertHarnessImport` 의
   * 것이지 `runInstall` 의 것이 아니다 — 한 경로의 증거를 다른 경로에 전용하지 않는다
   * (`no-false-ship`). v26.140.0 까지 이 자리는 사용자 파일을 **통째로 덮어썼다**.
   */
  it("기존 사용자 CLAUDE.md 를 덮어쓰지 않는다 — 본문 보존 + import 1줄, 재실행 무변화", () => {
    const rootMd = join(projectDir, "CLAUDE.md");
    const userBody = "# 우리 서비스\n\n팀 규칙:\n- 배포는 화요일에만\n";
    writeFileSync(rootMd, userBody, "utf8");

    const install = (): void => {
      runInstall({
        runExternal: null,
        harnessRoot: HARNESS_ROOT,
        projectDir,
        spec: {
          tracks: ["tooling"],
          options: { withCodexTrust: false },
          cli: ["claude"],
          projectDir,
        },
      });
    };
    install();

    const afterFirst = readFileSync(rootMd, "utf8");
    for (const line of userBody.trimEnd().split("\n")) {
      expect(afterFirst).toContain(line);
    }
    expect(afterFirst).not.toContain("SCAFFOLD"); // 스캐폴드로 대체되지 않았다
    expect(
      afterFirst.split("\n").filter((l) => l.trim() === "@CLAUDE-uzys-harness.md"),
    ).toHaveLength(1);

    // 재설치가 import 를 또 붙이면 매 설치마다 파일이 자란다.
    install();
    expect(readFileSync(rootMd, "utf8")).toBe(afterFirst);
  });

  it("backup 옵션은 install 에서 `.claude/` 를 옮기지 않는다 — 폴더 단위 백업은 update 전용 (#551 PR-3)", () => {
    runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: {
        tracks: ["tooling"],
        options: {
          withCodexTrust: false,
        },
        cli: ["claude"],
        projectDir,
      },
    });
    const second = runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      backup: true,
      spec: {
        tracks: ["tooling"],
        options: {
          withCodexTrust: false,
        },
        cli: ["claude"],
        projectDir,
      },
    });
    expect(second.backup).toBeNull();
    expect(readdirSync(projectDir).filter((n) => n.startsWith(".claude.backup-"))).toEqual([]);
    expect(existsSync(join(projectDir, ".claude/rules"))).toBe(true);
  });

  it("throws when templates directory missing", () => {
    expect(() =>
      runInstall({
        runExternal: null,
        harnessRoot: "/no/such/root",
        projectDir,
        spec: {
          tracks: ["tooling"],
          options: {
            withCodexTrust: false,
          },
          cli: ["claude"],
          projectDir,
        },
      }),
    ).toThrow(/Templates dir not found/);
  });
});

/**
 * M-1 → #551 PR-3 — install 이 settings.json 에 **없는 스크립트를 부르는 하네스 참조를 쓰지 않는가**.
 *
 * 전에는 템플릿으로 settings.json 을 통째로 덮은 뒤 치유기(`cleanStaleHookRefs`)로 죽은 참조를 걷었다. 이제
 * install 은 하네스 몫만 쓰고, 그 몫은 **이번 선택으로 렌더**한다(설계 N13) — 깔지 않는 훅은 처음부터 부르지 않고,
 * 기록된 하네스 훅이 렌더에서 빠지면 upsert 가 뺀다. 파이프라인을 돌려 디스크의 settings.json 으로 판정한다.
 *
 * 세 방향을 같이 본다:
 *   ① 설치자가 뺀 훅(`--without baseline:hooks/…`) → 참조가 없다 · 다른 훅은 산다
 *   ② 앞 설치가 적은 훅이 이번 선택에서 빠진다 → 다음 install 이 그 참조를 뺀다(설치자 훅은 그대로)
 *   ③ 템플릿이 몫으로 옮길 수 없는 훅(`.claude/hooks/` 밖 스크립트 — 옛 M-1 의 스킬 사이드카)을 부르면
 *      조용히 빠뜨리지 않고 멈춘다 — **입력 변이**: 실 `templates/` 사본에만 그 훅을 넣는다.
 */
describe("install 의 settings.json — 이번 선택으로 렌더한 하네스 몫 (M-1 → #551 PR-3)", () => {
  let projectDir: string;
  const mutatedRoots: string[] = [];

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "ch-heal-"));
  });
  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
    for (const root of mutatedRoots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  const baseOptions = { withCodexTrust: false };
  const PROTECT = "protect-files.sh";
  const SESSION = "session-start.sh";

  function install(harnessRoot: string, baselineExclude: string[] = []) {
    return runInstall({
      runExternal: null,
      harnessRoot,
      projectDir,
      spec: {
        tracks: ["tooling"],
        options: baseOptions,
        cli: ["claude"],
        projectDir,
        ...(baselineExclude.length > 0 ? { baselineExclude } : {}),
      },
    });
  }

  function settingsText(): string {
    return readFileSync(join(projectDir, ".claude/settings.json"), "utf8");
  }

  it("① 설치자가 뺀 훅은 settings.json 이 부르지 않는다 — 다른 훅은 산다", () => {
    const report = install(HARNESS_ROOT, ["baseline:hooks/protect-files"]);

    expect(existsSync(join(projectDir, ".claude/hooks", PROTECT))).toBe(false);
    expect(
      settingsText(),
      "깔지 않은 훅을 부르는 참조를 썼다 — Write/Edit 마다 exit 127",
    ).not.toContain(PROTECT);
    expect(settingsText()).toContain(SESSION);
    // install 은 사후 치유를 하지 않는다 — 보고할 것이 없다
    expect(report.staleHookRefs).toEqual([]);
  });

  it("② 앞 설치가 적은 하네스 훅이 이번 선택에서 빠지면 그 참조를 뺀다 (설치자 훅은 그대로)", () => {
    install(HARNESS_ROOT);
    expect(settingsText()).toContain(PROTECT);
    const mine = { type: "command", command: "bash my-own.sh" };
    const withMine = JSON.parse(settingsText()) as {
      hooks: { PreToolUse: Array<{ matcher?: string; hooks: unknown[] }> };
    };
    withMine.hooks.PreToolUse.push({ matcher: "Bash", hooks: [mine] });
    writeFileSync(join(projectDir, ".claude/settings.json"), JSON.stringify(withMine, null, 2));

    install(HARNESS_ROOT, ["baseline:hooks/protect-files"]);

    expect(settingsText()).not.toContain(PROTECT);
    expect(settingsText()).toContain("my-own.sh");
    expect(settingsText()).toContain(SESSION);
  });

  it("③ 템플릿이 `.claude/hooks/` 밖 스크립트를 부르면 설치가 멈춘다 — 몫으로 옮길 수 없는 참조를 조용히 빠뜨리지 않는다", () => {
    const root = mkdtempSync(join(tmpdir(), "ch-heal-root-"));
    mutatedRoots.push(root);
    cpSync(join(HARNESS_ROOT, "templates"), join(root, "templates"), { recursive: true });
    const settingsPath = join(root, "templates/settings.json");
    const settings = JSON.parse(readFileSync(settingsPath, "utf8")) as {
      hooks: {
        PreToolUse: Array<{ matcher?: string; hooks: Array<{ type: string; command: string }> }>;
      };
    };
    settings.hooks.PreToolUse.push({
      matcher: "Write|Edit",
      hooks: [
        {
          type: "command",
          command: 'bash "$CLAUDE_PROJECT_DIR/.claude/skills/north-star/sidecar.sh"',
        },
      ],
    });
    writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
    // 전제 — 변이가 템플릿에 들어갔다(안 들어갔으면 아래 판정이 헛통과한다)
    expect(readFileSync(settingsPath, "utf8")).toContain("sidecar.sh");

    expect(() => install(root)).toThrow(/cannot be written as a harness portion/);
  });

  it("claude 미선택이면 건드릴 settings.json 이 없다 — 빈 보고", () => {
    const report = runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: { tracks: ["tooling"], options: baseOptions, cli: ["codex"], projectDir },
    });

    expect(report.staleHookRefs).toEqual([]);
    expect(existsSync(join(projectDir, ".claude/settings.json"))).toBe(false);
  });
});
