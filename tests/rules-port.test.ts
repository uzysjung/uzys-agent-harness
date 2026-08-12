import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { portRules, renderRulesBlock, stripClaudeFrontmatter } from "../src/rules-port.js";

/**
 * 룰을 비 Claude CLI 로 옮길 때의 **변환 규칙**.
 *
 * WHY: 첫 판은 변환에 게이트가 하나도 없었다 — 프론트매터를 안 벗기거나 h1 을 그대로 둬도
 * 전 스위트가 green 이었다(독립 검증 L-2 가 변이로 실증). 둘 다 조용한 파손이다: `paths:` 가
 * `AGENTS.md` 한복판에 노출되고, h1 이 여러 개인 문서가 만들어진다.
 */

const ROOT = resolve(import.meta.dirname, "..");
const RULES_DIR = join(ROOT, "templates/rules");
const ALL = readdirSync(RULES_DIR)
  .filter((f) => f.endsWith(".md"))
  .map((f) => f.replace(/\.md$/, ""));

describe("stripClaudeFrontmatter", () => {
  it("Claude 전용 frontmatter 를 벗긴다", () => {
    const src = '---\npaths:\n  - "**/*.sh"\n---\n\n# Shell Safety\n\n본문\n';
    expect(stripClaudeFrontmatter(src)).toBe("# Shell Safety\n\n본문");
  });

  it("frontmatter 가 없으면 본문을 그대로 둔다", () => {
    expect(stripClaudeFrontmatter("# Git Safety\n\n본문\n")).toBe("# Git Safety\n\n본문");
  });

  it("닫히지 않은 frontmatter 를 본문으로 오인해 잘라내지 않는다", () => {
    // `---` 로 시작하지만 닫히지 않은 문서를 통째로 삼키면 룰 하나가 통째로 사라진다.
    const broken = "---\npaths: 어쩌고\n\n# 제목\n";
    expect(stripClaudeFrontmatter(broken)).toContain("# 제목");
  });
});

describe("portRules — 배포 룰 전량", () => {
  it("탐지기 자기검증: 룰이 실재하고 그중 하나는 frontmatter 를 갖고 있다", () => {
    expect(ALL.length).toBeGreaterThan(3);
    const withFrontmatter = ALL.filter((n) =>
      readFileSync(join(RULES_DIR, `${n}.md`), "utf8").startsWith("---\n"),
    );
    // 하나도 없으면 아래 "노출 0" 단언이 공허하게 통과한다.
    expect(withFrontmatter.length, "frontmatter 를 가진 룰이 없다 — 변환 검사가 무의미해진다").toBe(
      1,
    );
  });

  it("이식된 본문 어디에도 frontmatter 구분자가 남지 않는다", () => {
    for (const { name, body } of portRules(ROOT, ALL)) {
      expect(body.startsWith("---"), `${name}: frontmatter 가 안 벗겨졌다`).toBe(false);
      expect(body).not.toContain("\npaths:");
    }
  });

  it("원본에 없는 이름은 조용히 건너뛴다 (설치를 세우지 않는다)", () => {
    expect(portRules(ROOT, ["없는-룰", ...ALL]).length).toBe(ALL.length);
  });
});

describe("renderRulesBlock — AGENTS.md 에 끼울 한 덩어리", () => {
  it("h1 을 h2 로 낮춘다 — 파일 경계가 사라지므로 h1 이 여러 개면 구조가 무너진다", () => {
    const block = renderRulesBlock(portRules(ROOT, ALL));
    const h1 = block.split("\n").filter((l) => /^#\s/.test(l));
    expect(h1, `h1 이 ${h1.length}개 남았다: ${h1.join(" · ")}`).toHaveLength(0);
    // 룰 수만큼 h2 제목이 있어야 한다 — 하나라도 삼켜지면 그 룰이 통째로 안 들어간 것이다.
    const h2 = block.split("\n").filter((l) => /^##\s/.test(l));
    expect(h2.length).toBeGreaterThanOrEqual(ALL.length);
  });

  it("빈 목록이면 빈 문자열 — 구분선만 남은 덩어리를 만들지 않는다", () => {
    expect(renderRulesBlock([])).toBe("");
  });
});
