import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runCodexTransform } from "../../src/codex/transform.js";

const HARNESS_ROOT = resolve(__dirname, "../..");

describe("runCodexTransform (E2E against templates/)", () => {
  let project: string;

  beforeEach(() => {
    project = mkdtempSync(join(tmpdir(), "ch-codex-"));
  });

  afterEach(() => {
    rmSync(project, { recursive: true, force: true });
  });

  it("v26.57.0 (ADR-018) — withUzysHarness=true → skills + prompts 6+6 생성", () => {
    const report = runCodexTransform({
      harnessRoot: HARNESS_ROOT,
      projectDir: project,
      withUzysHarness: true,
    });
    expect(existsSync(report.agentsMdPath)).toBe(true);
    expect(existsSync(report.configTomlPath)).toBe(true);
    expect(report.hookFiles).toHaveLength(3);
    expect(report.skillFiles).toHaveLength(6);
    expect(report.promptFiles).toHaveLength(6);

    const agents = readFileSync(report.agentsMdPath, "utf8");
    expect(agents).not.toContain("/uzys:");
    expect(agents).toContain("/uzys-");

    const config = readFileSync(report.configTomlPath, "utf8");
    expect(config).toContain("[features]");
    expect(config).toContain("[mcp_servers.");

    for (const hook of report.hookFiles) {
      expect(readFileSync(hook, "utf8")).not.toContain("CLAUDE_PROJECT_DIR");
    }

    for (const skill of report.skillFiles) {
      const body = readFileSync(skill, "utf8");
      expect(body.startsWith("---")).toBe(true);
      expect(body).toMatch(/name: uzys-(spec|plan|build|test|review|ship)/);
    }

    for (const promptFile of report.promptFiles) {
      const body = readFileSync(promptFile, "utf8");
      expect(body).toMatch(/^---/);
      expect(body).toContain("description:");
      expect(body).not.toContain("/uzys:");
      expect(promptFile).toContain(".codex/prompts/uzys-");
    }
  });

  it("v26.57.0 (ADR-018, BREAKING) — withUzysHarness=false → skills + prompts 0+0 (uzys 산출물 X)", () => {
    const report = runCodexTransform({
      harnessRoot: HARNESS_ROOT,
      projectDir: project,
    });
    // AGENTS.md / config.toml / hooks 는 codex baseline 이라 그대로 생성
    expect(existsSync(report.agentsMdPath)).toBe(true);
    expect(existsSync(report.configTomlPath)).toBe(true);
    expect(report.hookFiles).toHaveLength(3);
    // uzys 산출물은 빠짐
    expect(report.skillFiles).toEqual([]);
    expect(report.promptFiles).toEqual([]);
    // .codex/prompts/ 디렉토리도 만들지 않음
    expect(existsSync(join(project, ".codex/prompts"))).toBe(false);
    expect(existsSync(join(project, ".agents/skills/uzys-spec"))).toBe(false);
  });

  it("default (param 누락) = withUzysHarness=false 동작 (안전한 default)", () => {
    const report = runCodexTransform({ harnessRoot: HARNESS_ROOT, projectDir: project });
    expect(report.skillFiles).toEqual([]);
    expect(report.promptFiles).toEqual([]);
  });

  it("throws when required template missing", () => {
    expect(() => runCodexTransform({ harnessRoot: "/no/such/root", projectDir: project })).toThrow(
      /required source missing/,
    );
  });
});
