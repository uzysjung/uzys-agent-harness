import { readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { listFilesRecursive } from "../src/fs-ops.js";

/**
 * 우리가 내보내는 `.md` 의 frontmatter 가 **YAML 로 읽히는가**.
 *
 * 왜 게이트인가: `templates/agents/implementer.md` 의 `description` 이 따옴표 없이
 * `... from deciding to building: a feature ...` 를 담고 있었다. YAML 의 plain scalar 안에서
 * `콜론+공백`은 중첩 매핑의 시작으로 읽히므로 엄격한 파서는 거기서 죽는다 —
 * *"mapping values are not allowed in this context at line 2 column 174"*. 사용자가 마크다운
 * 프리뷰에서 그 에러를 봤고, 독립 파서(Ruby Psych)로 같은 메시지·같은 열을 재현했다.
 *
 * Claude Code 자신은 관대해서 이 파일도 읽었다. 그래서 **아무도 안 물었다** — 한 소비자가
 * 너그럽다는 사실은 계약이 아니고, 우리는 이 파일을 남의 저장소에 설치한다.
 *
 * **검사 범위는 이 결함 종류 하나다**(plain scalar 안의 `: `). 전체 YAML 문법을 보려면 파서를
 * 의존성으로 들여야 하는데, 3줄짜리 frontmatter 하나 때문에 그러지는 않는다. 대신 탐지기가
 * 실제로 무는지를 canary 로 먼저 보인다 — 빈 결과는 부재의 증거가 아니다.
 */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** `---` 로 시작하는 파일의 frontmatter 본문. 없으면 null. */
function frontmatterOf(raw: string): string | null {
  if (!raw.startsWith("---\n")) return null;
  const end = raw.indexOf("\n---", 3);
  return end < 0 ? null : raw.slice(4, end);
}

/**
 * frontmatter 의 `description` 값. 없으면 null.
 *
 * folded scalar(`>-`)를 한 줄로 접어 길이를 잰다 — 공식 상한이 그 값에 걸리기 때문이다.
 * 들여쓰기가 풀리는 첫 줄에서 멈춘다(다음 키의 시작).
 */
function descriptionOf(frontmatter: string): string | null {
  const lines = frontmatter.split("\n");
  const at = lines.findIndex((l) => /^description:/.test(l));
  if (at < 0) return null;
  const head = (lines[at] as string).replace(/^description:[ \t]*/, "");
  if (!/^(>-?|\|-?)$/.test(head.trim())) return head.trim().replace(/^["']|["']$/g, "");
  const body: string[] = [];
  for (let i = at + 1; i < lines.length; i++) {
    const line = lines[i] as string;
    if (line.trim() === "") continue;
    if (!/^[ \t]/.test(line)) break;
    body.push(line.trim());
  }
  return body.join(" ");
}

/** 공식 상한 (platform.claude.com Agent Skills, 실측 2026-08-30). */
const DESCRIPTION_LIMIT = 1024;

interface Violation {
  line: number;
  key: string;
  column: number;
  excerpt: string;
}

/**
 * plain scalar 안의 `콜론+공백`(또는 줄 끝 콜론)을 찾는다.
 *
 * 따옴표·flow(`[`/`{`)·블록(`>`/`|`)으로 시작하는 값은 plain scalar 가 아니라 건너뛴다.
 * 들여쓴 줄도 안 본다 — 블록 스칼라의 본문일 수 있어 키:값으로 읽으면 오탐이 된다.
 * `https://` 처럼 콜론 뒤가 공백이 아닌 것은 YAML 이 허용하므로 걸리지 않는다.
 */
function plainScalarColonViolations(frontmatter: string): Violation[] {
  const out: Violation[] = [];
  frontmatter.split("\n").forEach((line, i) => {
    const m = line.match(/^([A-Za-z0-9_.-]+):[ \t]+(.*)$/);
    if (!m) return;
    const [, key, value] = m as unknown as [string, string, string];
    if (value === "" || /^["'[{>|&*!]/.test(value)) return;
    const at = value.search(/:(\s|$)/);
    if (at < 0) return;
    out.push({
      line: i + 2, // +1 for 0-index, +1 for the opening `---`
      key,
      column: key.length + 2 + at + 1,
      excerpt: value.slice(Math.max(0, at - 24), at + 16),
    });
  });
  return out;
}

/**
 * 우리 소유의 `.md` 만 본다.
 *
 * `.claude/local-plugins/` 는 ECC 플러그인이 통째로 들여온 남의 산출물이다(그쪽 번역 문서에
 * 같은 위반이 13건 있지만 우리가 고칠 파일이 아니다). 여기를 안 빼면 게이트가 우리가 못 고치는
 * 것 때문에 상시 red 가 되고, 상시 red 인 게이트는 아무도 안 돌린다(#237 이 없앤 관행).
 */
function ownedMarkdown(): string[] {
  const roots = [
    "templates",
    ".claude/agents",
    ".claude/rules",
    ".claude/skills",
    ".claude/commands",
  ];
  return roots.flatMap((r) =>
    listFilesRecursive(join(ROOT, r))
      .filter((rel) => rel.endsWith(".md"))
      .map((rel) => join(r, rel)),
  );
}

describe("frontmatter 가 YAML 로 읽힌다", () => {
  const files = ownedMarkdown();

  it("탐지기 자기검증 — 알려진 양성이 잡힌다 (canary)", () => {
    // 이 문자열이 실제로 죽은 그 값이다. 여기가 0건이면 아래 "위반 없음"은 증거가 아니다.
    const bad = plainScalarColonViolations(
      "name: implementer\ndescription: work moves from deciding to building: a feature, a bug fix.",
    );
    expect(bad).toHaveLength(1);
    expect(bad[0]?.key).toBe("description");
  });

  it("음성 대조 — 정상 표기는 안 잡힌다 (오탐 가드)", () => {
    expect(
      plainScalarColonViolations(
        [
          'description: "work moves from deciding to building: a feature."', // 따옴표
          'tools: ["Read", "Write"]', // flow 시퀀스
          "homepage: https://example.com/a", // 콜론 뒤가 공백이 아니다
          "allowed-tools: Bash(git status:*)",
          "model: opus",
        ].join("\n"),
      ),
    ).toEqual([]);
  });

  it("전제 확인 — 검사할 파일이 실제로 있다 (게이트가 죽지 않았는가)", () => {
    const withFm = files.filter((f) => frontmatterOf(readFileSync(join(ROOT, f), "utf8")) !== null);
    expect(withFm.length).toBeGreaterThan(20);
  });

  it("우리 소유 파일에 plain scalar 콜론 위반이 없다", () => {
    const found: string[] = [];
    for (const rel of files) {
      const fm = frontmatterOf(readFileSync(join(ROOT, rel), "utf8"));
      if (fm === null) continue;
      for (const v of plainScalarColonViolations(fm)) {
        found.push(
          `${relative(ROOT, join(ROOT, rel))}:${v.line} [${v.key}] col ${v.column} → …${v.excerpt}…`,
        );
      }
    }
    expect(
      found,
      `frontmatter 값 안의 \`콜론+공백\`은 YAML 매핑의 시작으로 읽혀 엄격한 파서가 죽는다.\n` +
        `값을 따옴표로 감싸라 (형제 파일 data-analyst·reviewer·strategist 가 이미 그렇게 한다):\n` +
        found.map((f) => `  ${f}`).join("\n"),
    ).toEqual([]);
  });

  it("배포판과 개발 사본을 **양쪽 다** 훑는다 (한쪽만 고치는 것을 막는다)", () => {
    // 두 트리의 내용이 같아야 한다는 뜻이 아니다 — `templates/` 는 배포물이고 `.claude/` 는
    // 우리 개발용이라 **의도적으로 다르다**(9개 중 2개가 지금도 다르다). 여기서 고정하는 것은
    // 검사 대상에 두 트리가 다 들어 있다는 사실이다. 실제 결함이 양쪽에 있었고, 한쪽만 봤다면
    // 사용자는 고쳐진 것을 받고 우리는 깨진 것을 계속 썼거나 그 반대가 됐다.
    expect(files.some((f) => f.startsWith("templates/agents/"))).toBe(true);
    expect(files.some((f) => f.startsWith(".claude/agents/"))).toBe(true);
  });
});

/**
 * 스킬 `description` 은 **매 세션 상주**하고, 공식 상한은 **1,024자**다
 * (platform.claude.com Agent Skills — "YAML frontmatter requirements ... specific validation
 * rules", 2026-08-30 실측). 초과 시 무슨 일이 나는지는 **문서에 없다** — Claude Code 는
 * 1,362자짜리를 거절하지 않고 실어 준 관측이 있다. 그래서 이 게이트가 무는 것은 "잘린다"가
 * 아니라 **공표된 검증 규칙을 우리가 어긴 채 남의 저장소에 설치한다**는 사실이다.
 *
 * 하필 잘릴 자리가 나쁘다는 것이 이 상한을 지킬 실질적 이유다 — 초과분 6종은 전부 끝에
 * **트리거 문구와 `Do NOT` 경계절**을 달고 있었다(#333 실측). 상한에서 끊기면 발화 조건과
 * 금지 조건이 먼저 사라진다.
 *
 * **글롭이다, 열거가 아니다.** 자산 목록을 여기 적으면 그 목록이 두 번째 하드코딩 사본이 되어
 * 썩는다 — 이 저장소가 5회 재발로 배운 형태다. 상한 검사가 자산 하나에만 붙어 있어 나머지
 * 27종이 무검사였던 것이 #333 이다.
 */
describe("스킬 description 이 공식 상한 안에 든다", () => {
  const skills = ownedMarkdown().filter((f) => f.endsWith("/SKILL.md"));

  it("탐지기 자기검증 — 상한 초과가 잡힌다 (canary)", () => {
    const over = `description: >-\n  ${"가".repeat(600)}\n  ${"나".repeat(600)}`;
    expect(descriptionOf(over)?.length).toBeGreaterThan(DESCRIPTION_LIMIT);
  });

  it("음성 대조 — 상한 안은 안 잡히고, 접기·따옴표가 길이를 왜곡하지 않는다", () => {
    expect(descriptionOf(`description: >-\n  ${"a".repeat(1000)}`)?.length).toBe(1000);
    // 접은 줄은 공백 하나로 이어진다 — 두 줄이면 1 + 1 + 1 = 3.
    expect(descriptionOf("description: >-\n  a\n  b")).toBe("a b");
    // plain scalar 와 따옴표 표기도 같은 값을 낸다.
    expect(descriptionOf("name: x\ndescription: hello\nmodel: opus")).toBe("hello");
    expect(descriptionOf('description: "hello"')).toBe("hello");
    // description 이 없으면 null — 없는 것을 0자로 읽어 통과시키면 안 된다.
    expect(descriptionOf("name: x")).toBeNull();
  });

  it("전제 확인 — 검사할 SKILL.md 가 실제로 있다 (0건 통과 방지)", () => {
    expect(skills.length, "SKILL.md 를 하나도 못 찾았다 — 글롭이 죽었다").toBeGreaterThan(20);
    const withDesc = skills.filter(
      (f) => descriptionOf(frontmatterOf(readFileSync(join(ROOT, f), "utf8")) ?? "") !== null,
    );
    expect(withDesc.length, "description 추출이 전부 실패했다").toBe(skills.length);
  });

  it("모든 SKILL.md 의 description 이 1,024자 이내다", () => {
    const over: string[] = [];
    for (const rel of skills) {
      const fm = frontmatterOf(readFileSync(join(ROOT, rel), "utf8"));
      const description = fm === null ? null : descriptionOf(fm);
      if (description === null) continue;
      if (description.length > DESCRIPTION_LIMIT) {
        over.push(`${rel} → ${description.length}자 (+${description.length - DESCRIPTION_LIMIT})`);
      }
    }
    expect(
      over,
      `검사한 SKILL.md ${skills.length}개 중 ${over.length}개가 공식 상한 ` +
        `${DESCRIPTION_LIMIT}자를 넘겼다. 끝에 붙은 트리거·\`Do NOT\` 절이 먼저 잘릴 자리다 — ` +
        `중복 트리거 열거부터 줄이고 금지절은 남겨라:\n` +
        over.map((o) => `  ${o}`).join("\n"),
    ).toEqual([]);
  });
});
