import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AGENTS_MD_TEMPLATE,
  type AgentsMdCli,
  renameSlashes,
  renderAgentsMd,
} from "../src/agents-md-render.js";

/**
 * #642 — `AGENTS.md` 는 템플릿 하나를 **깔린 비-Claude CLI 집합**으로 렌더한다. 전에는 CLI 판 템플릿 둘 중 나중에 쓴 쪽이
 * 이겨, codex 설치본에 opencode 를 더하면 `## Session Start` 와 Codex 안내가 조용히 빠졌다.
 *
 * 렌더러는 실제 배포 템플릿으로 잰다 — 합성 템플릿으로 재면 템플릿과 렌더러가 갈려도 초록이다.
 */

// rule-ref:frozen-file — 아래 SAMPLE_CLAUDE_MD 의 `Rule N` 은 임베드 렌더를 시험하는 **합성 fixture** 다.
const SAMPLE_CLAUDE_MD = `# Project CLAUDE.md

## Rule 1 — Think
Body of rule one. Use /uzys:spec to start.

## Rule 2 — Simplicity
Body of rule two.
`;
const SAMPLE_CONTEXT = "<!-- FILL:stack — inspect the repo -->";
const RULES = "## Some Rule\n\nrule body";

const ROOT = resolve(__dirname, "..");
const TEMPLATE = readFileSync(join(ROOT, AGENTS_MD_TEMPLATE), "utf8");
const TEMPLATE_SECTIONS = [...TEMPLATE.matchAll(/^## (.+)$/gm)].map((m) => m[1]);

function render(clis: ReadonlyArray<AgentsMdCli>): string {
  return renderAgentsMd({
    template: TEMPLATE,
    claudeMd: SAMPLE_CLAUDE_MD,
    projectName: "demo",
    projectContext: SAMPLE_CONTEXT,
    harnessRules: RULES,
    clis,
  });
}

/** 렌더 결과의 최상위 절 중 템플릿이 정의한 것. 본문(앵커 · 룰)의 `## ` 는 세지 않는다. */
function sections(text: string): string[] {
  return text
    .split("\n")
    .flatMap((l) => /^## (.+)$/.exec(l)?.[1] ?? [])
    .filter((n) => TEMPLATE_SECTIONS.includes(n));
}

describe("renameSlashes", () => {
  it("rewrites all /uzys: occurrences to /uzys-", () => {
    expect(renameSlashes("/uzys:plan + /uzys:build")).toBe("/uzys-plan + /uzys-build");
  });

  it("does not touch unrelated text", () => {
    expect(renameSlashes("hello :world")).toBe("hello :world");
  });
});

describe("renderAgentsMd — 깔린 집합으로 렌더 (#642)", () => {
  it("제목이 집합의 CLI 이름을 정렬 순서로 댄다", () => {
    expect(render(["codex"])).toContain("# demo — Agent Guide (Codex)\n");
    expect(render(["opencode", "codex"])).toContain("# demo — Agent Guide (Codex · OpenCode)\n");
    expect(render(["antigravity", "opencode", "codex"])).toContain(
      "# demo — Agent Guide (Codex · OpenCode · Antigravity)\n",
    );
  });

  it("## Session Start 는 codex 가 집합에 있을 때만", () => {
    expect(sections(render(["codex"]))).toContain("Session Start");
    expect(sections(render(["codex", "opencode"]))).toContain("Session Start");
    expect(sections(render(["opencode"]))).not.toContain("Session Start");
    expect(sections(render(["antigravity"]))).not.toContain("Session Start");
  });

  it("## Harness Rules(인라인 룰)는 codex 또는 opencode 가 있을 때만 — antigravity 단독은 .agents/rules/ 로 받는다", () => {
    for (const set of [["codex"], ["opencode"], ["codex", "antigravity"]] as const) {
      const out = render(set);
      expect(sections(out)).toContain("Harness Rules");
      expect(out).toContain("rule body");
    }
    const solo = render(["antigravity"]);
    expect(sections(solo)).toEqual(["Project Context", "Project Rules", "Protected Files"]);
    expect(solo).not.toContain("rule body");
  });

  it("Codex 의 32 KiB 안내는 codex 가 있을 때만 · 1차 방어 줄은 그 CLI 의 것만", () => {
    expect(render(["codex"])).toContain("project_doc_max_bytes");
    expect(render(["opencode"])).not.toContain("project_doc_max_bytes");
    expect(render(["codex"])).toContain('sandbox_mode = "workspace-write"');
    expect(render(["codex"])).not.toContain("OpenCode `permission`");
    expect(render(["opencode"])).toContain("OpenCode `permission`");
    const both = render(["codex", "opencode"]);
    expect(both).toContain('sandbox_mode = "workspace-write"');
    expect(both).toContain("OpenCode `permission` 설정이 1차 방어다. 그 위에:");
    // antigravity 단독은 1차 방어 줄이 없다 — 목록은 그대로
    const solo = render(["antigravity"]);
    expect(solo).not.toContain("그 위에:");
    expect(solo).toContain("lock 파일");
  });

  it("절 이름 집합 ⊆ 템플릿 · 자리표시자가 남지 않는다 · 빈 줄이 셋 이상 이어지지 않는다", () => {
    const sets: AgentsMdCli[][] = [
      ["codex"],
      ["opencode"],
      ["antigravity"],
      ["codex", "opencode"],
      ["codex", "opencode", "antigravity"],
    ];
    for (const set of sets) {
      const out = render(set);
      for (const name of sections(out)) expect(TEMPLATE_SECTIONS).toContain(name);
      expect(out, set.join("+")).not.toMatch(/\{[A-Z_]+\}/);
      expect(out, set.join("+")).not.toMatch(/\n\n\n\n/);
    }
  });

  it("CLAUDE.md 전문 embed + 첫 h1 strip + 슬래시 rename + {PROJECT_CONTEXT} 치환", () => {
    const out = render(["opencode"]);
    expect(out).toContain("Body of rule one");
    expect(out).toContain("Rule 2 — Simplicity");
    expect(out).not.toContain("# Project CLAUDE.md");
    expect(out).toContain("/uzys-spec");
    expect(out).not.toContain("/uzys:spec");
    expect(out).toContain(SAMPLE_CONTEXT);
  });

  it("빈 집합은 호출부 버그 — claude 단독은 이 파일을 쓰지 않는다", () => {
    expect(() => render([])).toThrow(/empty CLI set/);
  });
});
