/**
 * #431 — 번들 스킬 **디렉터리 도달**을 재는 테스트들이 공유하는 유도기.
 *
 * 대상 스킬 id 와 기대 파일 목록을 **열거하지 않는다**. 이 리포에서 열거는 자산이 하나
 * 개편되는 순간 조용히 썩는다 — `scenario-dev-method-skills.sh` 가 박아 둔 이름 하나로
 * 26일간 red 였던 전례가 그 형태다. 그래서 둘 다 `templates/skills/` 를 훑어서 만든다.
 */

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { listFilesRecursive } from "../../src/fs-ops.js";

/** 번들 스킬 소스 디렉터리. */
export function bundledSkillDir(harnessRoot: string, id: string): string {
  return join(harnessRoot, "templates/skills", id);
}

/**
 * `references/` 를 가진 **첫** 번들 스킬 id (이름 정렬). 참조 파일이 실재하는 스킬이어야
 * "형제 파일이 도달한다"를 실제로 재게 된다 — 없는 스킬을 고르면 단언이 0건을 통과한다.
 */
export function firstSkillIdWithReferences(harnessRoot: string): string {
  const root = join(harnessRoot, "templates/skills");
  const ids = readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  for (const id of ids) {
    if (!existsSync(join(root, id, "SKILL.md"))) continue;
    const refs = join(root, id, "references");
    if (!existsSync(refs)) continue;
    if (listFilesRecursive(refs).length === 0) continue;
    return id;
  }
  throw new Error(
    "templates/skills/ 에 references/ 를 가진 스킬이 없다 — 이 테스트는 아무것도 재지 못한다",
  );
}

/**
 * **설치된** 스킬 중 `references/` 를 가진 첫 id. `skillsRoot` 는 설치 자리
 * (`.agents/skills` 또는 `.claude/skills`). 설치 결과에서 유도하므로 "그 스킬이 이 트랙에서
 * 실제로 깔리는가"를 테스트가 알 필요가 없다 — 조건(`condition`)이 바뀌어도 안 썩는다.
 */
export function installedSkillIdWithReferences(harnessRoot: string, skillsRoot: string): string {
  const installed = existsSync(skillsRoot)
    ? readdirSync(skillsRoot, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .sort()
    : [];
  for (const id of installed) {
    const refs = join(bundledSkillDir(harnessRoot, id), "references");
    if (existsSync(refs) && listFilesRecursive(refs).length > 0) return id;
  }
  throw new Error(
    `${skillsRoot} 에 references/ 를 가진 번들 스킬이 없다 — 이 테스트는 아무것도 재지 못한다`,
  );
}

/**
 * `templates/skills/<id>/` 에서 기대 산출물 상대경로를 유도한다 (닷파일·닷디렉터리 제외).
 * `.DS_Store` 같은 OS 부산물은 설치자 프로젝트로 나가지 않아야 한다.
 */
export function expectedSkillRelFiles(harnessRoot: string, id: string): string[] {
  return listFilesRecursive(bundledSkillDir(harnessRoot, id))
    .filter((rel) => !rel.split("/").some((segment) => segment.startsWith(".")))
    .sort();
}
