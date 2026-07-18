import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// v26.115.0 — recurrence-prevention 스킬의 Level-2 지침 계약.
// 계기: 이 repo 가 같은 문서 사실 drift 를 5회 재발시킨 원인은 "게이트 부재"가 아니라 **게이트를
// 파일 열거로 쓴 것**이었다 (게이트의 커버 목록 자체가 두 번째 하드코딩 사본 → 목록 밖 표면이
// 다음 서식지). 그 교훈이 이 repo 룰(.claude/rules/no-false-ship.md)에만 박제돼 있으면 스킬
// 사용자는 같은 함정을 그대로 반복한다 — 스킬이 Level 2 를 가르치면서 그 대표적 오용법을
// 빼놓는 셈. 마커가 빠지면 "재발방지 방법론 설치됨" 보고가 반쪽 계약을 가리킨다 (no-false-ship).

const read = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

const tpl = read("../templates/skills/recurrence-prevention/SKILL.md");

// 양끝 앵커 — 끝을 안 막으면 뒷절(Pitfalls 등)의 동일 낱말로도 통과한다 (v26.113.0 mutation 실증).
const ladder = (tpl.split("## Step 3a")[1] ?? "").split("## Step 3b")[0] ?? "";

describe("recurrence-prevention — Level 2 게이트 작성 지침", () => {
  it("게이트를 열거가 아닌 훑기(글롭/derive)로 쓰라고 사다리 절에서 가르친다", () => {
    expect(ladder, "Step 3a 섹션 슬라이스가 비었다 — 헤딩 변경 여부 확인").not.toBe("");
    expect(ladder).toMatch(/sweep, not a list/);
    // 기제(글롭 또는 단일출처 derive)를 명시해야 실행 가능한 지침이 된다.
    expect(ladder).toMatch(/glob/);
    expect(ladder).toMatch(/derive/);
  });

  it("면제는 표식으로 주고 기본값은 검사 — 포함목록 큐레이션 금지", () => {
    // 이 방향을 뒤집으면(포함목록 유지) 게이트가 다시 열거로 회귀한다 — 원인 그 자체.
    expect(ladder).toMatch(/default must be checked/);
    expect(ladder).toMatch(/never by\s+curating an inclusion list/);
  });

  it("근거로 실제 재발 횟수를 들고 있다 — 무근거 일반화 금지", () => {
    expect(ladder).toMatch(/five recurrences/);
  });

  it("repo-local .claude 복사본이 템플릿과 byte-동일 (silent drift 가드)", () => {
    expect(read("../.claude/skills/recurrence-prevention/SKILL.md")).toBe(tpl);
  });
});
