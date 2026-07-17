import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { extractFrontmatter, resolveBundleRoot } from "../src/context-cost.js";
import { INTERNAL_BUNDLED_SKILL_IDS } from "../src/external-assets.js";

/**
 * v26.103.0 (ADR-032) — 스킬 트리거 중복 게이트.
 *
 * WHY: 컨텍스트 잠식의 실체는 descriptor 상주비용(작음)보다 **유사 스킬 간 라우팅 혼란**(큼).
 * 두 번들 스킬의 트리거 description 이 과도하게 겹치면 모델이 어느 쪽을 발화할지 흔들리고
 * 왕복이 늘어난다. 개수 상한 대신, description 유사도가 임계를 넘는 **새 쌍**을 차단한다.
 *
 * 실측 2026-07-17 (10종 45쌍): 최대 0.190 (gemini-consult ↔ codex-consult — 분업이 명문화된
 * 의도적 자매 스킬). 임계 0.30 = 현재 최대의 ~1.6배 — 기존 쌍은 전부 통과하며, 새 스킬이
 * 기존 스킬과 이 이상 겹치면 description 을 분리(경계 명시)하거나 ALLOWLIST 에 사유와 함께
 * 등재해야 한다.
 */
const JACCARD_THRESHOLD = 0.3;

/** 임계 초과가 의도적인 쌍 — 등재 시 반드시 사유를 남겨라. (2026-07-17 현재 없음) */
const ALLOWLIST: ReadonlyArray<{ a: string; b: string; reason: string }> = [];

const STOPWORDS = new Set(
  "the a an and or for of to in on with use when this that is are it its via then from by as into your you we our not no".split(
    " ",
  ),
);

function descriptionOf(skillId: string, root: string): string {
  const content = readFileSync(join(root, "templates", "skills", skillId, "SKILL.md"), "utf8");
  const fm = extractFrontmatter(content);
  if (!fm) return "";
  const m = fm.match(/description:\s*(?:>-?\s*)?([\s\S]*?)(?=\n[a-zA-Z_-]+:|$)/);
  return m?.[1]?.replace(/\s+/g, " ").trim() ?? "";
}

function triggerTokens(description: string): Set<string> {
  return new Set(
    description
      .toLowerCase()
      .split(/[^a-z0-9가-힣]+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  const inter = [...a].filter((x) => b.has(x)).length;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

describe("bundled skill trigger overlap gate (ADR-032)", () => {
  const root = resolveBundleRoot();
  const skills = INTERNAL_BUNDLED_SKILL_IDS.map((id) => ({
    id,
    tokens: triggerTokens(descriptionOf(id, root)),
  }));

  it("every bundled skill has a non-trivial trigger description", () => {
    for (const s of skills) {
      expect(s.tokens.size, `${s.id} trigger description too thin to route on`).toBeGreaterThan(5);
    }
  });

  it("no un-allowlisted pair exceeds the similarity threshold", () => {
    const offenders: string[] = [];
    for (let i = 0; i < skills.length; i++) {
      const a = skills[i];
      if (!a) continue;
      for (let j = i + 1; j < skills.length; j++) {
        const b = skills[j];
        if (!b) continue;
        const sim = jaccard(a.tokens, b.tokens);
        const allowed = ALLOWLIST.some(
          (p) => (p.a === a.id && p.b === b.id) || (p.a === b.id && p.b === a.id),
        );
        if (sim > JACCARD_THRESHOLD && !allowed) {
          offenders.push(`${a.id} <-> ${b.id} (jaccard ${sim.toFixed(3)})`);
        }
      }
    }
    expect(
      offenders,
      `트리거 description 이 과도하게 겹치는 쌍 발견 — 경계를 description 에 명시해 분리하거나, ` +
        `의도적이면 ALLOWLIST 에 사유와 함께 등재하라:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});
