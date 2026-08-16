import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  classifyBaselineTarget,
  isBaselineExcluded,
  listBaselineTargets,
} from "../src/baseline-targets.js";
import { runInstall } from "../src/installer.js";
import { baselineExcludeFrom, initialTargetSelection } from "../src/interactive.js";
import type { InstallSpec, OptionFlags } from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");
const NO_OPTS: OptionFlags = { withPrune: false, withCodexTrust: false };

/**
 * 트랙이 고르는 자산을 사용자가 볼 수 있고 해제할 수 있는가.
 *
 * 왜 게이트인가: 그전까지 룰·에이전트·훅·스킬은 **화면에 한 번도 안 나온 채** 깔렸다. 위저드
 * 3단계는 외부 자산만 물었고 트랙 자산은 설치가 끝난 뒤 요약에서 처음 보였다. 사용자 지적 —
 * *"기술스택 선택했다고 알아서 설치되는 구조는 개선해. 설치항목은 모두 투명하게 다 보여줘야 해."*
 *
 * 두 방향을 함께 문다: **보이는가**(목록이 manifest 에서 유도되는가) · **먹히는가**(해제한 것이
 * 실제로 안 깔리는가). 한쪽만 걸면 목록만 예쁘고 설치는 그대로인 상태가 초록으로 산다.
 */
describe("classifyBaselineTarget — 고를 수 있는 것과 없는 것", () => {
  it.each([
    [".claude/rules/git-policy.md", "rules", "git-policy"],
    [".claude/agents/reviewer.md", "agents", "reviewer"],
    [".claude/hooks/protect-files.sh", "hooks", "protect-files"],
    [".claude/skills/deep-research", "skills", "deep-research"],
  ])("%s → %s/%s", (target, kind, name) => {
    const t = classifyBaselineTarget(target);
    expect(t?.kind).toBe(kind);
    expect(t?.name).toBe(name);
    expect(t?.id).toBe(`baseline:${kind}/${name}`);
  });

  // manifest 에는 디렉터리 엔트리와 그 **안의 파일** 엔트리가 섞여 있다. 마지막 경로 조각을 쓰면
  // 후자가 `SKILL.md` 라는 이름의 항목으로 화면에 뜬다 — 실제로 그렇게 만들었다가 고쳤다.
  it("스킬은 첫 경로 조각으로 합쳐진다 (디렉터리 · 내부 파일이 한 체크박스)", () => {
    const dir = classifyBaselineTarget(".claude/skills/spec-scaling");
    const file = classifyBaselineTarget(".claude/skills/spec-scaling/SKILL.md");
    expect(dir?.id).toBe("baseline:skills/spec-scaling");
    expect(file?.id).toBe(dir?.id);
  });

  it.each([
    ".claude/settings.json",
    "CLAUDE-uzys-harness.md",
    ".mcp.json",
    ".uzys-agent-harness/spec-drift-check.sh",
    ".claude/commands/uzys/foo.md",
  ])("구조 자산 %s 는 후보가 아니다 (빼면 설치가 반쪽이 된다)", (target) => {
    expect(classifyBaselineTarget(target)).toBeNull();
  });

  it("고를 수 없는 자산은 어떤 제외 목록으로도 안 빠진다", () => {
    // 잘못된 id 가 흘러들어와도 설치가 깨지지 않아야 한다.
    const excluded = new Set(["baseline:rules/git-policy", ".claude/settings.json"]);
    expect(isBaselineExcluded(".claude/settings.json", excluded)).toBe(false);
    expect(isBaselineExcluded(".claude/rules/git-policy.md", excluded)).toBe(true);
  });
});

describe("listBaselineTargets — manifest 에서 유도한다", () => {
  it("네 종류가 모두 나오고 트랙이 안 고른 것은 안 나온다", () => {
    const tooling = listBaselineTargets({ tracks: ["tooling"] });
    const kinds = new Set(tooling.map((t) => t.kind));
    expect(kinds).toEqual(new Set(["rules", "agents", "hooks", "skills"]));

    // cli-development 는 tooling 전용 — executive 에는 없어야 한다. 이 대조가 없으면 목록이
    // 트랙과 무관한 상수여도 위 단언은 통과한다.
    const ids = (tracks: Parameters<typeof listBaselineTargets>[0]["tracks"]) =>
      new Set(listBaselineTargets({ tracks }).map((t) => t.id));
    expect(ids(["tooling"])).toContain("baseline:rules/cli-development");
    expect(ids(["executive"])).not.toContain("baseline:rules/cli-development");
  });

  it("중복 id 가 없다 (스킬 디렉터리 + 내부 파일이 한 항목으로 합쳐진다)", () => {
    const list = listBaselineTargets({ tracks: ["full"] });
    expect(new Set(list.map((t) => t.id)).size).toBe(list.length);
    expect(list.map((t) => t.name)).not.toContain("SKILL.md");
  });
});

describe("baselineExcludeFrom — 체크를 제외로 뒤집는다", () => {
  const offered = [{ id: "baseline:rules/a" }, { id: "baseline:rules/b" }];

  it("전부 체크된 기본 상태면 제외가 0건이다 (기존 동작과 동일)", () => {
    expect(baselineExcludeFrom(offered, ["baseline:rules/a", "baseline:rules/b"])).toEqual([]);
  });

  it("푼 것만 제외로 나온다", () => {
    expect(baselineExcludeFrom(offered, ["baseline:rules/a"])).toEqual(["baseline:rules/b"]);
  });

  it("위저드 초기 선택은 트랙 baseline 을 전부 체크한 상태다", () => {
    const initial = initialTargetSelection(["tooling"], []);
    const offeredIds = listBaselineTargets({ tracks: ["tooling"] }).map((t) => t.id);
    expect(offeredIds.length).toBeGreaterThan(0);
    for (const id of offeredIds) expect(initial).toContain(id);
    // 그러므로 아무것도 안 건드린 사용자의 제외 목록은 비어 있다.
    expect(baselineExcludeFrom(listBaselineTargets({ tracks: ["tooling"] }), initial)).toEqual([]);
  });
});

describe("설치에 실제로 먹히는가 (E2E)", () => {
  let projectDir: string;
  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "ch-baseline-"));
  });
  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  const spec = (extra: Partial<InstallSpec> = {}): InstallSpec => ({
    tracks: ["tooling"],
    options: NO_OPTS,
    cli: ["claude", "codex"],
    projectDir,
    ...extra,
  });

  /**
   * 룰 본문 고유 문자열. **템플릿 헤더를 쓰면 안 된다** — `## Git Policy` 는
   * `AGENTS.md.template` 의 고정 섹션이라 룰을 빼도 남는다. 처음에 그걸 needle 로 써서 전제
   * 테스트가 거짓 통과했고, 제외 테스트만 빨간불이 났다. 아래 둘은 룰 파일에만 있음을 확인했다.
   */
  const GIT_RULE_BODY = "Git Safety";
  const DOC_RULE_BODY = "Documentation Boundaries";

  it("제외 안 하면 깔린다 (전제 — 이게 없으면 아래 부재 단언이 무의미하다)", () => {
    runInstall({ runExternal: null, harnessRoot: HARNESS_ROOT, projectDir, spec: spec() });
    expect(existsSync(join(projectDir, ".claude/rules/git-policy.md"))).toBe(true);
    expect(existsSync(join(projectDir, ".claude/hooks/protect-files.sh"))).toBe(true);
    expect(readFileSync(join(projectDir, "AGENTS.md"), "utf8")).toContain(GIT_RULE_BODY);
  });

  it("해제한 룰은 `.claude/` 에도 AGENTS.md 에도 안 간다 (4 CLI 대칭)", () => {
    // 한쪽만 거르면 claude 에서는 뺀 룰이 codex/opencode 에는 그대로 깔린다 — 이 리포가
    // #300 에서 정확히 그 형태로 당했다.
    const report = runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: spec({ baselineExclude: ["baseline:rules/git-policy"] }),
    });
    const agents = readFileSync(join(projectDir, "AGENTS.md"), "utf8");
    expect(existsSync(join(projectDir, ".claude/rules/git-policy.md"))).toBe(false);
    expect(agents).not.toContain(GIT_RULE_BODY);
    expect(report.baselineExcluded).toContain(".claude/rules/git-policy.md");
    // 안 뺀 룰은 양쪽 다 그대로 — 제외가 통째로 날리는 것이 아님을 보이고, 동시에 위 부재
    // 단언이 "AGENTS.md 에 룰이 아예 안 실려서" 통과한 것이 아님을 증명한다(탐지기 자기검증).
    expect(existsSync(join(projectDir, ".claude/rules/doc-governance.md"))).toBe(true);
    expect(agents).toContain(DOC_RULE_BODY);
  });

  it("해제한 훅은 파일도 settings.json 배선도 함께 빠진다", () => {
    runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: spec({ cli: ["claude"], baselineExclude: ["baseline:hooks/protect-files"] }),
    });
    expect(existsSync(join(projectDir, ".claude/hooks/protect-files.sh"))).toBe(false);
    // 배선이 남으면 매 Write/Edit 마다 없는 스크립트를 찾는다 (bash exit 127).
    const settings = readFileSync(join(projectDir, ".claude/settings.json"), "utf8");
    expect(settings).not.toContain("protect-files.sh");
    // 탐지기 자기검증 — 남아 있어야 할 훅은 같은 파일에서 찾힌다.
    expect(settings).toContain("session-start.sh");
  });

  it("스킬 해제는 디렉터리째 안 깔린다", () => {
    runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: spec({ cli: ["claude"], baselineExclude: ["baseline:skills/deep-research"] }),
    });
    expect(existsSync(join(projectDir, ".claude/skills/deep-research"))).toBe(false);
    expect(existsSync(join(projectDir, ".claude/skills/strategic-compact"))).toBe(true);
  });

  it("구조 자산은 제외 지시가 있어도 깔린다 (설치가 반쪽이 되지 않는다)", () => {
    runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: spec({ cli: ["claude"], baselineExclude: [".claude/settings.json", "CLAUDE.md"] }),
    });
    expect(existsSync(join(projectDir, ".claude/settings.json"))).toBe(true);
    expect(existsSync(join(projectDir, "CLAUDE-uzys-harness.md"))).toBe(true);
  });
});
