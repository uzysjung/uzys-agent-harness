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
});
