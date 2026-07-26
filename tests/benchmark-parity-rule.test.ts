import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// v26.109.0 (ADR-038, 라이프사이클 자산화 ③) — benchmark-parity 계약 검증.
// v26.138.0 — 계약을 **둘로 쪼갰다**: 룰은 머지를 막는 게이트만 상주시키고(위반은 작업 도중에
// 일어나므로 스킬 발화를 기다리면 늦다), 루프 절차·gap.md 스키마·dogfood·PR 템플릿은
// `gap-analysis-e2e` 스킬로 옮겼다(발화 시에만 비용). 계약이 사라진 게 아니라 소유자가 바뀐 것이라
// 검사도 같이 옮긴다 — 다만 **쪼갠 순간 새 실패 양식이 생긴다**: 한쪽만 남고 위임이 끊기는 것.
// 그래서 아래 마지막 두 테스트가 "룰 → 스킬" 연결과 "스킬 실재"를 함께 본다. 링크가 끊긴 채로
// 양쪽이 개별 통과하면 설치자는 게이트만 받고 절차는 못 받는다 (no-false-ship).

const read = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

const SKILL_DIR = "gap-analysis-e2e";
const rule = read("../templates/rules/benchmark-parity.md");
const skill = read(`../templates/skills/${SKILL_DIR}/SKILL.md`);

describe("benchmark-parity — 룰(게이트)", () => {
  it("머지를 막는 게이트 4종이 남아 있다", () => {
    // 절차를 스킬로 옮기면서 게이트까지 딸려가면 룰은 빈 껍데기가 된다. 이 4개가 "위반을
    // 작업 도중에 잡는다"는 상주 정당화의 전부다 — 하나라도 빠지면 룰을 상주시킬 이유가 없다.
    expect(rule, "capture 없는 동등 자처 금지").toContain("capture 없이");
    expect(rule, "증거 없는 행 기재 금지").toContain("증거 없는 행");
    expect(rule, "CRITICAL 잔존 시 머지 차단").toMatch(/CRITICAL[\s\S]{0,80}머지 차단/);
    expect(rule, "PR ## Fidelity 의무").toContain("## Fidelity");
  });

  it("'단순 존재 ≠ 완결' 판정 기준을 유지한다", () => {
    // doc-governance 의 baseline 대조 절이 UI 트랙에서 이 문장을 인용한다. 여기서 지우면
    // 그쪽 참조가 끊긴 채로 조용히 통과한다.
    expect(rule).toContain("단순 존재 ≠ 완결");
  });

  it("capture 수단을 재규정하지 않고 playwright-launch 에 위임한다", () => {
    expect(rule).toContain("playwright-launch");
    expect(rule).not.toContain("launchPersistentContext");
  });

  it("도메인 중립 — 프로젝트 고유명은 예시로도 넣지 않는다", () => {
    expect(rule).not.toMatch(/goaltrack/i);
    expect(rule).not.toMatch(/르몽/);
  });
});

describe("benchmark-parity — 스킬(절차)", () => {
  it("gap.md 표 스키마를 그대로 들고 있다", () => {
    // SSOT: docs/plans/lifecycle-codification-2026-07-18.md ③
    for (const col of ["Severity", "근본원인", "증거", "수정안", "상태"]) {
      expect(skill).toContain(col);
    }
    expect(skill).toMatch(/\| *ID *\|/);
  });

  it("PR '## Fidelity' 템플릿 본문을 제공한다", () => {
    expect(skill).toContain("## Fidelity (benchmark parity)");
  });

  it("자율 루프 완료조건을 기계검증 프록시로 제한한다", () => {
    // 주관적 시각 동등 판정을 완료조건으로 쓰면 루프가 종료 불가/자기기만이 된다.
    // 헤딩 앵커링: 낱말 매치("기계")는 무관 산문에도 걸린다 (SOD v26.109.0 N-2).
    expect(skill).toMatch(/## 자율 루프 완료조건 \(기계검증 프록시만\)/);
  });

  it("두 severity 척도를 섞지 말라고 명시한다", () => {
    // 이 스킬은 원래 Nielsen 0–4 를 쓰고, gap.md 는 CRITICAL~LOW 를 쓴다. 한 파일에 두 척도가
    // 공존하게 됐으므로 경계를 적어두지 않으면 다음 독자가 임의 변환한다 — 같은 사실이 두 곳에서
    // 어긋나는 전형적 경로다.
    expect(skill).toContain("두 척도를 섞지 않는다");
    expect(skill).toContain("CRITICAL(핵심 기능 자체가 불성립)");
  });
});

describe("benchmark-parity — 룰과 스킬의 연결", () => {
  it("룰이 절차의 소유자로 그 스킬을 지목한다", () => {
    expect(
      rule,
      `룰이 ${SKILL_DIR} 를 SSOT 로 가리켜야 한다 — 안 그러면 게이트만 읽은 에이전트가 절차를 새로 지어낸다`,
    ).toContain(SKILL_DIR);
  });

  it("지목된 스킬이 실재한다", () => {
    // 살아 있는 지시문이 실재하지 않는 스킬을 가리키는 것은 실제로 관측된 실패 양식이다.
    const path = fileURLToPath(
      new URL(`../templates/skills/${SKILL_DIR}/SKILL.md`, import.meta.url),
    );
    expect(existsSync(path), `${SKILL_DIR} 스킬이 없는데 룰이 그것을 가리키고 있다`).toBe(true);
  });
});
