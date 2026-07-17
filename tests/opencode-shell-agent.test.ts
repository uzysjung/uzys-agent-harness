/**
 * v26.100.0 — OpenCode command fallback: shell-dependent skill → `agent: build`.
 *
 * WHY this gate exists (persona/SOD finding, ADR-029): the harness's own
 * templates/opencode/opencode.json.template denies bash to the `plan` agent, yet
 * renderCommandFromSkill stamped `agent: plan` on EVERY bundled skill. The consult
 * advisors (gemini-consult, codex-consult) work ONLY by shelling out to an external
 * CLI — under plan they were a complete no-op on OpenCode while installing "green"
 * (a v26.95.0 false-ship for gemini-consult). The fix derives shell-dependence from
 * the bundled `scripts/` sidecar dir (structural signal — no hardcoded id list to
 * drift). These tests fail if either side of that contract rots:
 *   - a scripts/-carrying skill rendering back to plan (the original bug), or
 *   - the opencode.json.template agent profiles changing out from under the rationale.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DEV_METHOD_SKILL_IDS, INTERNAL_BUNDLED_SKILL_IDS } from "../src/external-assets.js";
import { renderCommandFromSkill } from "../src/opencode/commands.js";
import { runOpencodeTransform } from "../src/opencode/transform.js";

const HARNESS_ROOT = resolve(__dirname, "..");
const SKILL_SRC = ["---", "description: test skill", "---", "", "# body", ""].join("\n");

describe("renderCommandFromSkill agent derivation", () => {
  it("defaults to agent: plan (read-heavy dev-method skills)", () => {
    expect(renderCommandFromSkill(SKILL_SRC, "x")).toContain("agent: plan");
  });

  it("shellDependent → agent: build (bash-capable)", () => {
    const out = renderCommandFromSkill(SKILL_SRC, "x", { shellDependent: true });
    expect(out).toContain("agent: build");
    expect(out).not.toContain("agent: plan");
  });
});

describe("shell-dependence is derived from the scripts/ sidecar (no list to drift)", () => {
  const hasScripts = (id: string) =>
    existsSync(join(HARNESS_ROOT, "templates/skills", id, "scripts"));

  it("consult advisors ship scripts/; dev-method skills don't", () => {
    expect(hasScripts("gemini-consult")).toBe(true);
    expect(hasScripts("codex-consult")).toBe(true);
    for (const id of DEV_METHOD_SKILL_IDS) {
      expect(hasScripts(id), `${id} unexpectedly grew a scripts/ sidecar`).toBe(false);
    }
  });

  it("template premise holds: plan denies bash, build allows it", () => {
    const tpl = JSON.parse(
      readFileSync(join(HARNESS_ROOT, "templates/opencode/opencode.json.template"), "utf8"),
    );
    expect(tpl.agent.plan.tools.bash).toBe(false);
    expect(tpl.agent.build.tools.bash).toBe(true);
  });
});

describe("runOpencodeTransform end-to-end agent stamping", () => {
  let projectDir: string;
  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  it("consult commands render agent: build; dev-method commands render agent: plan", () => {
    projectDir = mkdtempSync(join(tmpdir(), "opencode-shell-agent-"));
    runOpencodeTransform({
      harnessRoot: HARNESS_ROOT,
      projectDir,
      selectedInternalSkills: INTERNAL_BUNDLED_SKILL_IDS,
    });
    for (const id of INTERNAL_BUNDLED_SKILL_IDS) {
      const cmd = readFileSync(join(projectDir, ".opencode/commands", `${id}.md`), "utf8");
      const expected = id === "gemini-consult" || id === "codex-consult" ? "build" : "plan";
      expect(cmd, `${id} should carry agent: ${expected}`).toContain(`agent: ${expected}`);
    }
  });
});
