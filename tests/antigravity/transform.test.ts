import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runAntigravityTransform } from "../../src/antigravity/transform.js";
import { stripClaudeFrontmatter } from "../../src/rules-port.js";
import { expectedSkillRelFiles, firstSkillIdWithReferences } from "../helpers/bundled-skill-dir.js";

const HARNESS_ROOT = resolve(__dirname, "../..");

/** 이전 판(v26.164.0)이 쓰던 본문 — 원본에서 Claude frontmatter 만 벗긴 것 + 끝 줄바꿈. */
function previousBody(rule: string): string {
  const source = readFileSync(join(HARNESS_ROOT, "templates/rules", `${rule}.md`), "utf8");
  return `${stripClaudeFrontmatter(source)}\n`;
}

// #631 — Antigravity 는 `trigger` frontmatter 가 없는 `.agents/rules/*.md` 를 조용히 버린다(공식 문서, 2026-10-11).
describe("runAntigravityTransform — rules carry Antigravity trigger frontmatter (#631)", () => {
  let projectDir = "";

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "agy-proj-"));
  });
  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  it("paths 가 없던 룰은 always_on, Claude paths 가 있던 룰은 glob + globs — 본문은 이전 판과 바이트 동일", () => {
    runAntigravityTransform({
      harnessRoot: HARNESS_ROOT,
      projectDir,
      rules: ["git-policy", "cli-development"],
      baseline: new Map(),
    });
    const always = readFileSync(join(projectDir, ".agents/rules/git-policy.md"), "utf8");
    const glob = readFileSync(join(projectDir, ".agents/rules/cli-development.md"), "utf8");
    const alwaysHead = "---\ntrigger: always_on\n---\n\n";
    const globHead = '---\ntrigger: glob\nglobs: "**/*.sh, **/*.bash"\n---\n\n';
    expect(always.startsWith(alwaysHead)).toBe(true);
    expect(glob.startsWith(globHead)).toBe(true);
    expect(always.slice(alwaysHead.length)).toBe(previousBody("git-policy"));
    expect(glob.slice(globHead.length)).toBe(previousBody("cli-development"));
  });

  it("옛 앵커 .agents/rules/uzys-harness.md 는 만들지 않는다 — 원칙·맥락은 루트 AGENTS.md 가 맡는다 (ADR-103)", () => {
    const report = runAntigravityTransform({
      harnessRoot: HARNESS_ROOT,
      projectDir,
      rules: ["git-policy"],
      baseline: new Map(),
    });
    expect(existsSync(join(projectDir, ".agents/rules/uzys-harness.md"))).toBe(false);
    expect("rulesFile" in report).toBe(false);
    expect(report.harnessRuleFiles).toEqual([join(projectDir, ".agents/rules/git-policy.md")]);
    expect(report.skillFiles).toHaveLength(0);
  });
});

// v26.87.0 — dev-method skills against the REAL templates/skills/ (need actual SKILL.md source).
describe("runAntigravityTransform — dev-method skills (v26.87.0 multi-CLI routing)", () => {
  let project = "";
  // 2026-08-02 정비 (ADR-060) — 표본이 이관된 두 스킬에서 잔존 번들 스킬로 바뀌었다.
  //   검증 대상은 **라우팅**(선택된 id 만 native .agents/skills/ 로 렌더)이지 특정 스킬이 아니다.
  const DEV_METHOD = ["compaction-handoff", "recurrence-prevention"];

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

  // #431 — Antigravity 도 스킬을 디렉터리로 읽는다(agentskills 사양). 대상 id 는
  //   `templates/skills/` 에서 유도한다 — 이름을 박으면 자산 개편에 조용히 썩는다.
  it("references/ 를 가진 스킬은 형제 파일까지 .agents/skills/<id>/ 에 온다", () => {
    const id = firstSkillIdWithReferences(HARNESS_ROOT);
    const expected = expectedSkillRelFiles(HARNESS_ROOT, id);
    const report = runAntigravityTransform({
      harnessRoot: HARNESS_ROOT,
      projectDir: project,
      selectedInternalSkills: [id],
      baseline: new Map(),
    });
    for (const rel of expected) {
      const target = join(project, ".agents/skills", id, rel);
      expect(existsSync(target), `${rel} 미도달`).toBe(true);
      expect(report.skillFiles).toContain(target);
    }
    // 형제가 0건이면 위 루프는 SKILL.md 하나만 보고 통과한다 — 모집단 자기검증.
    expect(expected.filter((rel) => rel !== "SKILL.md").length).toBeGreaterThan(0);
  });

  it("선택한 dev-method skill 만 렌더 (선택 안 한 id 는 빠짐)", () => {
    const report = runAntigravityTransform({
      harnessRoot: HARNESS_ROOT,
      projectDir: project,
      selectedInternalSkills: ["compaction-handoff"],
      baseline: new Map(),
    });
    expect(existsSync(join(project, ".agents/skills/compaction-handoff/SKILL.md"))).toBe(true);
    expect(existsSync(join(project, ".agents/skills/recurrence-prevention"))).toBe(false);
    expect(report.skillFiles).toHaveLength(1);
  });
});
