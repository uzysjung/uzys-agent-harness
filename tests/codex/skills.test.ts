import { describe, expect, it } from "vitest";
import { renderBundledSkill } from "../../src/codex/skills.js";

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
