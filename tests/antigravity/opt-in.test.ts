import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { runAntigravityOptIn } from "../../src/antigravity/opt-in.js";

const PHASES = ["spec", "plan", "build", "test", "review", "ship"] as const;

describe("runAntigravityOptIn (v26.67.0)", () => {
  let harnessRoot = "";
  let projectDir = "";
  let geminiHome = "";

  beforeEach(() => {
    harnessRoot = mkdtempSync(join(tmpdir(), "ag-opt-harness-"));
    projectDir = mkdtempSync(join(tmpdir(), "ag-opt-proj-"));
    geminiHome = mkdtempSync(join(tmpdir(), "ag-opt-gemini-"));

    // Mock projectDir/.agents/skills/uzys-{phase}/SKILL.md (Phase B output)
    for (const phase of PHASES) {
      const skillDir = join(projectDir, ".agents/skills", `uzys-${phase}`);
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(join(skillDir, "SKILL.md"), `mock skill ${phase}\n`);
    }

    // Mock harnessRoot/templates/commands/uzys/<phase>.md
    const cmdDir = join(harnessRoot, "templates/commands/uzys");
    mkdirSync(cmdDir, { recursive: true });
    for (const phase of PHASES) {
      writeFileSync(join(cmdDir, `${phase}.md`), `mock workflow ${phase}\n`);
    }
  });

  it("enabled=false → 전체 skip (skills + workflows count 0, write 0)", () => {
    const report = runAntigravityOptIn({ projectDir, harnessRoot, geminiHome, enabled: false });
    expect(report.skillsInstalled.enabled).toBe(false);
    expect(report.skillsInstalled.count).toBe(0);
    expect(report.workflowsInstalled.enabled).toBe(false);
    expect(report.workflowsInstalled.count).toBe(0);
    // ~/.gemini/ 미수정 확인 (D16)
    expect(existsSync(join(geminiHome, "antigravity"))).toBe(false);
    rmSync(projectDir, { recursive: true, force: true });
    rmSync(harnessRoot, { recursive: true, force: true });
    rmSync(geminiHome, { recursive: true, force: true });
  });

  it("enabled=true → 6 skills + 6 workflows 복사", () => {
    const report = runAntigravityOptIn({ projectDir, harnessRoot, geminiHome, enabled: true });
    expect(report.skillsInstalled.count).toBe(6);
    expect(report.workflowsInstalled.count).toBe(6);
    for (const phase of PHASES) {
      expect(existsSync(join(geminiHome, "antigravity/skills", `uzys-${phase}/SKILL.md`))).toBe(
        true,
      );
      expect(existsSync(join(geminiHome, "antigravity/global_workflows", `uzys-${phase}.md`))).toBe(
        true,
      );
    }
    rmSync(projectDir, { recursive: true, force: true });
    rmSync(harnessRoot, { recursive: true, force: true });
    rmSync(geminiHome, { recursive: true, force: true });
  });

  it("workflow body 가 templates/commands/uzys/<phase>.md 그대로 보존", () => {
    runAntigravityOptIn({ projectDir, harnessRoot, geminiHome, enabled: true });
    const content = readFileSync(
      join(geminiHome, "antigravity/global_workflows/uzys-spec.md"),
      "utf8",
    );
    expect(content).toBe("mock workflow spec\n");
    rmSync(projectDir, { recursive: true, force: true });
    rmSync(harnessRoot, { recursive: true, force: true });
    rmSync(geminiHome, { recursive: true, force: true });
  });

  it("projectDir/.agents/skills/uzys-* 없으면 skills count 0 (workflows 는 영향 X)", () => {
    rmSync(join(projectDir, ".agents"), { recursive: true, force: true });
    const report = runAntigravityOptIn({ projectDir, harnessRoot, geminiHome, enabled: true });
    expect(report.skillsInstalled.count).toBe(0);
    expect(report.workflowsInstalled.count).toBe(6);
    rmSync(projectDir, { recursive: true, force: true });
    rmSync(harnessRoot, { recursive: true, force: true });
    rmSync(geminiHome, { recursive: true, force: true });
  });

  it("harnessRoot 미명시 시 workflows skip (skills 는 영향 X)", () => {
    const report = runAntigravityOptIn({ projectDir, geminiHome, enabled: true });
    expect(report.skillsInstalled.count).toBe(6);
    expect(report.workflowsInstalled.count).toBe(0);
    rmSync(projectDir, { recursive: true, force: true });
    rmSync(harnessRoot, { recursive: true, force: true });
    rmSync(geminiHome, { recursive: true, force: true });
  });
});
