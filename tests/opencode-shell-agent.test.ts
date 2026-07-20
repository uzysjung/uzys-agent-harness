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
import { INTERNAL_BUNDLED_SKILL_IDS } from "../src/external-assets.js";
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

/** 구현(src/opencode/transform.ts)이 쓰는 것과 동일한 구조 신호. 두 describe 가 공유한다. */
const hasScripts = (id: string) =>
  existsSync(join(HARNESS_ROOT, "templates/skills", id, "scripts"));

describe("shell-dependence is derived from the scripts/ sidecar (no list to drift)", () => {
  it("skills that shell out ship scripts/", () => {
    // 상담 어드바이저는 외부 CLI 를 실행하는 것이 존재 이유다.
    expect(hasScripts("gemini-consult")).toBe(true);
    expect(hasScripts("codex-consult")).toBe(true);
    // harness-health-audit 은 "## Run the deterministic linter first" 로 시작한다 —
    // npx ecc-agentshield scan · AgentLint · cclint. 처음부터 bash 가 필요했는데
    // scripts/ 가 없어 OpenCode 에서 agent: plan(bash 차단)으로 렌더됐고, 그래서 첫 지시부터
    // 실행 불가였다. v26.121.0 에서 observation-digest.mjs 가 들어오며 해소됐다.
    expect(hasScripts("harness-health-audit")).toBe(true);
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
      baseline: new Map(),
    });
    // 기대값을 구현과 **같은 구조 신호**에서 derive 한다. 이 파일 서문이 "no hardcoded id
    // list to drift" 라고 선언해 놓고도 여기서 consult 두 개를 이름으로 박아 뒀었고, 그래서
    // harness-health-audit 이 scripts/ 를 갖게 되자 계약이 아니라 목록이 깨졌다 (v26.121.0).
    let sawBuild = 0;
    for (const id of INTERNAL_BUNDLED_SKILL_IDS) {
      const cmd = readFileSync(join(projectDir, ".opencode/commands", `${id}.md`), "utf8");
      const expected = hasScripts(id) ? "build" : "plan";
      if (expected === "build") sawBuild++;
      expect(cmd, `${id} should carry agent: ${expected}`).toContain(`agent: ${expected}`);
    }
    // 시어터 방지 — 전부 plan 이면 위 루프는 아무것도 증명하지 않는다.
    expect(sawBuild).toBeGreaterThan(0);
  });
});
