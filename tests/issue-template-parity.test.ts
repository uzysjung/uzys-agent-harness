import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * `.github/ISSUE_TEMPLATE/` 가 스킬 원본과 **같은 절 구성**인지 (#319).
 *
 * WHY: 같은 구조를 두 곳에 두기로 한 결정 자체가 drift 를 만든다 — 이 저장소는 그 형태로
 * 5회 재발한 이력이 있다. 그래서 기대 절 목록을 여기 **열거하지 않고 원본에서 유도**한다:
 * 원본이 개정되면 이 게이트가 자동으로 새 기준을 쓴다.
 *
 * **문면이 아니라 구조만 본다.** 절 제목의 뜻이 옳은지는 사람이 읽어 판정한다
 * (`.claude/rules/change-management.md` — 의미를 무는 자동 검사는 만들지 마라).
 *
 * 배포물은 대상이 아니다: `.github/ISSUE_TEMPLATE/` 는 이 저장소에만 두기로 했다(#319 ⓐ).
 */
const ROOT = resolve(__dirname, "..");
const SRC = join(ROOT, "templates/skills/gh-issue-workflow/ISSUE.template.md");
const DEST = join(ROOT, ".github/ISSUE_TEMPLATE");

/** 원본의 한 변형(`# 변형 X …` ~ 다음 `# ` 또는 끝) 안의 `## ` 제목들. */
function sectionsOfVariant(marker: string): string[] {
  const raw = readFileSync(SRC, "utf8");
  const start = raw.indexOf(`# 변형 ${marker}`);
  if (start < 0) throw new Error(`원본에서 "변형 ${marker}" 를 못 찾았다 — 이 판정은 무효다`);
  // 다음 **변형** 까지만 자른다. 아무 `# ` 로 자르면 코드펜스 안의 bash 주석
  // (`# 실제 출력 …`)에서 끊겨 변형 A 가 절반만 잡힌다 — 실제로 그랬다.
  const rest = raw.slice(start + 1);
  const nextTop = rest.search(/\n# 변형 /);
  return (nextTop < 0 ? rest : rest.slice(0, nextTop))
    .split("\n")
    .filter((l) => l.startsWith("## "))
    .map((l) => l.slice(3).trim());
}

function sectionsOfFile(name: string): string[] {
  const p = join(DEST, name);
  if (!existsSync(p)) throw new Error(`${name} 이 없다`);
  return readFileSync(p, "utf8")
    .split("\n")
    .filter((l) => l.startsWith("## "))
    .map((l) => l.slice(3).trim());
}

describe("이슈 템플릿이 스킬 원본과 같은 절 구성인가 (#319)", () => {
  // 모집단 0 은 "전부 통과"가 아니라 "아무것도 안 쟀다"다.
  it("원본에서 절을 실제로 읽어온다", () => {
    expect(sectionsOfVariant("A").length, "변형 A 의 절을 못 읽었다").toBeGreaterThan(3);
    expect(sectionsOfVariant("B").length, "변형 B 의 절을 못 읽었다").toBeGreaterThan(3);
  });

  it("task.md · bug.md 가 변형 A 와 같은 절 구성", () => {
    const expected = sectionsOfVariant("A");
    for (const f of ["task.md", "bug.md"]) {
      expect(sectionsOfFile(f), `${f} 의 절 구성이 원본 변형 A 와 다르다`).toEqual(expected);
    }
  });

  it("epic.md 가 변형 B 와 같은 절 구성", () => {
    expect(sectionsOfFile("epic.md"), "epic.md 의 절 구성이 원본 변형 B 와 다르다").toEqual(
      sectionsOfVariant("B"),
    );
  });

  it("GitHub 이 읽는 frontmatter 를 갖는다 (name/about)", () => {
    for (const f of ["task.md", "bug.md", "epic.md"]) {
      const raw = readFileSync(join(DEST, f), "utf8");
      expect(raw.startsWith("---\n"), `${f} 에 frontmatter 가 없다`).toBe(true);
      expect(raw, `${f} 에 name: 이 없다`).toMatch(/\nname: \S/);
      expect(raw, `${f} 에 about: 이 없다`).toMatch(/\nabout: \S/);
    }
  });
});
