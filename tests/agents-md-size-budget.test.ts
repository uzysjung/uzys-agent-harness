/**
 * B-T8 (v26.165.0 · ADR-103) — 렌더한 `AGENTS.md` 가 두 벤더 상한 안에 있다. 벤더 상한에 묶인 **계약 테스트 하나**다.
 *
 * - Antigravity: 룰 파일 하나(공식 문서 "any rule file (AGENTS.md, GEMINI.md, or .agents/rules/*.md)") 24,000 bytes 넘는
 *   부분은 잘린다(docs/rules, 확인 2026-10-11). Antigravity 가 이제 이 파일을 앵커로 읽는다.
 * - Codex: `project_doc_max_bytes` 기본 32 KiB — 합친 크기가 닿으면 거기서 읽기를 멈춘다(ADR-071).
 *
 * 가장 큰 렌더 = 세 CLI 전부 + 전 트랙 룰 + 빈 스캐폴드 + 상시 스킬 안내 전부. **설치자가 채운 Project Context 는 이 수에
 * 들지 않는다** — 넘는 만큼 뒤(`## Protected Files`)부터 잘린다. 이 테스트는 하네스 몫만으로 상한을 넘지 않는지만 문다.
 */

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { withMarkedContinuousSkillsNote } from "../src/agents-md-merge.js";
import { AGENTS_MD_TEMPLATE, renderAgentsMd } from "../src/agents-md-render.js";
import { CONTINUOUS_SKILLS } from "../src/external-assets.js";
import { resolveRules } from "../src/manifest.js";
import { renderFillScaffold } from "../src/project-claude-merge.js";
import { portRules, renderRulesBlock } from "../src/rules-port.js";

const ROOT = resolve(__dirname, "..");

describe("AGENTS.md 크기 — 벤더 상한 (B-T8)", () => {
  it("세 CLI · full 트랙 · 빈 스캐폴드 렌더가 Antigravity 24,000 B 와 Codex 32 KiB 안이다", () => {
    const rules = resolveRules({ tracks: ["full"] });
    expect(rules.length, "모집단 자기검증 — full 트랙 룰이 있어야 한다").toBeGreaterThan(3);
    const out = renderAgentsMd({
      template: readFileSync(join(ROOT, AGENTS_MD_TEMPLATE), "utf8"),
      claudeMd: readFileSync(join(ROOT, "templates/CLAUDE.md"), "utf8"),
      projectName: "a-reasonably-long-project-name",
      projectContext: withMarkedContinuousSkillsNote(
        renderFillScaffold("agents-md"),
        CONTINUOUS_SKILLS.map((s) => s.id),
      ),
      harnessRules: renderRulesBlock(portRules(ROOT, rules)),
      clis: ["codex", "opencode", "antigravity"],
    });
    const bytes = Buffer.byteLength(out, "utf8");
    expect(bytes).toBeLessThan(24_000);
    expect(bytes).toBeLessThan(32 * 1024);
  });
});
