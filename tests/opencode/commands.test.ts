import { describe, expect, it } from "vitest";
import { renderCommand, renderCommandFromSkill } from "../../src/opencode/commands.js";

const SOURCE_WITH_FRONTMATTER = `---
description: "Define phase — 구조화된 스펙"
---

본문 — /uzys:plan 으로 진행.
`;

const SOURCE_WITHOUT_FRONTMATTER = `Define phase summary

Body line.
Use /uzys:build next.
`;

describe("opencode/commands renderCommand", () => {
  it("emits frontmatter with description + agent + body slash-renamed", () => {
    const out = renderCommand({ source: SOURCE_WITH_FRONTMATTER, phase: "spec" });
    expect(out).toContain('description: "Define phase — 구조화된 스펙"');
    expect(out).toContain("agent: plan");
    expect(out).toContain("/uzys-plan");
    expect(out).not.toContain("/uzys:plan");
    // No `name:` line — OpenCode uses filename as command name
    expect(out).not.toMatch(/^name:/m);
  });

  it("uses default description when source has none", () => {
    const out = renderCommand({ source: "", phase: "build" });
    expect(out).toContain("uzys-build phase command");
    expect(out).toContain("agent: build");
  });

  it("falls back to first non-empty line when no frontmatter present", () => {
    const out = renderCommand({ source: SOURCE_WITHOUT_FRONTMATTER, phase: "test" });
    expect(out).toContain("Define phase summary");
    expect(out).toContain("agent: build");
    expect(out).toContain("/uzys-build");
  });

  it("maps phase to correct agent (plan/build pairing)", () => {
    expect(renderCommand({ source: "", phase: "spec" })).toContain("agent: plan");
    expect(renderCommand({ source: "", phase: "plan" })).toContain("agent: plan");
    expect(renderCommand({ source: "", phase: "build" })).toContain("agent: build");
    expect(renderCommand({ source: "", phase: "test" })).toContain("agent: build");
    expect(renderCommand({ source: "", phase: "review" })).toContain("agent: plan");
    expect(renderCommand({ source: "", phase: "ship" })).toContain("agent: build");
  });

  it("escapes double-quotes in description", () => {
    const out = renderCommand({
      source: `---\ndescription: "He said \\"hi\\""\n---\n\nbody\n`,
      phase: "spec",
    });
    expect(out).toMatch(/description: ".*\\".*\\"/);
  });

  it("handles unknown phase by defaulting agent to build", () => {
    const out = renderCommand({ source: "", phase: "unknown" });
    expect(out).toContain("agent: build");
  });

  it("handles description without surrounding quotes (frontmatter without quoting)", () => {
    const out = renderCommand({
      source: "---\ndescription: bare description text\n---\n\nbody\n",
      phase: "spec",
    });
    expect(out).toContain('description: "bare description text"');
  });

  it("handles frontmatter without closing delimiter (treats whole as body)", () => {
    const out = renderCommand({
      source: "---\ndescription: never closed\n\nbody continues\n",
      phase: "spec",
    });
    expect(out).toContain('description: "never closed"');
  });
});

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
