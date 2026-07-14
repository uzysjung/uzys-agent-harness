import { describe, expect, it } from "vitest";
import {
  FILL_SECTIONS,
  mergeProjectClaude,
  renderFillScaffold,
  SCAFFOLD_BANNER,
  TRACK_DISPLAY_NAMES,
} from "../src/project-claude-merge.js";

describe("renderFillScaffold — the shared project-context scaffold", () => {
  it("emits every MUST-HAVE section as a self-contained FILL comment (exhaustive)", () => {
    // Intent: a section without a FILL prompt would ship as an empty header — the exact
    // "meaningless content" this redesign removes. Every id must carry an actionable prompt.
    const out = renderFillScaffold();
    for (const id of FILL_SECTIONS) {
      expect(out).toContain(`<!-- FILL:${id} —`);
    }
  });

  it("ships an honest placeholder for every section so an unfilled file states no false fact", () => {
    // Intent: the old fragment shipped a Bash stack to every project — affirmatively wrong.
    // An unfilled section must read as "not filled yet", never as a verified fact.
    const out = renderFillScaffold();
    const placeholders = out.match(/_\(not filled yet — /g) ?? [];
    expect(placeholders).toHaveLength(FILL_SECTIONS.length);
  });

  it("leads with the visible SCAFFOLD banner (HTML FILL comments are invisible in a preview)", () => {
    expect(renderFillScaffold().startsWith(SCAFFOLD_BANNER)).toBe(true);
    expect(SCAFFOLD_BANNER).toContain("SCAFFOLD");
  });
});

describe("mergeProjectClaude — the delivered project-root CLAUDE.md", () => {
  it("uses the real project name as the H1 (fixes the shipped `# [Project Name]` literal)", () => {
    // Intent: this is the single most visible boilerplate bug — the literal placeholder title
    // shipped verbatim to every project. It must be replaced with the real basename.
    const out = mergeProjectClaude(["tooling"], { projectName: "my-real-app" });
    expect(out.startsWith("# my-real-app\n")).toBe(true);
    expect(out).not.toContain("[Project Name]");
    expect(out).not.toContain("{PROJECT_NAME}");
  });

  it("records the selected tracks as install metadata using display names", () => {
    const out = mergeProjectClaude(["tooling", "data"], { projectName: "app" });
    expect(out).toContain("> Active track(s): Tooling, Data");
  });

  it("embeds the shared scaffold verbatim (single source of truth with AGENTS.md)", () => {
    // Intent: CLAUDE.md and every AGENTS.md {PROJECT_CONTEXT} must come from one source so the
    // FILL prompts are byte-identical across all 4 CLIs. Proven by containment of the exact body.
    const out = mergeProjectClaude(["tooling"], { projectName: "app" });
    expect(out).toContain(renderFillScaffold());
  });

  it("expands 'full' to every non-full track in the metadata note", () => {
    const out = mergeProjectClaude(["full"], { projectName: "app" });
    for (const t of [
      "tooling",
      "csr-fastapi",
      "csr-fastify",
      "csr-supabase",
      "ssr-htmx",
      "ssr-nextjs",
      "data",
      "executive",
      "project-management",
      "growth-marketing",
    ] as const) {
      expect(out).toContain(TRACK_DISPLAY_NAMES[t]);
    }
    expect(out).not.toContain("Full");
  });
});

describe("mergeProjectClaude — display names", () => {
  it("exposes all 11 track display names (R3)", () => {
    expect(TRACK_DISPLAY_NAMES["csr-fastapi"]).toBe("CSR FastAPI");
    expect(TRACK_DISPLAY_NAMES["ssr-nextjs"]).toBe("SSR Next.js");
    expect(TRACK_DISPLAY_NAMES["project-management"]).toBe("Project Management");
    expect(TRACK_DISPLAY_NAMES["growth-marketing"]).toBe("Growth Marketing");
    expect(Object.keys(TRACK_DISPLAY_NAMES)).toHaveLength(11);
  });
});
