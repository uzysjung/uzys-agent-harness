import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runAntigravityTransform } from "../../src/antigravity/transform.js";

// rule-ref:frozen-file — 아래 SAMPLE_CLAUDE_MD 의 `Rule N` 은 임베드 렌더를 시험하는 **합성
// fixture** 다(앵커 지목이 아니다). 줄 단위 표식을 쓰면 표식이 템플릿 리터럴 안으로 들어가
// fixture 내용을 바꿔 버려 같은 fixture 를 쓰는 단언이 다른 것을 재게 된다.

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
      [
        "# {PROJECT_NAME} — Antigravity Agent Guide",
        "## Project Context",
        "{PROJECT_CONTEXT}",
        "## Project Rules",
        "{PROJECT_RULES}",
      ].join("\n"),
    );
  });

  function cleanup() {
    rmSync(harnessRoot, { recursive: true, force: true });
    rmSync(projectDir, { recursive: true, force: true });
  }

  // rules (.agents/rules/uzys-harness.md) is ALWAYS written — project context, not gated.
  it("writes .agents/rules/uzys-harness.md; no selected skills → skillFiles empty", () => {
    const report = runAntigravityTransform({ harnessRoot, projectDir, baseline: new Map() });
    expect(report.rulesFile).toBe(join(projectDir, ".agents/rules/uzys-harness.md"));
    expect(existsSync(report.rulesFile as string)).toBe(true);
    expect(report.skillFiles).toHaveLength(0);
    cleanup();
  });

  it("rules 가 CLAUDE.md 전문 embed + project name 치환 + 슬래시 rename + h1 strip", () => {
    runAntigravityTransform({ harnessRoot, projectDir, baseline: new Map() });
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
    // project-context 스캐폴드 주입 ({PROJECT_CONTEXT} → renderFillScaffold())
    expect(rules).toContain("<!-- FILL:stack —");
    expect(rules).not.toContain("{PROJECT_CONTEXT}");
    cleanup();
  });

  it("CLAUDE.md 또는 template 부재 시 rulesFile = null (graceful — install 진행)", () => {
    rmSync(join(harnessRoot, "templates/antigravity"), { recursive: true, force: true });
    const report = runAntigravityTransform({ harnessRoot, projectDir, baseline: new Map() });
    expect(report.rulesFile).toBeNull();
    // rules 부재여도 transform 자체는 끝까지 진행 (skills 는 selected 없으니 0).
    expect(report.skillFiles).toHaveLength(0);
    cleanup();
  });
});

// v26.87.0 — dev-method skills against the REAL templates/skills/ (need actual SKILL.md source).
describe("runAntigravityTransform — dev-method skills (v26.87.0 multi-CLI routing)", () => {
  let project = "";
  // 2026-08-02 정비 (ADR-060) — 표본이 이관된 두 스킬에서 잔존 번들 스킬로 바뀌었다.
  //   검증 대상은 **라우팅**(선택된 id 만 native .agents/skills/ 로 렌더)이지 특정 스킬이 아니다.
  const DEV_METHOD = ["compaction-handoff", "eval-harness"];

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
      baseline: new Map(),
    });
    for (const id of DEV_METHOD) {
      const target = join(project, ".agents/skills", id, "SKILL.md");
      expect(report.skillFiles).toContain(target);
      expect(existsSync(target)).toBe(true);
    }
    // dev-method skill 은 평행 workflow 를 만들지 않는다 (uzys 전례와 다름).
    expect(existsSync(join(project, ".agents/workflows/compaction-handoff.md"))).toBe(false);
    expect(existsSync(join(project, ".agents/workflows"))).toBe(false);
  });

  // PITFALL GUARD — frontmatter name: <id> 보존 (renderBundledSkill 이 name 을 재래핑하지 않는다).
  it("frontmatter 가 name: <id> 보존 (NOT name: uzys-<id>)", () => {
    runAntigravityTransform({
      harnessRoot: HARNESS_ROOT,
      projectDir: project,
      selectedInternalSkills: ["compaction-handoff"],
      baseline: new Map(),
    });
    const body = readFileSync(join(project, ".agents/skills/compaction-handoff/SKILL.md"), "utf8");
    expect(body).toContain("name: compaction-handoff");
    expect(body).not.toContain("name: uzys-");
  });

  it("selectedInternalSkills 빈 배열 → dev-method skill 미생성", () => {
    const report = runAntigravityTransform({
      harnessRoot: HARNESS_ROOT,
      projectDir: project,
      baseline: new Map(),
    });
    expect(existsSync(join(project, ".agents/skills/compaction-handoff"))).toBe(false);
    expect(report.skillFiles).toHaveLength(0);
  });

  it("선택한 dev-method skill 만 렌더 (선택 안 한 id 는 빠짐)", () => {
    const report = runAntigravityTransform({
      harnessRoot: HARNESS_ROOT,
      projectDir: project,
      selectedInternalSkills: ["compaction-handoff"],
      baseline: new Map(),
    });
    expect(existsSync(join(project, ".agents/skills/compaction-handoff/SKILL.md"))).toBe(true);
    expect(existsSync(join(project, ".agents/skills/eval-harness"))).toBe(false);
    expect(report.skillFiles).toHaveLength(1);
  });
});
