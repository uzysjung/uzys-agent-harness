import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
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
          withPrune: false,
          withCodexTrust: false,
        },
        cli: ["claude"],
        projectDir,
      },
    });

    expect(report.installedTracks).toEqual(["tooling"]);
    expect(report.filesCopied).toBeGreaterThan(10);

    // Project skeleton exists
    expect(existsSync(join(projectDir, ".claude/CLAUDE.md"))).toBe(true);
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
          withPrune: false,
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
          withPrune: false,
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
          withPrune: false,
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
          withPrune: false,
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
            withPrune: false,
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
 * 실 `templates/` 로 설치하고, 디스크에 남은 `.claude/settings.json` 을 읽어 판정한다.
 *
 * 결함의 형태: `templates/settings.json` 은 `applies: all` 이라 항상 깔리는데, 그 PreToolUse
 * 훅이 참조하는 `.claude/skills/strategic-compact/suggest-compact.sh` 는
 * `withEcc=true`(ECC plugin 선택) 에서 **미설치**다. 그 조합의 설치자는 Write/Edit 마다 없는
 * 파일을 bash 로 부른다(exit 127).
 *
 * 두 방향을 **같이** 본다 — 치유가 파손이 되면 안 되기 때문이다:
 *   ① withEcc=true  → 죽은 참조가 사라진다 + 보고에 실린다
 *   ② withEcc=false → 같은 참조가 **살아남는다** (스킬이 실제로 깔려 있다)
 *   ③ 두 경우 모두 `.claude/hooks/*.sh` 정상 참조는 건드리지 않는다
 */
describe("install 경로의 stale hook ref 치유 (M-1)", () => {
  let projectDir: string;

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "ch-heal-"));
  });
  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  const baseOptions = { withPrune: false, withCodexTrust: false };

  /**
   * `withEcc` 는 spec 의 boolean 이 아니라 **자산 선택**에서 파생된다
   * (`installer.ts` `buildManifestSpec` → `isAssetSelected("ecc-plugin")`). 그래서 테스트도
   * 사용자가 실제로 하는 것과 같은 입력(`--with ecc-plugin` = forceInclude)으로 만든다.
   * `runExternal: null` 이라 plugin 자체는 안 깔리지만, manifest 게이팅은 선택만 보므로
   * "plugin 을 골랐다 → cherry-pick 스킬은 비켜선다" 상태가 정확히 재현된다.
   */
  function install(withEcc: boolean) {
    return runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: {
        tracks: ["tooling"],
        options: baseOptions,
        cli: ["claude"],
        projectDir,
        ...(withEcc ? { userOverride: { forceInclude: ["ecc-plugin"], forceExclude: [] } } : {}),
      },
    });
  }

  function settingsText(): string {
    return readFileSync(join(projectDir, ".claude/settings.json"), "utf8");
  }

  /** 정상 참조 = 항상 깔리는 훅(`ALWAYS_HOOKS`) 중 settings.json 이 실제로 부르는 것들. */
  const LIVE_HOOK_REFS = ["session-start.sh", "protect-files.sh", "mcp-pre-exec.sh"];

  it("전제 확인 — 두 설치가 스킬 유무에서 실제로 갈린다 (헛통과 차단)", () => {
    // 여기가 안 갈리면 아래 두 케이스는 같은 상황을 두 번 보는 것이고, 초록불이 무의미해진다.
    install(true);
    expect(existsSync(join(projectDir, ".claude/skills/strategic-compact"))).toBe(false);

    rmSync(projectDir, { recursive: true, force: true });
    projectDir = mkdtempSync(join(tmpdir(), "ch-heal-"));
    install(false);
    expect(
      existsSync(join(projectDir, ".claude/skills/strategic-compact/suggest-compact.sh")),
    ).toBe(true);
  });

  it("withEcc=true — 없는 스킬을 가리키던 훅 참조가 설치 후 사라진다", () => {
    const report = install(true);

    expect(
      report.staleHookRefs,
      "install 이 치유기를 부르지 않았다 — settings.json 이 없는 파일을 가리킨 채 남는다",
    ).toContain("skills/strategic-compact/suggest-compact.sh");
    // 보고만 하고 파일을 안 고치면 아무 소용이 없다. 디스크가 답이다.
    expect(settingsText()).not.toContain("suggest-compact");
  });

  it("withEcc=true — 정상 훅 참조는 살아남는다 (치유가 파손이 되면 안 된다)", () => {
    install(true);
    const text = settingsText();
    for (const hook of LIVE_HOOK_REFS) {
      expect(text, `${hook} 참조가 사라졌다 — 치유기가 멀쩡한 훅을 뜯었다`).toContain(hook);
      expect(existsSync(join(projectDir, ".claude/hooks", hook))).toBe(true);
    }
  });

  it("withEcc=false — 스킬이 깔리므로 같은 참조가 보존된다", () => {
    const report = install(false);

    expect(report.staleHookRefs).toEqual([]);
    expect(settingsText()).toContain("suggest-compact");
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
