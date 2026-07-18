import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildManifest } from "../src/manifest.js";

// v26.114.0 (ADR-042, 라이프사이클 자산화 ⑥) — 증거 산출물 템플릿 3종의 광고 계약 검증.
// ① deep-research: 리서치 원장(N confirmed·M killed + 기각 사유 + caveat)
// ② eval-harness: eval spec 아티팩트 계약(C·R ID·Baseline·Test Command·Status)
// ③ benchmark-parity: dogfood pass — **신규 스키마 없이** 기존 gap.md 재사용 (중복 금지 원칙)
// 앵커는 섹션 슬라이스 양끝 — 무앵커는 다른 절의 동일 낱말로 통과한다 (④⑤ SOD mutation 실증).

const read = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

const dr = read("../templates/skills/deep-research/SKILL.md");
const eh = read("../templates/skills/eval-harness/SKILL.md");
const bp = read("../templates/rules/benchmark-parity.md");

const slice = (text: string, start: string, end: string): string =>
  (text.split(start)[1] ?? "").split(end)[0] ?? "";

describe("증거 산출물 템플릿 — 라이프사이클 ⑥ 계약", () => {
  it("deep-research: 원장 섹션 — confirmed/killed 카운트 + 기각 사유 열 + caveat", () => {
    const ledger = slice(dr, "## Research Ledger", "## Methodology");
    expect(ledger).toContain("killed");
    expect(ledger).toContain("Why rejected");
    expect(ledger).toContain("Caveats");
  });

  it("deep-research: 원장이 선택이 아님을 근거와 함께 가르친다 — kill 0 은 재검토 신호", () => {
    const rationale = slice(dr, "### The ledger is not optional", "## Examples");
    expect(rationale).toContain("re-researches");
    // "0 killed = 깨끗한 결과" 오독을 명시적으로 차단하는지.
    expect(rationale).toMatch(/Zero kills/);
  });

  it("eval-harness: eval spec 아티팩트 계약 — C/R ID + Baseline + Test Command + Status", () => {
    const define = slice(eh, "### 1. Define (Before Coding)", "### 2. Implement");
    expect(define).toMatch(/C1\.\.Cn/);
    expect(define).toMatch(/R1\.\.Rn/);
    expect(define).toContain("**Baseline**: commit");
    expect(define).toContain("## Test Command");
    expect(define).toContain("## Status (after implementation)");
    // 두 필드의 존재 이유(반증가능성·재실행성)가 함께 있어야 껍데기 템플릿이 안 된다.
    expect(define).toContain("falsifiable");
  });

  it("benchmark-parity: dogfood 는 신규 스키마 없이 gap.md 를 재사용한다", () => {
    const dogfood = slice(bp, "## Dogfood pass", "## PR 의무 필드");
    expect(dogfood).toContain("gap.md");
    expect(dogfood).toContain("새 스키마를 만들지 말고");
    expect(dogfood).toContain("배포본");
    expect(dogfood).toMatch(/CRITICAL 0/);
  });

  it("C2→C3 재분류: deep-research·eval-harness 는 withEcc 무관 install (수정본)", () => {
    // 수정본을 C2 로 두면 plugin ON 사용자는 원장/eval 계약이 없는 ECC 판만 받는다
    // → "코드화됨" 광고가 그 사용자에게 거짓 (no-false-ship). ADR-019 분류상 C3.
    const m = buildManifest({ tracks: ["tooling"] });
    const drEntry = m.find((e) => e.source === "skills/deep-research");
    const ehEntry = m.find((e) => e.source === "skills/eval-harness");
    expect(drEntry?.applies({ tracks: ["tooling"], withEcc: true })).toBe(true);
    expect(ehEntry?.applies({ tracks: ["tooling"], withEcc: true })).toBe(true);
    // deep-research = 전 트랙 / eval-harness = dev 트랙 유지
    expect(drEntry?.applies({ tracks: ["executive"], withEcc: true })).toBe(true);
    expect(ehEntry?.applies({ tracks: ["executive"], withEcc: true })).toBe(false);

    // 잔여 C2 (strategic-compact·agent-introspection-debugging) 는 재분류가 전파되지 않았는지.
    expect(
      m
        .find((e) => e.source === "skills/strategic-compact")
        ?.applies({
          tracks: ["tooling"],
          withEcc: true,
        }),
    ).toBe(false);
    expect(
      m
        .find((e) => e.source === "skills/agent-introspection-debugging")
        ?.applies({
          tracks: ["tooling"],
          withEcc: true,
        }),
    ).toBe(false);
  });

  it("repo-local .claude 복사본이 템플릿과 byte-동일 (silent drift 가드)", () => {
    for (const rel of [
      "skills/deep-research/SKILL.md",
      "skills/eval-harness/SKILL.md",
      "rules/benchmark-parity.md",
    ]) {
      expect(read(`../.claude/${rel}`), rel).toBe(read(`../templates/${rel}`));
    }
  });
});
