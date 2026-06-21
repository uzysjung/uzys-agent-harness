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

  it("v26.57.0 (ADR-018) — withUzysHarness=true → skills + prompts 6+6 생성", () => {
    const report = runCodexTransform({
      harnessRoot: HARNESS_ROOT,
      projectDir: project,
      withUzysHarness: true,
    });
    expect(existsSync(report.agentsMdPath)).toBe(true);
    expect(existsSync(report.configTomlPath)).toBe(true);
    expect(report.hookFiles).toHaveLength(3);
    expect(report.skillFiles).toHaveLength(6);
    expect(report.promptFiles).toHaveLength(6);

    const agents = readFileSync(report.agentsMdPath, "utf8");
    expect(agents).not.toContain("/uzys:");
    expect(agents).toContain("/uzys-");

    const config = readFileSync(report.configTomlPath, "utf8");
    expect(config).toContain("[features]");
    expect(config).toContain("[mcp_servers.");

    for (const hook of report.hookFiles) {
      expect(readFileSync(hook, "utf8")).not.toContain("CLAUDE_PROJECT_DIR");
    }

    for (const skill of report.skillFiles) {
      const body = readFileSync(skill, "utf8");
      expect(body.startsWith("---")).toBe(true);
      expect(body).toMatch(/name: uzys-(spec|plan|build|test|review|ship)/);
    }

    for (const promptFile of report.promptFiles) {
      const body = readFileSync(promptFile, "utf8");
      expect(body).toMatch(/^---/);
      expect(body).toContain("description:");
      expect(body).not.toContain("/uzys:");
      expect(promptFile).toContain(".codex/prompts/uzys-");
    }
  });

  it("v26.57.0 (ADR-018, BREAKING) — withUzysHarness=false → skills + prompts 0+0 (uzys 산출물 X)", () => {
    const report = runCodexTransform({
      harnessRoot: HARNESS_ROOT,
      projectDir: project,
    });
    // AGENTS.md / config.toml / hooks 는 codex baseline 이라 그대로 생성
    expect(existsSync(report.agentsMdPath)).toBe(true);
    expect(existsSync(report.configTomlPath)).toBe(true);
    expect(report.hookFiles).toHaveLength(3);
    // uzys 산출물은 빠짐
    expect(report.skillFiles).toEqual([]);
    expect(report.promptFiles).toEqual([]);
    // .codex/prompts/ 디렉토리도 만들지 않음
    expect(existsSync(join(project, ".codex/prompts"))).toBe(false);
    expect(existsSync(join(project, ".agents/skills/uzys-spec"))).toBe(false);
  });

  it("default (param 누락) = withUzysHarness=false 동작 (안전한 default)", () => {
    const report = runCodexTransform({ harnessRoot: HARNESS_ROOT, projectDir: project });
    expect(report.skillFiles).toEqual([]);
    expect(report.promptFiles).toEqual([]);
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
    // 보존해야 한다. renderSkill 을 거치면 name: uzys-<id> 로 오염 + 이중 래핑. 이 테스트가
    // 그 회귀를 잡는다 (business logic = "frontmatter 보존"이 깨지면 fail).
    it("frontmatter 가 name: <id> 보존 (NOT name: uzys-<id>) — renderSkill 미사용 가드", () => {
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
      // uzys-harness 미선택이므로 skillFiles 전체가 비어 있어야 한다.
      expect(report.skillFiles).toEqual([]);
    });

    // dev-method skill 게이팅은 withUzysHarness 와 **독립** — uzys-harness 없이도 렌더된다.
    it("withUzysHarness=false 여도 dev-method skill 은 독립적으로 렌더", () => {
      const report = runCodexTransform({
        harnessRoot: HARNESS_ROOT,
        projectDir: project,
        withUzysHarness: false,
        selectedInternalSkills: ["multi-persona-review"],
      });
      expect(existsSync(join(project, ".agents/skills/multi-persona-review/SKILL.md"))).toBe(true);
      // uzys-6Gate skill 은 빠지고 dev-method 1개만.
      expect(existsSync(join(project, ".agents/skills/uzys-spec"))).toBe(false);
      expect(report.skillFiles).toHaveLength(1);
    });
  });
});
