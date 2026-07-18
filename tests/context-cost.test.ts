import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { renderInstallHeader } from "../src/commands/install-render.js";
import {
  assetBodyTokens,
  assetCostRows,
  assetDescriptorTokens,
  estimateTokens,
  extractFrontmatter,
  formatContextCostLine,
  resolveBundleRoot,
  summarizeContextCost,
} from "../src/context-cost.js";
import { DEV_METHOD_SKILL_IDS, INTERNAL_BUNDLED_SKILL_IDS } from "../src/external-assets.js";
import { formatSummary } from "../src/interactive.js";
import type { InstallSpec } from "../src/types.js";

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
 */
const DEV_METHOD_DESCRIPTOR_BUDGET_TOKENS = 1900;

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
    expect(assetDescriptorTokens("multi-persona-review", root)).not.toBeNull();
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
    const dir = join(root, "templates", "skills", "multi-persona-review");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "SKILL.md"), "---\r\nname: x\r\ndescription: y\r\n---\r\nbody");
    expect(assetDescriptorTokens("multi-persona-review", root) ?? 0).toBeGreaterThan(0);
  });

  it("degrades to null (unmeasured) when SKILL.md has no frontmatter", () => {
    const root = mkdtempSync(join(tmpdir(), "agent-harness-nofm-"));
    const dir = join(root, "templates", "skills", "multi-persona-review");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "SKILL.md"), "no frontmatter body");
    expect(assetDescriptorTokens("multi-persona-review", root)).toBeNull();
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

  it("non-interactive install header prints the context cost line", () => {
    const lines: string[] = [];
    renderInstallHeader((m) => lines.push(m), spec);
    const joined = lines.join("\n");
    expect(joined).toContain("session-start context cost:");
  });

  it("wizard confirm summary prints the same context cost line", () => {
    const summary = formatSummary(spec);
    expect(summary).toContain("session-start context cost:");
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
    mkdirSync(join(root, "templates", "skills", "multi-persona-review"), { recursive: true });
    // description 에 긴 문자열을 넣어도 body 값이 오염되지 않아야 한다.
    writeFileSync(
      join(root, "templates", "skills", "multi-persona-review", "SKILL.md"),
      `---\nname: x\ndescription: ${"D".repeat(400)}\n---\n\n${"B".repeat(80)}\n`,
    );
    expect(assetBodyTokens("multi-persona-review", root)).toBe(estimateTokens(80));
    expect(assetDescriptorTokens("multi-persona-review", root)).toBeGreaterThan(100);
  });

  it("frontmatter 가 없으면 파일 전체가 body", () => {
    const root = mkdtempSync(join(tmpdir(), "cost-nofm-"));
    mkdirSync(join(root, "templates", "skills", "multi-persona-review"), { recursive: true });
    writeFileSync(
      join(root, "templates", "skills", "multi-persona-review", "SKILL.md"),
      "# no frontmatter",
    );
    expect(assetBodyTokens("multi-persona-review", root)).toBe(
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
