/**
 * #573/#596/#629/#630/#656/#655/#611 — uninstall 회수 누수(E 클러스터)의 계약.
 *
 * - #573: skills CLI 제거 인자는 **스킬 이름**(detail.skill) — source 는 무매치인데도 exit 0.
 * - #596: `--cli antigravity` 가 형제 룰(.agents/rules/<rule>.md)도 회수한다.
 * - #629/#630: 파일 심링크(config.toml 등)는 대상까지 따라가 회수 — 단 `.agents/skills/` 링크는 건드리지 않는다(#343).
 * - #655: claude CLI 가 "not found" 로 실패하는 플러그인은 already-removed 로 성공 처리.
 * - #656: 걷어낸 AGENTS.md 에 거짓 스캐폴드 배너("not filled in yet")가 남지 않는다.
 * - #611: 전량 uninstall 후 빈 docs/decisions 디렉터를 걷는다.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { uninstallAction } from "../src/commands/uninstall.js";
import { runInstall } from "../src/installer.js";
import type { CliBase, InstallSpec } from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");
let projectDir: string;

beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "ah-leaks-"));
});
afterEach(() => {
  rmSync(projectDir, { recursive: true, force: true });
});

const install = (clis: ReadonlyArray<CliBase>, tracks: ReadonlyArray<string> = ["tooling"]) =>
  runInstall({
    runExternal: null,
    harnessRoot: HARNESS_ROOT,
    projectDir,
    spec: {
      tracks: [...tracks],
      options: { withCodexTrust: false },
      cli: [...clis],
      projectDir,
    } as InstallSpec,
  });

const uninstall = (options: Record<string, unknown> = {}) => {
  const lines: string[] = [];
  uninstallAction({ projectDir, yes: true, ...options } as never, {
    exit: () => undefined as never,
    log: (l: string) => lines.push(l),
    err: (l: string) => lines.push(l),
    // vitest(src) 에서 defaultHarnessRoot 가 src/ 를 가리켜 템플릿을 못 읽는다 — 배치(dist) 기준 경로 주입.
    resolveHarnessRoot: () => HARNESS_ROOT,
  });
  return lines;
};

describe("#573 — skills remove 인자는 스킬 이름", () => {
  it("detail.skill 가 있으면 이름을 넘긴다(다중 스킬 source 는 무매치 exit 0 이었음)", () => {
    install(["claude"]);
    const spawn = vi.fn(() => ({ status: 0, stdout: "", stderr: "" }) as never);
    const path = join(projectDir, ".uzys-agent-harness", ".harness-install.json");
    const log = JSON.parse(readFileSync(path, "utf8")) as {
      assets: Array<{ id: string; method: string; detail: Record<string, string> }>;
    };
    log.assets = [
      {
        id: "supabase-agent-skills",
        method: "skill",
        detail: { source: "anthropics/skills", skill: "frontend-design" },
      },
    ];
    writeFileSync(path, JSON.stringify(log));
    uninstallAction({ projectDir, yes: true } as never, {
      exit: () => undefined as never,
      log: () => {},
      err: () => {},
      spawn,
      rm: () => {},
      resolveHarnessRoot: () => HARNESS_ROOT,
    });
    const call = spawn.mock.calls[0] as unknown as [string, string[]];
    expect(call[1]).toContain("frontend-design");
    expect(call[1]).not.toContain("anthropics/skills");
  });
});

describe("#596 — --cli antigravity 가 형제 룰을 회수한다", () => {
  it("룰 파일들이 사라진다(앵커만 아니라)", () => {
    install(["claude", "antigravity"]);
    expect(existsSync(join(projectDir, ".agents/rules/git-policy.md"))).toBe(true);
    uninstall({ cli: "antigravity" });
    expect(existsSync(join(projectDir, ".agents/rules/uzys-harness.md"))).toBe(false);
    expect(existsSync(join(projectDir, ".agents/rules/git-policy.md"))).toBe(false);
    // .agents/skills 는 이 조합에서 antigravity 소유(codex/opencode 없음) — 함께 회수된다.
    expect(existsSync(join(projectDir, ".agents/skills"))).toBe(false);
    expect(existsSync(join(projectDir, ".claude"))).toBe(true); // 남은 claude 는 무사
  });
});

describe("#655 — not-found 플러그인은 already-removed 로 성공", () => {
  it("exit 1 없이 기록에서 빠진다", () => {
    install(["claude"]);
    const path = join(projectDir, ".uzys-agent-harness", ".harness-install.json");
    const log = JSON.parse(readFileSync(path, "utf8")) as {
      assets: Array<{ id: string; method: string; scope: string; detail: Record<string, string> }>;
    };
    log.assets = [
      { id: "gone", method: "plugin", scope: "project", detail: { pluginId: "gone@mp" } },
    ];
    writeFileSync(path, JSON.stringify(log));
    const exit = vi.fn(() => undefined as never);
    const lines: string[] = [];
    uninstallAction({ projectDir, yes: true } as never, {
      exit,
      log: (l: string) => lines.push(l),
      err: (l: string) => lines.push(l),
      spawn: () => ({ status: 1, stdout: "", stderr: "plugin not found: gone@mp" }) as never,
      resolveHarnessRoot: () => HARNESS_ROOT,
    });
    expect(exit).not.toHaveBeenCalledWith(1);
    expect(lines.join("\n")).toContain("claude plugin uninstall"); // 되돌리기 단계는 실행됐고
    expect(lines.join("\n")).not.toMatch(/⊘.*gone.*failed/); // 실패로 보고되지 않았다
    expect(existsSync(path)).toBe(false); // 전량 uninstall 계약대로 로그는 삭제
  });
});

describe("#656 — 거짓 스캐폴드 배너가 남지 않는다", () => {
  it("씨뿌린 AGENTS.md(미편집)를 uninstall 한 뒤 배너 문장이 없다", () => {
    // CLAUDE.md 가 있는 프로젝트에 codex 설치 → AGENTS.md 씨뿌림(#528)
    writeFileSync(join(projectDir, "CLAUDE.md"), "# my project\n\nmy own notes\n", "utf8");
    install(["codex"]);
    expect(readFileSync(join(projectDir, "AGENTS.md"), "utf8")).toContain("my own notes");
    uninstall();
    if (existsSync(join(projectDir, "AGENTS.md"))) {
      expect(readFileSync(join(projectDir, "AGENTS.md"), "utf8")).not.toContain(
        "SCAFFOLD — not filled in yet",
      );
    }
  });
});

describe("#611 — 빈 docs/decisions 회수", () => {
  it("전량 uninstall 후 빈 디렉터가 남지 않는다", () => {
    install(["claude"]);
    expect(existsSync(join(projectDir, "docs/decisions"))).toBe(true);
    uninstall();
    expect(existsSync(join(projectDir, "docs/decisions"))).toBe(false);
  });
});
