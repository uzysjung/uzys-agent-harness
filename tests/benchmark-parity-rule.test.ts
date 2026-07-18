import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// v26.109.0 (ADR-038, 라이프사이클 자산화 ③) — benchmark-parity 룰 템플릿의 광고 계약 검증.
// 이 rule 이 약속하는 것 = ① capture→핵심기능→완결성→발전 루프 ② gap.md 표 스키마
// ③ PR "## Fidelity" 의무 필드 ④ 기계검증 프록시 완료조건. 마커가 빠지면 "룰 설치됨" 보고가
// 계약 없는 빈 문서를 가리키게 된다 (no-false-ship).

const tpl = readFileSync(
  fileURLToPath(new URL("../templates/rules/benchmark-parity.md", import.meta.url)),
  "utf8",
);

describe("benchmark-parity rule template", () => {
  it("carries the gap.md schema columns the plan advertises", () => {
    // SSOT: docs/plans/lifecycle-codification-2026-07-18.md ③ — "gap.md 표(ID·Severity·
    // 근본원인·증거·수정안·상태)".
    for (const col of ["Severity", "근본원인", "증거", "수정안", "상태"]) {
      expect(tpl).toContain(col);
    }
    expect(tpl).toMatch(/\| *ID *\|/);
  });

  it("mandates the PR '## Fidelity' section", () => {
    expect(tpl).toContain("## Fidelity");
  });

  it("restricts autonomous-loop exit conditions to machine-checkable proxies", () => {
    // 주관적 시각 동등 판정을 완료조건으로 쓰면 루프가 종료 불가/자기기만 — GT 실운영 교훈.
    expect(tpl).toContain("기계");
    expect(tpl).toContain("완료조건");
  });

  it("cross-references playwright-launch instead of duplicating capture mechanics", () => {
    // 원칙(중복 신설 금지): capture 수단(영속 profile·click-only)의 SSOT 는 playwright-launch.md.
    expect(tpl).toContain("playwright-launch");
    expect(tpl).not.toContain("launchPersistentContext");
  });

  it("stays domain-neutral — project-specific names appear only as examples", () => {
    // 원칙: 프로젝트 고유명(GoalTrack 등)은 예시로도 남기지 않는다. 레퍼런스 SaaS 명은
    // "(예: ...)" fill-in 예시로만 허용.
    expect(tpl).not.toContain("GoalTrack");
    expect(tpl).not.toContain("르몽");
  });
});
