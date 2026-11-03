/**
 * B-T8 (v26.165.0 · ADR-103) — 렌더한 `AGENTS.md` 가 두 벤더 상한 안에 있다. 벤더 상한에 묶인 **계약 테스트 하나**다.
 *
 * - Antigravity: 룰 파일 하나(공식 문서 "any rule file (AGENTS.md, GEMINI.md, or .agents/rules/*.md)") 24,000 bytes 넘는
 *   부분은 잘린다(docs/rules, 확인 2026-10-11). Antigravity 가 이제 이 파일을 앵커로 읽는다.
 * - Codex: `project_doc_max_bytes` 기본 32 KiB — 합친 크기가 닿으면 거기서 읽기를 멈춘다(ADR-071).
 *
 * 재는 렌더 = 그 집합의 CLI + 그 트랙의 룰 + 빈 스캐폴드 + 상시 스킬 안내 전부. **설치자가 채운 Project Context 는 이 수에
 * 들지 않는다** — 넘는 만큼 뒤부터 잘리고, 뒤는 `## Harness Rules`(룰 사본)다(#944 · ADR-116). 이 테스트는 하네스 몫만으로
 * 상한을 넘지 않는지, 넘을 때 잘리는 것이 룰 사본뿐인지를 문다.
 */

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { withMarkedContinuousSkillsNote } from "../src/agents-md-merge.js";
import { AGENTS_MD_TEMPLATE, type AgentsMdCli, renderAgentsMd } from "../src/agents-md-render.js";
import { CONTINUOUS_SKILLS } from "../src/external-assets.js";
import { resolveRules } from "../src/manifest.js";
import { renderFillScaffold } from "../src/project-claude-merge.js";
import { portRules, renderRulesBlock } from "../src/rules-port.js";
import { TRACKS, type Track } from "../src/types.js";

const ROOT = resolve(__dirname, "..");
const ANTIGRAVITY_LIMIT = 24_000;
const TEMPLATE = readFileSync(join(ROOT, AGENTS_MD_TEMPLATE), "utf8");
const TEMPLATE_SECTIONS = new Set([...TEMPLATE.matchAll(/^## (.+)$/gm)].map((m) => m[1] ?? ""));

function render(
  tracks: ReadonlyArray<Track>,
  clis: ReadonlyArray<AgentsMdCli>,
  rulesViaInstructions = false,
): string {
  const rules = resolveRules({ tracks: [...tracks] });
  expect(rules.length, "모집단 자기검증 — 트랙 룰이 있어야 한다").toBeGreaterThan(2);
  return renderAgentsMd({
    template: TEMPLATE,
    claudeMd: readFileSync(join(ROOT, "templates/CLAUDE.md"), "utf8"),
    projectName: "a-reasonably-long-project-name",
    projectContext: withMarkedContinuousSkillsNote(
      renderFillScaffold("agents-md"),
      CONTINUOUS_SKILLS.map((s) => s.id),
    ),
    harnessRules: renderRulesBlock(portRules(ROOT, rules)),
    clis,
    rulesViaInstructions,
  });
}

/** 바이트 단위 — `## Harness Rules` 절의 [시작, 끝). 절이 없으면 null. 끝 = 다음 템플릿 절 또는 파일 끝. */
function rulesSpan(text: string): { start: number; end: number; total: number } | null {
  const lines = text.split("\n");
  let offset = 0;
  let start = -1;
  let end = -1;
  for (const line of lines) {
    const name = /^## (.+?)\s*$/.exec(line)?.[1];
    if (name !== undefined && TEMPLATE_SECTIONS.has(name)) {
      if (start !== -1 && end === -1) end = offset;
      if (name === "Harness Rules") start = offset;
    }
    offset += Buffer.byteLength(line, "utf8") + 1;
  }
  const total = Buffer.byteLength(text, "utf8");
  if (start === -1) return null;
  return { start, end: end === -1 ? total : end, total };
}

/**
 * Antigravity 가 24,000 B 에서 자를 때 잃는 바이트 중 **룰 사본이 아닌 것**의 수 — 0 이어야 한다. 룰 사본은 Antigravity 가
 * `.agents/rules/` 로 따로 받는다(그 밖의 설치자 절 · `Protected Files` 는 다른 데서 못 받는다).
 */
function lostOutsideRules(text: string): number {
  const span = rulesSpan(text);
  const total = Buffer.byteLength(text, "utf8");
  if (total <= ANTIGRAVITY_LIMIT) return 0;
  const lost = total - ANTIGRAVITY_LIMIT;
  if (span === null) return lost;
  const lostRules = Math.max(0, span.end - Math.max(span.start, ANTIGRAVITY_LIMIT));
  return lost - lostRules;
}

const PAIRS: Array<[Track, Track]> = TRACKS.flatMap((a, i) =>
  TRACKS.slice(i + 1).map((b): [Track, Track] => [a, b]),
);

describe("AGENTS.md 크기 — 벤더 상한 (B-T8)", () => {
  // #935 — `full` 이 가장 큰 렌더라는 전제는 #820 부터 참이 아니다: htmx 화면 룰은 `full` 에 없고 그 트랙에만 간다.
  //   트랙마다 잰다. `full` 과 htmx 트랙을 함께 고른 조합은 24,000 B 를 넘는다 — 아래 두 트랙 게이트가 그때 잘리는 것을 문다.
  it.each([
    ...TRACKS,
  ])("세 CLI · %s 트랙 · 빈 스캐폴드 렌더가 Antigravity 24,000 B 와 Codex 32 KiB 안이다", (track) => {
    const bytes = Buffer.byteLength(render([track], ["codex", "opencode", "antigravity"]), "utf8");
    expect(bytes).toBeLessThan(ANTIGRAVITY_LIMIT);
    expect(bytes).toBeLessThan(32 * 1024);
  });

  it("탐지기 자기검증 — 두 트랙 조합 중 24,000 B 를 넘는 렌더가 실재한다(없으면 아래 '잘리는 것은 룰뿐' 이 공허하다)", () => {
    const over = PAIRS.filter(
      (p) => Buffer.byteLength(render(p, ["codex", "opencode", "antigravity"]), "utf8") > 24_000,
    );
    expect(over.length).toBeGreaterThan(0);
    // 잴 줄 아는지 — 넘는 렌더에서 잘리는 바이트가 실제로 있다
    const [first] = over;
    if (first === undefined) throw new Error("unreachable");
    const out = render(first, ["codex", "opencode", "antigravity"]);
    expect(rulesSpan(out)).not.toBeNull();
  });

  // #944 (ADR-116) — Codex 가 있으면 룰은 인라인이고 `## Harness Rules` 는 맨 끝이다. 그 앞(하네스 몫 + 빈 스캐폴드)이 24,000 B
  //   안이고, 넘는 만큼 잘리는 것은 룰 사본뿐이다. 순서를 되돌리면(룰이 `Protected Files` 앞) 여기서 red.
  const WITH_CODEX: ReadonlyArray<ReadonlyArray<AgentsMdCli>> = [
    ["codex", "antigravity"],
    ["codex", "opencode", "antigravity"],
  ];
  for (const clis of WITH_CODEX) {
    it.each(
      PAIRS,
    )(`${clis.join("+")} · %s + %s — 룰 앞 바이트 < 24,000 · 잘리는 것은 룰 사본뿐`, (a, b) => {
      const out = render([a, b], clis);
      const span = rulesSpan(out);
      expect(span, "인라인 룰 절이 있다").not.toBeNull();
      expect(span?.start ?? Number.POSITIVE_INFINITY).toBeLessThan(ANTIGRAVITY_LIMIT);
      expect(lostOutsideRules(out)).toBe(0);
    });
  }

  // #944 — Codex 가 없으면(포인터 · Antigravity 단독) 파일 전체가 24,000 B 안이다. 포인터가 못 서는 실행(인라인 폴백)도 잘리는
  //   것은 룰 사본뿐이다.
  it.each(
    PAIRS,
  )("opencode+antigravity(포인터) · antigravity 단독 · %s + %s — 파일 전체 < 24,000", (a, b) => {
    for (const out of [
      render([a, b], ["opencode", "antigravity"], true),
      render([a, b], ["antigravity"]),
    ]) {
      expect(Buffer.byteLength(out, "utf8")).toBeLessThan(ANTIGRAVITY_LIMIT);
    }
    expect(lostOutsideRules(render([a, b], ["opencode", "antigravity"]))).toBe(0);
  });
});
