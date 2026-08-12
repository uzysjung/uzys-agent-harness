import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 브라우저 금지문의 **소유자**가 실재하는지.
 *
 * WHY: 2026-08-12 에 `playwright-launch` 룰을 `ui-visual-review` 스킬로 흡수했다(사용자 결정).
 * 룰을 지우는 것은 한 줄이고 금지문을 옮기는 것은 다섯 줄이라, **지우기만 하고 옮기지 않는**
 * 실패가 정확히 이 지점에서 일어난다. 이 저장소가 한 번 겪은 형태다 — 리뷰 반영 중 보안 금지문이
 * 절차문으로 격하돼 소멸했고 전 스위트가 초록이었다(메모리 `feedback_softening_can_delete`).
 *
 * 그래서 이 게이트는 "룰이 없다"가 아니라 **"금지가 어딘가에 살아 있다"**를 문다. 옮긴 곳이
 * 스킬이므로 스킬 본문을 읽는다.
 */

const ROOT = resolve(__dirname, "..");
const SKILL = join(ROOT, "templates/skills/ui-visual-review/SKILL.md");

/**
 * 룰이 담고 있던 금지 4종.
 *
 * needle 은 **그 금지문에만 있는 문자열**이어야 한다. 첫 판은 `chrome-devtools`·`입력`·
 * `page.goto` 를 썼는데 셋 다 스킬 본문 다른 곳(런처 예제·절차 설명)에 이미 있어서, 금지문을
 * 통째로 지워도 4개 중 3개가 **green 이었다**(독립 검증 H-1 이 변이로 실증). 흔한 토큰을 고르면
 * 게이트가 장식이 된다 — 아래 `자기검증` 테스트가 그 조건을 매번 다시 확인한다.
 */
const PROHIBITIONS = [
  { label: "활성 Chrome attach", needle: "사용자 활성 Chrome 에 attach" },
  { label: "일회성 context", needle: "일회성 browser context" },
  { label: "사용자 입력 중 자동화 동시 실행", needle: "키를 입력하는 동안 자동화 process" },
  { label: "reference SaaS 측 이동", needle: "reference SaaS" },
];

describe("브라우저 금지문의 소유자", () => {
  it("룰은 사라졌다 — 되살아나면 상주 층이 다시 늘어난다", () => {
    expect(existsSync(join(ROOT, "templates/rules/playwright-launch.md"))).toBe(false);
  });

  it("탐지기 자기검증 — needle 이 금지문 줄에만 있다 (장식 게이트 방지)", () => {
    // 금지 절 밖에서도 잡히는 needle 은 그 금지문을 지워도 green 이다. 한 번 그렇게 새서
    // 4개 중 3개가 장식이었다(H-1). 매번 다시 잰다: 각 needle 이 문서 전체에서 **1회**만 나오고,
    // 그 1회가 금지 목록 블록 안이어야 한다.
    const body = readFileSync(SKILL, "utf8");
    const block = body.split(/##+\s*절대 금지/)[1]?.split(/\n##+\s/)[0] ?? "";
    expect(block, "금지 블록을 못 잘랐다 — 아래 단언이 공허해진다").not.toHaveLength(0);
    for (const { label, needle } of PROHIBITIONS) {
      const hits = body.split(needle).length - 1;
      expect(hits, `${label}: needle '${needle}' 이 문서에 ${hits}회 — 1회여야 한다`).toBe(1);
      expect(block, `${label}: needle 이 금지 블록 밖에 있다`).toContain(needle);
    }
  });

  it("금지 4종이 스킬 본문에 살아 있다", () => {
    const body = readFileSync(SKILL, "utf8");
    for (const { label, needle } of PROHIBITIONS) {
      expect(body, `금지문 소실: ${label}`).toContain(needle);
    }
    // 금지문은 **금지문으로** 남아야 한다. 절차 설명의 이유절로 내려가면 그 절차를 지킨 경로로
    // 들어오는 위반을 아무것도 막지 않는다.
    expect(body, "금지 절 제목이 없다 — 금지가 절차 산문에 녹아버렸을 수 있다").toMatch(
      /##+\s*절대 금지/,
    );
  });

  it("스킬 description 이 **브라우저를 열기 전에** 읽히도록 트리거한다", () => {
    // 룰이 상주했던 유일한 이유가 "위반은 작업 도중에 일어나서 스킬 발화를 기다리면 늦다" 였다.
    // 스킬로 옮긴 이상 그 위험은 description 이 흡수해야 한다 — 늦게 발화하면 흡수 실패다.
    const front = readFileSync(SKILL, "utf8").split("---")[1] ?? "";
    expect(front, "description 에 '열기 전' 트리거가 없다").toMatch(/BEFORE opening a browser/i);
    expect(front, "'버벅인다' 진입점이 description 에서 빠졌다").toMatch(/laggy|slow/i);
  });
});
