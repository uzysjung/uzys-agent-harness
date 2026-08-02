import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { FILL_SECTIONS, renderFillScaffold } from "../src/project-claude-merge.js";

const TEMPLATES_DIR = resolve(__dirname, "../templates");

/**
 * Discover every per-CLI AGENTS.md template by scanning `templates/` — NOT a hardcoded list.
 * A future 4th-CLI template that forgets `{PROJECT_CONTEXT}` then fails the gate below instead
 * of silently shipping AGENTS.md with zero project context (no-false-ship: gate over comment).
 */
function agentsTemplatePaths(): string[] {
  return readdirSync(TEMPLATES_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => join(TEMPLATES_DIR, e.name, "AGENTS.md.template"))
    .filter((p) => existsSync(p));
}

describe("AGENTS.md project-context parity (cross-CLI drift gate)", () => {
  it("discovers the three non-Claude CLI templates", () => {
    const clis = agentsTemplatePaths().map((p) => p.split("/").at(-2));
    expect(clis).toEqual(expect.arrayContaining(["codex", "opencode", "antigravity"]));
  });

  it("every AGENTS.md template carries the {PROJECT_CONTEXT} placeholder", () => {
    // Intent: the fill scaffold must reach EVERY non-Claude CLI. A template omitting the
    // placeholder would ship AGENTS.md with no project context — the pre-redesign state.
    const paths = agentsTemplatePaths();
    expect(paths.length).toBeGreaterThanOrEqual(3);
    for (const p of paths) {
      expect(readFileSync(p, "utf8")).toContain("{PROJECT_CONTEXT}");
    }
  });

  it("the shared scaffold carries every MUST-HAVE FILL section (one source for all 4 CLIs)", () => {
    const scaffold = renderFillScaffold();
    for (const id of FILL_SECTIONS) {
      expect(scaffold).toContain(`<!-- FILL:${id} —`);
    }
  });

  it("no AGENTS.md template instructs an unapproved session-start git pull (D3ⓐ, same policy as the Claude hook)", () => {
    // Rewriting local commits without approval is the same policy violation whether a script
    // does it (Claude Code hook) or a text instruction tells the agent to do it (Codex/OpenCode
    // AGENTS.md). Scanned by glob, not by a hardcoded CLI list — a future 5th CLI template must
    // be caught here without editing this test.
    const paths = agentsTemplatePaths();
    expect(paths.length).toBeGreaterThanOrEqual(3);
    for (const p of paths) {
      expect(readFileSync(p, "utf8"), p).not.toMatch(/git\s+pull/);
    }
  });
});
