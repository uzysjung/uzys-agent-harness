import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { runAntigravityTransform } from "../../src/antigravity/transform.js";

const PHASES = ["spec", "plan", "build", "test", "review", "ship"] as const;

describe("runAntigravityTransform (v26.66.0)", () => {
  let harnessRoot = "";
  let projectDir = "";

  beforeEach(() => {
    harnessRoot = mkdtempSync(join(tmpdir(), "agy-harness-"));
    projectDir = mkdtempSync(join(tmpdir(), "agy-proj-"));
    // Mock templates/commands/uzys/<phase>.md (6 files)
    const cmdDir = join(harnessRoot, "templates/commands/uzys");
    mkdirSync(cmdDir, { recursive: true });
    for (const phase of PHASES) {
      writeFileSync(join(cmdDir, `${phase}.md`), `mock ${phase} body\n`);
    }
  });

  it("withUzysHarness=false → skipped (skill + workflow 0)", () => {
    const report = runAntigravityTransform({ harnessRoot, projectDir, withUzysHarness: false });
    expect(report.skillFiles).toHaveLength(0);
    expect(report.workflowFiles).toHaveLength(0);
    rmSync(harnessRoot, { recursive: true, force: true });
    rmSync(projectDir, { recursive: true, force: true });
  });

  it("withUzysHarness=true → 6 skills + 6 workflows 생성", () => {
    const report = runAntigravityTransform({ harnessRoot, projectDir, withUzysHarness: true });
    expect(report.skillFiles).toHaveLength(6);
    expect(report.workflowFiles).toHaveLength(6);
    for (const phase of PHASES) {
      const skillPath = join(projectDir, ".agents/skills", `uzys-${phase}`, "SKILL.md");
      const workflowPath = join(projectDir, ".agents/workflows", `uzys-${phase}.md`);
      expect(report.skillFiles).toContain(skillPath);
      expect(report.workflowFiles).toContain(workflowPath);
    }
    rmSync(harnessRoot, { recursive: true, force: true });
    rmSync(projectDir, { recursive: true, force: true });
  });

  it("workflow .md 가 source (templates/commands/uzys/<phase>.md) 그대로 보존", () => {
    runAntigravityTransform({ harnessRoot, projectDir, withUzysHarness: true });
    const content = readFileSync(join(projectDir, ".agents/workflows/uzys-spec.md"), "utf8");
    expect(content).toBe("mock spec body\n");
    rmSync(harnessRoot, { recursive: true, force: true });
    rmSync(projectDir, { recursive: true, force: true });
  });

  it("SKILL.md 가 YAML frontmatter 포함 (Anthropic skill format)", () => {
    runAntigravityTransform({ harnessRoot, projectDir, withUzysHarness: true });
    const skill = readFileSync(join(projectDir, ".agents/skills/uzys-spec/SKILL.md"), "utf8");
    expect(skill.startsWith("---\n")).toBe(true);
    expect(skill).toContain("name:");
    expect(skill).toContain("description:");
    rmSync(harnessRoot, { recursive: true, force: true });
    rmSync(projectDir, { recursive: true, force: true });
  });

  it("commands/uzys/ 부재 + codex/skills/uzys-<phase>/SKILL.md fallback 존재 → fallback 사용", () => {
    rmSync(join(harnessRoot, "templates/commands/uzys"), { recursive: true, force: true });
    const fallbackDir = join(harnessRoot, "templates/codex/skills/uzys-spec");
    mkdirSync(fallbackDir, { recursive: true });
    writeFileSync(join(fallbackDir, "SKILL.md"), "fallback stub body\n");
    runAntigravityTransform({ harnessRoot, projectDir, withUzysHarness: true });
    const skill = readFileSync(join(projectDir, ".agents/skills/uzys-spec/SKILL.md"), "utf8");
    expect(skill).toContain("fallback stub body");
    rmSync(harnessRoot, { recursive: true, force: true });
    rmSync(projectDir, { recursive: true, force: true });
  });

  it("templates/commands/uzys/<phase>.md 없으면 workflow skip (skill 은 fallback stub)", () => {
    rmSync(join(harnessRoot, "templates/commands/uzys"), { recursive: true, force: true });
    const report = runAntigravityTransform({ harnessRoot, projectDir, withUzysHarness: true });
    // source 없으면 workflow skip
    expect(report.workflowFiles).toHaveLength(0);
    // skill 은 fallback stub 도 없으니 source="" 로 작성됨 (renderSkill 가 empty body 처리)
    expect(report.skillFiles).toHaveLength(6);
    rmSync(harnessRoot, { recursive: true, force: true });
    rmSync(projectDir, { recursive: true, force: true });
  });
});
