import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// v26.114.0 (ADR-042, 라이프사이클 자산화 ⑥) 로 시작했고 두 번 성격이 바뀌었다. **2026-08-30
// 재판정(#363)**: 스킬 본문의 문구를 읽던 3블록을 걷고 돌려서 판정되는 것만 남겼다.
// **ADR-090 (#452)**: 남은 계약 중 ECC C3 축(카탈로그 배선 · PRD 분류표 대조 · 두 사본 바이트
// 동일)은 그 대상 자산이 전부 은퇴해 사라졌다 — C3 축의 재등장은 `tests/manifest.test.ts` ·
// `tests/vnv-verdict.test.ts` 가 빈 목록 단언으로 지킨다.
// 남은 계약 = 배포 스킬의 코드펜스 균형(형식 파손) · 룰 인벤토리↔실파일 1:1.

const read = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

describe("배포 자산 형식 계약 (구 라이프사이클 ⑥)", () => {
  // ── 2026-08-30 재판정(#363): 문구 단언 3블록을 걷었다 ──────────────────────────
  // 걷어낸 것 = `deep-research` 원장 마커(`killed`·`Why rejected`·`Caveats`)·"kill 0 은
  // 재검토 신호"(`Zero kills`)·`eval-harness` 의 eval spec 필드(`C1..Cn`·`Baseline`·
  // `Test Command`·`Status`·`falsifiable`). 셋 다 **스킬 본문의 낱말**을 읽었다.
  //
  // 근거는 이미 채택된 룰이다 — `change-management.md` §자산은 자기 변경 요청 없이
  // 건드리지 않는다 의 *"문장의 의미를 무는 자동 검사는 만들지 마라(3회 우회 실측)"*.
  // 문구 검사는 양쪽으로 틀린다: 같은 뜻으로 다시 쓰면 🔴(정당한 개정 차단), 낱말을 남긴 채
  // 옆 문장을 뒤집으면 🟢(뜻이 반대인데 통과). 실제로 이 파일의 앵커 방식(섹션 슬라이스)도
  // 그 우회를 막지 못한다 — 슬라이스 안에서 문장을 뒤집으면 낱말은 그대로다.
  // 자산 본문의 뜻은 `npm run assets:history` 로 이력을 읽어 사람·에이전트가 판정한다.
  //
  // 남긴 블록은 뜻을 안 읽는다: 코드펜스 균형(형식 파손) · 룰 인벤토리↔실파일 1:1.

  // 2026-08-04 (#284) — `benchmark-parity` 룰의 dogfood 계약 검증이 여기 있었다. 룰이 배포에서
  // 빠지면서 함께 제거됐다: 그 룰이 담던 gap.md 표 스키마·PR 의무 필드·walkthrough 절차는 그
  // 작업을 할 때만 필요한데 매 세션 상주했고, 같은 일을 `audit-service-gaps` 스킬이 담당한다.
  // 룰이 되살아나면 `tests/manifest.test.ts` 가 잡는다 (상주로 되돌아가는 것이 회귀다).

  it("배포 자산의 마크다운 펜스가 균형 — 중첩 코드블록이 바깥 블록을 조기 종료하지 않는다", () => {
    // SOD F1 실증: eval-harness 템플릿 안에 ```bash 를 중첩했더니 그 닫는 펜스가 **바깥**
    // ```markdown 을 닫아, 이후 산문과 기존 헤딩까지 코드로 렌더됐다. 계약 테스트는 전부
    // toContain 이라 코드블록 안 텍스트로도 통과 — 형식 파손을 아무도 못 잡았다.
    // 중첩 시 바깥 펜스는 백틱 4개 이상이어야 한다 (CommonMark: 닫는 펜스는 정보 문자열 없음).
    // ADR-090 (#452) — 표본 두 종이 은퇴했다. 이름을 다시 열거하는 대신 **배포되는 스킬
    // 전량을 훑는다** — 열거 사본은 자산이 바뀔 때마다 뒤처지고, 뒤처진 목록은 새 자산의
    // 형식 파손을 아무도 안 본다.
    const skillsDir = fileURLToPath(new URL("../templates/skills", import.meta.url));
    const rels = readdirSync(skillsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => `skills/${e.name}/SKILL.md`);
    expect(rels.length, "배포 스킬이 0건 — 이 게이트가 무의미해진다").toBeGreaterThan(5);
    for (const rel of rels) {
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
  //   **커버 범위를 정확히 적는다(독립 검증 지적, 2026-07-27).** 이 게이트가 검출하는 것은
  //   **표 행 첫 셀에 룰명이 평문으로 오는 형태**(`| git-policy |`, 굵게 표기 허용) 하나뿐이고,
  //   한 건만 있어도 실패한다. **검출하지 못하는 우회**: 백틱 표(`` | `git-policy` | ``) ·
  //   불릿 목록 · 산문 나열 · 2번째 열 배치. 즉 "다른 형태로 나열하는 우회를 막는다"고 쓰면
  //   거짓이다 — 옛 표 형태의 재출현만 막는다.
  //   넓히지 않고 좁게 두는 이유: 여기서 형태를 열거하기 시작하면 그 목록이 두 번째 하드코딩
  //   사본이 되고 목록 밖 표기가 다음 서식지가 된다(`no-false-ship` §게이트는 열거하지 말고
  //   훑어라, 6회 재발분). 인벤토리 전반의 진위는 ADR-058 의 1차 축(무게이트 주장 수) 추출기가
  //   맡을 자리이고, 그것은 **아직 미구현**이다. 그때까지 이 구멍은 열려 있다.
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
});
