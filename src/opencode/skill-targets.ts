/**
 * #531 (Epic #527 S3) — OpenCode 자리(`.agents/skills/<id>/`)에 **있어야 하는** 번들 스킬과,
 * `update` 가 그 자리를 채울 수 있게 해 주는 writer 래퍼.
 *
 * `update` 는 `refreshOnly` 로 "디스크에 이미 있는 파일만" 갱신한다(ADR-049). 그 판정이
 * 새 릴리즈가 **더한** 번들 스킬에는 반대로 작동한다 — 파일이 없는 이유가 "안 골라서"가 아니라
 * "그때는 없던 자산이라서"인데 update 가 영영 건너뛴다. `.claude/` 쪽은 `installNewSkillDirs`
 * 가 따로 깔아 주지만 그 함수는 **claude 가 깔린 집합에 있을 때 `.claude/skills/` 만** 본다 —
 * Epic #527 S3 가 "확인된 결함"으로 지목한 자리가 여기다.
 */

import { join, sep } from "node:path";
import { isBaselineExcluded } from "../baseline-targets.js";
import { readInstallLog } from "../install-log.js";
import { buildAssetSpec } from "../manifest.js";
import type { OwnedWriter, WriteOptions } from "../owned-write.js";
import { DEFAULT_OPTIONS, TRACKS, type Track } from "../types.js";

/**
 * 이 프로젝트가 가져야 할 번들 스킬 id.
 *
 * 판정을 새로 만들지 않고 **기존 것을 부른다**: 트랙 구성이 기본 옵션으로 고르는 번들 스킬
 * (`buildAssetSpec` 의 `selectedInternalSkills` — `installNewSkillDirs` 가 manifest `applies`
 * 로 재는 것과 같은 판정) 에서 설치 때 해제한 것(`skillExclude` #505 · `baselineExclude`
 * ADR-074)을 뺀다.
 *
 * **설치 기록이 없거나 트랙을 모르면 빈 배열이다.** 무엇이 기본인지 모르는 채로 만들면
 * "안 고른 것은 안 만든다"가 무너진다 — 레거시(로그 없는) 설치본에서 `refreshOnly` 가
 * 디스크로 대신하던 판정을 여기서 깨뜨리지 않기 위한 보수적 기본값이다.
 */
export function bundledSkillTargets(projectDir: string): string[] {
  const log = readInstallLog(projectDir);
  if (log === null) return [];
  const tracks = log.spec.tracks.filter((t): t is Track =>
    (TRACKS as ReadonlyArray<string>).includes(t),
  );
  if (tracks.length === 0) return [];
  const skillExcluded = new Set(log.spec.skillExclude ?? []);
  const baselineExcluded = new Set(log.spec.baselineExclude ?? []);
  return buildAssetSpec({ tracks, options: DEFAULT_OPTIONS }).selectedInternalSkills.filter(
    (id) => !skillExcluded.has(id) && !isBaselineExcluded(`.claude/skills/${id}`, baselineExcluded),
  );
}

/**
 * `ids` 에 해당하는 `.agents/skills/<id>/` 아래 쓰기에만 `createInRefresh` 를 얹은 writer.
 *
 * `createInRefresh` 는 **그 CLI 가 설치돼 있다는 별도 증거**를 잡은 호출부만 쓸 수 있다
 * (`owned-write.ts`). 여기서의 증거는 호출 경로 자체다 — `update` 는 설치 로그의 CLI 집합
 * (`installedClis`, #514 → #528)으로 거른 CLI 의 transform 만 부른다. opencode transform 이
 * `refreshOnly` 로 돌고 있다는 것이 곧 "opencode 가 이 프로젝트에 깔려 있다" 다.
 *
 * 프록시로 얹는 이유: 스킬 디렉터리 루프의 SSOT 는 세 transform 공용
 * `writeBundledSkillDirs`(#431) 하나이고, 거기에 CLI 별 예외를 넣으면 그 루프가 다시 갈린다.
 * 누적(기준선·백업·카운트)은 원본 writer 하나가 그대로 쥔다.
 */
export function allowSkillCreation(
  writer: OwnedWriter,
  projectDir: string,
  ids: ReadonlyArray<string>,
): OwnedWriter {
  if (ids.length === 0) return writer;
  const roots = ids.map((id) => `${join(projectDir, ".agents", "skills", id)}${sep}`);
  return {
    write(absPath: string, content: string, opts?: WriteOptions): boolean {
      const inTarget = roots.some((root) => absPath.startsWith(root));
      return writer.write(absPath, content, inTarget ? { ...opts, createInRefresh: true } : opts);
    },
    result: () => writer.result(),
  };
}
