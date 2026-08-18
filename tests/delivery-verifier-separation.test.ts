import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// #345 — "구현 주체와 분리된 검증자가 완료를 판정한다"가 배포 룰에서 **조용히 사라졌다.**
//
// 이력: #285 가 배포 룰에 독립 리뷰 문장을 넣었고, #299 가 "앵커가 이미 소유한다"는 근거로
// 걷어냈다. 그 판정은 절반만 맞았다 — 앵커(§5 Verify and Review)는 **머지 시점의 독립 리뷰**를
// 담지만 다음 둘은 담지 않는다:
//   ⓐ **완료를 누가 판정하는가** — 앵커는 리뷰어가 "verifies the work itself"라고만 말한다.
//      판정 주체가 없으면 만든 쪽이 자기 산출물에 완료 도장을 찍는 것이 규칙 위반이 아니게 된다.
//   ⓑ **ship 경계** — 앵커는 "before it is merged"까지다. 배포는 별개 경계이고 이 룰이 소유한다.
//
// 그래서 이 게이트가 무는 것은 **잃으면 결함이 되살아나는 것**뿐이다. 문구 전체를 박제하지
// 않는다 — 표현이 바뀌어도 위 두 성분이 살아 있으면 통과한다.
//
// 왜 게이트가 필요한가: 이 저장소는 룰 본문이 **길이를 유지한 채 의미만 뒤집히는** 형태로
// 손실된 전례가 있고(보안 금지문이 이유절로 격하), 룰 본문을 무는 자리는 세 곳뿐이었다.
// 사용자가 이 문장의 소실을 직접 발견해 이슈로 냈다는 사실 자체가 계측 공백의 증거다.

const read = (p: string) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), "utf8");
const shipped = read("../templates/rules/ship-checklist.md");
const dev = read("../.claude/rules/ship-checklist.md");
const anchor = read("../templates/CLAUDE.md");

describe("#345 — 완료 판정은 만든 레인이 내리지 않는다", () => {
  // 탐지기 자기검증: 모집단이 비면 아래 단언이 전부 저절로 참이 된다.
  it("검사 대상 세 파일을 실제로 읽었다", () => {
    for (const [name, text] of [
      ["templates/rules/ship-checklist.md", shipped],
      [".claude/rules/ship-checklist.md", dev],
      ["templates/CLAUDE.md", anchor],
    ] as const) {
      expect(text.length, `${name} 가 비었다 — 이 게이트가 아무것도 안 본다`).toBeGreaterThan(200);
    }
  });

  it("배포 룰이 **판정 주체**를 지목한다 — 만든 쪽이 아니라 검증자다", () => {
    expect(shipped).toMatch(/검증자가 완료를 판정한다|완료 판정은 만든 (쪽|레인)이 (아닌|아니라)/);
  });

  it("배포 룰이 **보고를 읽고 승인하는 것은 판정이 아니라고** 말한다", () => {
    // 이 줄이 없으면 "검증자가 판정한다"가 결재 도장으로 축소된다 — 이 저장소가 실제로
    // 겪은 형태다(구현자 보고를 그대로 옮겨 적은 완료 보고).
    expect(shipped).toMatch(/직접 다시 확인/);
    expect(shipped).toMatch(/판정이 아니다/);
  });

  it("개발 사본에도 같은 계약이 있다 — 한쪽만 있으면 두 레인이 다른 기준으로 판정한다", () => {
    expect(dev).toMatch(/완료 판정은 만든 레인이 아니라 검증 레인이 내린다/);
    expect(dev).toMatch(/직접 다시 확인/);
  });

  it("앵커는 이 계약을 담지 않는다 — 룰에 두는 근거가 유지되는지 본다", () => {
    // 앵커가 나중에 같은 것을 담게 되면 이 룰 줄은 중복이 되고, 그때 이 테스트가 red 로
    // 알려 준다(중복을 방치하는 것도 이 저장소가 고치는 형태다 — ADR-070).
    expect(anchor).toMatch(
      /Independent review by an agent or person other than the one that produced/,
    );
    expect(anchor).not.toMatch(/verifier (issues|owns) the (completion )?verdict/i);
  });
});
