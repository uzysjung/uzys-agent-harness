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
  formatResidentCostLine,
  residentCost,
  resolveBundleRoot,
  summarizeContextCost,
} from "../src/context-cost.js";
import { DEV_METHOD_SKILL_IDS, INTERNAL_BUNDLED_SKILL_IDS } from "../src/external-assets.js";
import { runInstall } from "../src/installer.js";
import { formatSummary } from "../src/interactive.js";
import { buildAssetSpec, buildManifest } from "../src/manifest.js";
import { renderFillScaffold } from "../src/project-claude-merge.js";
import { DEFAULT_OPTIONS, type InstallSpec, TRACKS, type Track } from "../src/types.js";

const HARNESS_ROOT_FOR_INSTALL = resolve(__dirname, "..");

/** 상주 CLAUDE.md 중 스캐폴드 몫. 파일이 아니라 생성물이라 어떤 root 에서도 같다. */
const scaffoldTokens = (): number => estimateTokens(renderFillScaffold().trim().length);

/**
 * v26.103.0 (ADR-032) — Session-Start Context Cost ratchet.
 *
 * WHY: NORTH_STAR NSM "Session-Start Context Cost" — "간결"은 슬로건이 아니라 계측 대상.
 * dev 트랙 기본 설치(dev-method 전 종)의 descriptor 비용이 조용히 불어나는 것을 차단한다.
 * 예산 상향은 금지가 아니라 **명시적 정당화**(PR 본문 + 이 상수 갱신)를 요구하는 ratchet.
 *
 * 실측 2026-07-17: dev-method 8종 = ~1,872 tokens. 예산 = 2,000 (여유 ~7%).
 * 실측 2026-07-18: + recurrence-prevention (9번째, ADR-033 사용자 지시 자산) = ~2,096 tokens.
 * 예산 = 2,200 (여유 ~5%) — 자산 1종 추가에 따른 명시적 상향. 설명 확장만으로 넘으면 줄여라.
 * 실측 2026-07-18 (ADR-034): model-orchestration 이 수단(권장) opt-in 으로 이동 → 코어 8종 =
 * ~1,809 tokens. 예산 = 1,900 으로 재조임 (ratchet — 줄었으면 예산도 낮춘다).
 * 실측 2026-08-02 (ADR-060): 방법론 7종이 uzysjung/uzys-agent-skills 로 이관돼 번들 코어는
 * compaction-handoff 1종 = ~124 tokens. 예산 = 150 으로 재조임 (같은 ratchet 규칙 —
 * 아래 "budget is honest" 가 실측 ×1.25 를 넘는 예산을 거절한다).
 * 실측 2026-08-02 (ADR-062, 복원): 이관이 되돌려져 코어 6종 = ~1,415 tokens
 * (compaction-handoff 124 · clear-korean-communication 362 · audit-service-gaps 298 ·
 * multi-persona-review 217 · recurrence-prevention 243 · verification-loop 171).
 * 예산 = 1,500 (여유 ~6%). **명시적 상향의 근거**: 자산 1종 → 6종이라는 도달 범위 변화이지
 * 설명 확장이 아니다. 종당 평균 ~236 은 이관 전 8종 시절(~226/종, v26.103.0 실측 1,809/8)과
 * 같은 자릿수다 — description 이 원본 verbatim 트리거 발화를 되찾았는데도 종당 비용은
 * 안 불었다는 뜻이라 이 상향은 "스킬이 늘어난 만큼"에 그친다.
 */
const DEV_METHOD_DESCRIPTOR_BUDGET_TOKENS = 1500;

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

describe("session-start context cost ratchet (NSM, ADR-032)", () => {
  it("dev-method core descriptor cost stays within budget", () => {
    const s = summarizeContextCost([...DEV_METHOD_SKILL_IDS]);
    expect(s.unmeasuredCount).toBe(0);
    expect(
      s.measuredTokens,
      `dev-method descriptor cost ~${s.measuredTokens} exceeds budget ${DEV_METHOD_DESCRIPTOR_BUDGET_TOKENS} — ` +
        "새 스킬/설명 확장이 기본 설치 컨텍스트를 불렸다. 줄이거나, 예산 상향을 PR 에서 명시적으로 정당화하라 (ADR-032)",
    ).toBeLessThanOrEqual(DEV_METHOD_DESCRIPTOR_BUDGET_TOKENS);
  });

  it("budget is honest — not pre-inflated far above actual cost", () => {
    // ratchet 이 의미를 가지려면 예산이 실측 근처여야 한다 (실측 ×1.25 이내).
    const s = summarizeContextCost([...DEV_METHOD_SKILL_IDS]);
    expect(
      DEV_METHOD_DESCRIPTOR_BUDGET_TOKENS,
      `예산(${DEV_METHOD_DESCRIPTOR_BUDGET_TOKENS})이 실측(~${s.measuredTokens})보다 25% 넘게 높다 — ` +
        "descriptor 를 줄였다면 예산도 실측 근처로 낮춰 ratchet 을 다시 조여라 (ADR-032)",
    ).toBeLessThanOrEqual(Math.ceil(s.measuredTokens * 1.25));
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
   */
  const expectedLine = (): string => {
    const entries = buildManifest(spec).filter((e) => e.applies(spec));
    const line = formatResidentCostLine(residentCost(entries), 0);
    // unmeasured 절은 자산 선택에 따라 달라지므로 그 앞부분(개수·토큰·내역)만 비교한다.
    return (line ?? "").split(" · 0 external")[0]?.replace(/\)$/, "") ?? "";
  };

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
      {
        rules: 3094,
        projectClaudeMd: 938,
        skillDescriptors: 547,
        agentDescriptors: 615,
        total: 5194,
        items: { rules: 10, skills: 9, agents: 9, claudeMd: 1, total: 29 },
      },
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

  it("자산이 없으면 null", () => {
    expect(
      formatResidentCostLine(
        {
          rules: 0,
          projectClaudeMd: 0,
          skillDescriptors: 0,
          agentDescriptors: 0,
          total: 0,
          items: { rules: 0, skills: 0, agents: 0, claudeMd: 0, total: 0 },
        },
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
    // 위 등식은 derive **자체**가 망가져 양쪽이 함께 0 이 되면 초록으로 통과한다.
    const { measured, selected } = measuredVsInstalled("tooling");
    expect(selected, "buildAssetSpec 이 번들 스킬을 하나도 안 고른다").toBeGreaterThan(0);
    expect(measured, "상주 스킬 계측이 0 이다").toBeGreaterThan(selected);
  });
});

describe("상주 항목 수 (quantity 축)", () => {
  const count = (track: string): ReturnType<typeof residentCost>["items"] => {
    const spec = buildAssetSpec({ tracks: [track as Track], options: DEFAULT_OPTIONS });
    return residentCost(buildManifest(spec).filter((e) => e.applies(spec))).items;
  };

  // 최소(executive) · 중간(tooling) · 최대(full). 값이 바뀌면 그 자체가 검토 대상이다 —
  // 늘었으면 정당화를, 줄었으면 여기와 baseline 을 함께 낮춰라.
  // 2026-08-02 정비 (ADR-060) — 스킬 축이 줄었다: 방법론 스킬 이관으로 번들 dir 이 14개
  //   사라졌고(전 트랙 상주였던 north-star·gh-issue-workflow 포함) 그만큼 상주 항목이 빠진다.
  //   설치 자체가 없어진 게 아니라 `.claude/skills/` 상주에서 npx 설치로 **경로가 바뀐 것**이다.
  //   2026-08-02 룰·훅 다이어트 — 룰 축이 전 트랙 1 줄었다: `gates-taxonomy` 를 COMMON_RULES 에서
  //   뺐다(게이트 4유형 어휘표 = 모델 기지식). 훅은 상주가 아니라 이 표에 영향이 없다.
  it.each([
    ["executive", { rules: 3, skills: 11, agents: 5, claudeMd: 2, total: 21 }],
    ["tooling", { rules: 6, skills: 17, agents: 9, claudeMd: 2, total: 34 }],
    // 2026-08-12 — `playwright-launch` 가 `ui-visual-review` 스킬로 흡수돼 UI 트랙 룰이 0이 됐다.
    // full 의 룰이 7 → 6 이고 총합도 하나 준다 (스킬 수는 그대로 — 흡수된 곳이 이미 있던 스킬이다).
    ["full", { rules: 6, skills: 25, agents: 9, claudeMd: 2, total: 42 }],
  ] as const)("track=%s 의 상주 항목 수가 실측과 일치한다", (track, expected) => {
    expect(count(track)).toEqual(expected);
  });

  it("합계는 표면 4개의 합이다 — 어느 표면이 빠져도 합계가 조용히 맞으면 안 된다", () => {
    for (const track of TRACKS) {
      const c = count(track);
      expect(c.total, `track=${track}`).toBe(c.rules + c.skills + c.agents + c.claudeMd);
      expect(c.total, `track=${track} 상주 항목이 0 이면 계측이 죽은 것이다`).toBeGreaterThan(0);
    }
  });

  it("트랙마다 항목 수가 다르다 — 트랙 무관 상수를 세고 있지 않다는 대조", () => {
    // count() 가 manifest 대신 고정 목록을 세면 모든 트랙이 같은 값이 되고, 위 표는 여전히
    // 통과할 수 있다(한 트랙만 맞으면 되는 게 아니라 셋 다 맞아야 하지만 상수 세 개면 그만).
    expect(new Set(TRACKS.map((t) => count(t).total)).size).toBeGreaterThan(1);
  });
});
