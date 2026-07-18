import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// v26.112.0 (ADR-040, 라이프사이클 자산화 ④) — north-star 스킬 보강의 광고 계약 검증.
// 주입 요소 = ① metric-as-proxy(측정 불가 목표의 대리 지표 명시) ② Pillars + 모듈↔축 매핑
// ③ 우선순위 순서 게이트(기본→완성도→차별화). 마커가 빠지면 "보강됨" 보고가 거짓이 된다
// (no-false-ship). SSOT: docs/plans/lifecycle-codification-2026-07-18.md ④.

const skill = readFileSync(
  fileURLToPath(new URL("../templates/skills/north-star/SKILL.md", import.meta.url)),
  "utf8",
);
const tpl = readFileSync(
  fileURLToPath(new URL("../templates/skills/north-star/NORTH_STAR.template.md", import.meta.url)),
  "utf8",
);

describe("north-star skill — 라이프사이클 ④ 보강 계약", () => {
  it("SKILL.md: metric-as-proxy — 측정 불가 목표의 대리 지표 선언을 가르친다", () => {
    expect(skill).toMatch(/프록시|proxy/i);
    // 프록시의 짝 구조(양 + 사후 품질)와 굿하트 경계 중 최소한 품질 짝은 명시.
    expect(skill).toContain("품질");
  });

  it("SKILL.md: Pillars + 모듈↔축 매핑 — 미매핑 모듈은 착수 전 재검토", () => {
    expect(skill).toMatch(/Pillar|전략 축/);
    expect(skill).toMatch(/모듈.*축.*매핑|모듈 ↔ 축/);
    expect(skill).toContain("재검토");
  });

  it("SKILL.md: 우선순위 순서 게이트 — 기본→완성도→차별화, 건너뛰기 금지", () => {
    expect(skill).toContain("기본 필수");
    expect(skill).toContain("완성도");
    expect(skill).toMatch(/차별화/);
    expect(skill).toMatch(/건너뛰/);
  });

  it("NORTH_STAR.template.md: Pillars 섹션 + 모듈↔축 매핑 표 fill-in", () => {
    expect(tpl).toMatch(/Pillar/);
    expect(tpl).toMatch(/\| *모듈/);
    expect(tpl).toContain("프록시");
  });

  it("도메인 중립 — 실프로젝트 고유명은 Examples 참고 사례로만", () => {
    // Process/템플릿 본문에 특정 도메인 지표가 규범으로 박히면 일반화 실패.
    expect(tpl).not.toMatch(/ROI|WAGI|GoalTrack|Vantage/);
  });
});
