import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * 번들 스킬이 **자기 파일**을 Claude 자리 경로(`.claude/skills/<자기 id>/…`)로 박지 않는다 (#729).
 *
 * WHY: 스킬 디렉터리는 두 자리에 깔린다 — Claude Code 는 `.claude/skills/<id>/`, Codex · OpenCode ·
 * Antigravity 는 `.agents/skills/<id>/`. 포팅(`src/codex/skills.ts` portBody)은 본문의 경로 문자열을
 * 바꾸지 않으므로, `bash .claude/skills/<id>/scripts/x.sh` 같은 예시는 `.agents/` 설치본에서 **없는
 * 경로**를 가리킨다. `external-model-consult` 가 예시 10줄로 그 상태를 실제로 배송했다(v26.168.0
 * 설계 §1.1 ⓔ). 자기 파일은 "읽은 SKILL.md 의 디렉터리" 기준으로 가리킨다.
 *
 * 뜻을 읽지 않는다 — 자기 id 가 박힌 경로라는 **형태**만 문다. 다른 스킬 · 설치 위치를 설명하는
 * `.claude/skills/<다른 id>` 언급은 대상이 아니다.
 */

const SKILLS_DIR = fileURLToPath(new URL("../templates/skills/", import.meta.url));

function textFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return textFiles(p);
    return /\.(md|sh|ya?ml)$/.test(e.name) ? [p] : [];
  });
}

function selfSlotHits(id: string, files: readonly string[]): string[] {
  const needle = `.claude/skills/${id}/`;
  return files.flatMap((f) =>
    readFileSync(f, "utf8")
      .split("\n")
      .flatMap((line, i) => (line.includes(needle) ? [`${f}:${i + 1}  ${line.trim()}`] : [])),
  );
}

describe("번들 스킬의 자기 파일 경로", () => {
  const ids = readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);

  it("모집단이 비지 않았다", () => {
    expect(ids).toContain("external-model-consult");
  });

  it("자기 파일을 `.claude/skills/<자기 id>/` 로 가리키는 배포 파일이 0건", () => {
    const hits = ids.flatMap((id) => selfSlotHits(id, textFiles(join(SKILLS_DIR, id))));
    expect(
      hits,
      `.agents/skills/ 설치본에서 없는 경로가 된다 — 읽은 SKILL.md 의 디렉터리 기준으로 써라:\n${hits.join("\n")}`,
    ).toEqual([]);
  });
});
