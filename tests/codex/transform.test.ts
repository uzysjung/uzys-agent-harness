import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runCodexTransform } from "../../src/codex/transform.js";
import { expectedSkillRelFiles, firstSkillIdWithReferences } from "../helpers/bundled-skill-dir.js";

const HARNESS_ROOT = resolve(__dirname, "../..");

describe("runCodexTransform (E2E against templates/)", () => {
  let project: string;

  beforeEach(() => {
    project = mkdtempSync(join(tmpdir(), "ch-codex-"));
  });

  afterEach(() => {
    rmSync(project, { recursive: true, force: true });
  });

  it("produces Codex baseline — AGENTS.md + config.toml + ported hooks (slash + env rename)", () => {
    const report = runCodexTransform({
      harnessRoot: HARNESS_ROOT,
      projectDir: project,
      baseline: new Map(),
    });
    expect(existsSync(report.agentsMdPath)).toBe(true);
    expect(existsSync(report.configTomlPath)).toBe(true);
    // HOOK_NAMES = [session-start] — v26.115.0(ADR-043)에서 hito-counter 제거.
    expect(report.hookFiles).toHaveLength(1);

    // Invariant: no Claude-namespace colon-slash (/uzys:) leaks into Codex output.
    const agents = readFileSync(report.agentsMdPath, "utf8");
    expect(agents).not.toContain("/uzys:");

    const config = readFileSync(report.configTomlPath, "utf8");
    expect(config).toContain("[features]");
    expect(config).toContain("[mcp_servers.");

    // Ported hooks rename CLAUDE_PROJECT_DIR → CODEX_PROJECT_DIR.
    for (const hook of report.hookFiles) {
      expect(readFileSync(hook, "utf8")).not.toContain("CLAUDE_PROJECT_DIR");
    }
  });

  it("default (no selectedInternalSkills) → skillFiles empty, no .agents/skills written", () => {
    const report = runCodexTransform({
      harnessRoot: HARNESS_ROOT,
      projectDir: project,
      baseline: new Map(),
    });
    expect(report.skillFiles).toEqual([]);
    expect(existsSync(join(project, ".agents/skills"))).toBe(false);
  });

  it("throws when required template missing", () => {
    expect(() =>
      runCodexTransform({ harnessRoot: "/no/such/root", projectDir: project, baseline: new Map() }),
    ).toThrow(/required source missing/);
  });

  // v26.87.0 — dev-method skills → .agents/skills/<id>/SKILL.md (native, frontmatter 보존).
  describe("dev-method skills (v26.87.0 — multi-CLI routing)", () => {
    // 2026-08-02 정비 (ADR-060) — 표본이 이관된 두 스킬에서 잔존 번들 스킬로 바뀌었다.
    //   검증 대상은 라우팅(선택된 id 만 native .agents/skills/ 로 렌더)이지 특정 스킬이 아니다.
    const DEV_METHOD = ["compaction-handoff", "eval-harness"];

    // ADR-085 — 상시 스킬 안내는 AGENTS.md 프로젝트 맥락에, 깔린 것만.
    it("상시 스킬을 골랐을 때만 AGENTS.md 에 안내 절이 붙는다", () => {
      const NOTE = "## Skills that apply continuously";
      runCodexTransform({
        harnessRoot: HARNESS_ROOT,
        projectDir: project,
        selectedInternalSkills: ["task-brief", ...DEV_METHOD],
        baseline: new Map(),
      });
      const withNote = readFileSync(join(project, "AGENTS.md"), "utf8");
      expect(withNote).toContain(NOTE);
      expect(withNote).toContain("`task-brief`");
      expect(withNote).not.toContain("`compaction-handoff`"); // 상시 스킬이 아니다
      runCodexTransform({
        harnessRoot: HARNESS_ROOT,
        projectDir: project,
        selectedInternalSkills: DEV_METHOD,
        baseline: new Map(),
      });
      expect(readFileSync(join(project, "AGENTS.md"), "utf8")).not.toContain(NOTE);
    });

    it("selectedInternalSkills 주어지면 native .agents/skills/<id>/SKILL.md 로 렌더", () => {
      const report = runCodexTransform({
        harnessRoot: HARNESS_ROOT,
        projectDir: project,
        selectedInternalSkills: DEV_METHOD,
        baseline: new Map(),
      });
      for (const id of DEV_METHOD) {
        const target = join(project, ".agents/skills", id, "SKILL.md");
        expect(report.skillFiles).toContain(target);
        expect(existsSync(target)).toBe(true);
      }
    });

    // PITFALL GUARD: dev-method SKILL.md 는 이미 완성된 skill — 자체 frontmatter(name: <id>)를
    // 보존해야 한다. renderBundledSkill 이 name 을 uzys-<id> 로 다시 래핑하면 오염 + 이중 래핑.
    // 이 테스트가 그 회귀를 잡는다 (business logic = "frontmatter 보존"이 깨지면 fail).
    it("frontmatter 가 name: <id> 보존 (NOT name: uzys-<id>) — renderBundledSkill frontmatter 보존 가드", () => {
      runCodexTransform({
        harnessRoot: HARNESS_ROOT,
        projectDir: project,
        selectedInternalSkills: ["compaction-handoff"],
        baseline: new Map(),
      });
      const body = readFileSync(
        join(project, ".agents/skills/compaction-handoff/SKILL.md"),
        "utf8",
      );
      expect(body).toContain("name: compaction-handoff");
      expect(body).not.toContain("name: uzys-compaction-handoff");
      expect(body).not.toContain("name: uzys-");
    });

    it("selectedInternalSkills 빈 배열(기본) → dev-method skill 미생성", () => {
      const report = runCodexTransform({
        harnessRoot: HARNESS_ROOT,
        projectDir: project,
        baseline: new Map(),
      });
      expect(existsSync(join(project, ".agents/skills/compaction-handoff"))).toBe(false);
      // 선택된 dev-method skill 이 없으므로 skillFiles 전체가 비어 있어야 한다.
      expect(report.skillFiles).toEqual([]);
    });

    // #431 — `SKILL.md` 만 가던 시절 이 단언은 `references/` 를 빈 자리로 남겼다. 대상 id 는
    //   `templates/skills/` 에서 유도한다 — 이름을 박으면 자산 개편에 조용히 썩는다.
    it("references/ 를 가진 스킬은 형제 파일까지 .agents/skills/<id>/ 에 온다", () => {
      const id = firstSkillIdWithReferences(HARNESS_ROOT);
      const expected = expectedSkillRelFiles(HARNESS_ROOT, id);
      const report = runCodexTransform({
        harnessRoot: HARNESS_ROOT,
        projectDir: project,
        selectedInternalSkills: [id],
        baseline: new Map(),
      });
      for (const rel of expected) {
        const target = join(project, ".agents/skills", id, rel);
        expect(existsSync(target), `${rel} 미도달`).toBe(true);
        expect(report.skillFiles).toContain(target);
      }
      // 형제가 0건이면 위 루프는 SKILL.md 하나만 보고 통과한다 — 모집단 자기검증.
      expect(expected.filter((rel) => rel !== "SKILL.md").length).toBeGreaterThan(0);
    });

    it("selected dev-method skill 만 렌더 (선택 안 한 id 는 빠짐)", () => {
      const report = runCodexTransform({
        harnessRoot: HARNESS_ROOT,
        projectDir: project,
        selectedInternalSkills: ["compaction-handoff"],
        baseline: new Map(),
      });
      expect(existsSync(join(project, ".agents/skills/compaction-handoff/SKILL.md"))).toBe(true);
      // 선택하지 않은 skill 은 빠지고 dev-method 1개만.
      expect(existsSync(join(project, ".agents/skills/eval-harness"))).toBe(false);
      expect(report.skillFiles).toHaveLength(1);
    });
  });
});
