import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  formatResidentCostBlock,
  formatResidentCostLine,
  makeResidentCost,
  type ResidentCost,
} from "../src/context-cost.js";

/**
 * 상주 비용 **표시 계약** (v26.140.0).
 *
 * 계기: 개수 축을 추가하면서 `cost:report` 에만 개수를 붙이고 설치 헤더·wizard confirm 에는
 * 안 붙였다. 세 표면이 각자 문자열을 조립하고 있었으니 한 곳만 갱신되는 것이 기본 동작이었다 —
 * 이 리포가 3회 연속으로 적발한 그 형태 그대로다("한 축이 계열 일부에만 있으면 빠진 쪽이
 * 입증 책임").
 *
 * 그래서 표면을 **열거하지 않는다.** 열거하면 그 목록이 두 번째 하드코딩 사본이 되고, 목록에
 * 없는 표면이 다음 서식지가 된다. 대신 글롭으로 훑어 **상주 비용을 계산하는 파일은 표시를
 * 반드시 공용 포맷 함수(`formatResidentCost*`)에서 얻는다**는 구조를 강제한다. 새 표면이
 * 생겨도 이 게이트를 고칠 필요가 없고, 고쳐야 한다면 그건 새 표면이 계약을 어긴 것이다.
 *
 * 면제는 **표식이 있는 쪽**이다 (기본값 = 검사). 표시가 목적이 아닌 파일은 자기 안에
 * `resident-cost-display: none` 을 적어 스스로 밝힌다.
 */
const EXEMPT_MARKER = "resident-cost-display: none";
const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** src/ · scripts/ 를 재귀로 훑는다 (파일명 목록을 들고 있지 않다). */
function sourceFiles(): string[] {
  const out: string[] = [];
  for (const [dir, ext] of [
    ["src", ".ts"],
    ["scripts", ".mjs"],
  ] as const) {
    for (const rel of readdirSync(join(ROOT, dir), { recursive: true, encoding: "utf8" })) {
      if (rel.endsWith(ext)) out.push(join(dir, rel));
    }
  }
  return out;
}

/** 상주 비용을 계산하는 파일 = 표시 계약의 대상. 포맷 함수 자신은 대상이 아니다. */
function residentCostConsumers(): { path: string; content: string }[] {
  return sourceFiles()
    .filter((p) => p !== join("src", "context-cost.ts"))
    .map((path) => ({ path, content: readFileSync(join(ROOT, path), "utf8") }))
    .filter((f) => /residentCost\s*\(/.test(f.content));
}

const sample: ResidentCost = makeResidentCost({
  rules: 3637,
  projectClaudeMd: 1064,
  skillDescriptors: 550,
  agentDescriptors: 724,
  items: { rules: 10, skills: 9, agents: 9, claudeMd: 1, total: 29 },
});

describe("상주 비용 표시 계약 (표면 대칭)", () => {
  it("탐지기가 실제로 무는지 먼저 — 상주 비용 소비 파일을 복수로 찾아낸다", () => {
    // 이 단언이 없으면 글롭이 빈 목록을 돌려줘도 아래 전수 검사가 조용히 통과한다
    // (0건 검사 = 무검사). 부재를 확인하는 검사는 탐지기부터 검증한다.
    const consumers = residentCostConsumers();
    expect(
      consumers.length,
      "residentCost 소비 파일을 하나도 못 찾았다 — 글롭이 죽었다",
    ).toBeGreaterThan(2);
    expect(sourceFiles().length).toBeGreaterThan(20);
  });

  it("상주 비용을 계산하는 파일은 표시를 공용 포맷 함수에서 얻는다 (자체 조립 금지)", () => {
    const offenders = residentCostConsumers()
      .filter((f) => !f.content.includes(EXEMPT_MARKER))
      .filter((f) => !/formatResidentCost\w*\s*\(/.test(f.content))
      .map((f) => f.path);
    expect(
      offenders,
      `${offenders.join(", ")} 가 상주 비용을 직접 계산하면서 표시를 공용 포맷 함수에서 얻지 ` +
        "않는다. 표면마다 문자열을 조립하면 한 표면만 갱신되는 drift 가 생긴다 " +
        `(개수 축이 리포트에만 붙었던 그 형태). 표시가 목적이 아니면 파일에 "${EXEMPT_MARKER}" 를 ` +
        "적어 면제를 스스로 밝혀라 — 기본값은 검사다.",
    ).toEqual([]);
  });

  it("공용 포맷 함수 둘 다 개수를 먼저, 토큰을 뒤에 보여준다", () => {
    // 표면별 문구가 갈리는 것을 막는 것이 위 계약이라면, 여기서 지키는 건 **그 단일 문구가
    // 실제로 개수를 담는다**는 사실이다. 포맷 함수가 개수를 빠뜨리면 전 표면이 함께 빠뜨린다.
    const line = formatResidentCostLine(sample, 52) ?? "";
    expect(line).toContain("29 items resident");
    expect(line.indexOf("29 items")).toBeLessThan(line.indexOf("~5975 tokens"));
    expect(line).toContain("rules 10 ~3637");

    const block = formatResidentCostBlock(sample).join("\n");
    expect(block).toContain("개수");
    expect(block).toContain(" 10개  ~3637");
    expect(block).toContain(" 29개 상주 · ~5975 tokens/세션");
  });

  it("표시 값은 전부 인자에서 온다 — 상수를 박아두면 표면이 거짓말을 한다", () => {
    // 같은 함수에 다른 값을 주면 다른 문자열이 나와야 한다. 하드코딩된 숫자가 섞이면
    // 위 두 단언은 통과하면서 화면은 틀린 값을 보여줄 수 있다.
    const half: ResidentCost = {
      ...sample,
      rules: 1,
      total: 2,
      items: { rules: 1, skills: 0, agents: 0, claudeMd: 1, total: 2 },
    };
    expect(formatResidentCostLine(half, 0)).toContain("2 items resident");
    expect(formatResidentCostLine(half, 0)).not.toContain("29");
    expect(formatResidentCostBlock(half).join("\n")).not.toContain("29개");
  });
});
