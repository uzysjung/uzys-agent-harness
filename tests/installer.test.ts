import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

  it("backup option moves existing .claude/ aside before install", () => {
    // Pre-populate a .claude/ to trigger backup
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
    expect(second.backup).toMatch(/\.claude\.backup-/);
    expect(existsSync(`${second.backup}`)).toBe(true);
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
 * M-1 — install 경로가 settings.json 의 죽은 훅 참조를 **실제로** 치유하는가.
 *
 * WHY 단위 계약(`tests/update-mode.test.ts`)으로 부족한가: 그쪽은 치유기 함수만 본다.
 * 결함의 본체는 **install 이 그 함수를 부르는가**이고, 그 호출은 지워도 단위 테스트가
 * 전부 초록이다(실측 확인). 그래서 여기서는 함수가 아니라 **파이프라인**을 돌린다 —
 * 실제로 설치하고, 디스크에 남은 `.claude/settings.json` 을 읽어 판정한다.
 *
 * 결함의 형태: `templates/settings.json` 은 `applies: all` 이라 항상 깔리는데, 그 PreToolUse
 * 훅이 참조하는 **스킬 디렉터리 안의 사이드카 스크립트**는 그 스킬의 조건대로 좁게 깔린다.
 * 그 조합의 설치자는 Write/Edit 마다 없는 파일을 bash 로 부른다(exit 127).
 *
 * **입력을 변이시켜 잰다**(이 리포 확정 어휘 = 입력 변이). 그 배선을 들고 있던 스킬은
 * ADR-088 (#426 F-09) 에서 은퇴해 실 템플릿에 더는 없다 — 그래서 실 `templates/` 를 임시
 * 디렉터리로 복사해 **거기에만** 같은 형태의 훅을 넣는다. 손으로 쓴 settings.json 픽스처를
 * 쓰면 템플릿 표기가 바뀌는 순간 이 게이트가 조용히 거짓이 된다.
 *
 * 두 방향을 **같이** 본다 — 치유가 파손이 되면 안 되기 때문이다:
 *   ① 참조 대상이 안 깔린다 → 죽은 참조가 사라진다 + 보고에 실린다
 *   ② 참조 대상이 깔린다   → 같은 형태의 참조가 **살아남는다**
 *   ③ 두 경우 모두 `.claude/hooks/*.sh` 정상 참조는 건드리지 않는다
 */
describe("install 경로의 stale hook ref 치유 (M-1)", () => {
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

  /** tooling 트랙 기본 선택에 들어오는 스킬 디렉터리 — ② 방향의 참조 대상. */
  const LIVE_SKILL = "north-star";
  /** 어느 spec 에서도 깔리지 않는 이름 — ① 방향. */
  const GHOST_SKILL = "ghost-sidecar-skill";
  const SIDECAR = "sidecar.sh";

  /**
   * 실 `templates/` 사본 + 스킬 안의 사이드카를 부르는 훅 한 줄.
   *
   * @param withSidecarFile true 면 그 스크립트까지 templates 에 만들어 **설치되게** 한다
   *   (= 참조가 살아 있는 쪽). false 면 배선만 있고 대상은 어디에도 없다.
   */
  function mutatedHarnessRoot(skillDir: string, withSidecarFile: boolean): string {
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
          command: `bash "$CLAUDE_PROJECT_DIR/.claude/skills/${skillDir}/${SIDECAR}"`,
        },
      ],
    });
    writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
    if (withSidecarFile) {
      writeFileSync(join(root, "templates/skills", skillDir, SIDECAR), "#!/bin/bash\nexit 0\n");
    }
    return root;
  }

  function install(harnessRoot: string) {
    return runInstall({
      runExternal: null,
      harnessRoot,
      projectDir,
      spec: {
        tracks: ["tooling"],
        options: baseOptions,
        cli: ["claude"],
        projectDir,
      },
    });
  }

  function settingsText(): string {
    return readFileSync(join(projectDir, ".claude/settings.json"), "utf8");
  }

  /** 정상 참조 = 항상 깔리는 훅(`ALWAYS_HOOKS`) 중 settings.json 이 실제로 부르는 것들. */
  const LIVE_HOOK_REFS = ["session-start.sh", "protect-files.sh"];

  it("전제 확인 — 변이가 배선을 넣었고 두 경우가 갈린다 (헛통과 차단)", () => {
    // 변이가 안 걸렸으면 아래 판정은 "치유했다"와 "배선이 애초에 없었다"를 구분하지 못한다.
    const ghostRoot = mutatedHarnessRoot(GHOST_SKILL, false);
    expect(readFileSync(join(ghostRoot, "templates/settings.json"), "utf8")).toContain(SIDECAR);
    install(ghostRoot);
    expect(existsSync(join(projectDir, `.claude/skills/${GHOST_SKILL}`))).toBe(false);

    rmSync(projectDir, { recursive: true, force: true });
    projectDir = mkdtempSync(join(tmpdir(), "ch-heal-"));
    install(mutatedHarnessRoot(LIVE_SKILL, true));
    expect(existsSync(join(projectDir, `.claude/skills/${LIVE_SKILL}/${SIDECAR}`))).toBe(true);
  });

  it("참조 대상이 없으면 — 죽은 훅 참조가 설치 후 사라진다", () => {
    const report = install(mutatedHarnessRoot(GHOST_SKILL, false));

    expect(
      report.staleHookRefs,
      "install 이 치유기를 부르지 않았다 — settings.json 이 없는 파일을 가리킨 채 남는다",
    ).toContain(`skills/${GHOST_SKILL}/${SIDECAR}`);
    // 보고만 하고 파일을 안 고치면 아무 소용이 없다. 디스크가 답이다.
    expect(settingsText()).not.toContain(SIDECAR);
  });

  it("참조 대상이 없어도 정상 훅 참조는 살아남는다 (치유가 파손이 되면 안 된다)", () => {
    install(mutatedHarnessRoot(GHOST_SKILL, false));
    const text = settingsText();
    for (const hook of LIVE_HOOK_REFS) {
      expect(text, `${hook} 참조가 사라졌다 — 치유기가 멀쩡한 훅을 뜯었다`).toContain(hook);
      expect(existsSync(join(projectDir, ".claude/hooks", hook))).toBe(true);
    }
  });

  it("참조 대상이 깔리면 같은 참조가 보존된다", () => {
    const report = install(mutatedHarnessRoot(LIVE_SKILL, true));

    expect(report.staleHookRefs).toEqual([]);
    expect(settingsText()).toContain(SIDECAR);
    for (const hook of LIVE_HOOK_REFS) {
      expect(settingsText()).toContain(hook);
    }
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
