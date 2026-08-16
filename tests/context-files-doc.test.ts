import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { HARNESS_ANCHOR_FILE, upsertHarnessImport } from "../src/project-claude-merge.js";

/**
 * `docs/CONTEXT-FILES.md` 가 설명하는 것과 코드가 실제로 하는 것이 갈리지 않게 한다.
 *
 * 왜 게이트인가: 이 문서는 **사용자 저장소에 생긴 파일이 무엇인지** 알려주는 유일한 문서다.
 * 여기가 틀리면 사용자는 하네스 소유 파일에 자기 내용을 적고(다음 update 에 날아간다) 자기
 * 파일을 하네스 것으로 오해한다. 초안을 쓸 때 실제로 두 곳이 틀렸다 — import 마커 이름을
 * 지어냈고(`uzys-agent-harness:begin`, 실제는 `uzys-harness:import:start`), 채우기 블록 형태도
 * 실물과 달랐다. 렌더 출력을 떠서 고쳤고, 같은 실수가 다시 나지 않게 여기서 문다.
 *
 * 문서 전문을 검사하지 않는다 — **코드에서 유도되는 문자열만** 본다. 산문까지 물면 문서를
 * 고칠 때마다 게이트가 울려 아무도 안 고치게 된다.
 */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DOC = readFileSync(join(ROOT, "docs/CONTEXT-FILES.md"), "utf8");

describe("CONTEXT-FILES.md ↔ 코드 정합성", () => {
  it("검사 대상 문서가 비어 있지 않다 (0바이트면 이 게이트가 죽은 것)", () => {
    expect(DOC.length).toBeGreaterThan(500);
  });

  it("앵커 파일명이 코드의 SSOT 와 같다", () => {
    expect(DOC).toContain(HARNESS_ANCHOR_FILE);
  });

  it("문서에 적힌 import 블록이 실제 렌더 결과와 문자열로 일치한다", () => {
    // 지어낸 마커를 적는 것을 막는 유일한 방법은 실제 출력과 대조하는 것이다.
    const rendered = upsertHarnessImport("# p\n", { projectName: "p", tracks: ["tooling"] });
    const markerStart = rendered.match(/<!-- uzys-harness:import:start -->/)?.[0];
    const markerEnd = rendered.match(/<!-- uzys-harness:import:end -->/)?.[0];
    expect(
      markerStart,
      "렌더 결과에서 시작 마커를 못 찾았다 — 이 테스트의 전제가 깨졌다",
    ).toBeDefined();
    expect(markerEnd).toBeDefined();
    expect(DOC).toContain(markerStart as string);
    expect(DOC).toContain(markerEnd as string);
    expect(DOC).toContain(`@${HARNESS_ANCHOR_FILE}`);
  });

  it("탐지기 자기검증 — 존재하지 않는 마커는 문서에서 안 잡힌다", () => {
    // 위 단언이 "문서에 아무 문자열이나 있으면 통과"가 아님을 보인다.
    expect(DOC).not.toContain("<!-- uzys-agent-harness:begin -->");
  });

  it("4 CLI 의 앵커 위치를 전부 적는다 (한 CLI 라도 빠지면 그 사용자는 자기 파일을 못 찾는다)", () => {
    for (const needle of [
      HARNESS_ANCHOR_FILE,
      "AGENTS.md",
      ".agents/rules/uzys-harness.md",
      ".claude/rules/",
    ]) {
      expect(DOC, `${needle} 가 문서에 없다`).toContain(needle);
    }
  });

  it("USAGE.md 가 이 문서를 가리킨다 (링크 없는 문서는 없는 문서다)", () => {
    expect(readFileSync(join(ROOT, "docs/USAGE.md"), "utf8")).toContain("CONTEXT-FILES.md");
  });
});
