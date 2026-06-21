import { describe, expect, it } from "vitest";
import { renderBundledSkill, renderSkill } from "../../src/codex/skills.js";

describe("renderSkill", () => {
  it("uses the first non-empty line as description when no frontmatter", () => {
    const source = "Define phase — write SPEC first.\n\n## Process\n\n1. step\n";
    const out = renderSkill({ source, phase: "spec" });
    expect(out).toContain("name: uzys-spec");
    expect(out).toContain('description: "Define phase — write SPEC first."');
    expect(out).toContain("## Process");
    expect(out).toContain("1. step");
  });

  it("extracts description from YAML frontmatter when present", () => {
    const source = `---\nname: build\ndescription: "Build phase — TDD."\n---\n\n## Goal\n\nbody\n`;
    const out = renderSkill({ source, phase: "build" });
    expect(out).toContain("name: uzys-build");
    expect(out).toContain('description: "Build phase — TDD."');
    expect(out).not.toMatch(/^---\nname: build\n/);
    expect(out).toContain("## Goal");
  });

  it("renames /uzys: → /uzys- in body only", () => {
    const source = "spec.\n\nrun /uzys:plan after this.";
    const out = renderSkill({ source, phase: "spec" });
    expect(out).toContain("/uzys-plan");
    expect(out).not.toContain("/uzys:plan");
  });

  it("falls back to a synthetic description when source is empty", () => {
    const out = renderSkill({ source: "", phase: "ship" });
    expect(out).toContain('description: "uzys-ship phase skill (Codex 포팅)"');
  });

  it("escapes embedded quotes in the description", () => {
    const out = renderSkill({ source: 'A "quoted" desc', phase: "review" });
    expect(out).toContain('description: "A \\"quoted\\" desc"');
  });
});

// v26.87.0 — renderBundledSkill: dev-method skills 의 native skill 출력.
// 핵심 intent = 이미 완성된 skill 의 frontmatter(name: <id>)를 보존하고 body 만 포팅한다는 것.
describe("renderBundledSkill (v26.87.0 dev-method)", () => {
  it("preserves the skill's own frontmatter verbatim (name: <id>, NOT name: uzys-<id>)", () => {
    const source = "---\nname: gap-analysis-e2e\ndescription: full desc\n---\n\nbody\n";
    const out = renderBundledSkill(source);
    expect(out).toContain("name: gap-analysis-e2e");
    expect(out).not.toContain("name: uzys-");
    expect(out.startsWith("---\nname: gap-analysis-e2e")).toBe(true);
  });

  it("ports the body: /uzys: → /uzys- and CLAUDE_PROJECT_DIR → CODEX_PROJECT_DIR", () => {
    const source = "---\nname: x\n---\n\nrun /uzys:plan in $CLAUDE_PROJECT_DIR\n";
    const out = renderBundledSkill(source);
    expect(out).toContain("/uzys-plan");
    expect(out).not.toContain("/uzys:plan");
    expect(out).toContain("CODEX_PROJECT_DIR");
    expect(out).not.toContain("CLAUDE_PROJECT_DIR");
  });

  it("never drops content when there is no frontmatter (defensive — ports as body)", () => {
    const out = renderBundledSkill("just a body, no frontmatter, see /uzys:spec");
    expect(out).toContain("just a body");
    expect(out).toContain("/uzys-spec");
  });

  it("ports the whole thing as body when frontmatter never closes (malformed)", () => {
    const out = renderBundledSkill("---\nname: y\nno closing delimiter\nbody /uzys:ship");
    // No silent drop: original content survives, slashes ported.
    expect(out).toContain("name: y");
    expect(out).toContain("/uzys-ship");
  });
});
