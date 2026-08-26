import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// 2026-08-26 (#357, 사용자 결정) — **스킬 본문의 뜻을 코드가 판정하지 않는다.**
//
// 이 파일은 원래 세 스킬 본문이 파일 핸드오프 규칙을 **어느 절에서 어떤 낱말로** 가르치는지
// 검사했다 — `## Worker lifecycle` 하위 절 슬라이스 + `file, not as a return message` ·
// `silent` · `spawn prompt` · `spawn-time` · `retrofit` · `write its findings to a file` ·
// `model-orchestration` · `Effective Votes` 8종.
//
// 그 방식은 #345 에서 세 라운드에 걸쳐 수렴하지 않는 것이 측정됐다. 어절과 절 위치를 고정하면
// **같은 뜻의 정당한 개정과 절 재편이 빨간불**이 되고, 그 어절을 남긴 채 뜻을 뒤집으면
// **초록불**이다. 양쪽으로 다 틀리는 검사는 없느니만 못하다 — 초록불이 "스킬이 제대로
// 가르친다"는 증거로 읽히기 때문이다.
//
// 이 게이트의 계기(v26.120.0, 서브에이전트 리포트 3인분 유실)는 지금도 유효하지만, 그것을
// 막는 것은 **스킬 문서에 특정 낱말이 남아 있는 것**이 아니라 위임 시점에 파일 경로를 지정하는
// 행위다. 문서가 지워지는 쪽은 변경 이력이 맡는다 — 룰·스킬·훅은 개별 독립 자산이고, 자기
// 변경 요청 없이는 건드리지 않으며, 바꿀 때 이유와 이슈 번호를 커밋에 남긴다
// (`.claude/rules/change-management.md` §자산은 자기 변경 요청 없이 건드리지 않는다).
//
// 남긴 단언은 **돌려서 판정되는 것**뿐이다. ADR-069 — 외부 실행기 레인은 세 스킬을 **같은
// 사이클에** 고치므로, 한쪽 사본만 고쳐지는 drift 가 실재 위험이다(설계 §5.1).
// `external-tool-routing.test.ts` §"세 스킬의 두 사본이 1:1 이다" 가 이 파일을 SKILL.md 3종의
// 사본 대조 소유자로 지목한다 — 그 계약은 아래에서 그대로 유지된다.

const read = (p: string) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), "utf8");

describe("외부 실행기 레인 세 스킬 — 설치본(.claude) 사본이 1:1 이다", () => {
  it.each([
    ["model-orchestration"],
    ["multi-persona-review"],
    ["external-model-consult"],
  ])("%s/SKILL.md", (id) => {
    expect(read(`../.claude/skills/${id}/SKILL.md`)).toBe(
      read(`../templates/skills/${id}/SKILL.md`),
    );
  });
});
