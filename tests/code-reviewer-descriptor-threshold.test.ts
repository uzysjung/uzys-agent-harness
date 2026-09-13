import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * `code-reviewer` 발화 조건의 회귀 게이트 (ADR-087).
 *
 * 두 사본(배포판 `templates/agents/` · 이 리포 `.claude/agents/`)의 descriptor 는 ECC 원본의
 * *"MUST BE USED for all code changes"* 였다 — 수정마다 리뷰 에이전트를 띄우는 무조건 지시.
 * 사용자 결정(#424 · #423)으로 씬 완료 · 문턱 위 머지 전으로 바꿨다. 원문은
 * `.claude/local-plugins/ecc/agents/code-reviewer.md` 에 그대로 남아 있어 **ECC 재동기화 한 번이면
 * 되돌아온다** — 이 게이트는 그 경로만 본다. 문장의 뜻은 읽지 않는다(`change-management`
 * §자산은 자기 변경 요청 없이 건드리지 않는다 — 어휘 게이트 3회 우회 실측). 원문 토큰 하나와
 * 두 사본의 동일성만 단언한다.
 */
const ROOT = resolve(__dirname, "..");
const description = (path: string): string => {
  const text = readFileSync(join(ROOT, path), "utf8");
  const m = text.match(/^description:\s*(.+)$/m);
  if (!m?.[1]) throw new Error(`${path}: description 줄이 없다`);
  return m[1];
};

const SHIPPED = "templates/agents/code-reviewer.md";
const REPO = ".claude/agents/code-reviewer.md";
/**
 * ECC 원본 descriptor 축자(`.claude/local-plugins/ecc/agents/code-reviewer.md`, 2026-09-13).
 * 파일이 아니라 상수인 이유: 그 디렉터리는 gitignore 라 CI·새 클론에 없다 — 파일을 읽으면
 * 게이트가 우리가 못 고치는 것 때문에 상시 red 가 된다(`frontmatter-yaml.test.ts` 가 같은 이유로
 * 그 디렉터리를 제외한다). canary 가 지키는 것은 "탐지기가 원문 형태를 문다" 이고, 그것은
 * 원문 문장 하나면 충분하다.
 */
const UPSTREAM_DESCRIPTION =
  "Expert code review specialist. Proactively reviews code for quality, security, and maintainability. Use immediately after writing or modifying code. MUST BE USED for all code changes.";

describe("code-reviewer descriptor — 수정마다가 아니라 씬 완료 · 문턱 위 머지 전 (ADR-087)", () => {
  it("ECC 원본의 무조건 지시 토큰이 두 사본 어디에도 없다", () => {
    for (const path of [SHIPPED, REPO]) {
      expect(
        description(path),
        `${path} 가 ECC 원문으로 되돌아왔다 — 재동기화 경로를 확인하라`,
      ).not.toMatch(/MUST BE USED/);
    }
  });

  it("배포판과 이 리포 사본의 descriptor 가 같다 — 설치자와 우리가 다른 문턱을 받지 않는다", () => {
    expect(description(REPO)).toBe(description(SHIPPED));
  });

  it("canary — ECC 원문 형태에는 그 토큰이 있다(탐지기가 문다)", () => {
    expect(UPSTREAM_DESCRIPTION).toMatch(/MUST BE USED/);
    // 두 사본이 원문과 실제로 다르다 — 같으면 위 두 단언은 공허하다.
    expect(description(SHIPPED)).not.toBe(UPSTREAM_DESCRIPTION);
  });
});
