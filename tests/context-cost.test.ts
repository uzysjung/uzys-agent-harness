import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { renderInstallHeader } from "../src/commands/install-render.js";
import {
  assetBodyTokens,
  assetCostRows,
  assetDescriptorTokens,
  estimateTokens,
  extractFrontmatter,
  formatContextCostLine,
  formatResidentCostBlock,
  formatResidentCostLine,
  landsOnDisk,
  makeResidentCost,
  residentCost,
  resolveBundleRoot,
} from "../src/context-cost.js";
import { CONTINUOUS_SKILLS, INTERNAL_BUNDLED_SKILL_IDS } from "../src/external-assets.js";
import { buildManifestSpec, runInstall } from "../src/installer.js";
import { formatSummary } from "../src/interactive.js";
import { buildAssetSpec, buildManifest } from "../src/manifest.js";
import { renderFillScaffold, withContinuousSkillsNote } from "../src/project-claude-merge.js";
import { DEFAULT_OPTIONS, type InstallSpec, type Track } from "../src/types.js";

const HARNESS_ROOT_FOR_INSTALL = resolve(__dirname, "..");

/** 상주 CLAUDE.md 중 스캐폴드 몫. 파일이 아니라 생성물이라 어떤 root 에서도 같다. */
// ADR-085 — src 와 같은 대상: 스캐폴드 + 상시 스킬 안내(전 스킬 선택 기준 상한).
const scaffoldTokens = (): number =>
  estimateTokens(
    withContinuousSkillsNote(
      renderFillScaffold(),
      CONTINUOUS_SKILLS.map((s) => s.id),
    ).trim().length,
  );

describe("context-cost primitives", () => {
  it("estimates tokens at chars/4 rounded up", () => {
    expect(estimateTokens(4)).toBe(1);
    expect(estimateTokens(5)).toBe(2);
    expect(estimateTokens(0)).toBe(0);
  });

  it("extracts the frontmatter block and returns null when absent", () => {
    expect(extractFrontmatter("---\nname: x\ndescription: y\n---\nbody")).toBe(
      "name: x\ndescription: y",
    );
    expect(extractFrontmatter("no frontmatter here")).toBeNull();
  });

  it("returns null (unmeasured) for non-internal assets and unknown ids", () => {
    // superpowers = plugin method — 설치 시점에 frontmatter 를 알 수 없다.
    expect(assetDescriptorTokens("superpowers")).toBeNull();
    expect(assetDescriptorTokens("no-such-asset")).toBeNull();
  });

  it("measures every bundled internal skill (frontmatter exists and is non-trivial)", () => {
    for (const id of INTERNAL_BUNDLED_SKILL_IDS) {
      const tokens = assetDescriptorTokens(id);
      expect(tokens, `bundled skill ${id} must be measurable`).not.toBeNull();
      expect(tokens ?? 0, `bundled skill ${id} frontmatter too small to be real`).toBeGreaterThan(
        20,
      );
    }
  });

  it("resolves bundle root to a directory containing templates/skills", () => {
    const root = resolveBundleRoot();
    expect(assetDescriptorTokens("compaction-handoff", root)).not.toBeNull();
  });
});

describe("path robustness + degraded frontmatter (SOD 리뷰 F1/F7 회귀 가드)", () => {
  it("measures from a root containing spaces and Korean chars, with CRLF frontmatter", () => {
    const root = mkdtempSync(join(tmpdir(), "agent harness 한글 "));
    const dir = join(root, "templates", "skills", "compaction-handoff");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "SKILL.md"), "---\r\nname: x\r\ndescription: y\r\n---\r\nbody");
    expect(assetDescriptorTokens("compaction-handoff", root) ?? 0).toBeGreaterThan(0);
  });

  it("degrades to null (unmeasured) when SKILL.md has no frontmatter", () => {
    const root = mkdtempSync(join(tmpdir(), "agent-harness-nofm-"));
    const dir = join(root, "templates", "skills", "compaction-handoff");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "SKILL.md"), "no frontmatter body");
    expect(assetDescriptorTokens("compaction-handoff", root)).toBeNull();
  });
});

describe("context cost display line", () => {
  it("formats measured + unmeasured decomposition", () => {
    expect(
      formatContextCostLine({ measuredTokens: 742, measuredCount: 8, unmeasuredCount: 5 }),
    ).toBe(
      "session-start context cost: ~742 tokens (8 bundled skills measured · 5 external unmeasured)",
    );
    expect(formatContextCostLine({ measuredTokens: 0, measuredCount: 0, unmeasuredCount: 3 })).toBe(
      "session-start context cost: unmeasured (3 external assets)",
    );
    expect(
      formatContextCostLine({ measuredTokens: 0, measuredCount: 0, unmeasuredCount: 0 }),
    ).toBeNull();
  });

  it("formats singular counts and omits the external clause when zero", () => {
    expect(
      formatContextCostLine({ measuredTokens: 120, measuredCount: 1, unmeasuredCount: 1 }),
    ).toBe(
      "session-start context cost: ~120 tokens (1 bundled skill measured · 1 external unmeasured)",
    );
    expect(
      formatContextCostLine({ measuredTokens: 200, measuredCount: 2, unmeasuredCount: 0 }),
    ).toBe("session-start context cost: ~200 tokens (2 bundled skills measured)");
    expect(formatContextCostLine({ measuredTokens: 0, measuredCount: 0, unmeasuredCount: 1 })).toBe(
      "session-start context cost: unmeasured (1 external asset)",
    );
  });
});

/** 표시 표면 증거 (no-false-ship — "표시된다" 주장은 렌더 실행 산출물로 증명). */
describe("context cost surfaces", () => {
  const spec: InstallSpec = {
    projectDir: "/tmp/x",
    tracks: ["tooling"],
    cli: ["claude"],
    options: {},
    scope: "project",
  } as unknown as InstallSpec;

  /**
   * 표면이 보여야 하는 문자열을 여기서 다시 조립하지 않는다 — 포맷 함수를 그대로 호출해
   * 얻는다. 기대값을 손으로 적으면 그 문자열이 세 번째 사본이 되고, 표면이 자체 조립으로
   * 새는 것을 잡으려는 이 테스트가 정작 같은 잘못을 저지르게 된다.
   *
   * **기대값은 `buildManifestSpec` 을 거친다 (#320 H1, 독립 리뷰 적발).** 전에는 `InstallSpec`
   * 을 그대로 `applies()` 에 넘겨 기대값을 뽑았는데, 표면도 같은 좁은 spec 을 쓰고 있어서
   * **둘이 같은 결함을 공유한 채 항상 초록**이었다. 그동안 설치자 화면은 track=tooling 에서
   * 23개(실제 34개)를 출력하고 있었다. 기대값을 설치기 쪽에 묶어야 표면이 새는 것이 보인다.
   */
  const expectedLine = (): string => {
    const assetSpec = buildManifestSpec(spec);
    const entries = buildManifest(assetSpec).filter((e) => e.applies(assetSpec));
    const line = formatResidentCostLine(residentCost(entries), 0);
    // unmeasured 절은 자산 선택에 따라 달라지므로 그 앞부분(개수·토큰·내역)만 비교한다.
    return (line ?? "").split(" · 0 external")[0]?.replace(/\)$/, "") ?? "";
  };

  it("화면에 뜨는 상주 항목 수가 baseline·cost:report 와 같은 값이다 (#320 H1)", () => {
    // 계측만 고치고 표면을 두면 **내부는 34, 화면은 23** 이 된다 — 일관되게 틀린 것보다 나쁘다.
    // `residentCost` 를 설치기 spec 으로 부른 것이 이 저장소의 1차 지표 값이고, 화면은 그것과
    // 같아야 한다.
    const truth = residentCost(
      buildManifest(buildManifestSpec(spec)).filter((e) => e.applies(buildManifestSpec(spec))),
    ).items.total;
    const lines: string[] = [];
    renderInstallHeader((m) => lines.push(m), spec);
    const shown = /(\d+) items resident/.exec(lines.join("\n"))?.[1];
    expect(
      shown,
      "설치 헤더가 상주 항목 수를 아예 안 낸다 — 표면이 사라졌거나 문구가 바뀌었다.",
    ).toBeDefined();
    expect(
      Number(shown),
      `설치 헤더가 ${shown}개를 보여주는데 실제 상주는 ${truth}개다 — 설치자에게 나가는 숫자가\n` +
        "1차 지표와 어긋난다(#320 H1: 표면이 selectedInternalSkills 없는 spec 을 쓰면 이 형태가 된다).",
    ).toBe(truth);
    expect(formatSummary(spec)).toContain(`${truth} items resident`);
  });

  it("non-interactive install header prints the context cost line", () => {
    const lines: string[] = [];
    renderInstallHeader((m) => lines.push(m), spec);
    const joined = lines.join("\n");
    expect(joined).toContain("session-start context cost:");
    // v26.117.0 — 총합만 보이면 "스킬 descriptor 만 세던" 10% 과소표기로 조용히 되돌아간다.
    // v26.140.0 — 개수까지 같은 라인으로 도달하는지 (표면 대칭). 포맷 함수 산출물과 대조.
    expect(joined).toContain(expectedLine());
    expect(joined).toContain("items resident");
  });

  it("wizard confirm summary prints the same context cost line", () => {
    const summary = formatSummary(spec);
    expect(summary).toContain("session-start context cost:");
    expect(summary).toContain(expectedLine());
    expect(summary).toContain("items resident");
  });

  it("두 표면이 **같은** 라인을 보여준다 — 표면별 상이 문구 금지", () => {
    // v26.88.0 이중 고지 사고의 교훈이 개수 축에도 그대로 걸린다.
    const lines: string[] = [];
    renderInstallHeader((m) => lines.push(m), spec);
    const fromHeader = lines.join("\n").match(/session-start context cost: [^\n]*/)?.[0];
    const fromWizard = formatSummary(spec).match(/session-start context cost: [^\n]*/)?.[0];
    expect(fromHeader).toBeDefined();
    // 헤더는 dim 이스케이프가 붙으므로 wizard 라인이 헤더 라인에 포함되는지로 본다.
    expect(fromHeader).toContain(expectedLine());
    expect(fromWizard).toContain(expectedLine());
  });
});

/**
 * #476 — 계획(manifest)으로 재는 두 표면(헤더 · wizard confirm)은 그 CLI 조합에서 **디스크에
 * 남는** 것만 센다. codex 단독 설치는 `.claude/` 를 만들지 않는데 서브에이전트를 셌고(tooling:
 * `agents 2 ~192`), 같은 설치의 update 화면(디스크 실측, #458)은 `agents 0 ~0` 을 냈다 — 같은
 * 설치가 화면마다 다른 숫자를 가진다. 기대값은 여기서 손으로 적지 않고 manifest 계획에서 뽑는다.
 */
describe("계획 상주 계측은 CLI 조합에서 디스크에 남는 것만 센다 (#476)", () => {
  const specFor = (cli: ReadonlyArray<string>): InstallSpec =>
    ({
      projectDir: "/tmp/x",
      tracks: ["tooling"],
      cli,
      options: {},
      scope: "project",
    }) as unknown as InstallSpec;
  const headerLine = (spec: InstallSpec): string => {
    const lines: string[] = [];
    renderInstallHeader((m) => lines.push(m), spec);
    return /session-start context cost: [^\n]*/.exec(lines.join("\n"))?.[0] ?? "";
  };
  const plannedAgents = (spec: InstallSpec): number => {
    const a = buildManifestSpec(spec);
    return buildManifest(a).filter((e) => e.applies(a) && e.target.startsWith(".claude/agents/"))
      .length;
  };

  it("codex 단독 — 헤더와 wizard confirm 이 agents 0 ~0 (계획에는 에이전트가 있다 = 대조군)", () => {
    const spec = specFor(["codex"]);
    expect(
      plannedAgents(spec),
      "대조군: 계획에 에이전트가 없으면 이 테스트는 필터가 무는지 못 본다",
    ).toBeGreaterThan(0);
    expect(headerLine(spec)).toContain("agents 0 ~0");
    expect(formatSummary(spec)).toContain("agents 0 ~0");
  });

  it("claude 포함 — 계획의 에이전트 수를 그대로 센다 (기존 동작 보존)", () => {
    const spec = specFor(["claude", "codex"]);
    expect(headerLine(spec)).toContain(`agents ${plannedAgents(spec)} ~`);
    expect(formatSummary(spec)).toContain(`agents ${plannedAgents(spec)} ~`);
  });

  it("landsOnDisk — 룰·스킬은 CLI 무관(AGENTS.md 인라인 · .agents/skills), 에이전트만 claude 에 묶인다", () => {
    expect(landsOnDisk(".claude/rules/x.md", ["codex"])).toBe(true);
    expect(landsOnDisk(".claude/skills/x", ["opencode"])).toBe(true);
    expect(landsOnDisk(".claude/agents/x.md", ["codex"])).toBe(false);
    expect(landsOnDisk(".claude/agents/x.md", ["antigravity"])).toBe(false);
    expect(landsOnDisk(".claude/agents/x.md", ["claude"])).toBe(true);
    expect(landsOnDisk(".claude/agents/x.md", ["codex", "claude"])).toBe(true);
  });
});

/**
 * v26.116.0 (ADR-043 후속 ①) — 발화(fired) 비용 계측 + 순위표.
 *
 * WHY: 1차 NSM `Context Cost per Install` 은 상주(descriptor) + 발화(body) 두 축인데 v26.115.0
 * 시점엔 상주만 계측됐다. 발화 비용이 상주의 10배 이상이라 "얼마나 잡아먹나"의 큰 쪽이 공백이었다.
 * 이 계측이 없으면 keep/drop 판정이 다시 취향으로 돌아간다 (ADR-043 이 막으려는 바로 그것).
 */
describe("fired(body) 비용 계측", () => {
  it("body 토큰은 frontmatter 를 제외한다 — descriptor 와 이중 계상되면 안 된다", () => {
    const root = mkdtempSync(join(tmpdir(), "cost-body-"));
    mkdirSync(join(root, "templates", "skills", "compaction-handoff"), { recursive: true });
    // description 에 긴 문자열을 넣어도 body 값이 오염되지 않아야 한다.
    writeFileSync(
      join(root, "templates", "skills", "compaction-handoff", "SKILL.md"),
      `---\nname: x\ndescription: ${"D".repeat(400)}\n---\n\n${"B".repeat(80)}\n`,
    );
    expect(assetBodyTokens("compaction-handoff", root)).toBe(estimateTokens(80));
    expect(assetDescriptorTokens("compaction-handoff", root)).toBeGreaterThan(100);
  });

  it("frontmatter 가 없으면 파일 전체가 body", () => {
    const root = mkdtempSync(join(tmpdir(), "cost-nofm-"));
    mkdirSync(join(root, "templates", "skills", "compaction-handoff"), { recursive: true });
    writeFileSync(
      join(root, "templates", "skills", "compaction-handoff", "SKILL.md"),
      "# no frontmatter",
    );
    expect(assetBodyTokens("compaction-handoff", root)).toBe(
      estimateTokens("# no frontmatter".length),
    );
  });

  it("외부 자산·미존재 자산은 unmeasured(null) — 추정치를 만들어내지 않는다", () => {
    expect(assetBodyTokens("superpowers")).toBeNull();
    expect(assetBodyTokens("no-such-asset")).toBeNull();
  });

  it("실제 번들 스킬은 body 가 descriptor 보다 크다 — 발화 비용이 지배항이라는 전제", () => {
    // 이 전제가 깨지면(예: body 가 더 작아짐) 순위표를 body 로 정렬하는 근거 자체가 흔들린다.
    for (const id of INTERNAL_BUNDLED_SKILL_IDS) {
      const body = assetBodyTokens(id);
      const desc = assetDescriptorTokens(id);
      expect(body, `${id} body`).not.toBeNull();
      expect(body as number, `${id}: body(${body}) > descriptor(${desc})`).toBeGreaterThan(
        desc as number,
      );
    }
  });
});

describe("비용 순위표", () => {
  it("발화 비용 내림차순 — '무엇부터 검토할 것인가'의 순서", () => {
    const rows = assetCostRows(INTERNAL_BUNDLED_SKILL_IDS);
    expect(rows).toHaveLength(INTERNAL_BUNDLED_SKILL_IDS.length);
    const bodies = rows.map((r) => r.bodyTokens ?? -1);
    expect([...bodies].sort((a, b) => b - a)).toEqual(bodies);
  });

  it("입력 자산을 하나도 빠뜨리지 않는다 — 누락은 순위표를 조용히 거짓으로 만든다", () => {
    const rows = assetCostRows(INTERNAL_BUNDLED_SKILL_IDS);
    expect(new Set(rows.map((r) => r.id))).toEqual(new Set(INTERNAL_BUNDLED_SKILL_IDS));
  });

  it("unmeasured(외부 자산)는 뒤로 밀린다 — 0 으로 취급해 상위에 섞이면 안 된다", () => {
    const rows = assetCostRows(["superpowers", ...INTERNAL_BUNDLED_SKILL_IDS]);
    expect(rows[rows.length - 1]?.id).toBe("superpowers");
    expect(rows[rows.length - 1]?.bodyTokens).toBeNull();
  });
});

/**
 * v26.117.0 (ADR-044) — 상주 비용의 표면 전체.
 *
 * WHY: v26.116.0 까지 상주 = "스킬 descriptor" 였는데, 실측하니 tooling 트랙 상주 ~5,194 중
 * 스킬 descriptor 는 ~547(10%)뿐이었다. rules 가 ~3,094(60%)로 지배항인데 계측 밖이었고,
 * 그 정의는 **굿하트로 뚫린다**: SKILL.md 산문을 룰로 옮기면 발화-시-비용이 매 세션 상주로
 * 바뀌어 실제로는 악화되는데 지표는 개선으로 표시된다. 아래 "이동" 테스트가 그 구멍을 막는다.
 */
describe("상주 비용 — 표면 전체 (ADR-044)", () => {
  const seed = (): string => {
    const root = mkdtempSync(join(tmpdir(), "resident-"));
    mkdirSync(join(root, "templates", "rules"), { recursive: true });
    mkdirSync(join(root, "templates", "skills", "s1"), { recursive: true });
    mkdirSync(join(root, "templates", "agents"), { recursive: true });
    writeFileSync(join(root, "templates", "CLAUDE.md"), "C".repeat(40));
    writeFileSync(join(root, "templates", "rules", "r1.md"), "R".repeat(400));
    writeFileSync(
      join(root, "templates", "skills", "s1", "SKILL.md"),
      `---\nname: s1\ndescription: ${"D".repeat(36)}\n---\n\n${"B".repeat(4000)}\n`,
    );
    writeFileSync(
      join(root, "templates", "agents", "a1.md"),
      `---\nname: a1\ndescription: ${"E".repeat(36)}\n---\n\n${"F".repeat(2000)}\n`,
    );
    return root;
  };
  const entries = [
    { source: "rules/r1.md", target: ".claude/rules/r1.md" },
    { source: "skills/s1", target: ".claude/skills/s1" },
    { source: "agents/a1.md", target: ".claude/agents/a1.md" },
  ];

  it("rules 는 전문이, skills/agents 는 descriptor 만 상주로 계상된다", () => {
    const r = residentCost(entries, seed());
    expect(r.rules).toBe(estimateTokens(400)); // 룰은 통째로 상시 로드
    expect(r.skillDescriptors).toBeLessThan(estimateTokens(4000)); // body 는 상주 아님
    expect(r.agentDescriptors).toBeLessThan(estimateTokens(2000));
    // 앵커(파일 40자) + 스캐폴드(코드 생성물). 스캐폴드분을 상수로 박으면 스캐폴드가 바뀔 때
    // 이 테스트가 조용히 거짓이 된다 — 같은 함수에서 파생시킨다.
    expect(r.projectClaudeMd).toBe(estimateTokens(40) + scaffoldTokens());
    expect(r.total).toBe(r.rules + r.projectClaudeMd + r.skillDescriptors + r.agentDescriptors);
  });

  it("개수는 토큰과 **같은 대상**을 센다 — 표면당 1, CLAUDE.md 는 2 (앵커+스캐폴드)", () => {
    // 두 축이 다른 대상을 세기 시작하면 나란히 놓은 의미가 없다. seed() 는 표면마다 1개씩이고
    // CLAUDE.md 만 2 다 — 설치가 앵커(루트 `CLAUDE-uzys-harness.md`)와 스캐폴드(루트
    // `CLAUDE.md`)를 둘 다 놓는다. 원본은 어느 쪽이든 `templates/CLAUDE.md` 하나다.
    const r = residentCost(entries, seed());
    expect(r.items).toEqual({ rules: 1, skills: 1, agents: 1, claudeMd: 2, total: 5 });
  });

  it("앵커가 없으면 그 몫만 빠진다 — 스캐폴드는 코드 생성물이라 빠질 수 없다", () => {
    // 한쪽 축만 0 으로 떨어지면 그 자체가 drift다 (개수는 세는데 토큰은 0, 또는 그 반대).
    // v26.140.0 까지 이 자리는 앵커만 재면서 라벨은 "스캐폴드"였고, 그래서 스캐폴드는
    // 있으나 없으나 0 이었다. 두 몫을 분리해 각각의 부재를 따로 판정한다.
    const root = mkdtempSync(join(tmpdir(), "resident-noclaude-"));
    mkdirSync(join(root, "templates", "rules"), { recursive: true });
    writeFileSync(join(root, "templates", "rules", "r1.md"), "R".repeat(400));
    const r = residentCost([{ source: "rules/r1.md", target: ".claude/rules/r1.md" }], root);
    expect(r.projectClaudeMd).toBe(scaffoldTokens());
    expect(r.items.claudeMd).toBe(1);
    expect(r.items.total).toBe(2);
  });

  it("스킬 body → 룰로 '이동'하면 상주 비용이 늘어난다 — 굿하트 구멍 차단", () => {
    // 이 단언이 뒤집히면(이동해도 그대로/감소) 지표가 사용자를 나쁘게 만드는 리팩터링을
    // 보상하게 된다. ADR-044 가 존재하는 이유 그 자체.
    const before = residentCost(entries, seed());
    const moved = seed();
    // 같은 산문을 스킬 body 에서 빼서 룰에 붙인 상태.
    writeFileSync(
      join(moved, "templates", "skills", "s1", "SKILL.md"),
      `---\nname: s1\ndescription: ${"D".repeat(36)}\n---\n\nshort\n`,
    );
    writeFileSync(join(moved, "templates", "rules", "r1.md"), "R".repeat(400) + "B".repeat(4000));
    expect(residentCost(entries, moved).total).toBeGreaterThan(before.total);
  });

  it("hooks 는 상주 비용이 아니다 — 실행될 뿐 컨텍스트에 안 올라간다", () => {
    const root = seed();
    const withHook = [...entries, { source: "hooks/h.sh", target: ".claude/hooks/h.sh" }];
    expect(residentCost(withHook, root).total).toBe(residentCost(entries, root).total);
    // 개수 축에서도 마찬가지 — 훅이 늘었다고 상주 항목이 늘면 지표가 엉뚱한 것을 센다.
    expect(residentCost(withHook, root).items.total).toBe(residentCost(entries, root).items.total);
  });

  it("표시 라인이 내역을 드러낸다 — 총합만 보이면 어디가 비싼지 모른다", () => {
    const line = formatResidentCostLine(
      makeResidentCost({
        rules: 3094,
        projectClaudeMd: 938,
        skillDescriptors: 547,
        agentDescriptors: 615,
        items: { rules: 10, skills: 9, agents: 9, claudeMd: 1, total: 29 },
      }),
      52,
    );
    expect(line).toContain("~5194 tokens/session");
    expect(line).toContain("rules 10 ~3094");
    expect(line).toContain("skills 9 ~547");
    expect(line).toContain("52 external assets unmeasured");
    // v26.140.0 — 개수가 **먼저**. 표면마다 순서가 다르면 그 자체가 혼선이다.
    expect(line).toContain("29 items resident");
    expect((line ?? "").indexOf("items resident")).toBeLessThan(
      (line ?? "").indexOf("tokens/session"),
    );
  });

  it("표시 라인이 **두 축을 갈라** 보여준다 (ADR-083)", () => {
    // **독립 리뷰 HIGH 적발.** 이 PR 이 광고한 표시 변경 전체가 무게이트였다 — `parts` 를
    // 이전 형태로 되돌려도, 축 라벨을 아무 문자열로 바꿔도 전 스위트가 초록이었다.
    // 사용자 도달 표면의 주장은 그 표면을 실행해 증명한다(no-false-ship).
    const r = makeResidentCost({
      rules: 1360,
      projectClaudeMd: 2954,
      skillDescriptors: 2799,
      agentDescriptors: 725,
      items: { rules: 6, skills: 17, agents: 9, claudeMd: 2, total: 34 },
    });
    const line = formatResidentCostLine(r, 0) ?? "";
    // 축 이름과 값을 **derive 한 값으로** 대조한다 — 숫자를 손으로 적으면 그게 세 번째 사본이다.
    expect(line, "지시문 축이 표시에서 사라졌다").toContain(
      `directives ${r.directive.items} ~${r.directive.tokens}`,
    );
    expect(line, "발화 표면 축이 표시에서 사라졌다").toContain(
      `triggers ${r.firing.items} ~${r.firing.tokens}`,
    );
    // 축만 있고 내역이 없으면 어디가 비싼지 여전히 모른다.
    expect(line).toContain(`rules ${r.items.rules} ~${r.rules}`);
    expect(line).toContain(`CLAUDE.md ${r.items.claudeMd} ~${r.projectClaudeMd}`);
  });

  it("상주 표가 축 소계를 행으로 낸다 (ADR-083)", () => {
    const r = makeResidentCost({
      rules: 1360,
      projectClaudeMd: 2954,
      skillDescriptors: 2799,
      agentDescriptors: 725,
      items: { rules: 6, skills: 17, agents: 9, claudeMd: 2, total: 34 },
    });
    const block = formatResidentCostBlock(r).join("\n");
    // 소계가 없으면 읽는 사람이 네 줄을 머리로 더해야 하고, 그러면 "무엇을 줄여야 하나"가
    // 표에서 안 보인다 — 축을 가른 이유 자체가 사라진다.
    expect(block, "지시문 소계 행이 없다").toMatch(
      new RegExp(`지시문\\s+${r.directive.items}개\\s+~${r.directive.tokens}`),
    );
    expect(block, "발화 표면 소계 행이 없다").toMatch(
      new RegExp(`발화 표면\\s+${r.firing.items}개\\s+~${r.firing.tokens}`),
    );
    // 축이 무슨 뜻인지 설명이 함께 나가야 한다 — 라벨만으로는 "줄여도 되는 축"이 안 갈린다.
    expect(block, "축 설명 줄이 없다").toContain("깎으면 안 불린다");
  });

  it("자산이 없으면 null", () => {
    expect(
      formatResidentCostLine(
        makeResidentCost({
          rules: 0,
          projectClaudeMd: 0,
          skillDescriptors: 0,
          agentDescriptors: 0,
          items: { rules: 0, skills: 0, agents: 0, claudeMd: 0, total: 0 },
        }),
        0,
      ),
    ).toBeNull();
  });
});

/**
 * v26.140.0 — 상주 비용의 **양(quantity) 축 = 항목 수**.
 *
 * WHY: 1차 NSM 의 양 축을 토큰에서 개수로 바꿨다. ADR-051 실측에서 토큰의 금전 비용은
 * 무의미했지만($2.94/1k요청 · 컨텍스트 0.59%) 실제로 아픈 비용 — 교차참조, 서로 모순되는 지시,
 * 문서 drift, 유지보수 — 는 항목 수에 비례한다. "잘 동작한다"고 판정된 레퍼런스가 15개인데
 * 우리 tooling 이 29개라는 사실은 토큰 수치로는 절대 보이지 않았다.
 *
 * 아래는 상수표를 읽는 게 아니라 **실제 manifest + applies 필터**로 센다 — cost:report ·
 * baseline · ratchet 이 쓰는 것과 같은 경로다. 계측 경로가 갈리면 수치가 갈린다.
 */
/**
 * **계측을 "설치가 실제로 만드는 것"에 묶는다 (#320, 사용자 지시 2026-08-30).**
 *
 * #320 의 원인은 필드 하나를 빠뜨린 것이 아니라 **계측이 설치와 다른 목록을 보고 있었다**는
 * 것이다. 그래서 재발 방지도 "필드를 채웠는지" 확인이 아니라 **두 목록을 맞대는 것**으로 한다 —
 * 새 스킬이 카탈로그에 들어오면 설치분과 계측분이 함께 움직이므로 이 등식은 저절로 최신이 된다.
 * 열거가 없어서 게이트를 고칠 일도 없다.
 *
 * 외부 설치(`runExternal`)는 no-op 으로 둔다 — 그쪽은 설치 시점에 내용을 알 수 없어 의도적으로
 * "미계측"이고(no-false-ship), 섞으면 이 등식이 네트워크 상태에 따라 흔들린다.
 */
describe("상주 계측 ↔ 실제 설치 (#320 재발 방지)", () => {
  const measuredVsInstalled = (
    track: Track,
  ): { measured: number; installed: ReadonlyArray<string>; selected: number } => {
    const projectDir = mkdtempSync(join(tmpdir(), "cost-install-"));
    try {
      const spec = buildAssetSpec({ tracks: [track], options: DEFAULT_OPTIONS });
      runInstall({
        harnessRoot: HARNESS_ROOT_FOR_INSTALL,
        projectDir,
        spec: { tracks: [track], options: DEFAULT_OPTIONS, cli: ["claude"], projectDir },
        mode: "add",
        runExternal: () => ({ attempted: [], succeeded: 0, skipped: 0, excludedByCli: [] }),
      });
      const installed = readdirSync(join(projectDir, ".claude", "skills"), { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .sort();
      const measured = residentCost(buildManifest(spec).filter((e) => e.applies(spec))).items
        .skills;
      return { measured, installed, selected: spec.selectedInternalSkills.length };
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  };

  it.each([
    "executive",
    "tooling",
    "full",
  ] as ReadonlyArray<Track>)("track=%s — 상주 계측이 세는 스킬 수 = 설치가 실제로 만든 스킬 디렉터리 수", (track) => {
    const { measured, installed } = measuredVsInstalled(track);
    expect(
      measured,
      `계측 ${measured}종 ≠ 실설치 ${installed.length}종.\n` +
        `설치된 것: ${installed.join(", ")}\n` +
        "계측 spec 이 설치기와 다른 목록을 보고 있다 — #320 이 정확히 이 형태였다\n" +
        "(계측만 손으로 조립해 selectedInternalSkills 를 안 넘겼고, 번들 스킬이 통째로 빠졌다).",
    ).toBe(installed.length);
  });

  it("모집단이 통째로 비어 통과하는 상태를 막는다 (0 == 0 방지)", () => {
    // **위 등식이 무는 범위를 과장하지 않는다** (독립 리뷰 적발): 등식은 "계측만 설치와
    // 갈리는 것"을 잡는다. `buildAssetSpec` **자체**가 망가지면 계측과 설치가 **함께** 줄어
    // 등식은 초록으로 산다. 그 경우를 실제로 무는 것은 아래 하한 단언과, 그 다음 describe 의
    // **하드코딩된 항목 수 표**(executive · tooling · full)다 — 그 표가 derive 에서
    // 값을 뽑지 않고 손으로 적혀 있다는 것이 여기서는 장점이다.
    const { measured, selected } = measuredVsInstalled("tooling");
    expect(selected, "buildAssetSpec 이 번들 스킬을 하나도 안 고른다").toBeGreaterThan(0);
    // ADR-090 (#452) 이전에는 `measured > selected` 였다 — 카탈로그 엔트리 없이 깔리던 ECC 파생
    // 스킬이 tooling 상주에 섞여 있었기 때문이다. 그 셋이 은퇴해 두 집합이 겹친다.
    expect(measured, "상주 스킬 계측이 0 이다").toBeGreaterThanOrEqual(selected);
  });
});
