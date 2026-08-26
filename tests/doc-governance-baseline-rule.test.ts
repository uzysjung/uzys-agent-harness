import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// 2026-08-26 (사용자 결정) — **룰 본문의 뜻을 코드가 판정하지 않는다.**
//
// 이 파일은 원래 doc-governance 룰이 특정 문장들을 담고 있는지 정규식으로 검사했다
// (미완 표기 해석 · 심볼≠완료 · 기본값 · 임계값 금지 · 서사 금지 = 산문 단언 5종).
// 그 방식은 #345 에서 세 라운드에 걸쳐 수렴하지 않는 것이 측정됐다 — 조이면 정당한
// 동의어 개정이 막히고, 풀면 의미 반전이 샌다.
//
// **룰이 왜 바뀌었는지는 git 이 기록하고, 뜻이 옳은지는 리뷰어가 본다.**
// 룰·스킬·훅은 개별 독립 자산이라 **자기 변경 요청 없이는 건드리지 않는다**(change-management).
//
// 남긴 것은 산문이 아니라 **구조**다 — 두 사본이 갈라지면 이 저장소가 자기가 파는 규약과
// 다른 것을 쓰게 되고, 그건 정규식 없이 바이트 비교로 판정된다.

const read = (p: string) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), "utf8");

describe("doc-governance — 배포판과 도그푸딩 사본의 동기화", () => {
  it("templates 와 설치본(.claude) 이 1:1 이다", () => {
    expect(read("../.claude/rules/doc-governance.md")).toBe(
      read("../templates/rules/doc-governance.md"),
    );
  });
});
