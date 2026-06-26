import { describe, expect, it } from "vitest";
import { renderCommandFromSkill } from "../../src/opencode/commands.js";

// v26.87.0 — renderCommandFromSkill: dev-method skill → OpenCode command fallback.
// intent = skill 의 자체 description 을 command frontmatter 로 옮기고(folded block 포함) body 보존.
describe("renderCommandFromSkill (v26.87.0 dev-method command fallback)", () => {
  it("emits command frontmatter (description from skill + agent) + ported body", () => {
    const source =
      "---\nname: multi-persona-review\ndescription: single-line desc\n---\n\nrun /uzys:spec\n";
    const out = renderCommandFromSkill(source, "multi-persona-review");
    expect(out.startsWith("---")).toBe(true);
    expect(out).toContain('description: "single-line desc"');
    expect(out).toContain("agent: plan");
    expect(out).toContain("/uzys-spec");
    expect(out).not.toContain("/uzys:spec");
  });

  it("flattens a folded (>-) multi-line description into one line", () => {
    const source = [
      "---",
      "name: x",
      "description: >-",
      "  line one",
      "  line two",
      "---",
      "",
      "body",
    ].join("\n");
    const out = renderCommandFromSkill(source, "x");
    expect(out).toContain('description: "line one line two"');
  });

  it("strips surrounding quotes from a single-line quoted description", () => {
    const source = '---\nname: x\ndescription: "quoted desc"\n---\n\nbody\n';
    const out = renderCommandFromSkill(source, "x");
    expect(out).toContain('description: "quoted desc"');
  });

  it("falls back to a synthetic description when the skill has none", () => {
    const out = renderCommandFromSkill("---\nname: x\n---\n\nbody\n", "gap-analysis-e2e");
    expect(out).toContain(
      'description: "gap-analysis-e2e (dev-method skill, OpenCode command fallback)"',
    );
  });

  it("treats a source with no frontmatter as first-line description + rest body", () => {
    const out = renderCommandFromSkill("plain first line\nrest of body", "x");
    expect(out).toContain('description: "plain first line"');
    expect(out).toContain("rest of body");
  });
});
