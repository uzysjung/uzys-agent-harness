import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runCodexTransform } from "../../src/codex/transform.js";

const HARNESS_ROOT = resolve(__dirname, "../..");

describe("runCodexTransform (E2E against templates/)", () => {
  let project: string;

  beforeEach(() => {
    project = mkdtempSync(join(tmpdir(), "ch-codex-"));
  });

  afterEach(() => {
    rmSync(project, { recursive: true, force: true });
  });

  it("produces Codex baseline — AGENTS.md + config.toml + ported hooks (slash + env rename)", () => {
    const report = runCodexTransform({
      harnessRoot: HARNESS_ROOT,
      projectDir: project,
    });
    expect(existsSync(report.agentsMdPath)).toBe(true);
    expect(existsSync(report.configTomlPath)).toBe(true);
    // HOOK_NAMES = [session-start, hito-counter] — both present in templates/hooks/.
    expect(report.hookFiles).toHaveLength(2);

    // Invariant: no Claude-namespace colon-slash (/uzys:) leaks into Codex output.
    const agents = readFileSync(report.agentsMdPath, "utf8");
    expect(agents).not.toContain("/uzys:");

    const config = readFileSync(report.configTomlPath, "utf8");
    expect(config).toContain("[features]");
    expect(config).toContain("[mcp_servers.");

    // Ported hooks rename CLAUDE_PROJECT_DIR → CODEX_PROJECT_DIR.
    for (const hook of report.hookFiles) {
      expect(readFileSync(hook, "utf8")).not.toContain("CLAUDE_PROJECT_DIR");
    }
  });

  it("default (no selectedInternalSkills) → skillFiles empty, no .agents/skills written", () => {
    const report = runCodexTransform({ harnessRoot: HARNESS_ROOT, projectDir: project });
    expect(report.skillFiles).toEqual([]);
    expect(existsSync(join(project, ".agents/skills"))).toBe(false);
  });

  it("throws when required template missing", () => {
    expect(() => runCodexTransform({ harnessRoot: "/no/such/root", projectDir: project })).toThrow(
      /required source missing/,
    );
  });

  // v26.87.0 — dev-method skills → .agents/skills/<id>/SKILL.md (native, frontmatter 보존).
  describe("dev-method skills (v26.87.0 — multi-CLI routing)", () => {
    const DEV_METHOD = ["multi-persona-review", "asis-tobe-decision"];

    it("selectedInternalSkills 주어지면 native .agents/skills/<id>/SKILL.md 로 렌더", () => {
      const report = runCodexTransform({
        harnessRoot: HARNESS_ROOT,
        projectDir: project,
        selectedInternalSkills: DEV_METHOD,
      });
      for (const id of DEV_METHOD) {
        const target = join(project, ".agents/skills", id, "SKILL.md");
        expect(report.skillFiles).toContain(target);
        expect(existsSync(target)).toBe(true);
      }
    });

    // PITFALL GUARD: dev-method SKILL.md 는 이미 완성된 skill — 자체 frontmatter(name: <id>)를
    // 보존해야 한다. renderBundledSkill 이 name 을 uzys-<id> 로 다시 래핑하면 오염 + 이중 래핑.
    // 이 테스트가 그 회귀를 잡는다 (business logic = "frontmatter 보존"이 깨지면 fail).
    it("frontmatter 가 name: <id> 보존 (NOT name: uzys-<id>) — renderBundledSkill frontmatter 보존 가드", () => {
      runCodexTransform({
        harnessRoot: HARNESS_ROOT,
        projectDir: project,
        selectedInternalSkills: ["multi-persona-review"],
      });
      const body = readFileSync(
        join(project, ".agents/skills/multi-persona-review/SKILL.md"),
        "utf8",
      );
      expect(body).toContain("name: multi-persona-review");
      expect(body).not.toContain("name: uzys-multi-persona-review");
      expect(body).not.toContain("name: uzys-");
    });

    it("selectedInternalSkills 빈 배열(기본) → dev-method skill 미생성", () => {
      const report = runCodexTransform({ harnessRoot: HARNESS_ROOT, projectDir: project });
      expect(existsSync(join(project, ".agents/skills/multi-persona-review"))).toBe(false);
      // 선택된 dev-method skill 이 없으므로 skillFiles 전체가 비어 있어야 한다.
      expect(report.skillFiles).toEqual([]);
    });

    it("selected dev-method skill 만 렌더 (선택 안 한 id 는 빠짐)", () => {
      const report = runCodexTransform({
        harnessRoot: HARNESS_ROOT,
        projectDir: project,
        selectedInternalSkills: ["multi-persona-review"],
      });
      expect(existsSync(join(project, ".agents/skills/multi-persona-review/SKILL.md"))).toBe(true);
      // 선택하지 않은 skill 은 빠지고 dev-method 1개만.
      expect(existsSync(join(project, ".agents/skills/asis-tobe-decision"))).toBe(false);
      expect(report.skillFiles).toHaveLength(1);
    });
  });
});
