import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// v26.120.0 — 서브에이전트 결과 수거는 파일로. 재발방지 게이트.
//
// 왜 게이트인가: 이 교훈은 두 번 기록됐고(v26.98.0 메모리 · v26.113.0 교훈 ⓓ) 세 번째로 발생했다
// — 5인 패널을 인라인 반환으로 돌리다 3인분 리포트가 조용히 유실. recurrence-prevention 사다리상
// 프로즈 기록은 이미 두 번 실패했으므로 구조로 내린다.
//
// 실패가 조용하다는 게 핵심이다: 워커가 "아무것도 안 냈다"로 보여서 전달 실패가 아니라 작업 실패로
// 오진하고, 같은 일을 다시 시킨다. 그래서 spawn 시점에 결정돼야 하고, 지시가 자산에서 사라지면
// 다음 세션이 같은 값을 또 치른다.

const read = (p: string) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), "utf8");
const mo = read("../templates/skills/model-orchestration/SKILL.md");
const mpr = read("../templates/skills/multi-persona-review/SKILL.md");

const lifecycle = (mo.split("## Worker lifecycle")[1] ?? "").split("\n## ")[0] ?? "";

describe("서브에이전트 결과 수거 = 파일 핸드오프", () => {
  it("model-orchestration 이 규칙을 소유한다 — Worker lifecycle 안에서", () => {
    // 위임 정책의 소유자. 다른 절에 흩어지면 delegation 결정 시 안 읽힌다.
    expect(lifecycle).not.toBe("");
    expect(lifecycle).toMatch(/file, not as a return message/);
  });

  it("실패가 조용하다는 점과 spawn 시점 결정임을 명시한다", () => {
    // 이 둘이 빠지면 "가능하면 파일로" 정도의 권고로 읽혀 다시 인라인으로 돌아간다.
    // 실제 재발 3회차의 원인이 정확히 "나중에 파일로 바꾸면 되지"였다.
    // OR 로 묶지 않는다 — 한쪽만 남아도 통과하면 가드가 아니라 장식이다(이 테스트 자체의
    // 1차 판본이 그 구멍으로 mutation 을 놓쳤다).
    expect(lifecycle).toMatch(/silent/);
    expect(lifecycle).toMatch(/spawn prompt/); // 어떻게: 지시를 spawn 프롬프트에 넣는다
    expect(lifecycle).toMatch(/spawn-time/); // 언제: 사후 보정이 아니라 spawn 시점 결정
    expect(lifecycle).toMatch(/retrofit/); // 왜: 사후 보정 비용이 실재한다
  });

  it("multi-persona-review 는 재서술하지 않고 참조한다 (MECE)", () => {
    // 두 곳에 규칙을 복제하면 한쪽만 고쳐지는 drift 가 시작된다 — doc-governance 원칙.
    expect(mpr).toMatch(/write its findings to a file/);
    expect(mpr).toContain("model-orchestration");
  });

  it("패널 고유의 대가(유효 표 감소)를 밝힌다", () => {
    // 일반 규칙만으로는 "리포트 하나 날린 것"으로 읽힌다. 패널에서는 표본이 줄어드는 것이고,
    // 그건 이 스킬이 근거로 삼는 유일한 변수다 (Nine Judges, Two Effective Votes).
    const step3 = (mpr.split("### 3.")[1] ?? "").split("### 4.")[0] ?? "";
    expect(step3).toMatch(/Effective Votes/);
  });

  it("설치본(.claude) 사본이 1:1 이다", () => {
    expect(read("../.claude/skills/model-orchestration/SKILL.md")).toBe(mo);
    expect(read("../.claude/skills/multi-persona-review/SKILL.md")).toBe(mpr);
  });
});
