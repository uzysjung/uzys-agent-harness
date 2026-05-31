import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { runAntigravityTransform } from "../../src/antigravity/transform.js";

const PHASES = ["spec", "plan", "build", "test", "review", "ship"] as const;

describe("runAntigravityTransform (v26.66.0 skills/workflows + v26.69.0 rules)", () => {
  let harnessRoot = "";
  let projectDir = "";

  beforeEach(() => {
    harnessRoot = mkdtempSync(join(tmpdir(), "agy-harness-"));
    projectDir = mkdtempSync(join(tmpdir(), "agy-proj-"));

    // Mock templates/commands/uzys/<phase>.md (6 files) — body references a sibling slash
    const cmdDir = join(harnessRoot, "templates/commands/uzys");
    mkdirSync(cmdDir, { recursive: true });
    for (const phase of PHASES) {
      writeFileSync(join(cmdDir, `${phase}.md`), `mock ${phase} body — next: /uzys:plan\n`);
    }

    // Mock templates/CLAUDE.md + templates/antigravity/AGENTS.md.template (rules source)
    writeFileSync(
      join(harnessRoot, "templates/CLAUDE.md"),
      [
        "# Project CLAUDE.md",
        "## Rule 1 — Think",
        "rule one body",
        "## Rule 2 — Simplicity",
        "rule two body — see /uzys:spec",
      ].join("\n"),
    );
    const agTplDir = join(harnessRoot, "templates/antigravity");
    mkdirSync(agTplDir, { recursive: true });
    writeFileSync(
      join(agTplDir, "AGENTS.md.template"),
      ["# {PROJECT_NAME} — Antigravity Agent Guide", "## Project Rules", "{PROJECT_RULES}"].join(
        "\n",
      ),
    );
  });

  function cleanup() {
    rmSync(harnessRoot, { recursive: true, force: true });
    rmSync(projectDir, { recursive: true, force: true });
  }

  // ── rules (v26.69.0) — always, not gated on withUzysHarness ──

  it("withUzysHarness=false → rules 작성 + skill/workflow 0 (rules 는 항상)", () => {
    const report = runAntigravityTransform({ harnessRoot, projectDir, withUzysHarness: false });
    expect(report.rulesFile).toBe(join(projectDir, ".agents/rules/uzys-harness.md"));
    expect(existsSync(report.rulesFile as string)).toBe(true);
    expect(report.skillFiles).toHaveLength(0);
    expect(report.workflowFiles).toHaveLength(0);
    cleanup();
  });

  it("rules 가 CLAUDE.md 전문 embed + project name 치환 + 슬래시 rename + h1 strip", () => {
    runAntigravityTransform({ harnessRoot, projectDir, withUzysHarness: false });
    const rules = readFileSync(join(projectDir, ".agents/rules/uzys-harness.md"), "utf8");
    // CLAUDE.md 전문 (Rule 1~2) embed
    expect(rules).toContain("rule one body");
    expect(rules).toContain("rule two body");
    expect(rules).toContain("Rule 1 — Think");
    // CLAUDE.md 의 h1 ("# Project CLAUDE.md") 은 strip (템플릿 h1 만)
    expect(rules).not.toContain("# Project CLAUDE.md");
    expect(rules).toContain("Antigravity Agent Guide");
    // /uzys: → /uzys- rename (Antigravity filename 기반 호출 정합)
    expect(rules).toContain("/uzys-spec");
    expect(rules).not.toContain("/uzys:spec");
    cleanup();
  });

  it("CLAUDE.md 또는 template 부재 시 rulesFile = null (graceful)", () => {
    rmSync(join(harnessRoot, "templates/antigravity"), { recursive: true, force: true });
    const report = runAntigravityTransform({ harnessRoot, projectDir, withUzysHarness: true });
    expect(report.rulesFile).toBeNull();
    // skills/workflows 는 영향 X
    expect(report.skillFiles).toHaveLength(6);
    cleanup();
  });

  // ── skills + workflows (v26.66.0) — gated on withUzysHarness ──

  it("withUzysHarness=true → rules + 6 skills + 6 workflows 생성", () => {
    const report = runAntigravityTransform({ harnessRoot, projectDir, withUzysHarness: true });
    expect(report.rulesFile).not.toBeNull();
    expect(report.skillFiles).toHaveLength(6);
    expect(report.workflowFiles).toHaveLength(6);
    for (const phase of PHASES) {
      expect(report.skillFiles).toContain(
        join(projectDir, ".agents/skills", `uzys-${phase}`, "SKILL.md"),
      );
      expect(report.workflowFiles).toContain(
        join(projectDir, ".agents/workflows", `uzys-${phase}.md`),
      );
    }
    cleanup();
  });

  it("workflow body 의 /uzys: 가 /uzys- 로 rename (Antigravity filename 호출 정합)", () => {
    runAntigravityTransform({ harnessRoot, projectDir, withUzysHarness: true });
    const content = readFileSync(join(projectDir, ".agents/workflows/uzys-spec.md"), "utf8");
    expect(content).toContain("/uzys-plan");
    expect(content).not.toContain("/uzys:plan");
    cleanup();
  });

  it("SKILL.md 가 YAML frontmatter 포함 (Anthropic skill format)", () => {
    runAntigravityTransform({ harnessRoot, projectDir, withUzysHarness: true });
    const skill = readFileSync(join(projectDir, ".agents/skills/uzys-spec/SKILL.md"), "utf8");
    expect(skill.startsWith("---\n")).toBe(true);
    expect(skill).toContain("name:");
    expect(skill).toContain("description:");
    cleanup();
  });

  it("commands/uzys/ 부재 + codex/skills fallback 존재 → fallback 사용", () => {
    rmSync(join(harnessRoot, "templates/commands/uzys"), { recursive: true, force: true });
    const fallbackDir = join(harnessRoot, "templates/codex/skills/uzys-spec");
    mkdirSync(fallbackDir, { recursive: true });
    writeFileSync(join(fallbackDir, "SKILL.md"), "fallback stub body\n");
    runAntigravityTransform({ harnessRoot, projectDir, withUzysHarness: true });
    const skill = readFileSync(join(projectDir, ".agents/skills/uzys-spec/SKILL.md"), "utf8");
    expect(skill).toContain("fallback stub body");
    cleanup();
  });

  it("commands/uzys/<phase>.md 없으면 workflow skip (skill 은 빈 stub)", () => {
    rmSync(join(harnessRoot, "templates/commands/uzys"), { recursive: true, force: true });
    const report = runAntigravityTransform({ harnessRoot, projectDir, withUzysHarness: true });
    expect(report.workflowFiles).toHaveLength(0);
    expect(report.skillFiles).toHaveLength(6);
    cleanup();
  });
});
