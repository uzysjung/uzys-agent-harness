/**
 * linked-skill-bodies.ts — `.claude/skills/<id>` 가 이 프로젝트의 `.agents/skills/<id>` 를 가리키는
 * 링크일 때, `install`(add) 이 그 **공유 본문**을 갱신한다 (#524 · Epic #527 S4).
 *
 * 왜 add 만인가: `update` 에서는 깔린 CLI 전부의 변환이 refresh 로 돌아 `.agents/skills/<id>` 가
 * 이미 최신판이 된다(`update-mode.ts` refreshExternalCli). 남는 구멍은 `install --cli claude` 처럼
 * 요청한 CLI 의 변환만 도는 add 다 — 링크 자리는 `.claude/` 쪽에서 "남의 것"으로 건너뛰고,
 * `.agents/` 쪽 변환은 이번 실행에 없어 아무도 본문을 안 쓴다. 그래서 update 에서는 여기를
 * 부르지 않는다(같은 파일을 두 주체가 쓰지 않게).
 *
 * 바이트 정본은 `.agents/skills/` 를 쓰는 변환과 **같은 함수**(`writeBundledSkillDirs` — 포팅판)다.
 * 원문(Claude 판)을 쓰면 그 자리를 네이티브로 읽는 Codex·OpenCode·Antigravity 가 존재하지 않는
 * `/uzys:` 커맨드를 안내받고, 같은 실행에 외부 변환이 있으면 두 주체가 한 파일을 서로 다른 바이트로
 * 번갈아 쓴다. 같은 함수를 쓰니 외부 변환이 먼저 썼으면 여기는 `current === content` 로 no-op 이다.
 */
import { join } from "node:path";
import { writeBundledSkillDirs } from "./codex/skills.js";
import type { InstallLogSkillFile } from "./install-log.js";
import type { OutsideLink } from "./outside-project.js";
import { createOwnedWriter } from "./owned-write.js";

export interface LinkedSkillBodies {
  /** 공유 본문을 최신 포팅판으로 맞춘 id (이미 최신이라 쓰지 않은 것 포함). */
  updated: string[];
  /** 공유 본문이 우리 기록(`externalFiles`)에 없어 **건드리지 않은** id — 다른 도구가 채운 자리다. */
  notOurs: string[];
  /** 이번에 담당한 파일의 기준선 — 설치 로그 `externalFiles` 에 합친다. */
  files: InstallLogSkillFile[];
  /** 설치자가 고친 본문이라 남긴 백업의 절대경로. */
  backupPaths: string[];
  /** 공유 본문 **안**이 남의 것(파일 링크 등)이라 쓰지 않은 자리. */
  foreignOwned: string[];
  /** #678 — 공유 본문의 실체가 프로젝트 밖이라 쓰지 않은 자리. */
  outside: OutsideLink[];
}

/**
 * @param baseline `externalFiles` 기준선 — **이번 실행의 외부 변환 결과까지 합친 것**. 먼저 도는
 *   변환이 방금 쓴 바이트를 모르면 여기서 그걸 "설치자 편집"으로 읽고 백업한다.
 *
 * 규칙 = `owned-write.ts` 의 표 하나(기준선과 같으면 조용히 · 다르면 백업) + 더 보수적인 예외 하나:
 * `.agents/skills/<id>/SKILL.md` 가 기준선에 **없으면** 그 id 는 아예 쓰지 않는다. 표의 "기록
 * 없음 → 보수적 백업"은 우리가 새로 만드는 자리의 규칙이고, 이 자리는 **남이 이미 채운** 본문이다
 * — 링크를 건 것은 설치자지만 그 안을 누가 채웠는지는 기록만 말할 수 있다(디스크 존재는 소유가
 * 아니다, ADR-096 D6).
 */
export function refreshLinkedSkillBodies(params: {
  harnessRoot: string;
  projectDir: string;
  ids: ReadonlyArray<string>;
  baseline: ReadonlyMap<string, string>;
}): LinkedSkillBodies {
  const { harnessRoot, projectDir, ids, baseline } = params;
  const bodyKey = (id: string): string => `.agents/skills/${id}/SKILL.md`;
  const ours = ids.filter((id) => baseline.has(bodyKey(id)));
  const writer = createOwnedWriter(projectDir, baseline);
  const written = new Set(
    writeBundledSkillDirs({ harnessRoot, projectDir, skillIds: ours, writer }),
  );
  const result = writer.result();
  return {
    updated: ours.filter((id) => written.has(join(projectDir, bodyKey(id)))),
    notOurs: ids.filter((id) => !baseline.has(bodyKey(id))),
    files: result.files,
    backupPaths: result.backupPaths,
    foreignOwned: result.foreignOwned,
    outside: result.outside ?? [],
  };
}
