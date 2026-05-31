import { describe, expect, it } from "vitest";
import { renameSlashes, renderAgentsMd } from "../../src/codex/agents-md.js";

const SAMPLE_CLAUDE_MD = `# Project CLAUDE.md

## Rule 1 — Think
Body of rule one. Use /uzys:spec to start.

## Rule 2 — Simplicity
Body of rule two.
`;

describe("renameSlashes", () => {
  it("rewrites all /uzys: occurrences to /uzys-", () => {
    expect(renameSlashes("/uzys:plan + /uzys:build")).toBe("/uzys-plan + /uzys-build");
  });

  it("does not touch unrelated text", () => {
    expect(renameSlashes("hello :world")).toBe("hello :world");
  });
});

describe("renderAgentsMd (v26.70.0 — full CLAUDE.md embed)", () => {
  const TEMPLATE = `# {PROJECT_NAME} — Codex Agent Guide

## Project Rules

{PROJECT_RULES}

## Workflow Gates

Use /uzys:spec to start.
`;

  it("embeds the full CLAUDE.md body + substitutes name + renames slashes", () => {
    const out = renderAgentsMd({
      template: TEMPLATE,
      claudeMd: SAMPLE_CLAUDE_MD,
      projectName: "demo",
    });
    expect(out).toContain("# demo — Codex Agent Guide");
    // 전체 Rule 본문 보존 (이전 section 추출 버그 — Rule 구조라 빈 결과였음)
    expect(out).toContain("Rule 1 — Think");
    expect(out).toContain("Body of rule one");
    expect(out).toContain("Rule 2 — Simplicity");
    expect(out).toContain("Body of rule two");
    // slash rename
    expect(out).toContain("/uzys-spec");
    expect(out).not.toContain("/uzys:spec");
    expect(out).not.toContain("{PROJECT_RULES}");
  });

  it("CLAUDE.md 의 첫 h1 은 strip (템플릿 자체 h1 만 유지)", () => {
    const out = renderAgentsMd({
      template: TEMPLATE,
      claudeMd: SAMPLE_CLAUDE_MD,
      projectName: "demo",
    });
    expect(out).not.toContain("# Project CLAUDE.md");
  });
});
