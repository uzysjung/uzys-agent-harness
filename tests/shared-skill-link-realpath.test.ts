import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { uninstallAction } from "../src/commands/uninstall.js";
import { linksToProjectSharedSkill } from "../src/foreign-slot.js";
import { runInstall } from "../src/installer.js";
import type { CliBase, InstallSpec } from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");

/**
 * #885 — `.claude/skills/<id>` → `.agents/skills/<id>` 링크(#524)를 판정하는 술어는 두 자리를 **끝까지** 풀어 댄다. `.agents` 자체가
 * 프로젝트 안 다른 폴더(dotfiles 식)로의 링크면 `.agents/skills/<id>` 꼬리를 문자열로 두는 판정이 실경로와 어긋나 공유 자리를
 * "남의 것" 으로 읽었다 — install 은 "owned by another tool" 로 알리고, `uninstall --cli codex` 는 Claude 가 링크로 쓰는 본문을 지웠다.
 * `.agents` 가 프로젝트 **밖**을 가리키면 지금처럼 false 다(그 본문은 이 프로젝트의 공유 자리가 아니다).
 */
describe("#885 공유 스킬 링크 — `.agents` 가 링크여도 같은 판정", () => {
  let projectDir: string;
  let elsewhere: string;
  const id = "audit-harness-fit";

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "ch-885-proj-"));
    elsewhere = mkdtempSync(join(tmpdir(), "ch-885-out-"));
  });
  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
    rmSync(elsewhere, { recursive: true, force: true });
  });

  const spec = (cli: CliBase[]): InstallSpec => ({
    tracks: ["tooling"],
    options: { withCodexTrust: false },
    cli,
    projectDir,
  });
  const install = (cli: CliBase[], mode: "fresh" | "add" | "update" = "fresh") =>
    runInstall({ runExternal: null, harnessRoot: HARNESS_ROOT, projectDir, spec: spec(cli), mode });

  /** `.agents` 를 `<target>/agents` 로 옮기고 그 자리에 링크를 건다 — 설치자가 dotfiles 식으로 관리하는 모양. */
  function moveAgentsTo(target: string, linkText: string): void {
    mkdirSync(target, { recursive: true });
    renameSync(join(projectDir, ".agents"), join(target, "agents"));
    symlinkSync(linkText, join(projectDir, ".agents"));
    expect(lstatSync(join(projectDir, ".agents")).isSymbolicLink()).toBe(true);
  }
  /** `.claude/skills/<id>` 를 `../../.agents/skills/<id>` 상대 링크로 (#524 구성). */
  function linkClaudeSlot(): string {
    const slot = join(projectDir, ".claude/skills", id);
    rmSync(slot, { recursive: true, force: true });
    symlinkSync(join("..", "..", ".agents", "skills", id), slot);
    // 대조군 — 링크가 본문을 실제로 가리킨다. 안 가리키면 아래 판정이 전부 다른 이유로 난다
    expect(existsSync(join(slot, "SKILL.md"))).toBe(true);
    return slot;
  }

  it("술어 — `.agents` 가 실디렉터리 · 프로젝트 안 링크면 true, 프로젝트 밖 링크면 false", () => {
    install(["claude", "codex"]);
    linkClaudeSlot();
    expect(linksToProjectSharedSkill(projectDir, id)).toBe(true); // 실디렉터리 — 현행 그대로

    moveAgentsTo(join(projectDir, "dotfiles"), join("dotfiles", "agents"));
    expect(linksToProjectSharedSkill(projectDir, id)).toBe(true);

    rmSync(join(projectDir, ".agents"));
    renameSync(join(projectDir, "dotfiles/agents"), join(elsewhere, "agents"));
    symlinkSync(join(elsewhere, "agents"), join(projectDir, ".agents"));
    expect(existsSync(join(projectDir, ".claude/skills", id, "SKILL.md"))).toBe(true);
    expect(linksToProjectSharedSkill(projectDir, id)).toBe(false);
  });

  it("install(add) 은 그 자리를 남의 것이라 부르지 않고 공유 본문으로 갱신한다", () => {
    install(["claude", "codex"]);
    moveAgentsTo(join(projectDir, "dotfiles"), join("dotfiles", "agents"));
    linkClaudeSlot();

    const report = install(["claude"], "add");

    expect(report.baselineForeignOwned).not.toContain(`.claude/skills/${id}`);
    expect(report.baselineLinked).toEqual([id]);
  });

  it("uninstall --cli codex 는 Claude 가 링크로 쓰는 본문을 남긴다 · 이어서 claude 만으로 update 하면 그 본문을 갱신 대상으로 본다", () => {
    install(["claude", "codex"]);
    moveAgentsTo(join(projectDir, "dotfiles"), join("dotfiles", "agents"));
    const slot = linkClaudeSlot();
    const lines: string[] = [];

    uninstallAction(
      { projectDir, cli: "codex" },
      {
        exit: () => undefined as never,
        log: (l: string) => lines.push(l),
        err: (l: string) => lines.push(l),
        resolveHarnessRoot: () => HARNESS_ROOT,
      },
    );

    expect(existsSync(join(projectDir, "dotfiles/agents/skills", id, "SKILL.md"))).toBe(true);
    expect(readFileSync(join(slot, "SKILL.md"), "utf8").length).toBeGreaterThan(0); // 깨진 링크가 아니다
    expect(lines.some((l) => l.includes(`.agents/skills/${id}`) && l.includes("Claude"))).toBe(
      true,
    );

    const upd = install(["claude"], "update");
    expect(upd.updateMode?.skillsLinked).toEqual([id]);
  });
});
