import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// WHY (v26.122.0): ship 게이트가 todo.md 의 `[ ]` 개수만 세고 **내용을 보지 않아서**
//   "언젠가 할 일(백로그)"과 "이번 사이클에 하기로 해놓고 안 한 것(진짜 drift)"을 구분하지
//   못했다. 백로그는 정상적으로 항상 존재하므로 게이트는 사실상 상시 차단 상태가 되고,
//   그 결과 todo.md 가 "열린 목표는 ship gate drift 를 피하려 비체크박스로 둔다"는 **우회를
//   관행으로 성문화**했다 — 셀 게 없으니 게이트는 아무것도 잡지 못한다.
//
//   해법은 면제 구간 표식이었다. 기본값은 검사, 면제는 표식이 있는 쪽.
//
// ⚠ 2026-08-02 정비 — **훅 `spec-drift-check.sh` 두 사본이 삭제됐다.** 그래서 이 파일에서
//   훅을 실행하던 단언(면제 표식 파싱 · fail-closed · 산문 인용 오인 · 사본 drift · 실 저장소
//   ship 통과)은 **전부 사라졌다.** 검사할 실행체가 없으면 그 단언들은 초록불로 태어난
//   테스트가 되고, 그건 증거가 아니다.
//
//   남은 것은 **문서 상태 게이트 하나**다: `docs/todo.md` 가 우회를 관행으로 지시하지 않고,
//   백로그 구간을 명시 표식으로 구분해 둔다. 이것이 "`docs/todo.md` 는 쉬는 상태 추적기이고
//   열린 사이클은 `docs/plans/*-todo.md` 로 분리한다"는 계약이 **문서 축에서** 남은 형태다.
//   실행 축(미완 항목 개수를 세어 출하를 막는 것)은 지금 아무도 물지 않는다 — 다시 필요해지면
//   훅을 되살리지 말고 이 파일에 TypeScript 게이트로 넣어라(훅은 배선된 적이 없어서 죽었다).

const START = "<!-- ship-gate:ignore-start -->";
const END = "<!-- ship-gate:ignore-end -->";

describe("우회 관행 제거", () => {
  it("docs/todo.md 가 '비체크박스' 우회를 더 이상 지시하지 않는다", () => {
    const todo = readFileSync("docs/todo.md", "utf-8");
    expect(
      todo.includes("비체크박스로 둔다"),
      "todo.md 가 여전히 게이트 우회를 관행으로 지시하고 있다",
    ).toBe(false);
  });

  it("docs/todo.md 의 백로그 구간이 면제 표식으로 감싸여 있다 (단독 줄 기준)", () => {
    const todo = readFileSync("docs/todo.md", "utf-8");
    // 단독 줄만 표식으로 센다 — 산문 인용(백틱으로 감싼 사용법 설명)을 함께 세면 짝이 깨진다.
    // 이 기능을 도입한 커밋에서 실제로 밟은 함정이다.
    const standalone = (marker: string) =>
      todo.split("\n").filter((l) => l.trim() === marker).length;
    const starts = standalone(START);
    expect(
      starts,
      "백로그 면제 표식이 없다 — 어디부터가 '언젠가'인지 문서가 말하지 않는다",
    ).toBeGreaterThan(0);
    expect(standalone(END), "표식이 열리고 닫히지 않았다").toBe(starts);
  });
});
