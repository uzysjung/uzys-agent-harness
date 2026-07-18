import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// v26.113.0 (ADR-041, 라이프사이클 자산화 ⑤) — V&V verdict 어휘 코드화의 광고 계약 검증.
// 주입 요소 = ① verification-loop: 고정 verdict(PASS/PASS_WITH_NITS/FAIL) + severity
// (CRITICAL~LOW) + FAIL→재검증 사이클 ② model-orchestration: V&V separation 절에 동일 어휘.
// 마커가 빠지면 "verdict 코드화됨" 보고가 거짓이 된다 (no-false-ship).
// 앵커는 섹션 슬라이스 — 무앵커 토큰 검사는 다른 절의 동일 낱말로도 통과한다 (④ SOD mutation 실증).

const read = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

const vl = read("../templates/skills/verification-loop/SKILL.md");
const mo = read("../templates/skills/model-orchestration/SKILL.md");

describe("V&V verdict 어휘 — 라이프사이클 ⑤ 계약", () => {
  it("verification-loop: Verdict Contract 절 — 고정 3-verdict + 4-severity", () => {
    const section = (vl.split("## Verdict Contract")[1] ?? "").split("## Continuous Mode")[0];
    expect(section).toContain("PASS_WITH_NITS");
    for (const sev of ["CRITICAL", "HIGH", "MEDIUM", "LOW"]) {
      expect(section).toContain(`**${sev}**`);
    }
  });

  it("verification-loop: FAIL 은 수정만으로 안 닫힌다 — 재검증 재현 + fresh instance 의무", () => {
    const section = (vl.split("## Verdict Contract")[1] ?? "").split("## Continuous Mode")[0];
    expect(section).toContain("re-verify");
    expect(section).toContain("fresh instance");
    // 구현 인스턴스의 자기 판정 금지가 model-orchestration V&V separation 으로 연결되는지.
    expect(section).toContain("model-orchestration");
  });

  it("verification-loop: 보고 골격이 Verdict 줄을 포함하고 READY 류 자유 서술을 쓰지 않는다", () => {
    const section = (vl.split("## Output Format")[1] ?? "").split("## Verdict Contract")[0];
    expect(section).toContain("Verdict:   PASS | PASS_WITH_NITS | FAIL");
    expect(section).not.toContain("READY");
  });

  it("model-orchestration: V&V separation 절에 동일 verdict 어휘 + verification-loop 계약 참조", () => {
    const section = (mo.split("## V&V separation")[1] ?? "").split("## Orchestrator handoff")[0];
    expect(section).toContain("PASS_WITH_NITS");
    expect(section).toMatch(/`CRITICAL` \/ `HIGH` \/ `MEDIUM` \/ `LOW`/);
    expect(section).toContain("verification-loop");
  });

  it("repo-local .claude 복사본이 템플릿과 byte-동일 (silent drift 가드)", () => {
    // 이 repo 는 자기 하네스를 .claude/ 에 자가 설치해 쓴다. 템플릿만 고치고 복사본을
    // 안 고치면 "주입됨" 보고와 실제 세션 동작이 갈라진다.
    for (const sd of ["verification-loop", "model-orchestration"]) {
      expect(read(`../.claude/skills/${sd}/SKILL.md`)).toBe(
        read(`../templates/skills/${sd}/SKILL.md`),
      );
    }
  });
});
