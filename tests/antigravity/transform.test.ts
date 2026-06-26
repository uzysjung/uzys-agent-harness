import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runAntigravityTransform } from "../../src/antigravity/transform.js";

const HARNESS_ROOT = resolve(__dirname, "../..");

describe("runAntigravityTransform — rules (v26.69.0, project context)", () => {
  let harnessRoot = "";
  let projectDir = "";

  beforeEach(() => {
    harnessRoot = mkdtempSync(join(tmpdir(), "agy-harness-"));
    projectDir = mkdtempSync(join(tmpdir(), "agy-proj-"));

    // Mock templates/CLAUDE.md + templates/antigravity/AGENTS.md.template (rules source)
    mkdirSync(join(harnessRoot, "templates"), { recursive: true });
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

  // rules (.agents/rules/uzys-harness.md) is ALWAYS written — project context, not gated.
  it("writes .agents/rules/uzys-harness.md; no selected skills → skillFiles empty", () => {
    const report = runAntigravityTransform({ harnessRoot, projectDir });
    expect(report.rulesFile).toBe(join(projectDir, ".agents/rules/uzys-harness.md"));
    expect(existsSync(report.rulesFile as string)).toBe(true);
    expect(report.skillFiles).toHaveLength(0);
    cleanup();
  });

  it("rules 가 CLAUDE.md 전문 embed + project name 치환 + 슬래시 rename + h1 strip", () => {
    runAntigravityTransform({ harnessRoot, projectDir });
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

  it("CLAUDE.md 또는 template 부재 시 rulesFile = null (graceful — install 진행)", () => {
    rmSync(join(harnessRoot, "templates/antigravity"), { recursive: true, force: true });
    const report = runAntigravityTransform({ harnessRoot, projectDir });
    expect(report.rulesFile).toBeNull();
    // rules 부재여도 transform 자체는 끝까지 진행 (skills 는 selected 없으니 0).
    expect(report.skillFiles).toHaveLength(0);
    cleanup();
  });
});

// v26.87.0 — dev-method skills against the REAL templates/skills/ (need actual SKILL.md source).
describe("runAntigravityTransform — dev-method skills (v26.87.0 multi-CLI routing)", () => {
  let project = "";
  const DEV_METHOD = ["multi-persona-review", "asis-tobe-decision"];

  beforeEach(() => {
    project = mkdtempSync(join(tmpdir(), "agy-devmethod-"));
  });
  afterEach(() => {
    rmSync(project, { recursive: true, force: true });
  });

  it("selectedInternalSkills 주어지면 native .agents/skills/<id>/SKILL.md 로 렌더 (workflow 미생성)", () => {
    const report = runAntigravityTransform({
      harnessRoot: HARNESS_ROOT,
      projectDir: project,
      selectedInternalSkills: DEV_METHOD,
    });
    for (const id of DEV_METHOD) {
      const target = join(project, ".agents/skills", id, "SKILL.md");
      expect(report.skillFiles).toContain(target);
      expect(existsSync(target)).toBe(true);
    }
    // dev-method skill 은 평행 workflow 를 만들지 않는다 (uzys 전례와 다름).
    expect(existsSync(join(project, ".agents/workflows/multi-persona-review.md"))).toBe(false);
    expect(existsSync(join(project, ".agents/workflows"))).toBe(false);
  });

  // PITFALL GUARD — frontmatter name: <id> 보존 (renderBundledSkill 이 name 을 재래핑하지 않는다).
  it("frontmatter 가 name: <id> 보존 (NOT name: uzys-<id>)", () => {
    runAntigravityTransform({
      harnessRoot: HARNESS_ROOT,
      projectDir: project,
      selectedInternalSkills: ["multi-persona-review"],
    });
    const body = readFileSync(
      join(project, ".agents/skills/multi-persona-review/SKILL.md"),
      "utf8",
    );
    expect(body).toContain("name: multi-persona-review");
    expect(body).not.toContain("name: uzys-");
  });

  it("selectedInternalSkills 빈 배열 → dev-method skill 미생성", () => {
    const report = runAntigravityTransform({
      harnessRoot: HARNESS_ROOT,
      projectDir: project,
    });
    expect(existsSync(join(project, ".agents/skills/multi-persona-review"))).toBe(false);
    expect(report.skillFiles).toHaveLength(0);
  });

  it("선택한 dev-method skill 만 렌더 (선택 안 한 id 는 빠짐)", () => {
    const report = runAntigravityTransform({
      harnessRoot: HARNESS_ROOT,
      projectDir: project,
      selectedInternalSkills: ["multi-persona-review"],
    });
    expect(existsSync(join(project, ".agents/skills/multi-persona-review/SKILL.md"))).toBe(true);
    expect(existsSync(join(project, ".agents/skills/asis-tobe-decision"))).toBe(false);
    expect(report.skillFiles).toHaveLength(1);
  });
});
