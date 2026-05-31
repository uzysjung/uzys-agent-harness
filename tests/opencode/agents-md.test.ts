import { describe, expect, it } from "vitest";
import { renameSlashes, renderAgentsMd } from "../../src/opencode/agents-md.js";

const SAMPLE_CLAUDE_MD = `# Project CLAUDE.md

## Rule 1 — Think
OpenCode-flavored harness. Use /uzys:spec to start.

## Rule 2 — Simplicity
Keep it minimal.
`;

describe("opencode/agents-md renameSlashes", () => {
  it("rewrites all /uzys: to /uzys-", () => {
    expect(renameSlashes("/uzys:spec + /uzys:plan")).toBe("/uzys-spec + /uzys-plan");
  });

  it("leaves unrelated text alone", () => {
    expect(renameSlashes("colon :elsewhere")).toBe("colon :elsewhere");
  });
});

describe("opencode/agents-md renderAgentsMd (v26.70.0 — full CLAUDE.md embed)", () => {
  const TEMPLATE = `# {PROJECT_NAME} — OpenCode Agent Guide

## Project Rules

{PROJECT_RULES}

Run /uzys:spec to start.
`;

  it("embeds full CLAUDE.md body + substitutes name + renames slashes + strips h1", () => {
    const out = renderAgentsMd({
      template: TEMPLATE,
      claudeMd: SAMPLE_CLAUDE_MD,
      projectName: "demo",
    });
    expect(out).toContain("# demo — OpenCode Agent Guide");
    expect(out).toContain("Rule 1 — Think");
    expect(out).toContain("OpenCode-flavored harness.");
    expect(out).toContain("Rule 2 — Simplicity");
    expect(out).toContain("/uzys-spec");
    expect(out).not.toContain("/uzys:spec");
    expect(out).not.toContain("{PROJECT_RULES}");
    expect(out).not.toContain("# Project CLAUDE.md");
  });
});
