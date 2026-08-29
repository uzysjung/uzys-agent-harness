import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
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

  it("produces AGENTS.md + opencode.json (no dev-method skills → no skill files)", () => {
    const report = runOpencodeTransform({
      harnessRoot: HARNESS_ROOT,
      projectDir: project,
      baseline: new Map(),
    });
    expect(existsSync(report.agentsMdPath)).toBe(true);
    expect(existsSync(report.opencodeJsonPath)).toBe(true);
    // 스킬은 selectedInternalSkills 에서만 나온다 — 여기선 0건.
    expect(report.skillFiles).toHaveLength(0);
    expect(report.retiredCommands).toHaveLength(0);

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
  describe("dev-method skills (ADR-081 — .agents/skills 네이티브)", () => {
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
        // ADR-081 — codex·antigravity 와 **같은 자리**다. OpenCode 1.18.23 이 프로젝트
        // 스코프 `.agents/skills/**/SKILL.md` 를 자동 로드한다(실측 2026-08-29).
        const target = join(project, ".agents/skills", id, "SKILL.md");
        expect(report.skillFiles).toContain(target);
        const body = readFileSync(target, "utf8");
        // 스킬 자신의 frontmatter 를 보존한다 — 커맨드 frontmatter 로 갈아끼우지 않는다.
        expect(body.startsWith("---")).toBe(true);
        expect(body).toMatch(/name:\s*.+/);
        expect(body).not.toContain("/uzys:");
      }
      expect(report.skillFiles).toHaveLength(DEV_METHOD.length);
      // 커맨드 사본은 더 이상 만들지 않는다 — 만들면 같은 이름이 목록에 두 줄로 뜬다.
      for (const id of DEV_METHOD) {
        expect(existsSync(join(project, ".opencode/commands", `${id}.md`))).toBe(false);
      }
    });

    it("스킬 본문이 원본 그대로 실린다 (description 이 잘리거나 stub 이 되지 않는다)", () => {
      runOpencodeTransform({
        harnessRoot: HARNESS_ROOT,
        projectDir: project,
        selectedInternalSkills: ["compaction-handoff"],
        baseline: new Map(),
      });
      const body = readFileSync(
        join(project, ".agents/skills/compaction-handoff/SKILL.md"),
        "utf8",
      );
      expect(body).toMatch(/durable facts and decisions/i);
    });

    it("옛 `.opencode/commands/<id>.md` 는 백업하고 지운다 (같은 이름이 두 줄로 뜨지 않게)", () => {
      // 전환 전 설치본 재현.
      const cmdDir = join(project, ".opencode/commands");
      mkdirSync(cmdDir, { recursive: true });
      writeFileSync(join(cmdDir, "compaction-handoff.md"), '---\ndescription: "old"\n---\n\nold\n');
      // 사용자가 직접 쓴 커맨드 — 번들 스킬 이름이 아니므로 건드리면 안 된다.
      writeFileSync(join(cmdDir, "my-own-command.md"), '---\ndescription: "mine"\n---\n\nmine\n');

      const report = runOpencodeTransform({
        harnessRoot: HARNESS_ROOT,
        projectDir: project,
        selectedInternalSkills: ["compaction-handoff"],
        baseline: new Map(),
      });

      expect(existsSync(join(cmdDir, "compaction-handoff.md"))).toBe(false);
      expect(report.retiredCommands).toHaveLength(1);
      expect(existsSync(join(cmdDir, "my-own-command.md"))).toBe(true);
      // 백업을 남긴다 — 사용자가 고쳤을 수 있고 그 편집분을 되살릴 방법이 없다.
      const backups = readdirSync(cmdDir).filter((f) => f.startsWith("compaction-handoff.md."));
      expect(backups.length).toBeGreaterThan(0);
    });

    it("selectedInternalSkills 빈 배열(기본) → 스킬 미생성 (0개)", () => {
      const report = runOpencodeTransform({
        harnessRoot: HARNESS_ROOT,
        projectDir: project,
        baseline: new Map(),
      });
      expect(existsSync(join(project, ".agents/skills/compaction-handoff/SKILL.md"))).toBe(false);
      expect(report.skillFiles).toHaveLength(0);
    });
  });
});
