import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// 2026-08-26 (#357, 사용자 결정) — **스킬 본문의 뜻을 코드가 판정하지 않는다.**
//
// 이 파일은 원래 recurrence-prevention 스킬이 Level-2 지침("게이트는 열거가 아니라 훑기로")을
// 가르치는지 영문 어절로 검사했다 — `sweep, not a list` · `glob` · `derive` ·
// `default must be checked` · `never by curating an inclusion list` · `five recurrences` 6종.
//
// 그 방식은 #345 에서 세 라운드에 걸쳐 수렴하지 않는 것이 측정됐다. 어절을 고정하면 **같은 뜻의
// 정당한 개정이 빨간불**이 되고("sweep" 을 다른 낱말로 다시 쓰면 막힌다), 그 어절을 남긴 채
// 옆 문장을 뒤집으면 **뜻이 반대가 돼도 초록불**이다. 양쪽으로 다 틀리는 검사는 없느니만 못하다
// — 초록불이 "스킬이 제대로 가르친다"는 증거로 읽히기 때문이다.
//
// 재발 방지는 이제 변경 이력이 맡는다: 룰·스킬·훅은 개별 독립 자산이고, 자기 변경 요청 없이는
// 건드리지 않으며, 바꿀 때 이유와 이슈 번호를 커밋에 남긴다
// (`.claude/rules/change-management.md` §자산은 자기 변경 요청 없이 건드리지 않는다).
//
// 남긴 단언은 **돌려서 판정되는 것 하나**다. 두 사본이 바이트 동일한지는 본문의 뜻을 읽지 않고
// 답이 나오고, 어긋나면 "스킬 주입됨" 보고와 실제 세션 동작이 갈라진다.

const read = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

describe("recurrence-prevention 스킬", () => {
  it("repo-local .claude 복사본이 템플릿과 byte-동일 (silent drift 가드)", () => {
    expect(read("../.claude/skills/recurrence-prevention/SKILL.md")).toBe(
      read("../templates/skills/recurrence-prevention/SKILL.md"),
    );
  });
});
