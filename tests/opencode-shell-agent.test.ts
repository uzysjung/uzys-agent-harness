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
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
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

let projectDir = "";
afterEach(() => {
  if (projectDir) rmSync(projectDir, { recursive: true, force: true });
  projectDir = "";
});

describe("shell-dependence is derived from the scripts/ sidecar (no list to drift)", () => {
  it("template premise holds: plan denies bash, build allows it", () => {
    const tpl = JSON.parse(
      readFileSync(join(HARNESS_ROOT, "templates/opencode/opencode.json.template"), "utf8"),
    );
    expect(tpl.agent.plan.tools.bash).toBe(false);
    expect(tpl.agent.build.tools.bash).toBe(true);
  });

  it("번들 스킬의 실제 stamp 가 scripts/ 유무와 일치한다", () => {
    // 2026-08-02 정비 (ADR-060) — scripts/ 를 싣던 스킬(consult 2종 · harness-health-audit)이
    //   전부 이관돼 현재 번들엔 build 로 렌더될 스킬이 **없다**. 그래서 이 루프만으로는
    //   build 분기를 증명하지 못한다 — 그 증명은 아래 합성 하네스 테스트가 맡는다.
    //   여기서는 "실제 번들이 계약과 어긋나지 않는가"만 본다.
    projectDir = mkdtempSync(join(tmpdir(), "opencode-shell-agent-real-"));
    runOpencodeTransform({
      harnessRoot: HARNESS_ROOT,
      projectDir,
      selectedInternalSkills: INTERNAL_BUNDLED_SKILL_IDS,
      baseline: new Map(),
    });
    expect(INTERNAL_BUNDLED_SKILL_IDS.length).toBeGreaterThan(0); // 공허한 통과 차단
    for (const id of INTERNAL_BUNDLED_SKILL_IDS) {
      const cmd = readFileSync(join(projectDir, ".opencode/commands", `${id}.md`), "utf8");
      const expected = hasScripts(id) ? "build" : "plan";
      expect(cmd, `${id} should carry agent: ${expected}`).toContain(`agent: ${expected}`);
    }
  });
});

describe("runOpencodeTransform end-to-end agent stamping", () => {
  it("합성 하네스: scripts/ 를 가진 스킬만 agent: build 로 렌더된다 (양 분기)", () => {
    // 이 파일의 서문이 선언한 "구조 신호에서 derive" 를 **양 분기 모두** 실증한다.
    //   이전 판본은 실제 번들에 scripts/ 스킬이 있다는 사정에 기대어 build 분기를 증명했고,
    //   그 사정이 사라지자 (이관) 계약이 아니라 표본이 깨졌다 — 같은 함정이 v26.121.0 에도
    //   있었다(consult 두 개를 이름으로 박아 둠). 표본을 테스트가 직접 만든다.
    const harnessRoot = mkdtempSync(join(tmpdir(), "opencode-shell-agent-harness-"));
    projectDir = mkdtempSync(join(tmpdir(), "opencode-shell-agent-proj-"));
    try {
      for (const rel of [
        "templates/CLAUDE.md",
        "templates/opencode/AGENTS.md.template",
        "templates/opencode/opencode.json.template",
      ]) {
        mkdirSync(dirname(join(harnessRoot, rel)), { recursive: true });
        copyFileSync(join(HARNESS_ROOT, rel), join(harnessRoot, rel));
      }
      mkdirSync(join(harnessRoot, "templates/skills/shells-out/scripts"), { recursive: true });
      writeFileSync(join(harnessRoot, "templates/skills/shells-out/SKILL.md"), SKILL_SRC);
      writeFileSync(join(harnessRoot, "templates/skills/shells-out/scripts/ask.sh"), "#!/bin/sh\n");
      mkdirSync(join(harnessRoot, "templates/skills/reads-only"), { recursive: true });
      writeFileSync(join(harnessRoot, "templates/skills/reads-only/SKILL.md"), SKILL_SRC);

      runOpencodeTransform({
        harnessRoot,
        projectDir,
        selectedInternalSkills: ["shells-out", "reads-only"],
        baseline: new Map(),
      });

      const cmd = (id: string) =>
        readFileSync(join(projectDir, ".opencode/commands", `${id}.md`), "utf8");
      expect(cmd("shells-out")).toContain("agent: build");
      expect(cmd("reads-only")).toContain("agent: plan");
    } finally {
      rmSync(harnessRoot, { recursive: true, force: true });
    }
  });
});
