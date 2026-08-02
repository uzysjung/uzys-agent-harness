import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runOpencodeTransform } from "../../src/opencode/transform.js";

const HARNESS_ROOT = resolve(__dirname, "../..");

describe("runOpencodeTransform (E2E against templates/)", () => {
  let project: string;

  beforeEach(() => {
    project = mkdtempSync(join(tmpdir(), "ch-opencode-"));
  });

  afterEach(() => {
    rmSync(project, { recursive: true, force: true });
  });

  it("produces AGENTS.md + opencode.json (no dev-method skills → no commands)", () => {
    const report = runOpencodeTransform({
      harnessRoot: HARNESS_ROOT,
      projectDir: project,
      baseline: new Map(),
    });
    expect(existsSync(report.agentsMdPath)).toBe(true);
    expect(existsSync(report.opencodeJsonPath)).toBe(true);
    // Commands are only emitted from selectedInternalSkills; none here → empty.
    expect(report.commandFiles).toHaveLength(0);

    // Invariant: no Claude-namespace colon-slash (/uzys:) leaks into OpenCode output.
    const agents = readFileSync(report.agentsMdPath, "utf8");
    expect(agents).not.toContain("/uzys:");
    expect(agents).toContain("OpenCode");

    const opencode = JSON.parse(readFileSync(report.opencodeJsonPath, "utf8"));
    expect(opencode.$schema).toBe("https://opencode.ai/config.json");
    // .mcp.json injects at least one entry into mcp.<name>
    expect(Object.keys(opencode.mcp).length).toBeGreaterThan(0);
  });

  it("throws when required template missing", () => {
    expect(() =>
      runOpencodeTransform({
        harnessRoot: "/no/such/root",
        projectDir: project,
        baseline: new Map(),
      }),
    ).toThrow(/required source missing/);
  });

  // v26.87.0 — dev-method skills → .opencode/commands/<id>.md (command fallback, no native skill).
  describe("dev-method skills (v26.87.0 — command fallback)", () => {
    // 2026-08-02 정비 (ADR-060) — 표본이 이관된 두 스킬에서 잔존 번들 스킬로 바뀌었다.
    //   검증 대상은 커맨드 fallback 렌더이지 특정 스킬이 아니다.
    const DEV_METHOD = ["compaction-handoff", "eval-harness"];

    it("selectedInternalSkills 주어지면 .opencode/commands/<id>.md 커맨드로 렌더", () => {
      const report = runOpencodeTransform({
        harnessRoot: HARNESS_ROOT,
        projectDir: project,
        selectedInternalSkills: DEV_METHOD,
        baseline: new Map(),
      });
      for (const id of DEV_METHOD) {
        const target = join(project, ".opencode/commands", `${id}.md`);
        expect(report.commandFiles).toContain(target);
        const body = readFileSync(target, "utf8");
        // command frontmatter: description(스킬에서 추출) + agent, body 포함.
        expect(body.startsWith("---")).toBe(true);
        expect(body).toMatch(/description:\s*".+"/);
        expect(body).toMatch(/agent:\s*\w+/);
        expect(body).not.toContain("/uzys:");
      }
      // 커맨드는 선택된 dev-method skill 에서만 생성된다.
      expect(report.commandFiles).toHaveLength(DEV_METHOD.length);
    });

    it("compaction-handoff 의 description 이 skill frontmatter 에서 추출됨 (빈 stub 아님)", () => {
      runOpencodeTransform({
        harnessRoot: HARNESS_ROOT,
        projectDir: project,
        selectedInternalSkills: ["compaction-handoff"],
        baseline: new Map(),
      });
      const body = readFileSync(join(project, ".opencode/commands/compaction-handoff.md"), "utf8");
      // 스킬 description 의 핵심 어구가 command description 으로 들어와야 한다 (folded block 파싱 검증).
      // 접힌 블록(>-)이 한 줄로 펴져야 통과한다 — 두 번째 줄의 어구를 앵커로 쓴다.
      expect(body).toMatch(/description:\s*".*durable facts and decisions.*"/i);
    });

    it("selectedInternalSkills 빈 배열(기본) → dev-method 커맨드 미생성 (커맨드 0개)", () => {
      const report = runOpencodeTransform({
        harnessRoot: HARNESS_ROOT,
        projectDir: project,
        baseline: new Map(),
      });
      expect(existsSync(join(project, ".opencode/commands/compaction-handoff.md"))).toBe(false);
      expect(report.commandFiles).toHaveLength(0);
    });
  });
});
