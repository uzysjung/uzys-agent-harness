import { describe, expect, it } from "vitest";
import { upsertHarnessImport } from "../src/project-claude-merge.js";

/**
 * P5 게이트 — @import 기반 앵커 (docs/plans/overhaul-2026-08-02-todo.md AC4).
 *
 * 계약: 설치기는 사용자 루트 CLAUDE.md 를 더 이상 덮어쓰지 않는다. 하네스 내용은
 * `CLAUDE-uzys-harness.md` 로 나가고, 루트 CLAUDE.md 에는 관리 마커로 감싼
 * `@CLAUDE-uzys-harness.md` import 한 줄만 들어간다 (Claude Code memory 문서 실측
 * 2026-08-02: 프로젝트 스코프 @import 지원, 상대경로, 코드펜스 내부는 무시).
 *
 * 이 테스트는 구현(레인 C) 착수 전에 red 로 태어났다 — 계약을 테스트가 정의하고
 * 구현이 따라온다 (작성 레인 = 오케스트레이터, 구현 레인과 분리).
 */

const IMPORT_LINE = "@CLAUDE-uzys-harness.md";

const importCount = (s: string): number =>
  s.split("\n").filter((l) => l.trim() === IMPORT_LINE).length;

describe("루트 CLAUDE.md 의 하네스 import 관리", () => {
  it("파일이 없으면 스캐폴드 + import 1줄로 생성한다", () => {
    const out = upsertHarnessImport(null, { projectName: "demo", tracks: ["tooling"] });
    expect(importCount(out)).toBe(1);
  });

  it("기존 사용자 CLAUDE.md 는 본문 무손실 — import 1줄만 추가된다", () => {
    const user = "# 내 프로젝트\n\n우리 팀 규칙:\n- 커밋은 한국어로\n";
    const out = upsertHarnessImport(user, { projectName: "demo", tracks: ["tooling"] });
    expect(out).toContain("우리 팀 규칙:");
    expect(out).toContain("- 커밋은 한국어로");
    expect(importCount(out)).toBe(1);
    // 덮어쓰기 회귀 방지: 사용자 본문이 스캐폴드로 대체되면 원문 라인이 사라진다.
    for (const line of user.trimEnd().split("\n")) {
      expect(out).toContain(line);
    }
  });

  it("재실행해도 import 는 정확히 1줄 (idempotent)", () => {
    const once = upsertHarnessImport("# p\n", { projectName: "p", tracks: ["tooling"] });
    const twice = upsertHarnessImport(once, { projectName: "p", tracks: ["tooling"] });
    expect(twice).toBe(once);
    expect(importCount(twice)).toBe(1);
  });

  it("코드펜스 안의 @참조는 import 로 세지 않는다 — 마커 밖 실줄만 관리한다", () => {
    // Claude Code 는 코드펜스 내 @path 를 import 하지 않는다. 사용자가 문서에서
    // 이 파일명을 예시로 인용해도 중복 추가하거나 1줄 계약을 깨면 안 된다.
    const user = "# p\n\n```\n@CLAUDE-uzys-harness.md (예시)\n```\n";
    const out = upsertHarnessImport(user, { projectName: "p", tracks: ["tooling"] });
    expect(importCount(out)).toBe(1); // 펜스 밖 관리 줄 1개 (펜스 안 줄은 trim 매치 안 됨 — "(예시)" 접미)
    expect(out).toContain("```\n@CLAUDE-uzys-harness.md (예시)\n```");
  });

  it("펜스 안의 **순수** import 줄은 기존 import 로 인정하지 않는다 — 펜스 밖에 실줄을 추가한다", () => {
    // 최종 리뷰 MEDIUM-1: 위 케이스는 "(예시)" 접미 때문에 trim 매치가 어차피 실패해
    // `!inFence` 가드를 지워도 초록이었다(가드가 장식이던 상태). 이 케이스가 그 가드를 문다 —
    // 펜스 안에 접미사 없는 진짜 import 줄을 두면, 가드 없이는 "이미 있다"로 오판해
    // 실 import 를 추가하지 않고, Claude Code 는 펜스 안을 무시하므로 하네스가 로드되지 않는다.
    const user = "# p\n\n```\n@CLAUDE-uzys-harness.md\n```\n";
    const out = upsertHarnessImport(user, { projectName: "p", tracks: ["tooling"] });
    // 파일 전체 실줄 = 펜스 안 1 + 펜스 밖 관리 1 = 2. 관리 대상은 펜스 밖 1줄이다.
    expect(importCount(out)).toBe(2);
    expect(out).toContain("```\n@CLAUDE-uzys-harness.md\n```");
    // idempotent 재실행에도 펜스 밖 줄이 또 늘면 안 된다.
    expect(upsertHarnessImport(out, { projectName: "p", tracks: ["tooling"] })).toBe(out);
  });

  // ADR-085 — 상시 스킬 안내는 관리 블록 **안**에, 깔린 것만.
  describe("관리 블록 안의 상시 스킬 안내 (ADR-085)", () => {
    const opts = (skills: string[]) => ({
      projectName: "p",
      tracks: ["tooling"] as const,
      continuousSkills: skills,
    });
    const NOTE = "## Skills that apply continuously";

    it("깔린 상시 스킬만 적고, 상시 스킬이 아닌 것은 적지 않는다", () => {
      const out = upsertHarnessImport(null, opts(["task-brief", "north-star"]));
      expect(out).toContain(NOTE);
      expect(out).toContain("`task-brief`");
      expect(out).not.toContain("`north-star`");
      expect(out).not.toContain("`clear-korean-communication`"); // 안 깔린 상시 스킬
      expect(importCount(out)).toBe(1);
    });

    it("상시 스킬이 하나도 없으면 안내 절 자체가 없다 — 한 줄도 상주시키지 않는다", () => {
      const out = upsertHarnessImport(null, opts(["north-star"]));
      expect(out).not.toContain(NOTE);
      expect(importCount(out)).toBe(1);
    });

    it("안내는 마커 블록 안에 있다 — uninstall 이 블록만 도려내면 안내도 같이 사라진다", () => {
      const out = upsertHarnessImport(null, opts(["task-brief"]));
      const start = out.indexOf("<!-- uzys-harness:import:start -->");
      const end = out.indexOf("<!-- uzys-harness:import:end -->");
      expect(out.indexOf(NOTE)).toBeGreaterThan(start);
      expect(out.indexOf(NOTE)).toBeLessThan(end);
    });

    it("재실행이 블록을 현행화한다 — 스킬을 빼면 안내가 빠지고 사용자 본문은 그대로", () => {
      const user = "# p\n\n우리 팀 규칙:\n- 커밋은 한국어로\n";
      const withNote = upsertHarnessImport(user, opts(["task-brief"]));
      expect(withNote).toContain(NOTE);
      const refreshed = upsertHarnessImport(withNote, opts([]));
      expect(refreshed).not.toContain(NOTE);
      expect(refreshed).toContain("- 커밋은 한국어로");
      expect(importCount(refreshed)).toBe(1);
      // 같은 선택으로 다시 돌리면 바이트 동일(파일을 만지지 않는다).
      expect(upsertHarnessImport(withNote, opts(["task-brief"]))).toBe(withNote);
    });
  });
});
