import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// v26.119.0 (ADR-045) — doc-governance "착수 전 baseline 대조" 계약의 검증.
//
// 2026-08-04 (#284) — 계약이 **절 구조에서 원칙 문장으로** 축소됐다. ADR-045 가 봉합한 결함은
// "출구 동기화가 '모두가 매번 지켰다'를 전제하는데 그 전제가 3개 프로젝트에서 깨졌다"이고,
// 그걸 막는 것은 **행동을 바꾸는 문장**이지 발동 조건표·3분류표·MECE 위임 참조가 아니다.
// 후자는 그 작업을 할 때만 필요한 절차인데 매 세션 상주했다.
//
// 그래서 이 게이트가 무는 대상도 좁아졌다. 지금 무는 것은 **잃으면 결함이 되살아나는 것**뿐이다:
//   ⓐ 미완 표기를 "안 된 것"으로 읽지 않는다 (= 재구현 유발)
//   ⓑ 심볼 존재를 완료 증거로 쓰지 않는다 (= 거짓 완료)
//   ⓒ 판정 불가일 때의 기본값 (= 실행자가 멈추거나 임의로 채우는 것 방지)
//   ⓓ 무근거 임계값 금지 (= 에이전트가 발동 여부를 스스로 판정 못 하는 상태 방지)
// 빠진 것: 절 헤딩과 그 순서 · 앵커 원칙 번호 참조 · author/커밋 발동조건 · 3분류 표 ·
// benchmark-parity/change-management 위임 참조(전자는 #284 로 삭제됨) · 게이트 부재 자인 문구 ·
// 전례 한 줄 · 246 토큰 상한. 전부 절 구조에 딸린 것이고, 절이 없어지면 검사할 대상도 없다.

const read = (p: string) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), "utf8");
const tpl = read("../templates/rules/doc-governance.md");

describe("doc-governance — 착수 전 baseline 대조 계약", () => {
  it("미완 표기를 '모르는 것'으로 읽으라고 말한다 — 재구현을 막는 문장이다", () => {
    expect(tpl).toMatch(/미완 표기는 "안 된 것"이 아니라/);
    expect(tpl).toMatch(/모르는 것/);
  });

  it("심볼 존재를 완료 증거로 쓰지 말라고 말한다 — 거짓 완료를 막는 문장이다", () => {
    expect(tpl).toMatch(/심볼이 있다는 것만으로 완료로 읽지 않는다/);
  });

  it("판정 불가 시의 기본값이 있다 — 없으면 실행자가 멈추거나 임의로 채운다", () => {
    expect(tpl).toMatch(/못 찾았다고 착수를 보류하지는? 않는다/);
  });

  it("무근거 임계값을 쓰지 않는다 — 에이전트가 발동을 스스로 판정할 수 있어야 한다", () => {
    expect(tpl).not.toMatch(/며칠|\d+일 이상|\d+% 이상/);
  });

  it("사고 서사를 인라인으로 늘어놓지 않는다 — 상주 비용을 내는 것은 행동을 바꾸는 문장뿐", () => {
    expect(tpl).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(tpl).not.toMatch(/^전례:/m);
  });

  it("templates 와 설치본(.claude) 이 1:1 이다", () => {
    // 도그푸딩 사본이 어긋나면 이 repo 는 자기가 파는 규약을 안 지키는 상태가 된다.
    expect(read("../.claude/rules/doc-governance.md")).toBe(tpl);
  });
});
