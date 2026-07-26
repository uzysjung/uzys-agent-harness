import { describe, expect, it } from "vitest";
import { renameSlashes, renderAgentsMd } from "../../src/opencode/agents-md.js";

// rule-ref:frozen-file — 아래 SAMPLE_CLAUDE_MD 의 `Rule N` 은 임베드 렌더를 시험하는 **합성
// fixture** 다(앵커 지목이 아니다). 줄 단위 표식을 쓰면 표식이 템플릿 리터럴 안으로 들어가
// fixture 내용을 바꿔 버려 같은 fixture 를 쓰는 단언이 다른 것을 재게 된다.

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

## Project Context

{PROJECT_CONTEXT}

## Project Rules

{PROJECT_RULES}

Run /uzys:spec to start.
`;

  const SAMPLE_CONTEXT = "<!-- FILL:stack — inspect the repo -->";

  it("embeds full CLAUDE.md body + substitutes name + renames slashes + strips h1", () => {
    const out = renderAgentsMd({
      template: TEMPLATE,
      claudeMd: SAMPLE_CLAUDE_MD,
      projectName: "demo",
      projectContext: SAMPLE_CONTEXT,
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

  it("substitutes {PROJECT_CONTEXT} with the project-context scaffold", () => {
    const out = renderAgentsMd({
      template: TEMPLATE,
      claudeMd: SAMPLE_CLAUDE_MD,
      projectName: "demo",
      projectContext: SAMPLE_CONTEXT,
    });
    expect(out).toContain(SAMPLE_CONTEXT);
    expect(out).not.toContain("{PROJECT_CONTEXT}");
  });
});
