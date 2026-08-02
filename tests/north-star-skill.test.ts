import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// v26.112.0 (ADR-040, 라이프사이클 자산화 ④) — north-star 스킬 보강의 광고 계약 검증.
// 주입 요소 = ① metric-as-proxy(측정 불가 목표의 대리 지표 명시) ② Pillars + 모듈↔축 매핑
// ③ 우선순위 순서 게이트(기본→완성도→차별화). 마커가 빠지면 "보강됨" 보고가 거짓이 된다
// (no-false-ship). SSOT: docs/plans/lifecycle-codification-2026-07-18.md ④.
//
// 2026-08-02 복원(스킬 복원 사이클 AC4): ADR-060 이 삭제한 게이트를 399e225 에서 복원했다.
// 복원본은 north-star + northstar-roadmap 이 **한 스킬로 통합**되므로 절 번호가 재배치된다 —
// 원본이 쓰던 `### 2.` / `### 3.` 번호 앵커를 **헤딩 텍스트 앵커**로 바꾼다(계약은 그대로,
// 양끝을 막는 성질도 그대로: 절은 다음 동급 이상 헤딩에서 끝난다).

const read = (p: string) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), "utf8");
const skill = read("../templates/skills/north-star/SKILL.md");
const tpl = read("../templates/skills/north-star/NORTH_STAR.template.md");

/**
 * 헤딩 텍스트로 절을 잘라낸다 — 시작은 그 헤딩, 끝은 **다음 동급 이상 헤딩**.
 * 무앵커 토큰 검사는 Anti-Patterns/Examples 의 동일 낱말로도 통과해 절 삭제 mutation 이
 * 생존했다(SOD v26.112.0 I-1 실증). 번호 대신 텍스트로 잡아 통합 후 재번호에도 견딘다.
 */
function section(md: string, heading: RegExp): string {
  const lines = md.split("\n");
  const start = lines.findIndex((l) => /^#{2,6} /.test(l) && heading.test(l));
  if (start === -1) return "";
  const level = (lines[start] ?? "").match(/^#+/)?.[0].length ?? 6;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => new RegExp(`^#{1,${level}} `).test(l));
  return (end === -1 ? rest : rest.slice(0, end)).join("\n");
}

/**
 * Example/사례 절을 걷어낸 본문. 원본은 `## Examples` 이후만 면제했으나, 통합본에는
 * northstar-roadmap 의 `## Worked example` 도 들어온다 — 면제 근거("고유명은 참고 사례로만")가
 * 같으므로 절 이름으로 면제한다. 열거가 아니라 훑기.
 */
function withoutExampleSections(md: string): string {
  const out: string[] = [];
  let skipUntilLevel = 0;
  for (const line of md.split("\n")) {
    const h = line.match(/^(#{1,6}) /);
    if (h) {
      const level = h[1]?.length ?? 6;
      if (skipUntilLevel > 0 && level <= skipUntilLevel) skipUntilLevel = 0;
      if (skipUntilLevel === 0 && /example|사례|예시/i.test(line)) {
        skipUntilLevel = level;
        continue;
      }
    }
    if (skipUntilLevel === 0) out.push(line);
  }
  return out.join("\n");
}

describe("north-star skill — 라이프사이클 ④ 보강 계약", () => {
  it("SKILL.md: metric-as-proxy — 측정 불가 목표의 대리 지표 선언을 가르친다", () => {
    const proxySection = section(skill, /North Star Metric/);
    expect(proxySection, "North Star Metric 절 슬라이스가 비었다 — 헤딩 변경 여부 확인").not.toBe(
      "",
    );
    expect(proxySection).toContain("프록시 지표를 명시적으로 선언");
    expect(proxySection).toContain("양(1차) + 사후 품질(2차) 짝");
    expect(proxySection).toContain("굿하트");
  });

  it("SKILL.md: Pillars + 모듈↔축 매핑 — 미매핑 모듈은 착수 전 재검토", () => {
    const pillars = section(skill, /Pillars|전략 축/);
    expect(pillars, "Pillars(전략 축) 절 슬라이스가 비었다 — 헤딩 변경 여부 확인").not.toBe("");
    expect(pillars).toMatch(/모듈.*축.*매핑|모듈 ↔ 축/);
    expect(pillars).toContain("재검토");
  });

  it("SKILL.md: 우선순위 순서 게이트 — 기본→완성도→차별화, 건너뛰기 금지", () => {
    const order = section(skill, /우선순위 순서/);
    expect(order, "우선순위 순서 게이트 절 슬라이스가 비었다 — 헤딩 변경 여부 확인").not.toBe("");
    expect(order).toContain("기본 필수");
    expect(order).toContain("완성도");
    expect(order).toMatch(/차별화/);
    expect(order).toMatch(/건너뛰/);
  });

  it("NORTH_STAR.template.md: Pillars 섹션 + 모듈↔축 매핑 표 fill-in", () => {
    expect(tpl).toMatch(/Pillar/);
    expect(tpl).toMatch(/\| *모듈/);
    expect(tpl).toContain("프록시");
  });

  it("도메인 중립 — 실프로젝트 고유명은 Examples 참고 사례로만", () => {
    // Process/템플릿 본문에 특정 도메인 지표가 규범으로 박히면 일반화 실패.
    // /i + SKILL 본문(Examples 이전) 확장 — 소문자 유입·Process 유입 mutation 4종 중 3종이
    //   생존했던 구멍을 봉합 (SOD v26.112.0 I-2 실증).
    const LEAK = /ROI|WAGI|GoalTrack|Vantage/i;
    expect(tpl).not.toMatch(LEAK);
    expect(withoutExampleSections(skill)).not.toMatch(LEAK);
  });
});
