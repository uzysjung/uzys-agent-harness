import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// v26.119.0 (ADR-045) — doc-governance "착수 전 baseline 대조" 절의 계약 검증.
// 이 절이 신설된 사유 = 출구 동기화("작업 완료 처리")가 "모두가 매번 지켰다"를 전제하는데 그
// 전제가 깨진 사례가 3개 프로젝트에서 관측됐다는 것. 아래 마커들은 장식이 아니라, 5인 페르소나
// 패널이 1차 초안에서 찾아낸 **자기 규약 위반 4건**을 봉합한 지점이다 — 하나라도 풀리면 그
// 결함이 그대로 되살아난다.

const read = (p: string) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), "utf8");
const tpl = read("../templates/rules/doc-governance.md");

// 양끝 앵커링: 낱말 매치는 무관 산문에도 걸린다. 반드시 이 절 안에서만 판정한다.
const section =
  (tpl.split("## 착수 전 baseline 대조")[1] ?? "").split("## 현행 vs archive")[0] ?? "";

describe("doc-governance — 착수 전 baseline 대조 절", () => {
  it("절이 존재하고 출구 동기화 절 뒤에 온다", () => {
    // 순서가 뒤집히면 "출구의 짝"이라는 독해가 깨진다.
    expect(section).not.toBe("");
    expect(tpl.indexOf("## 작업 완료 처리")).toBeLessThan(tpl.indexOf("## 착수 전 baseline 대조"));
  });

  it("CLAUDE.md Rule 8 과의 경계를 선언한다", () => {
    // Rule 8("read before you write")은 이미 매 세션 상주한다. 관계를 밝히지 않으면 이 절은
    // doc-governance 자신의 "같은 사실을 두 곳에 쓰지 않는다"를 어기는 순수 중복이 된다.
    expect(section).toContain("Rule 8");
  });

  it("발동 조건이 기계로 확인 가능하다 — 무근거 임계값 금지", () => {
    // benchmark-parity.md 는 heuristic threshold("30일","50%")를 근거 없이 단정하는 것을 금지한다.
    // 1차 초안의 "문서와 코드가 며칠 이상 떨어져 있던" 이 정확히 그 위반이었고, 그 상태로는
    // 에이전트가 발동 여부를 스스로 판정할 수 없어 절 전체가 무시된다.
    expect(section).not.toMatch(/며칠|\d+일 이상|\d+% 이상/);
    expect(section).toContain("author");
    expect(section).toMatch(/커밋/);
    // 착수 단위가 없으면 항목마다 재대조해 비용이 수십 배로 튄다.
    expect(section).toMatch(/백로그 전체에 1회/);
  });

  it("3분류 표에 판정 불가 시의 기본값이 있다", () => {
    // 기본값이 없으면 실행자가 "완전 구현인지 모르겠다"에서 멈추거나 임의로 채운다.
    for (const state of ["완전 구현", "부분 구현", "판정 불가"]) {
      expect(section).toContain(state);
    }
    expect(section).toMatch(/못 찾았다고 착수를 보류하지 않는다/);
  });

  it("엄격도와 승인범위를 재서술하지 않고 소유 자산에 위임한다 (MECE)", () => {
    // 재서술하면 두 곳이 어긋나는 drift 가 시작된다 — 참조로 유지해야 한다.
    expect(section).toContain("benchmark-parity.md");
    expect(section).toContain("단순 존재 ≠ 완결");
    expect(section).toContain("change-management.md");
  });

  it("게이트 부재를 자인한다", () => {
    // 프로즈 규약이 게이트인 척하면 no-false-ship 위반. recurrence-prevention 사다리상 첫
    // 도입이라 프로즈로 시작하되, 그 한계를 독자가 알아야 한다.
    expect(section).toMatch(/게이트가 없다/);
    expect(section).toMatch(/게이트로 승격/);
  });

  it("사고 서사를 인라인으로 늘어놓지 않고 ADR 로 위임한다", () => {
    // git-policy.md "Drift Period" 관용구 = 사고 요약 한 줄 + "상세 ADR-NNN 참조".
    // 길이 상한을 임의 숫자로 두면 그 자체가 benchmark-parity 가 금지하는 무근거 임계값이 된다.
    // 대신 이 파일의 실제 랩 관용구(최장 105자)를 기준으로 "한 줄"을 강제한다.
    // v26.128.0 — 원래 `/ADR-\d+/` 로 **번호까지** 요구했으나 일반화했다. 이 파일은
    // `templates/` = 배포물이고, 설치자에게 우리 `ADR-045` 는 가리키는 대상이 없다
    // (`templates-distribution-hygiene` 이 구체 좌표를 금지한다 — 두 게이트가 충돌했고
    // 배포 위생이 이겼다). 지켜야 할 계약은 "서사 대신 한 줄 + ADR 위임"이지 번호가 아니다.
    const preface = section.split("\n").filter((l) => l.startsWith("전례:"));
    expect(preface).toHaveLength(1);
    expect(preface[0]).toMatch(/ADR/);
    expect(preface[0]!.length).toBeLessThanOrEqual(105);
  });

  it("절 크기가 ADR-045 가 공표한 비용 안에 머문다", () => {
    // ADR-045 는 이 절을 ~246 토큰으로 공표한다. 서사가 슬금슬금 되돌아오면 그 공표가 거짓이
    // 되고, 상주 비용 지표(ADR-043/044)도 같이 오염된다. 상한은 임의값이 아니라 공표치 기준이다.
    const advertised = 246;
    expect(Math.ceil(section.length / 4)).toBeLessThanOrEqual(advertised);
  });

  it("templates 와 설치본(.claude) 이 1:1 이다", () => {
    // 도그푸딩 사본이 어긋나면 이 repo 는 자기가 파는 규약을 안 지키는 상태가 된다.
    expect(read("../.claude/rules/doc-governance.md")).toBe(tpl);
  });
});
