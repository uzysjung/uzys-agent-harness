import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildManifest, MODIFIED_ECC_SKILL_DIRS } from "../src/manifest.js";

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

  it("PRD 분류표의 C3 행 ↔ 코드의 C3 목록 일치 (3중 동기 의무 구조화)", () => {
    // ADR-019 는 분류가 "코드 주석 + ADR + PRD 표" 3중으로 동기돼야 한다고 규정하지만,
    // 강제 수단이 없어 v26.113.0(SOD F2)·v26.114.0 두 릴리즈 연속으로 표가 stale 했다.
    // 재발 = 이전 대책(주석 경고)의 실패 → 한 레벨 위로 에스컬레이션 (recurrence-prevention).
    // 같은 목록 2곳 하드코딩은 derive 또는 대조 테스트 없이 머지 금지 (no-false-ship).
    const prd = read("../docs/PRD/v26-58-cherry-pick-plugin-gating.md");
    const table = slice(prd, "### 22개 분류 확정", "###");
    const c3InTable = new Set(
      [
        ...table.matchAll(
          /^\| ecc-[^|]*\| ecc\/(?:\.agents\/)?skills\/([^/]+)\/[^|]*\|(?:[^|]*\|){3}\s*\*\*C3\*\*/gm,
        ),
      ].map((m) => m[1] as string),
    );
    // 코드의 C3 = ECC 출처 스킬 전체. 표에 없는 것(karpathy hook 등 별개 source)은 대상 아님.
    for (const sd of MODIFIED_ECC_SKILL_DIRS) {
      expect(c3InTable, `PRD 분류표가 ${sd} 를 C3 로 표기해야 한다`).toContain(sd);
    }
    // 역방향 — 표만 C3 이고 코드는 C2 인 유령 행도 차단.
    for (const sd of c3InTable) {
      expect(MODIFIED_ECC_SKILL_DIRS, `코드가 ${sd} 를 C3 로 배선해야 한다`).toContain(sd);
    }
  });

  it("배포 자산의 마크다운 펜스가 균형 — 중첩 코드블록이 바깥 블록을 조기 종료하지 않는다", () => {
    // SOD F1 실증: eval-harness 템플릿 안에 ```bash 를 중첩했더니 그 닫는 펜스가 **바깥**
    // ```markdown 을 닫아, 이후 산문과 기존 헤딩까지 코드로 렌더됐다. 계약 테스트는 전부
    // toContain 이라 코드블록 안 텍스트로도 통과 — 형식 파손을 아무도 못 잡았다.
    // 중첩 시 바깥 펜스는 백틱 4개 이상이어야 한다 (CommonMark: 닫는 펜스는 정보 문자열 없음).
    for (const rel of [
      "skills/eval-harness/SKILL.md",
      "skills/deep-research/SKILL.md",
      "rules/benchmark-parity.md",
    ]) {
      const lines = read(`../templates/${rel}`).split("\n");
      let openFence: string | null = null;
      for (const [idx, line] of lines.entries()) {
        const m = /^\s*(`{3,})(.*)$/.exec(line);
        if (!m) continue;
        const [, fence, rest] = m as unknown as [string, string, string];
        const info = rest.trim();
        if (openFence === null) {
          openFence = fence;
          continue;
        }
        if (info === "") {
          // 닫는 펜스 — 여는 펜스보다 짧으면 닫히지 않는다.
          if (fence.length >= openFence.length) openFence = null;
          continue;
        }
        // 정보 문자열이 있는 중첩 펜스: 바깥이 더 길어야 조기 종료를 피한다.
        expect(
          fence.length,
          `${rel}:${idx + 1} 중첩 펜스 '${info}' 가 바깥 펜스와 길이가 같다 — 바깥을 4-backtick 으로`,
        ).toBeLessThan(openFence.length);
      }
      expect(openFence, `${rel}: 닫히지 않은 코드블록`).toBeNull();
    }
  });

  // SOD F2 실증: 룰을 1개 추가했는데 헤더는 "(10개)" 로 남았다. 그 표는 스스로
  //   "SSOT = .claude/rules/*.md (표는 실 파일 목록과 1:1)" 이라 선언하므로, 어긋나면
  //   자기 선언이 거짓이 된다. 수기 표 ↔ 실파일 대조를 글롭으로 강제한다.
  // 2026-07-27 계약 조정 — **선언을 선택으로 바꾼다.** 인벤토리는 사람이 쓰는 순간 두 번째
  //   사본이 되고 사본은 갈린다. 실제로 이 파일에 룰 목록이 20줄 간격으로 **두 개** 있었고
  //   뒤엣것("15개 904줄", 나열은 16항목)이 실측(12개 729줄)과 어긋난 채 살아 있었다 — 앞엣것만
  //   이 게이트가 봤기 때문이다. 룰은 `paths:` 가 없으면 전부 자동 로드되므로 목록이 없어도
  //   내용은 이미 컨텍스트에 있다. **선언하지 않으면 거짓 선언도 없다.**
  //   다만 "표를 지우고 다른 형태로 나열"하는 우회는 막는다 — 표 행으로 룰 이름이 2개 이상
  //   나오면 그것이 인벤토리이고, 그때는 헤더·개수·전 항목이 실파일과 맞아야 한다.
  //   경로 참조 한두 건(`.claude/rules/ship-checklist.md §…`)은 인벤토리가 아니므로 통과한다.
  const ruleInventoryRow = (name: string) =>
    new RegExp(`^\\|\\s*\\*{0,2}${name}\\*{0,2}\\s*\\|`, "m");

  it("CLAUDE.md 가 룰 인벤토리를 실으면 .claude/rules 실파일과 1:1 (자기 선언 SSOT)", () => {
    const claudeMd = read("../CLAUDE.md");
    const files = readdirSync(fileURLToPath(new URL("../.claude/rules", import.meta.url)))
      .filter((f) => f.endsWith(".md"))
      .map((f) => f.replace(/\.md$/, ""));
    const rowNames = files.filter((name) => ruleInventoryRow(name).test(claudeMd));
    const declared = /## Active Rules \((\d+)개\)/.exec(claudeMd);

    if (declared === null) {
      expect(
        rowNames,
        "'Active Rules (N개)' 헤더가 없는데 룰 이름이 표 행으로 실려 있다 — 헤더만 지우고 목록을 남기면 이 게이트가 못 보는 두 번째 사본이 된다",
      ).toHaveLength(0);
      return;
    }
    expect(
      Number(declared[1]),
      `CLAUDE.md 선언 수 ≠ .claude/rules 실파일 수(${files.length})`,
    ).toBe(files.length);
    for (const name of files) {
      // 표는 일부 룰명을 굵게 표기한다(`| **cli-development** |`) — 표기 변형 허용, 행 존재만 단언.
      expect(claudeMd, `Active Rules 표에 ${name} 행이 없음`).toMatch(ruleInventoryRow(name));
    }
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
